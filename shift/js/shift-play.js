/* The Shift - Part 2/2 hand flow / boot */
(function (global) {
  'use strict';
  const X = global.__SHIFT;
  if (!X) throw new Error('shift-floor.js must load before shift-play.js');
  const {
    SHIFT_MS, MAX_HANDS, GLANCE_MS, BET_OPTIONS, START_BANK,
    CAST, DEALER_LINES, state, $,
    logTalk, setDealerLine, setDealerName, dealerWho, advanceShoeOffscreen, dealSeen,
    initNpcs, npcChooseBet, npcShouldHit, handLabel, renderCardAreas,
    updateMeta, updateClock, showControls, setPhase,
    maybeQueueAmbient, fireAmbient,
    makeCounter, fmtMoney, rcText, sleep, pick,
  } = X;

  async function startHand() {
    if (state.phase === 'ended' || state.busy) return;
    state.busy = true;
    state.you.result = '';
    state.holeHidden = true;
    setDealerLine('');
    {
      const fracNow = state.shoe.remainingFraction ? state.shoe.remainingFraction() : 1;
      const hitCut = (state.shoe.needsReshuffle && state.shoe.needsReshuffle()) || fracNow <= 0.26;
      if (hitCut) {
        state.shoe.reset();
        state.counter.reset();
        state.cutWarned = false;
        const d = dealerWho();
        logTalk('table', 'New shoe.', true);
        logTalk(d, pick(['New shoe.', 'Fresh cards.', 'Shuffle up.']), false);
        setDealerLine('New shoe.');
        // Count resets with the shoe — no lecture. Start from the top.
      }
    }
    for (const c of CAST) {
      const npc = state.npcs[c.id];
      npc.result = '';
      npc.hand = new Hand();
      npc.bet = npcChooseBet(npc);
      if (npc.bet) npc.bank -= npc.bet;
    }
    if (!state.you.watching) {
      const b = state.you.bet;
      if (b > state.you.bank) {
        state.you.watching = true;
        state.you.bet = 0;
      } else {
        state.you.bank -= b;
      }
    }
    state.you.hand = typeof Hand === 'function' ? new Hand() : null;
    state.dealer.hand = typeof Hand === 'function' ? new Hand() : null;
    setPhase('dealing');
    showControls('ctrl-waiting');
    $('waiting-hint').textContent = state.you.watching ? 'Watching this hand...' : 'Cards out...';
    renderCardAreas();
    updateMeta();
    await sleep(350);
    const order = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present && n.bet > 0);
    const playerIn = !state.you.watching && state.you.bet > 0;
    for (const npc of order) {
      dealSeen(npc.hand);
      renderCardAreas();
      await sleep(180);
    }
    if (playerIn) {
      dealSeen(state.you.hand);
      renderCardAreas();
      await sleep(180);
    }
    dealSeen(state.dealer.hand);
    renderCardAreas();
    await sleep(180);
    for (const npc of order) {
      dealSeen(npc.hand);
      renderCardAreas();
      await sleep(180);
    }
    if (playerIn) {
      dealSeen(state.you.hand);
      renderCardAreas();
      await sleep(180);
    }
    dealSeen(state.dealer.hand); // hole
    renderCardAreas();
    await sleep(220);
    for (const npc of order) {
      if (npc.hand.isBlackjack && npc.hand.isBlackjack()) {
        npc.result = 'blackjack';
        renderCardAreas();
        continue;
      }
      while (npcShouldHit(npc.hand) && !npc.hand.isBust()) {
        dealSeen(npc.hand);
        renderCardAreas();
        await sleep(260);
      }
      if (npc.hand.isBust()) npc.result = 'bust';
      else npc.result = 'stand';
      renderCardAreas();
      await sleep(120);
    }
    if (playerIn) {
      if (state.you.hand.isBlackjack && state.you.hand.isBlackjack()) {
        state.you.result = 'blackjack';
        renderCardAreas();
        await dealerResolve(order, playerIn);
        return;
      }
      setPhase('player');
      showControls('ctrl-play');
      state.busy = false;
      renderCardAreas();
      return;
    }
    await dealerResolve(order, false);
  }
  async function playerHit() {
    if (state.phase !== 'player' || state.busy || state.you.watching) return;
    state.busy = true;
    dealSeen(state.you.hand);
    renderCardAreas();
    await sleep(200);
    if (state.you.hand.isBust()) {
      state.you.result = 'bust';
      showControls('ctrl-waiting');
      $('waiting-hint').textContent = 'Bust.';
      const order = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present && n.bet > 0);
      await dealerResolve(order, true);
      return;
    }
    if (state.you.hand.value() === 21) {
      showControls('ctrl-waiting');
      $('waiting-hint').textContent = 'Twenty-one.';
      const order = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present && n.bet > 0);
      await dealerResolve(order, true);
      return;
    }
    state.busy = false;
    renderCardAreas();
  }
  async function playerStand() {
    if (state.phase !== 'player' || state.busy || state.you.watching) return;
    state.you.result = 'stand';
    showControls('ctrl-waiting');
    $('waiting-hint').textContent = 'Dealer\'s turn...';
    const order = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present && n.bet > 0);
    await dealerResolve(order, true);
  }
  function compare(playerHand, dealerHand) {
    if (typeof compareHands === 'function') return compareHands(playerHand, dealerHand);
    if (playerHand.isBust()) return 'loss';
    if (playerHand.isBlackjack() && dealerHand.isBlackjack()) return 'push';
    if (playerHand.isBlackjack()) return 'blackjack';
    if (dealerHand.isBust()) return 'win';
    const pv = playerHand.value(), dv = dealerHand.value();
    if (pv > dv) return 'win';
    if (pv < dv) return 'loss';
    return 'push';
  }
  function settleBet(bet, result) {
    if (result === 'blackjack') return Math.floor(bet * 2.5); // stake already out \u2192 return 2.5x total credit
    if (result === 'win') return bet * 2;
    if (result === 'push') return bet;
    return 0; // loss - stake already deducted
  }
  function resultLabel(r) {
    return ({ win: 'win', loss: 'lose', push: 'push', blackjack: 'blackjack' })[r] || r;
  }
  async function dealerResolve(order, playerIn) {
    state.busy = true;
    setPhase('dealer');
    state.holeHidden = false;
    renderCardAreas();
    await sleep(400);
    while (state.dealer.hand.value() < 17) {
      dealSeen(state.dealer.hand);
      renderCardAreas();
      await sleep(280);
    }
    setPhase('settle');
    const dBust = state.dealer.hand.isBust();
    const dBJ = state.dealer.hand.isBlackjack && state.dealer.hand.isBlackjack();
    for (const npc of order) {
      let r;
      if (npc.result === 'bust') r = 'loss';
      else if (npc.result === 'blackjack') r = dBJ ? 'push' : 'blackjack';
      else r = compare(npc.hand, state.dealer.hand);
      const credit = settleBet(npc.bet, r);
      npc.bank += credit;
      if (r === 'win' || r === 'blackjack') npc.streak = Math.max(1, npc.streak + 1);
      else if (r === 'loss') npc.streak = Math.min(-1, npc.streak - 1);
      else npc.streak = 0;
      npc.result = resultLabel(r);
      npc.bet = 0;
    }
    if (playerIn && !state.you.watching) {
      let r;
      if (state.you.result === 'bust') r = 'loss';
      else if (state.you.result === 'blackjack') r = dBJ ? 'push' : 'blackjack';
      else r = compare(state.you.hand, state.dealer.hand);
      const credit = settleBet(state.you.bet, r);
      state.you.bank += credit;
      state.netPL += (credit - state.you.bet);
      state.you.result = resultLabel(r);
      state.handsBet++;
    } else {
      state.handsWatched++;
    }
    if (dBust) setDealerLine('Dealer busts.');
    else if (dBJ) setDealerLine('Dealer blackjack.');
    else setDealerLine(pick(['Checks out.', 'Good luck next one.', '']));
    state.handsPlayed++;
    renderCardAreas();
    updateMeta();
    await sleep(900);
    maybeQueueAmbient();
    fireAmbient();
    if (state.phase === 'ended') { state.busy = false; return; }
    if (state.handsPlayed >= MAX_HANDS || Date.now() - state.startedAt >= SHIFT_MS) {
      endShift();
      state.busy = false;
      return;
    }
    setPhase('between');
    showControls('ctrl-between');
    state.busy = false;
  }
  function endShift() {
    if (state.phase === 'ended') return;
    setPhase('ended');
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    showControls('ctrl-waiting');
    $('waiting-hint').textContent = 'Shift over.';
    state.holeHidden = false;
    renderCardAreas();
    const rc = state.counter.runningCount;
    const recap = [
      `Hands at the table: ${state.handsPlayed}`,
      `You watched ${state.handsWatched}, played ${state.handsBet}.`,
      `Bank: ${fmtMoney(state.you.bank)} (net ${state.netPL >= 0 ? '+' : ''}${state.netPL}).`,
      '',
      'No scoreboard. Just the job:',
    ].join('\n');
    $('end-recap').textContent = recap;
    $('rc-guess').value = '';
    $('end-result').hidden = true;
    $('btn-again').hidden = true;
    $('shift-end').hidden = false;
    state._endRC = rc;
    logTalk('table', 'Shift over.', true);
  }
  function submitRC() {
    const raw = $('rc-guess').value.trim();
    const guess = Number(raw);
    const actual = state._endRC;
    const out = $('end-result');
    out.hidden = false;
    if (raw === '' || !Number.isFinite(guess)) {
      out.textContent = 'Enter a number - that was the whole shift.';
      return;
    }
    const ok = guess === actual;
    if (ok) {
      out.textContent = `You kept it. Running count was ${rcText(actual)}.`;
    } else {
      const diff = Math.abs(guess - actual);
      out.textContent = `Off by ${diff}. Running count was ${rcText(actual)}. Next shift.`;
    }
    $('btn-again').hidden = false;
  }
  function glance() {
    const flash = $('glance-flash');
    if (!flash || state.phase === 'ended') return;
    const rc = state.counter ? state.counter.runningCount : 0;
    flash.textContent = rcText(rc);
    flash.hidden = false;
    clearTimeout(glance._t);
    glance._t = setTimeout(() => { flash.hidden = true; }, GLANCE_MS);
  }
  function chooseWatch() {
    if (state.busy && state.phase !== 'between' && state.phase !== 'arrive') return;
    state.you.watching = true;
    state.you.bet = 0;
    if (state.phase === 'arrive' || state.phase === 'between') {
      startHand();
    }
  }
  function chooseBet(amount) {
    if (state.busy && state.phase !== 'between' && state.phase !== 'arrive') return;
    amount = Number(amount);
    if (!BET_OPTIONS.includes(amount)) return;
    if (amount > state.you.bank) {
      logTalk('table', 'Not enough chips for that.', true);
      return;
    }
    state.you.watching = false;
    state.you.bet = amount;
    if (state.phase === 'arrive' || state.phase === 'between') {
      startHand();
    }
  }
  function wireUI() {
    $('btn-glance')?.addEventListener('click', glance);
    $('btn-watch')?.addEventListener('click', chooseWatch);
    $('btn-watch-next')?.addEventListener('click', chooseWatch);
    $('btn-hit')?.addEventListener('click', () => { playerHit(); });
    $('btn-stand')?.addEventListener('click', () => { playerStand(); });
    $('btn-submit-rc')?.addEventListener('click', submitRC);
    $('btn-again')?.addEventListener('click', () => {
      $('shift-end').hidden = true;
      boot(true);
    });
    document.querySelectorAll('.btn-chip[data-bet]').forEach((btn) => {
      btn.addEventListener('click', () => chooseBet(btn.getAttribute('data-bet')));
    });
    const g = $('btn-glance');
    if (g) {
      g.addEventListener('pointerdown', (e) => { e.preventDefault(); glance(); });
    }
  }
  function boot(again) {
    if (typeof Shoe !== 'function' || typeof Hand !== 'function') {
      logTalk('table', 'Engine failed to load (Shoe/Hand). Check js/02-core-types.js.', true);
      return;
    }
    state.shoe = new Shoe(6, 0.75);
    state.counter = makeCounter();
    const frac = 0.40 + Math.random() * 0.15;
    advanceShoeOffscreen(frac);
    initNpcs();
    state.you = { bank: START_BANK, bet: 0, watching: true, hand: null, result: '' };
    state.dealer = { hand: null, line: '' };
    state.dealerChanged = false;
    state.someoneLeft = false;
    setDealerName('Ray');
    state.handsPlayed = 0;
    state.handsWatched = 0;
    state.handsBet = 0;
    state.netPL = 0;
    state.cutWarned = false;
    state.ambientPending = null;
    state.busy = false;
    state.holeHidden = true;
    state.startedAt = Date.now();
    setPhase('arrive');
    $('talk-log').innerHTML = '';
    $('shift-end').hidden = true;
    setDealerLine(pick(['Morning.', 'Good luck.', 'Cards are warm.']));
    logTalk('table', 'You walk up. Shoe\'s already into it.', true);
    logTalk(dealerWho(), state.dealer.line, false);
    logTalk(pick(['Dana', 'Cole', 'Irene']), pick(['Hey.', 'Seat\'s open.', 'Shoes are deep today.']), false);
    renderCardAreas();
    updateMeta();
    showControls('ctrl-arrive');
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(updateClock, 500);
    updateClock();
  }
  document.addEventListener('DOMContentLoaded', () => {
    wireUI();
    boot(false);
  });

  global.__SHIFT.endShift = endShift;
  global.__SHIFT.startHand = startHand;
})(typeof window !== 'undefined' ? window : globalThis);
