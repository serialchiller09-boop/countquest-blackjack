/* The Shift - living mid-shoe table. Part 1/2 setup/render/ambient */
(function (global) {
  'use strict';
  const SHIFT_MS = 4 * 60 * 1000;
  const MAX_HANDS = 12;
  const GLANCE_MS = 1200;
  const BET_OPTIONS = [10, 25, 50];
  const START_BANK = 500;
  function localHiLoTag(rank) {
    if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
    if (['7', '8', '9'].includes(rank)) return 0;
    return -1; // 10/J/Q/K/A
  }
  class LocalHiLo {
    constructor() { this.runningCount = 0; this.totalCardsCounted = 0; }
    reset() { this.runningCount = 0; this.totalCardsCounted = 0; }
    recordCardRemovedFromShoe(card) {
      const tag = localHiLoTag(card.rank);
      this.runningCount += tag;
      this.totalCardsCounted++;
      return tag;
    }
  }
  function makeCounter() {
    if (typeof HiLoCounter === 'function') return new HiLoCounter();
    if (typeof CardCounter === 'function') return new CardCounter('hi-lo');
    return new LocalHiLo();
  }
  function suitSym(suit) {
    if (typeof SUIT_SYM !== 'undefined' && SUIT_SYM[suit]) return SUIT_SYM[suit];
    return ({ S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' })[suit] || suit;
  }
  function isRed(suit) { return suit === 'H' || suit === 'D'; }
  function cardHtml(card, faceDown) {
    if (faceDown) return '<span class="card back" aria-label="facedown"></span>';
    const red = isRed(card.suit) ? ' red' : '';
    return `<span class="card${red}"><span class="rank">${card.rank}</span><span class="suit">${suitSym(card.suit)}</span></span>`;
  }
  function cardsHtml(cards, hideHole) {
    if (!cards || !cards.length) return '';
    return cards.map((c, i) => cardHtml(c, hideHole && i === 1)).join('');
  }
  function fmtMoney(n) {
    return String(Math.round(n));
  }
  function rcText(n) {
    return n > 0 ? `+${n}` : String(n);
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  const CAST = [
    { id: 'dana', name: 'Dana', baseBet: 25, mood: 'steady' },
    { id: 'cole', name: 'Cole', baseBet: 10, mood: 'hot' },
    { id: 'irene', name: 'Irene', baseBet: 50, mood: 'cold' },
  ];
  const GUESTS = ['Marco', 'Tess', 'Jules', 'Pat', 'Noor'];
  const DEALER_NAMES = ['Vince', 'Marla', 'Chris'];
  const DEALER_LINES = [
    'Insurance? No one? Alright.',
    'Good cards coming... maybe.',
    'Cut\'s getting close.',
    'Checks are fine. Cash too.',
    'Nice hand.',
    'Dealer wins.',
    'Push.',
  ];
  const state = {
    shoe: null,
    counter: null,
    dealer: { hand: null, line: '' },
    dealerName: 'Ray',
    dealerChanged: false,
    someoneLeft: false,
    npcs: {},
    you: {
      bank: START_BANK,
      bet: 0,
      watching: true,
      hand: null,
      result: '',
    },
    phase: 'arrive',
    handsPlayed: 0,
    handsWatched: 0,
    handsBet: 0,
    netPL: 0,
    startedAt: 0,
    timerId: null,
    ambientPending: null,
    cutWarned: false,
    busy: false,
    holeHidden: true,
  };
  const $ = (id) => document.getElementById(id);
  function logTalk(who, text, sys) {
    const box = $('talk-log');
    if (!box) return;
    const p = document.createElement('p');
    p.className = 'line';
    if (sys) {
      p.innerHTML = `<span class="sys">${escapeHtml(text)}</span>`;
    } else {
      p.innerHTML = `<span class="who">${escapeHtml(who)}</span> - ${escapeHtml(text)}`;
    }
    box.prepend(p);
    while (box.children.length > 40) box.removeChild(box.lastChild);
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function setDealerLine(text) {
    state.dealer.line = text || '';
    const el = $('dealer-line');
    if (el) el.textContent = state.dealer.line;
  }
  function setDealerName(name) {
    state.dealerName = name || 'Ray';
    const el = document.querySelector('.seat-dealer .seat-name');
    if (!el) return;
    el.innerHTML = `${escapeHtml(state.dealerName)} <span class="seat-role">dealer</span>`;
  }
  function advanceShoeOffscreen(fraction) {
    const targetRemain = Math.floor(state.shoe.initialCount * (1 - fraction));
    while (state.shoe.cardsRemaining > targetRemain) {
      const c = state.shoe.deal();
      state.counter.recordCardRemovedFromShoe(c);
    }
  }
  function dealSeen(toHand) {
    const c = state.shoe.deal();
    state.counter.recordCardRemovedFromShoe(c);
    toHand.add(c);
    return c;
  }
  function initNpcs() {
    state.npcs = {};
    for (const c of CAST) {
      state.npcs[c.id] = {
        ...c,
        homeName: c.name,
        isGuest: false,
        present: true,
        bank: 400 + Math.floor(Math.random() * 400),
        bet: 0,
        hand: null,
        result: '',
        streak: 0,
      };
    }
  }
  function npcChooseBet(npc) {
    if (!npc.present) return 0;
    let units = npc.baseBet;
    if (npc.mood === 'hot' || npc.streak >= 2) units = Math.min(50, units * 2);
    if (npc.mood === 'cold' || npc.streak <= -2) units = Math.max(10, Math.floor(units / 2) || 10);
    if (Math.random() < 0.2) units = pick(BET_OPTIONS);
    units = clamp(units, 10, Math.min(50, npc.bank));
    if (npc.bank < 10) return 0;
    return units;
  }
  function npcShouldHit(hand) {
    return hand.value() < 17;
  }
  function handLabel(h) {
    if (!h || !h.size) return '';
    return h.beginnerDisplaySummary ? h.beginnerDisplaySummary() : String(h.value());
  }
  function renderCardAreas() {
    const dCards = $('dealer-cards');
    const dTotal = $('dealer-total');
    const hideHole = state.holeHidden && (state.phase === 'dealing' || state.phase === 'player');
    if (dCards) dCards.innerHTML = state.dealer.hand ? cardsHtml(state.dealer.hand.cards, hideHole) : '';
    if (dTotal) {
      if (!state.dealer.hand || !state.dealer.hand.size) dTotal.textContent = '';
      else if (hideHole) dTotal.textContent = 'up card';
      else dTotal.textContent = handLabel(state.dealer.hand);
    }
    for (const c of CAST) {
      const npc = state.npcs[c.id];
      const seat = $(`seat-${c.id}`);
      if (seat) seat.classList.toggle('is-empty', !npc.present);
      seat?.classList.toggle('is-hot', npc.present && npc.mood === 'hot');
      seat?.classList.toggle('is-cold', npc.present && npc.mood === 'cold');
      const nameEl = seat?.querySelector('.seat-name');
      if (nameEl) nameEl.textContent = npc.present ? npc.name : 'Empty';
      const chips = $(`chips-${c.id}`);
      const bet = $(`bet-${c.id}`);
      const cards = $(`cards-${c.id}`);
      const total = $(`total-${c.id}`);
      const status = $(`status-${c.id}`);
      if (!npc.present) {
        if (chips) chips.textContent = 'empty chair';
        if (bet) bet.textContent = '';
        if (cards) cards.innerHTML = '';
        if (total) total.textContent = '';
        if (status) status.textContent = '';
        continue;
      }
      if (chips) chips.textContent = `${fmtMoney(npc.bank)} chips`;
      if (bet) bet.textContent = npc.bet ? `bet ${npc.bet}` : '';
      if (cards) cards.innerHTML = npc.hand ? cardsHtml(npc.hand.cards, false) : '';
      if (total) total.textContent = handLabel(npc.hand);
      if (status) status.textContent = npc.result || '';
    }
    const yChips = $('chips-you');
    const yBet = $('bet-you');
    const yCards = $('cards-you');
    const yTotal = $('total-you');
    const yStatus = $('status-you');
    const ySeat = $('seat-you');
    if (yChips) yChips.textContent = `${fmtMoney(state.you.bank)} chips`;
    if (yBet) yBet.textContent = state.you.watching ? (state.phase === 'arrive' ? '' : 'watching') : (state.you.bet ? `bet ${state.you.bet}` : '');
    if (yCards) yCards.innerHTML = (!state.you.watching && state.you.hand) ? cardsHtml(state.you.hand.cards, false) : '';
    if (yTotal) yTotal.textContent = (!state.you.watching) ? handLabel(state.you.hand) : '';
    if (yStatus) yStatus.textContent = state.you.result || '';
    ySeat?.classList.toggle('is-acting', state.phase === 'player');
  }
  function updateMeta() {
    const el = $('shift-meta');
    if (!el || !state.shoe) return;
    const frac = state.shoe.remainingFraction();
    let shoeFeel = 'deep shoe';
    if (frac < 0.35) shoeFeel = 'cut card near';
    else if (frac < 0.55) shoeFeel = 'mid-shoe';
    else if (frac < 0.75) shoeFeel = 'still early';
    el.textContent = `Hand ${state.handsPlayed || '-'} \u00b7 ${shoeFeel}`;
  }
  function updateClock() {
    const el = $('shift-clock');
    if (!el) return;
    const left = Math.max(0, SHIFT_MS - (Date.now() - state.startedAt));
    const s = Math.ceil(left / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    el.textContent = `${m}:${String(r).padStart(2, '0')}`;
    if (left <= 0 || state.handsPlayed >= MAX_HANDS) {
      if (typeof global.__SHIFT !== 'undefined' && typeof global.__SHIFT.endShift === 'function') global.__SHIFT.endShift();
    }
  }
  function showControls(which) {
    for (const id of ['ctrl-arrive', 'ctrl-waiting', 'ctrl-play', 'ctrl-between']) {
      const el = $(id);
      if (el) el.hidden = id !== which;
    }
  }
  function setPhase(p) {
    state.phase = p;
  }
  function dealerWho() {
    return state.dealerName || 'Ray';
  }
  function maybeQueueAmbient() {
    if (state.ambientPending || state.phase === 'ended') return;
    if (!state.cutWarned && state.shoe.remainingFraction() < 0.38) {
      state.ambientPending = 'cut';
      return;
    }
    if (!state.dealerChanged && state.handsPlayed >= 3 && state.handsPlayed <= 9 && Math.random() < 0.4) {
      state.ambientPending = 'dealerChange';
      return;
    }
    if (!state.someoneLeft && state.handsPlayed >= 2 && Math.random() < 0.55) {
      state.ambientPending = 'leave';
      return;
    }
    const empty = CAST.map((c) => state.npcs[c.id]).filter((n) => !n.present);
    if (empty.length && state.someoneLeft && Math.random() < 0.5) {
      state.ambientPending = 'sit';
      return;
    }
    if (Math.random() > 0.5) return;
    const present = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present);
    if (empty.length && present.length >= 2) state.ambientPending = pick(['leave', 'sit', 'sit', 'mood', 'dealer']);
    else if (empty.length) state.ambientPending = pick(['sit', 'sit', 'mood', 'dealer']);
    else if (present.length >= 2) state.ambientPending = pick(['leave', 'mood', 'dealer', 'dealer']);
    else state.ambientPending = pick(['mood', 'dealer']);
  }
  function fireAmbient() {
    const kind = state.ambientPending;
    state.ambientPending = null;
    if (!kind || state.phase === 'ended') return;
    if (kind === 'leave') {
      const present = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present);
      if (present.length <= 1) return;
      const n = pick(present);
      n.present = false;
      n.bet = 0;
      n.hand = null;
      n.result = '';
      state.someoneLeft = true;
      logTalk(n.name, pick(["I'm done.", 'Color me up.', 'Gonna stretch.', "Chair's yours.", "That's enough."]), false);
      logTalk('table', `${n.name} leaves an empty chair.`, true);
      renderCardAreas();
      return;
    }
    if (kind === 'sit') {
      const empty = CAST.map((c) => state.npcs[c.id]).filter((n) => !n.present);
      if (!empty.length) return;
      const n = pick(empty);
      n.present = true;
      n.bank = 300 + Math.floor(Math.random() * 300);
      n.streak = 0;
      n.bet = 0;
      n.hand = null;
      n.result = '';
      const taken = new Set(CAST.map((c) => state.npcs[c.id]).filter((x) => x.present).map((x) => x.name));
      const guestPool = GUESTS.filter((g) => !taken.has(g));
      const homeBack = Math.random() < 0.55;
      if (homeBack) {
        n.name = n.homeName;
        n.isGuest = false;
        n.mood = pick(['steady', 'hot', 'cold']);
        n.baseBet = CAST.find((c) => c.id === n.id)?.baseBet || 25;
        logTalk(n.name, pick(['Back.', 'Miss me?', 'Still warm.', 'One more stretch.']), false);
        logTalk('table', `${n.name} takes the empty chair.`, true);
      } else {
        n.name = pick(guestPool.length ? guestPool : GUESTS);
        n.isGuest = true;
        n.mood = pick(['steady', 'hot', 'cold']);
        n.baseBet = pick([10, 25, 50]);
        logTalk(n.name, pick(['This open?', 'Mind if I jump in?', 'Got room?', 'Deal me a seat.']), false);
        logTalk('table', `${n.name} sits where ${n.homeName} was.`, true);
      }
      renderCardAreas();
      return;
    }
    if (kind === 'dealerChange') {
      if (state.dealerChanged) return;
      state.dealerChanged = true;
      const old = dealerWho();
      const next = pick(DEALER_NAMES.filter((d) => d !== old));
      logTalk(old, pick(["I'm off. Good luck.", 'Shift change.', 'Taking my break.']), false);
      setDealerName(next);
      setDealerLine(pick(['I got it.', 'Same shoe.', 'Continuing.']));
      logTalk('table', `${next} takes the deal. Same shoe.`, true);
      logTalk(next, state.dealer.line, false);
      return;
    }
    if (kind === 'dealer') {
      const line = pick(DEALER_LINES);
      setDealerLine(line);
      logTalk(dealerWho(), line, false);
      return;
    }
    if (kind === 'cut') {
      state.cutWarned = true;
      setDealerLine("Cut card's coming.");
      logTalk(dealerWho(), "Cut card's coming.", false);
      return;
    }
    if (kind === 'mood') {
      const present = CAST.map((c) => state.npcs[c.id]).filter((n) => n.present);
      if (!present.length) return;
      const n = pick(present);
      if (n.streak >= 2) {
        n.mood = 'hot';
        n.baseBet = Math.min(50, n.baseBet * 2 || 25);
        logTalk(n.name, pick(['Feeling it.', "Let's press a bit.", 'One more.']), false);
      } else if (n.streak <= -2) {
        n.mood = 'cold';
        n.baseBet = Math.max(10, Math.floor((n.baseBet || 25) / 2));
        logTalk(n.name, pick(['Tightening up.', 'Smaller this time.', 'Cold run.']), false);
      } else {
        n.mood = pick(['steady', 'hot', 'cold']);
        logTalk('table', `${n.name} shifts chips around.`, true);
      }
      renderCardAreas();
    }
  }

  global.__SHIFT = {
    SHIFT_MS, MAX_HANDS, GLANCE_MS, BET_OPTIONS, START_BANK,
    CAST, GUESTS, DEALER_NAMES, DEALER_LINES, state, $,
    logTalk, escapeHtml, setDealerLine, setDealerName, dealerWho,
    advanceShoeOffscreen, dealSeen,
    initNpcs, npcChooseBet, npcShouldHit, handLabel, renderCardAreas,
    updateMeta, updateClock, showControls, setPhase,
    maybeQueueAmbient, fireAmbient,
    makeCounter, LocalHiLo, localHiLoTag, suitSym, isRed, cardHtml, cardsHtml,
    fmtMoney, rcText, sleep, pick, clamp,
  };
})(typeof window !== 'undefined' ? window : globalThis);
