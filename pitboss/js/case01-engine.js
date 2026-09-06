/**
 * Case 01 engine  -  shoe, Hi-Lo, basic strategy, seats, deal loop, tools, call.
 * Self-contained; does not load the full CountQuest app.
 */
(function (global) {
  'use strict';

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];

  function hiLoTag(rank) {
    if (rank === 'A' || rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return -1;
    if (rank === '7' || rank === '8' || rank === '9') return 0;
    return +1; // 2-6
  }

  function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10;
    return parseInt(rank, 10);
  }

  /** Half-up toward +inf for |n|.5 (away from zero for positives). */
  function roundHalfUp(n) {
    return n >= 0 ? Math.floor(n + 0.5) : Math.ceil(n - 0.5);
  }

  function handTotals(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      total += cardValue(c.rank);
      if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    const soft = aces > 0 && total <= 21;
    return { total, soft };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handTotals(cards).total === 21;
  }

  // ── Compact basic strategy (H17, DAS, no surrender) ──
  // Returns 'H'|'S'|'D'|'P'. D means double if allowed else hit (or stand for soft).
  function basicStrategy(cards, dealerUpRank, canDouble, canSplit) {
    const up = cardValue(dealerUpRank === 'A' ? 'A' : dealerUpRank);
    const dealerUp = dealerUpRank === 'A' ? 11 : up;
    const { total, soft } = handTotals(cards);
    const ranks = cards.map((c) => c.rank);
    const isPair =
      cards.length === 2 &&
      cardValue(ranks[0]) === cardValue(ranks[1]);

    if (canSplit && isPair) {
      const pr = ranks[0] === 'A' || cardValue(ranks[0]) === 10 ? ranks[0] : String(cardValue(ranks[0]));
      const pv = ranks[0] === 'A' ? 11 : cardValue(ranks[0]);
      if (pv === 11) return 'P'; // A,A
      if (pv === 10) return 'S';
      if (pv === 9) {
        if (dealerUp === 7 || dealerUp === 10 || dealerUp === 11) return 'S';
        return 'P';
      }
      if (pv === 8) return 'P';
      if (pv === 7) return dealerUp >= 2 && dealerUp <= 7 ? 'P' : 'H';
      if (pv === 6) return dealerUp >= 2 && dealerUp <= 6 ? 'P' : 'H';
      if (pv === 5) {
        // treat as hard 10
      } else if (pv === 4) {
        return dealerUp >= 5 && dealerUp <= 6 ? 'P' : 'H';
      } else if (pv === 3 || pv === 2) {
        return dealerUp >= 2 && dealerUp <= 7 ? 'P' : 'H';
      }
      if (pv === 5) {
        const act = hardTotalAction(10, dealerUp);
        return resolveDouble(act, canDouble);
      }
    }

    if (soft && total <= 21) {
      return resolveDouble(softTotalAction(total, dealerUp), canDouble);
    }
    return resolveDouble(hardTotalAction(total, dealerUp), canDouble);
  }

  function resolveDouble(act, canDouble) {
    if (act === 'D') return canDouble ? 'D' : 'H';
    if (act === 'Ds') return canDouble ? 'D' : 'S';
    return act;
  }

  function hardTotalAction(total, dealerUp) {
    if (total >= 17) return 'S';
    if (total >= 13 && total <= 16) return dealerUp >= 2 && dealerUp <= 6 ? 'S' : 'H';
    if (total === 12) return dealerUp >= 4 && dealerUp <= 6 ? 'S' : 'H';
    if (total === 11) return 'D';
    if (total === 10) return dealerUp >= 2 && dealerUp <= 9 ? 'D' : 'H';
    if (total === 9) return dealerUp >= 3 && dealerUp <= 6 ? 'D' : 'H';
    return 'H';
  }

  function softTotalAction(total, dealerUp) {
    // soft totals: A+x where total includes ace as 11
    if (total >= 20) return 'S'; // A9, A8 often stand; H17 A8 vs 6 can D
    if (total === 19) return dealerUp === 6 ? 'Ds' : 'S'; // A8
    if (total === 18) {
      // A7
      if (dealerUp >= 3 && dealerUp <= 6) return 'Ds';
      if (dealerUp === 2 || dealerUp === 7 || dealerUp === 8) return 'S';
      return 'H';
    }
    if (total === 17) return dealerUp >= 3 && dealerUp <= 6 ? 'D' : 'H'; // A6
    if (total === 16 || total === 15) return dealerUp >= 4 && dealerUp <= 6 ? 'D' : 'H';
    if (total === 14 || total === 13) return dealerUp >= 5 && dealerUp <= 6 ? 'D' : 'H';
    return 'H';
  }

  function pearsonR(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
      sxx += xs[i] * xs[i];
      syy += ys[i] * ys[i];
      sxy += xs[i] * ys[i];
    }
    const num = n * sxy - sx * sy;
    const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    if (den === 0) return 0;
    return num / den;
  }

  class Shoe {
    constructor(numDecks, rng) {
      this.numDecks = numDecks;
      this.rng = rng;
      this.cards = [];
      this.discards = [];
      this.cutIndex = 0;
      this.cutReached = false;
      this.rebuild(rng);
    }

    rebuild(rng) {
      this.cards = [];
      for (let d = 0; d < this.numDecks; d++) {
        for (const s of SUITS) {
          for (const r of RANKS) {
            this.cards.push({ rank: r, suit: s, id: `${r}${s}-${d}` });
          }
        }
      }
      rng.shuffleInPlace(this.cards);
      this.discards = [];
      this.cutReached = false;
      const cutCards = Math.round(CASE01.cutDecks * CASE01.cardsPerDeck);
      // cut card placed so when cardsLeft hits cutCards, cut is reached
      this.cutCardRemaining = cutCards;
    }

    cardsLeft() {
      return this.cards.length;
    }

    decksRemaining() {
      return Math.max(0.5, this.cards.length / CASE01.cardsPerDeck);
    }

    draw() {
      if (!this.cards.length) return null;
      const c = this.cards.pop();
      if (this.cards.length <= this.cutCardRemaining) this.cutReached = true;
      return c;
    }
  }

  function createSeat(id, name, archetype, buyInUnits) {
    return {
      id,
      name,
      archetype,
      buyInUnits,
      stackUnits: buyInUnits,
      nextBetUnits: 1,
      history: [],
      marks: 'empty', // empty | warm | cold
      flags: {
        hoveredHandsRemaining: 0,
        flattenedByHover: false,
        reactedToShuffle: false,
        camouflageSpent: false,
        shuffleSlumpHands: 0,
        soda: archetype === 'COUNTER',
        whiskey: archetype === 'WHALE_LITE',
        goldTrim: archetype === 'WHALE_LITE',
      },
      // live hand state
      hands: [],
      betUnits: 0,
      insured: false,
      indexDeviationThisHand: false,
      lastOutcome: null,
      flavor: '',
    };
  }

  function assignArchetypes(rng) {
    const seats = new Array(CASE01.seatCount);
    const indices = [0, 1, 2, 3, 4];
    rng.shuffleInPlace(indices);
    const counterSeat = indices[0];
    const touristSeat = indices[1];
    const martingaleSeat = indices[2];
    const filler = rng.shuffleInPlace([...CASE01.fillerPool]).slice(0, 2);
    const map = new Array(5);
    map[counterSeat] = 'COUNTER';
    map[touristSeat] = 'LUCKY_TOURIST';
    map[martingaleSeat] = 'MARTINGALE';
    let fi = 0;
    for (let i = 0; i < 5; i++) {
      if (!map[i]) map[i] = filler[fi++];
    }
    return map;
  }

  function pickNames(rng) {
    const pool = rng.shuffleInPlace([...CASE01_NAME_POOL]);
    return pool.slice(0, 5);
  }

  class Case01Engine {
    constructor(options = {}) {
      const seed =
        options.seed != null
          ? options.seed >>> 0
          : (Date.now() >>> 0);
      this.seed = seed;
      this.masterRng = new Case01Rng(seed);
      this.handIndex = 0; // completed hands
      this.phase = 'briefing'; // briefing | betting | dealing | playing | settle | paused | called | cut_force
      this.paused = false;
      this.speedMs = CASE01.speedsMs[CASE01.defaultSpeedIndex];
      this.cutCardReached = false;
      this.forceCallPending = false;
      this.called = false;
      this.call = null; // { type:'BACKOFF'|'PASS', seatId, hand }
      this.peekUsed = false;
      this.hoverUsed = false;
      this.hoverSeatId = null;
      this.shuffleUsed = false;
      this.tcAtShuffle = null;
      this.justShuffled = true; // first hand of shoe
      this.selectedSeatId = null;
      this.runningCount = 0;
      this.flavorLog = [];
      this.debug = !!options.debug;
      this.helpLevel = options.helpLevel != null ? options.helpLevel : 1;
      this.rerollsUsed = 0;
      this._queuedTool = null; // 'hover'|'shuffle' deferred
      this._pendingHoverSeat = null;
      this.factChips = {}; // seatId -> message
      this.notebookNote = '';
      this.onUpdate = options.onUpdate || (() => {});
      this._simMode = !!options.simMode;

      this._generateWithReroll();
    }

    _generateWithReroll() {
      let attempt = 0;
      let best = null;
      while (attempt <= CASE01.maxRerolls) {
        const shoeSeed = this.masterRng.fork('shoe', attempt).seed;
        const archSeed = this.masterRng.fork('arch', attempt).seed;
        const built = this._buildCase(shoeSeed, archSeed, attempt);
        const r = this._simulateCounterCorrelation(built);
        built.counterR = r;
        if (r == null || r >= CASE01.rerollIfCounterRBelow) {
          this._applyBuilt(built);
          this.rerollsUsed = attempt;
          return;
        }
        best = built;
        attempt++;
      }
      this._applyBuilt(best);
      this.rerollsUsed = CASE01.maxRerolls;
    }

    _buildCase(shoeSeed, archSeed, attempt) {
      const shoeRng = new Case01Rng(shoeSeed);
      const archRng = new Case01Rng(archSeed);
      const archetypes = assignArchetypes(archRng);
      const names = pickNames(archRng);
      const seats = [];
      for (let i = 0; i < 5; i++) {
        const arch = archetypes[i];
        seats.push(createSeat(i + 1, names[i], arch, CASE01.buyIn[arch]));
      }
      const shoe = new Shoe(CASE01.decks, shoeRng);
      return { shoe, seats, shoeSeed, archSeed, attempt, archetypes };
    }

    _applyBuilt(built) {
      this.shoe = built.shoe;
      this.seats = built.seats;
      this.shoeSeed = built.shoeSeed;
      this.archSeed = built.archSeed;
      this.counterRPreview = built.counterR;
      this.runningCount = 0;
      this.handIndex = 0;
      this.justShuffled = true;
      this.cutCardReached = false;
    }

    /** Headless sim of betting through ~20 hands with no hover to check COUNTER r. */
    _simulateCounterCorrelation(built) {
      const rngShoe = new Case01Rng(built.shoeSeed);
      const shoe = new Shoe(CASE01.decks, rngShoe);
      const seats = built.seats.map((s) => createSeat(s.id, s.name, s.archetype, s.buyInUnits));
      let rc = 0;
      let justShuffled = true;
      const maxHands = 20;

      for (let hand = 1; hand <= maxHands; hand++) {
        if (shoe.cardsLeft() <= shoe.cutCardRemaining && hand > 1) break;
        const decksRem = shoe.decksRemaining();
        const tc = roundHalfUp(rc / decksRem);
        // place bets
        for (const seat of seats) {
          const betRng = new Case01Rng(case01MixSeed(this.seed, 'bet', hand, seat.id, built.attempt));
          const bet = Case01Archetypes.computeArchetypeBet(seat, {
            hand,
            tcAtBet: tc,
            rcAtBet: rc,
            rng: betRng,
            justShuffled,
            shuffleSlumpHands: 0,
          });
          seat.nextBetUnits = bet;
          seat.betUnits = Math.min(bet, Math.max(1, seat.stackUnits));
        }
        justShuffled = false;

        // deal: 2 each + dealer
        const dealt = [];
        const deal = () => {
          const c = shoe.draw();
          if (c) {
            rc += hiLoTag(c.rank);
            dealt.push(c);
          }
          return c;
        };
        const playerHands = seats.map(() => [deal(), null]);
        const dealer = [deal(), null];
        for (let i = 0; i < 5; i++) playerHands[i][1] = deal();
        dealer[1] = deal();

        // simplified resolution for correlation: random-ish outcomes from hand totals
        for (let i = 0; i < 5; i++) {
          const seat = seats[i];
          const cards = playerHands[i].filter(Boolean);
          // hit once sometimes to burn cards
          const playRng = new Case01Rng(case01MixSeed(this.seed, 'play', hand, seat.id, built.attempt));
          let handCards = cards.slice();
          let guard = 0;
          while (guard++ < 6) {
            const { total, soft } = handTotals(handCards);
            if (total >= 21) break;
            const canDouble = handCards.length === 2;
            const basic = basicStrategy(handCards, dealer[0].rank, canDouble, false);
            const info = {
              hardTotal: soft ? total - 10 : total,
              soft,
              isPair: false,
              dealerUpValue: cardValue(dealer[0].rank),
              canDouble,
              canSplit: false,
            };
            // use total as hard for noise checks when soft
            info.hardTotal = total;
            const dec = Case01Archetypes.playDecision(seat, basic === 'D' ? 'H' : basic === 'P' ? 'H' : basic, info, tc, playRng);
            if (dec.action === 'H' || dec.action === 'D') {
              const c = deal();
              if (!c) break;
              handCards.push(c);
              if (dec.action === 'D') break;
            } else break;
          }
          // dealer hits H17 briefly
          let dCards = dealer.filter(Boolean);
          while (true) {
            const t = handTotals(dCards);
            if (t.total > 17) break;
            if (t.total === 17 && !t.soft) break;
            if (t.total === 17 && t.soft) {
              // H17 hit
              const c = deal();
              if (!c) break;
              dCards.push(c);
              continue;
            }
            if (t.total < 17) {
              const c = deal();
              if (!c) break;
              dCards.push(c);
              continue;
            }
            break;
          }
          const pt = handTotals(handCards).total;
          const dt = handTotals(dCards).total;
          let outcome = 'push';
          if (pt > 21) outcome = 'bust';
          else if (isBlackjack(handCards) && !isBlackjack(dCards)) outcome = 'bj';
          else if (dt > 21) outcome = 'win';
          else if (pt > dt) outcome = 'win';
          else if (pt < dt) outcome = 'lose';
          else outcome = 'push';

          // stack
          const bet = seat.betUnits;
          if (outcome === 'bj') seat.stackUnits += Math.floor(bet * 1.5);
          else if (outcome === 'win') seat.stackUnits += bet;
          else if (outcome === 'lose' || outcome === 'bust') seat.stackUnits -= bet;
          if (seat.stackUnits <= 0) {
            seat.stackUnits = Math.max(1, Math.floor(seat.buyInUnits / 2));
          }

          seat.history.push({
            hand,
            tcAtBet: tc,
            rcAtBet: rc, // after deal approx  -  for sim we log tc at bet which is pre-deal
            betUnits: bet,
            outcome: outcome === 'bust' ? 'lose' : outcome,
            indexDeviation: false,
            insured: false,
          });
        }
        // fix: tcAtBet should be pre-deal; we already computed tc before deal  -  good
        // but we mutated rc during deal; for next hand that's correct
        if (shoe.cutReached) break;
      }

      const counter = seats.find((s) => s.archetype === 'COUNTER');
      if (!counter || counter.history.length < CASE01.correlationMinHands) return 0;
      const xs = counter.history.map((h) => h.tcAtBet);
      const ys = counter.history.map((h) => h.betUnits);
      return pearsonR(xs, ys);
    }

    getCounterSeat() {
      return this.seats.find((s) => s.archetype === 'COUNTER');
    }

    getWhaleSeat() {
      return this.seats.find((s) => s.archetype === 'WHALE_LITE') || null;
    }

    trueCount() {
      return roundHalfUp(this.runningCount / this.shoe.decksRemaining());
    }

    decksRemainingDisplay() {
      return this.shoe.decksRemaining();
    }

    canCall() {
      return this.handIndex >= CASE01.minCallHand && !this.called;
    }

    // ── Tools ──
    markSeat(seatId, mark) {
      const s = this.seats.find((x) => x.id === seatId);
      if (!s || this.called) return;
      if (mark === 'cycle') {
        s.marks = s.marks === 'empty' ? 'warm' : s.marks === 'warm' ? 'cold' : 'empty';
      } else {
        s.marks = mark;
      }
      this._emit();
    }

    selectSeat(seatId) {
      this.selectedSeatId = seatId;
      this._emit();
    }

    requestHover(seatId) {
      if (this.hoverUsed || this.called) return { ok: false, reason: 'unavailable' };
      if (this.phase === 'betting') {
        this._startHover(seatId);
        return { ok: true };
      }
      this._queuedTool = 'hover';
      this._pendingHoverSeat = seatId;
      this.flavorLog.push('Hover queued for next betting window.');
      this._emit();
      return { ok: true, queued: true };
    }

    _startHover(seatId) {
      this.hoverUsed = true;
      this.hoverSeatId = seatId;
      const seat = this.seats.find((s) => s.id === seatId);
      if (seat) {
        seat.flags.hoveredHandsRemaining = CASE01.hoverHands;
      }
      // If chips are already out this window, recompute so COUNTER flattens now.
      if (this.phase === 'betting') {
        const hand = this.handIndex + 1;
        const tc = this.trueCount();
        const rc = this.runningCount;
        for (const s of this.seats) {
          const betRng = new Case01Rng(case01MixSeed(this.seed, 'bet', hand, s.id, this.rerollsUsed));
          const bet = Case01Archetypes.computeArchetypeBet(s, {
            hand,
            tcAtBet: tc,
            rcAtBet: rc,
            rng: betRng,
            justShuffled: this.justShuffled,
            shuffleSlumpHands: s.flags.shuffleSlumpHands,
          });
          const finalBet = Math.min(bet, Math.max(1, s.stackUnits || 1));
          s.nextBetUnits = finalBet;
          s.betUnits = finalBet;
        }
      }
      this.flavorLog.push("I'll keep dealing. You see something, you say.");
      this._emit();
    }

    requestShuffle() {
      if (this.shuffleUsed || this.called) return { ok: false, reason: 'unavailable' };
      if (this.hoverUsed && this.hoverSeatId && this.phase === 'betting' && this._queuedTool === 'hover') {
        // cannot both same hand  -  queue
      }
      if (this.phase === 'betting' && !this._toolLockedThisWindow) {
        this._doShuffle();
        return { ok: true };
      }
      if (this._queuedTool === 'hover') {
        this.flavorLog.push('Cannot Hover and Shuffle on the same hand. Shuffle queued.');
      }
      this._queuedTool = this._queuedTool === 'hover' ? 'hover' : 'shuffle';
      if (this._queuedTool !== 'hover') this._queuedTool = 'shuffle';
      else {
        // hover already queued; queue shuffle to next after
        this._queuedToolAfter = 'shuffle';
      }
      this.flavorLog.push('Shuffle Test queued for next betting window.');
      this._emit();
      return { ok: true, queued: true };
    }

    _doShuffle() {
      this.shuffleUsed = true;
      this.tcAtShuffle = this.trueCount();
      const counter = this.getCounterSeat();
      if (counter && this.tcAtShuffle >= 2) {
        counter.flags.reactedToShuffle = true;
        counter.flags.shuffleSlumpHands = 2;
        this.flavorLog.push(`${counter.name} slumps as the shoe resets.`);
      } else {
        const tourist = this.seats.find((s) => s.archetype === 'LUCKY_TOURIST');
        if (tourist) this.flavorLog.push(`${tourist.name}: "Already? We were just getting warm."`);
      }
      const shuffleRng = this.masterRng.fork('reshuffle', this.handIndex);
      this.shoe.rebuild(shuffleRng);
      this.runningCount = 0;
      this.justShuffled = true;
      this.cutCardReached = false;
      this.flavorLog.push('Shuffle. Running count snaps to 0.');
      this._toolLockedThisWindow = true;
      this._emit();
    }

    peekCount(playerRc) {
      if (this.peekUsed || this.called) return { ok: false };
      this.peekUsed = true;
      const truth = this.runningCount;
      const close = Math.abs((playerRc | 0) - truth) <= 1;
      const msg = close
        ? `Close enough. RC = ${truth}.`
        : `Off. RC = ${truth}.`;
      this.flavorLog.push(msg);
      this._emit();
      return { ok: true, close, truth, message: msg };
    }

    backOff(seatId) {
      if (!this.canCall()) return { ok: false, reason: 'too_early' };
      if (this.called) return { ok: false };
      const seat = this.seats.find((s) => s.id === seatId);
      if (!seat) return { ok: false };
      this.called = true;
      this.call = { type: 'BACKOFF', seatId, hand: this.handIndex, name: seat.name };
      this.phase = 'called';
      this.paused = true;
      this.flavorLog.push(`Sir/ma'am  -  blackjack is closed for you tonight.`);
      this._emit();
      return { ok: true };
    }

    passTable() {
      if (!this.canCall()) return { ok: false, reason: 'too_early' };
      if (this.called) return { ok: false };
      this.called = true;
      this.call = { type: 'PASS', seatId: null, hand: this.handIndex };
      this.phase = 'called';
      this.paused = true;
      this.flavorLog.push("Table's clean.");
      this._emit();
      return { ok: true };
    }

    setSpeed(ms) {
      if (CASE01.speedsMs.includes(ms)) this.speedMs = ms;
      this._emit();
    }

    togglePause() {
      if (this.called) return;
      this.paused = !this.paused;
      this._emit();
    }

    // ── Hand loop ──
    /** Place bets for upcoming hand (handIndex+1). */
    beginBettingWindow() {
      if (this.called) return;
      this.phase = 'betting';
      this._toolLockedThisWindow = false;
      this.factChips = {};

      // apply queued tools
      if (this._queuedTool === 'hover' && this._pendingHoverSeat && !this.hoverUsed) {
        this._startHover(this._pendingHoverSeat);
        this._queuedTool = this._queuedToolAfter || null;
        this._queuedToolAfter = null;
        this._pendingHoverSeat = null;
      } else if (this._queuedTool === 'shuffle' && !this.shuffleUsed) {
        this._doShuffle();
        this._queuedTool = null;
      }

      const hand = this.handIndex + 1;
      const tc = this.trueCount();
      const rc = this.runningCount;

      for (const seat of this.seats) {
        const betRng = new Case01Rng(case01MixSeed(this.seed, 'bet', hand, seat.id, this.rerollsUsed));
        const prevBet = seat.history.length ? seat.history[seat.history.length - 1].betUnits : null;
        const bet = Case01Archetypes.computeArchetypeBet(seat, {
          hand,
          tcAtBet: tc,
          rcAtBet: rc,
          rng: betRng,
          justShuffled: this.justShuffled,
          shuffleSlumpHands: seat.flags.shuffleSlumpHands,
        });
        // affordability
        let finalBet = Math.min(bet, Math.max(1, seat.stackUnits));
        if (seat.stackUnits <= 0) {
          seat.stackUnits = Math.max(1, Math.floor(seat.buyInUnits / 2));
          finalBet = Math.min(bet, seat.stackUnits);
        }
        seat.nextBetUnits = finalBet;
        seat.betUnits = finalBet;
        seat._tcAtBet = tc;
        seat._rcAtBet = rc;
        seat.insured = false;
        seat.indexDeviationThisHand = false;
        seat.hands = [];

        if (prevBet != null && Math.abs(finalBet - prevBet) >= 2 && this.helpLevel <= 1) {
          this.factChips[seat.id] = finalBet > prevBet ? 'bet jumped' : 'bet dropped';
        }

        if (this.debug && seat.archetype === 'COUNTER') {
          seat._debugWanted = Case01Archetypes.counterRawWanted(
            tc,
            seat.flags.hoveredHandsRemaining > 0,
            this.justShuffled,
            seat.flags.shuffleSlumpHands > 0
          );
        }
      }

      this.justShuffled = false;
      this._emit();
    }

    /** Deal and resolve one full hand synchronously (AI play). */
    resolveHand() {
      if (this.called) return null;
      const hand = this.handIndex + 1;
      this.phase = 'dealing';

      const take = () => {
        const c = this.shoe.draw();
        if (c) this.runningCount += hiLoTag(c.rank);
        if (this.shoe.cutReached) this.cutCardReached = true;
        return c;
      };

      // initial deal
      for (const seat of this.seats) {
        seat.hands = [{ cards: [], betUnits: seat.betUnits, done: false, doubled: false }];
      }
      const dealerCards = [];

      // two rounds
      for (const seat of this.seats) seat.hands[0].cards.push(take());
      dealerCards.push(take());
      for (const seat of this.seats) seat.hands[0].cards.push(take());
      dealerCards.push(take()); // hole

      const dealerUp = dealerCards[0];
      const tc = this.seats[0]._tcAtBet;

      // Insurance
      if (dealerUp.rank === 'A') {
        for (const seat of this.seats) {
          const insRng = new Case01Rng(case01MixSeed(this.seed, 'ins', hand, seat.id, this.rerollsUsed));
          if (Case01Archetypes.wantsInsurance(seat, tc, insRng)) {
            seat.insured = true;
            const cost = Math.max(1, Math.floor(seat.betUnits / 2));
            seat.stackUnits = Math.max(0, seat.stackUnits - cost);
          }
        }
      }

      // Peek BJ
      let dealerBJ = isBlackjack(dealerCards);
      if (dealerUp.rank === 'A' || cardValue(dealerUp.rank) === 10) {
        // peek
        if (dealerBJ) {
          this.flavorLog.push('Blackjack. Sorry, darlings - house has it.');
        }
      }

      // Count hole card always (already drawn and tagged)

      if (!dealerBJ) {
        // Player play each seat
        for (const seat of this.seats) {
          this._playSeatHands(seat, dealerUp, hand, take);
        }
        // Dealer play H17
        this._playDealer(dealerCards, take);
      }

      // Settle
      const dealerTotal = handTotals(dealerCards).total;
      const dealerBust = dealerTotal > 21;
      dealerBJ = isBlackjack(dealerCards);

      for (const seat of this.seats) {
        let stackDelta = 0;
        let primary = 'push';
        for (const h of seat.hands) {
          const pt = handTotals(h.cards).total;
          const pbj = isBlackjack(h.cards) && seat.hands.length === 1 && !h.doubled;
          let outcome;
          if (dealerBJ && pbj) outcome = 'push';
          else if (dealerBJ) outcome = 'lose';
          else if (pbj) outcome = 'bj';
          else if (pt > 21) outcome = 'bust';
          else if (dealerBust) outcome = 'win';
          else if (pt > dealerTotal) outcome = 'win';
          else if (pt < dealerTotal) outcome = 'lose';
          else outcome = 'push';
          primary = outcome === 'bust' ? 'lose' : outcome;
          if (outcome === 'bj') stackDelta += Math.floor(h.betUnits * 1.5);
          else if (outcome === 'win') stackDelta += h.betUnits;
          else if (outcome === 'lose' || outcome === 'bust') stackDelta -= h.betUnits;
        }
        // Insurance cost already deducted at offer. If dealer BJ, pay 2:1 (return cost + 2x).
        if (seat.insured && dealerBJ) {
          const cost = Math.max(1, Math.floor(seat.betUnits / 2));
          stackDelta += cost * 3;
        }

        seat.stackUnits += stackDelta;

        if (seat.stackUnits <= 0) {
          seat.stackUnits = Math.max(1, Math.floor(seat.buyInUnits / 2));
          this.flavorLog.push(`${seat.name} buys in again.`);
        }

        if (primary === 'bj' && Case01Archetypes.tipsOnBlackjack(seat, tc)) {
          seat.stackUnits = Math.max(0, seat.stackUnits - 1);
          this.flavorLog.push(`${seat.name} tokes 1 unit.`);
        }
        const tipRng = new Case01Rng(case01MixSeed(this.seed, 'tip', hand, seat.id, this.rerollsUsed));
        if (Case01Archetypes.chatterTipThisHand(seat, hand, tipRng)) {
          seat.stackUnits = Math.max(0, seat.stackUnits - 1);
        }

        seat.history.push({
          hand,
          tcAtBet: seat._tcAtBet,
          rcAtBet: seat._rcAtBet,
          betUnits: seat.betUnits,
          outcome: primary,
          indexDeviation: !!seat.indexDeviationThisHand,
          insured: !!seat.insured,
        });
        seat.lastOutcome = primary;
        seat.dealerCards = dealerCards;
      }

      // Hover countdown
      for (const seat of this.seats) {
        if (seat.flags.hoveredHandsRemaining > 0) {
          seat.flags.hoveredHandsRemaining--;
          if (seat.archetype === 'COUNTER') seat.flags.flattenedByHover = true;
          if (seat.flags.hoveredHandsRemaining === 0 && this.helpLevel <= 1) {
            if (seat.archetype === 'COUNTER') {
              this.notebookNote = 'Spread flattened under the eye.';
            } else if (seat.id === this.hoverSeatId) {
              this.notebookNote = 'No change in sizing.';
            }
          }
        }
        if (seat.flags.shuffleSlumpHands > 0) seat.flags.shuffleSlumpHands--;
      }

      this.handIndex = hand;
      this.phase = 'settle';
      this._emit();

      if (this.cutCardReached && !this.called) {
        this.forceCallPending = true;
      }
      return { hand, dealerCards };
    }

    _playSeatHands(seat, dealerUp, hand, take) {
      // single hand for simplicity; support one split
      const playRng = new Case01Rng(case01MixSeed(this.seed, 'play', hand, seat.id, this.rerollsUsed));
      let hi = 0;
      while (hi < seat.hands.length) {
        const h = seat.hands[hi];
        let guard = 0;
        while (!h.done && guard++ < 12) {
          const cards = h.cards;
          const { total, soft } = handTotals(cards);
          if (total >= 21) {
            h.done = true;
            break;
          }
          const canDouble = cards.length === 2 && seat.stackUnits >= h.betUnits;
          const canSplit =
            cards.length === 2 &&
            cardValue(cards[0].rank) === cardValue(cards[1].rank) &&
            seat.hands.length < 2 &&
            seat.stackUnits >= h.betUnits;
          let basic = basicStrategy(cards, dealerUp.rank, canDouble, canSplit);
          const info = {
            hardTotal: total,
            soft,
            isPair: canSplit,
            dealerUpValue: cardValue(dealerUp.rank),
            canDouble,
            canSplit,
          };
          const dec = Case01Archetypes.playDecision(seat, basic, info, seat._tcAtBet, playRng);
          if (dec.indexDeviation) seat.indexDeviationThisHand = true;
          let action = dec.action;
          // if basic wanted split but noise changed to H/S, ok
          if (action === 'P' && canSplit) {
            const c1 = cards[0];
            const c2 = cards[1];
            h.cards = [c1, take()];
            seat.hands.push({ cards: [c2, take()], betUnits: h.betUnits, done: false, doubled: false });
            // stack: second bet reserved via settlement
            continue;
          }
          if (action === 'D' && canDouble) {
            h.betUnits *= 2;
            h.doubled = true;
            h.cards.push(take());
            h.done = true;
            break;
          }
          if (action === 'D') action = 'H';
          if (action === 'P') action = 'H';
          if (action === 'H') {
            h.cards.push(take());
            continue;
          }
          // stand
          h.done = true;
        }
        hi++;
      }
    }

    _playDealer(dealerCards, take) {
      let guard = 0;
      while (guard++ < 20) {
        const t = handTotals(dealerCards);
        if (t.total > 17) break;
        if (t.total === 17 && !t.soft) break;
        // H17: hit soft 17
        if (t.total < 17 || (t.total === 17 && t.soft)) {
          dealerCards.push(take());
          continue;
        }
        break;
      }
    }

    liveCorrelations() {
      return this.seats.map((s) => {
        if (s.history.length < CASE01.correlationMinHands) return { seatId: s.id, r: null };
        const xs = s.history.map((h) => h.tcAtBet);
        const ys = s.history.map((h) => h.betUnits);
        return { seatId: s.id, r: pearsonR(xs, ys) };
      });
    }

    snapshot() {
      return {
        seed: this.seed,
        handIndex: this.handIndex,
        phase: this.phase,
        paused: this.paused,
        speedMs: this.speedMs,
        runningCount: this.runningCount,
        trueCount: this.trueCount(),
        decksRemaining: this.decksRemainingDisplay(),
        cardsLeft: this.shoe.cardsLeft(),
        cutCardReached: this.cutCardReached,
        forceCallPending: this.forceCallPending,
        called: this.called,
        call: this.call,
        peekUsed: this.peekUsed,
        hoverUsed: this.hoverUsed,
        hoverSeatId: this.hoverSeatId,
        shuffleUsed: this.shuffleUsed,
        tcAtShuffle: this.tcAtShuffle,
        selectedSeatId: this.selectedSeatId,
        canCall: this.canCall(),
        seats: this.seats.map((s) => ({
          id: s.id,
          name: s.name,
          archetype: this.debug ? s.archetype : undefined,
          stackUnits: s.stackUnits,
          betUnits: s.betUnits,
          nextBetUnits: s.nextBetUnits,
          marks: s.marks,
          flags: { ...s.flags },
          historyLen: s.history.length,
          lastOutcome: s.lastOutcome,
          goldTrim: s.flags.goldTrim,
          hands: s.hands,
          insured: s.insured,
          debugWanted: s._debugWanted,
        })),
        factChips: this.factChips,
        notebookNote: this.notebookNote,
        flavorLog: this.flavorLog.slice(-6),
        helpLevel: this.helpLevel,
        correlations: this.debug ? this.liveCorrelations() : undefined,
        counterRPreview: this.debug ? this.counterRPreview : undefined,
        rerollsUsed: this.rerollsUsed,
      };
    }

    _emit() {
      this.onUpdate(this.snapshot());
    }
  }

  // expose helpers for tests / dossier
  global.Case01Engine = Case01Engine;
  global.Case01Cards = {
    hiLoTag,
    cardValue,
    handTotals,
    isBlackjack,
    basicStrategy,
    roundHalfUp,
    pearsonR,
    RANKS,
    SUITS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
