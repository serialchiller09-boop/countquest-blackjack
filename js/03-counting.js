// §3 CARD COUNTING & BET SPREAD — Hi-Lo & KO systems
// ═══════════════════════════════════════════════════════════════
//
// HOW COUNTING WORKS IN THIS TRAINER
// ----------------------------------
// 1. TAG each card as it LEAVES the shoe (deal, burn, hole card, hit — everything).
// 2. RUNNING COUNT (RC) = sum of all tags seen this shoe. Starts at 0 after shuffle.
// 3. Hi-Lo (balanced): TRUE COUNT (TC) = RC ÷ decks remaining → bet spread from TC.
// 4. KO (unbalanced): bet spread from RC vs a deck-size key (pivot) — no TC conversion.
//
/** Counting system definitions — tags, betting model, and unlock hints. */
const COUNTING_SYSTEMS = {
  'hi-lo': {
    id: 'hi-lo',
    name: 'Hi-Lo',
    shortName: 'Hi-Lo',
    balanced: true,
    lowRanks: HI_LO_LOW_RANKS,
    neutralRanks: HI_LO_NEUTRAL_RANKS,
    unlockHint: 'Default system — always available.',
    betHint: 'Bet from true count (running count ÷ decks remaining).',
  },
  ko: {
    id: 'ko',
    name: 'Knock-Out (KO)',
    shortName: 'KO',
    balanced: false,
    lowRanks: new Set(['2','3','4','5','6','7']),
    neutralRanks: new Set(['8','9']),
    unlockHint: 'Unlock at Help Level 2 with 75% count accuracy (25+ quizzes).',
    betHint: 'Unbalanced — bet from running count vs key (pivot).',
  },
};

/** KO key count (pivot) by shoe size — bet ramps above this RC. */
const KO_PIVOT_BY_DECKS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4 };

function getKoPivot(numDecks) {
  const d = Math.max(1, Math.min(8, Math.floor(numDecks) || 6));
  return KO_PIVOT_BY_DECKS[d] ?? 4;
}

/**
 * Card tag for a counting system: +1 low, 0 neutral, -1 high (10/J/Q/K/A).
 * Ace is -1 for counting even though it counts as 11 in hand totals.
 */
function getCardTagForSystem(playingCard, systemId = 'hi-lo') {
  const sys = COUNTING_SYSTEMS[systemId] || COUNTING_SYSTEMS['hi-lo'];
  if (sys.lowRanks.has(playingCard.rank)) return +1;
  if (sys.neutralRanks.has(playingCard.rank)) return 0;
  return -1;
}

/** Hi-Lo tag shorthand (tests & legacy call sites). */
function getHiLoTagForCard(playingCard) {
  return getCardTagForSystem(playingCard, 'hi-lo');
}

function getKoTagForCard(playingCard) {
  return getCardTagForSystem(playingCard, 'ko');
}

/**
 * CardCounter — running count state for the active counting system.
 * Call recordCardRemovedFromShoe() for every card that leaves the shoe.
 */
class CardCounter {
  constructor(systemId = 'hi-lo') {
    this.systemId = COUNTING_SYSTEMS[systemId] ? systemId : 'hi-lo';
    /** Running count (RC): cumulative tag sum this shoe. */
    this.runningCount = 0;
    /** Total cards tagged this shoe (for stats / penetration context). */
    this.totalCardsCounted = 0;
  }

  reset() { this.runningCount = 0; this.totalCardsCounted = 0; }

  /**
   * Record one card removed from the shoe and update the running count.
   * @returns {number} the tag applied (+1, 0, or -1)
   */
  recordCardRemovedFromShoe(playingCard) {
    const tag = getCardTagForSystem(playingCard, this.systemId);
    this.runningCount += tag;
    this.totalCardsCounted++;
    return tag;
  }

  /**
   * True count (TC) = running count ÷ decks remaining (Hi-Lo betting metric).
   * Floor at 0.5 decks to avoid divide-by-zero near end of shoe.
   */
  calculateTrueCount(decksRemaining) {
    return this.runningCount / Math.max(decksRemaining, 0.5);
  }

  /** Snapshot used by HUD, bet phase, and quizzes. */
  getCountSnapshot(shoe) {
    const decksRemaining = shoe.decksRemaining();
    const numDecks = shoe.numDecks;
    const sys = COUNTING_SYSTEMS[this.systemId];
    const snap = {
      systemId: this.systemId,
      systemName: sys.shortName,
      runningCount: this.runningCount,
      trueCount: this.calculateTrueCount(decksRemaining),
      decksRemaining,
      cardsCounted: this.totalCardsCounted,
      numDecks,
    };
    if (!sys.balanced) {
      snap.pivot = getKoPivot(numDecks);
      snap.abovePivot = this.runningCount - snap.pivot;
    }
    return snap;
  }

  formatCountLine(shoe) {
    const snap = this.getCountSnapshot(shoe);
    const rcText = snap.runningCount >= 0 ? `+${snap.runningCount}` : `${snap.runningCount}`;
    if (COUNTING_SYSTEMS[snap.systemId]?.balanced) {
      const tcText = snap.trueCount >= 0 ? `+${snap.trueCount.toFixed(1)}` : snap.trueCount.toFixed(1);
      return `${snap.systemName} Running count ${rcText} | True count ${tcText} | Decks ${snap.decksRemaining.toFixed(2)}`;
    }
    const keyText = snap.abovePivot >= 0 ? `+${snap.abovePivot}` : `${snap.abovePivot}`;
    return `${snap.systemName} Running count ${rcText} | vs Key +${snap.pivot} (${keyText}) | Decks ${snap.decksRemaining.toFixed(2)}`;
  }
}

/** Backward-compatible alias — always Hi-Lo. */
class HiLoCounter extends CardCounter {
  constructor() { super('hi-lo'); }
}

/**
 * Bet spread: map true count to unit multiplier (standard 1–6 spread).
 * TC ≤ 0 → 1 unit (minimum). Each full +1 TC adds one unit, capped at 6.
 */
function betSpreadUnitsFromTrueCount(trueCount) {
  if (trueCount <= 0) return 1;
  return Math.min(1 + Math.floor(trueCount), 6);
}

/** KO spread: RC at/below pivot → 1 unit; each +1 above pivot adds a unit (max 6). */
function betSpreadUnitsFromKoRunningCount(runningCount, pivot) {
  const above = runningCount - pivot;
  if (above <= 0) return 1;
  return Math.min(1 + Math.floor(above), 6);
}

/** System-aware unit count from a count snapshot. */
function betSpreadUnitsFromCountSnapshot(snapshot) {
  const sys = COUNTING_SYSTEMS[snapshot.systemId || 'hi-lo'];
  if (sys?.balanced) return betSpreadUnitsFromTrueCount(snapshot.trueCount);
  return betSpreadUnitsFromKoRunningCount(snapshot.runningCount, snapshot.pivot ?? getKoPivot(snapshot.numDecks));
}

/**
 * Suggest a wager from a count snapshot, bankroll, and table limits.
 * Caps at 10% of bankroll so practice sessions don't go bust from one bet.
 */
function suggestWagerFromCountSnapshot(snapshot, bankroll, unitSize, minBet) {
  const sys = COUNTING_SYSTEMS[snapshot.systemId || 'hi-lo'];
  const units = betSpreadUnitsFromCountSnapshot(snapshot);
  let amount = units * unitSize;
  const bankrollCap = Math.max(Math.floor(bankroll * 0.1), minBet);
  const wasCappedByBankroll = amount > bankrollCap;
  amount = Math.min(amount, bankrollCap, bankroll);
  amount = Math.max(amount, minBet);
  return {
    systemId: snapshot.systemId || 'hi-lo',
    trueCount: snapshot.trueCount,
    runningCount: snapshot.runningCount,
    pivot: snapshot.pivot,
    abovePivot: snapshot.abovePivot,
    betMetric: sys?.balanced ? snapshot.trueCount : (snapshot.abovePivot ?? 0),
    betMetricLabel: sys?.balanced ? 'tc' : 'key',
    units: Math.max(1, Math.floor(amount / unitSize)),
    unitSize,
    amount,
    wasCappedByBankroll,
  };
}

/**
 * Suggest a wager from true count (Hi-Lo path — kept for tests).
 * Caps at 10% of bankroll so practice sessions don't go bust from one bet.
 */
function suggestWagerFromTrueCount(trueCount, bankroll, unitSize, minBet) {
  return suggestWagerFromCountSnapshot(
    { systemId: 'hi-lo', trueCount, runningCount: 0, numDecks: 6 },
    bankroll, unitSize, minBet,
  );
}

function insurancePayout(bet, dealerBJ) { return bet <= 0 ? 0 : dealerBJ ? bet * 2 : -bet; }
function maxInsurance(main) { return Math.floor(main / 2); }

function compareHands(player, dealer) {
  if (player.isBust()) return 'loss';
  if (player.isBlackjack() && dealer.isBlackjack()) return 'push';
  if (player.isBlackjack()) return 'blackjack';
  if (dealer.isBust()) return 'win';
  const pv = player.value(), dv = dealer.value();
  if (pv > dv) return 'win';
  if (pv < dv) return 'loss';
  return 'push';
}

function payout(bet, result, rules = DEFAULT_RULES) {
  if (result === 'blackjack') return Math.floor(bet * (rules.blackjackPayout || 1.5));
  if (result === 'win') return bet;
  if (result === 'push') return 0;
  if (result === 'surrender') return -Math.floor(bet / 2);
  return -bet;
}

function dealerShouldHit(h, rules = DEFAULT_RULES) {
  const t = h.value();
  if (t < 17) return true;
  if (t === 17 && h.isSoft() && rules.dealerHitsSoft17) return true;
  return false;
}

/** Dealer Mode — player runs the table with 3–5 AI players. */
const DEALER_MODE = {
  minPlayers: 3,
  maxPlayers: 5,
  defaultPlayers: 4,
  startBank: 10000,
  minBet: 25,
  maxBet: 500,
  handsPerSession: 12,
  payoutTimeMs: 10000,
  dealerActionTimeMs: 7000,
  countQuizEvery: 3,
  countQuizTimeMs: 8000,
  insuranceTimeMs: 8000,
  maxSplitsPerSeat: 1,
  minHandsForReward: 6,
};

const DEALER_INSURANCE_OPTIONS = [
  { id: 'pay', label: 'Pay 2:1', cls: 'dealer-pay-win' },
  { id: 'collect', label: 'Insurance Loses', cls: 'dealer-pay-loss' },
];

const DEALER_AI_ROSTER = [
  { name: 'VegasVic', avatar: '🎰' },
  { name: 'ChipQueen', avatar: '👑' },
  { name: 'AceHigh', avatar: '🃏' },
  { name: 'SplitKing', avatar: '✂️' },
  { name: 'DoubleD', avatar: '💎' },
  { name: 'LuckyLou', avatar: '🍀' },
  { name: 'HighLimit', avatar: '🔥' },
];

const DEALER_PAYOUT_OPTIONS = [
  { id: 'blackjack', label: 'Player BJ', cls: 'dealer-pay-bj' },
  { id: 'win', label: 'Player Wins', cls: 'dealer-pay-win' },
  { id: 'push', label: 'Push', cls: 'dealer-pay-push' },
  { id: 'loss', label: 'Player Loses', cls: 'dealer-pay-loss' },
];

function defaultDealerModeStats() {
  return {
    sessionsPlayed: 0,
    bestPayoutAccuracy: 0,
    bestCountAccuracy: 0,
    totalHands: 0,
    totalPayoutCorrect: 0,
    totalPayoutAttempts: 0,
    totalCountCorrect: 0,
    totalCountAttempts: 0,
    lastSession: null,
  };
}

function randomDealerSeatCount() {
  const span = DEALER_MODE.maxPlayers - DEALER_MODE.minPlayers + 1;
  return DEALER_MODE.minPlayers + Math.floor(Math.random() * span);
}

function createDealerAISeats(count = DEALER_MODE.defaultPlayers) {
  const picks = shuffleArray([...DEALER_AI_ROSTER]).slice(0, count);
  return picks.map((p, i) => ({
    id: `seat_${i}`,
    name: p.name,
    avatar: p.avatar,
    bet: DEALER_MODE.minBet,
    hands: [],
    insurance: 0,
    sessionNet: 0,
  }));
}

/** Seat numbers around the human (seat 4) on the 7-seat casino table. */
const TABLE_AI_SEAT_NUMS = [1, 2, 3, 5, 6, 7];
const TABLE_DEAL_ORDER = [1, 2, 3, 4, 5, 6, 7];
const TABLE_AI_MAX_SPLITS = 3;

function createTableAiSeats() {
  const picks = shuffleArray([...DEALER_AI_ROSTER]).slice(0, TABLE_AI_SEAT_NUMS.length);
  const seats = {};
  TABLE_AI_SEAT_NUMS.forEach((seatNum, i) => {
    const p = picks[i];
    seats[seatNum] = {
      seatNum,
      name: p.name,
      avatar: p.avatar,
      bet: 0,
      insurance: 0,
      hands: [],
      results: [],
    };
  });
  return seats;
}

function tableAiSplitCount(seat) {
  return Math.max(0, (seat.hands?.length || 1) - 1);
}

function tableAiSeatTotalBet(seat) {
  return (seat.hands || []).reduce((sum, hs) => sum + (hs.bet || 0), 0);
}

function renderTableAiMiniCard(card, hidden = false) {
  if (hidden) return '<div class="casino-ai-mini-card back">?</div>';
  const red = card.suit === 'H' || card.suit === 'D';
  return `<div class="casino-ai-mini-card ${red ? 'red' : ''}">${card.rank}</div>`;
}

function tableAiStrategyAction(handState, dealerUpRank, rules, splitCount, snap, systemId = 'hi-lo') {
  const canDouble = handState.hand.size === 2 && !handState.doubled;
  const canSplit = handState.hand.size === 2
    && handState.hand.cards[0].rank === handState.hand.cards[1].rank
    && !handState.fromSplit && !handState.splitAces
    && splitCount < TABLE_AI_MAX_SPLITS;
  const stratOpts = { trueCount: snap?.trueCount ?? null, countingSystemId: systemId };
  let advice = advise(handState.hand, dealerUpRank, canDouble, canSplit, stratOpts);
  let action = advice.action;
  if (action === 'surrender') action = 'stand';
  if (action === 'split' && canSplit) return 'split';
  if (action === 'double' && canDouble) return 'double';
  if (action === 'double') return 'hit';
  return action;
}

function dealerAIBetForSeat(snapshot, minBet, maxBet) {
  const units = betSpreadUnitsFromCountSnapshot(snapshot);
  return Math.min(maxBet, Math.max(minBet, minBet * units));
}

function dealerExpectedPlayerResult(playerHand, dealerHand, fromSplit = false) {
  let r = compareHands(playerHand, dealerHand);
  if (fromSplit && r === 'blackjack') r = 'win';
  return r;
}

function validateDealerPayoutGuess(guess, playerHand, dealerHand, fromSplit = false) {
  const expected = dealerExpectedPlayerResult(playerHand, dealerHand, fromSplit);
  return { ok: guess === expected, expected, guess };
}

function dealerHouseNetForResult(bet, result, rules = DEFAULT_RULES) {
  const playerNet = payout(bet, result, rules);
  return -playerNet;
}

function dealerActionPrompt(dealerHand, rules = DEFAULT_RULES) {
  const mustHit = dealerShouldHit(dealerHand, rules);
  const total = dealerHand.value();
  const soft = dealerHand.isSoft();
  const obvious = total < 12 || total >= 18 || (total === 17 && !soft);
  return {
    mustHit,
    correct: mustHit ? 'hit' : 'stand',
    total,
    soft,
    obvious,
    label: soft ? `Soft ${total}` : `Hard ${total}`,
  };
}

function dealerResultLabel(result) {
  return {
    win: 'Player Wins',
    loss: 'Player Loses',
    push: 'Push',
    blackjack: 'Player Blackjack',
    surrender: 'Surrender',
  }[result] || result;
}

function dealerModeAIStrategyAction(handState, dealerUpRank, rules, splitCount = 0) {
  const canDouble = handState.hand.size === 2 && !handState.doubled;
  const canSplit = handState.hand.size === 2
    && handState.hand.cards[0].rank === handState.hand.cards[1].rank
    && !handState.fromSplit && !handState.splitAces
    && splitCount < DEALER_MODE.maxSplitsPerSeat;
  let advice = advise(handState.hand, dealerUpRank, canDouble, canSplit);
  let action = advice.action;
  if (action === 'surrender') action = 'stand';
  if (action === 'split' && canSplit) return 'split';
  if (action === 'double' && canDouble) return 'double';
  if (action === 'double') return 'hit';
  return action;
}

function dealerUpShowsPeek(upRank) {
  return upRank === 'A' || isTenValueRank(upRank);
}

function dealerHasNaturalBlackjack(dealerHand) {
  return dealerHand.size >= 2 && dealerHand.isBlackjack();
}

function dealerSeatSplitCount(seat) {
  return Math.max(0, (seat.hands?.length || 1) - 1);
}

function dealerSeatTotalBet(seat) {
  return (seat.hands || []).reduce((sum, hs) => sum + (hs.bet || 0), 0);
}

function computeDealerShiftReward(payoutAcc, handsPlayed, early, housePL, event = null) {
  if (early || handsPlayed < DEALER_MODE.minHandsForReward) {
    return { chips: 0, gems: 0, reason: early ? 'ended early' : 'too few hands' };
  }
  let chips = 30 + Math.round(payoutAcc * 0.4);
  if (payoutAcc >= 90) chips += 40;
  if (payoutAcc === 100 && handsPlayed >= DEALER_MODE.handsPerSession) chips += 75;
  if (housePL > 0) chips += Math.min(150, Math.round(housePL * 0.03));
  if (event?.rewardMultiplier) chips = Math.round(chips * event.rewardMultiplier);
  let gems = payoutAcc >= 95 && handsPlayed >= 10 ? 1 : 0;
  if (event?.bonusGemsOnShift && payoutAcc >= (event.bonusGemsThreshold || 95)) {
    gems += event.bonusGemsOnShift;
  }
  return { chips, gems, reason: null };
}

function dealerAITakesInsurance(snapshot) {
  return snapshot.trueCount >= 3;
}

function dealerInsuranceHouseNet(insuranceBet, dealerBJ) {
  return dealerBJ ? -insuranceBet * 2 : insuranceBet;
}

function isDealerEventActive(event) {
  return event?.eventType === 'dealer';
}

function generateDecksLeftProblem(numDecks = 6) {
  const shoe = new Shoe(numDecks);
  const counter = new CardCounter('hi-lo');
  const minDeal = Math.max(12, Math.floor(shoe._initial * 0.12));
  const maxDeal = Math.floor(shoe._initial * 0.72);
  const cardsToDeal = minDeal + Math.floor(Math.random() * (maxDeal - minDeal + 1));
  for (let i = 0; i < cardsToDeal; i++) {
    counter.recordCardRemovedFromShoe(shoe.deal());
  }
  const actual = Math.round(shoe.decksRemaining() * 100) / 100;
  return {
    numDecks,
    cardsDealt: cardsToDeal,
    cardsRemaining: shoe.cardsRemaining,
    runningCount: counter.runningCount,
    decksRemaining: actual,
  };
}

function validateDecksLeftGuess(raw, actual, tolerance = 0.25) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Enter decks remaining' };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid number' };
  const error = Math.abs(n - actual);
  return { ok: true, value: n, correct: error <= tolerance, error: Math.round(error * 100) / 100 };
}

function defaultCardBurstDrillStats() {
  return { sessions: [] };
}

function defaultDecksLeftDrillStats() {
  return { prefs: { numDecks: 6, roundSize: 8, tolerance: 0.25 }, sessions: [] };
}

function summarizeCardBurstRounds(rounds) {
  if (!rounds?.length) return { total: 0, accuracy: 0, avgError: 0 };
  const total = rounds.length;
  const correct = rounds.filter(r => r.withinOne).length;
  return {
    total,
    accuracy: Math.round(100 * correct / total),
    avgError: Math.round(rounds.reduce((a, r) => a + r.error, 0) / total * 100) / 100,
  };
}

function summarizeDecksLeftRounds(rounds) {
  if (!rounds?.length) return { total: 0, accuracy: 0, avgError: 0 };
  const total = rounds.length;
  const correct = rounds.filter(r => r.correct).length;
  return {
    total,
    accuracy: Math.round(100 * correct / total),
    avgError: Math.round(rounds.reduce((a, r) => a + r.error, 0) / total * 100) / 100,
  };
}

/**
 * Rough player-edge % from average bet metric this shoe (educational, not exact).
 * Hi-Lo: metric = true count. KO: metric = running count vs key (above pivot).
 */
function estimateShoeEVFromBetMetric(handsPlayed, averageMetric, rules, systemId = 'hi-lo') {
  const edgePerPoint = rules.blackjackPayout < 1.5 ? 0.004 : 0.005;
  const baseHouseEdge = -0.005;
  const koScale = systemId === 'ko' ? 0.85 : 1;
  const est = (baseHouseEdge + averageMetric * edgePerPoint * koScale) * 100;
  return Math.max(-2.5, Math.min(2.5, est));
}

/** @deprecated alias — passes through as Hi-Lo true-count metric */
function estimateShoeEV(handsPlayed, averageMetric, rules, systemId = 'hi-lo') {
  return estimateShoeEVFromBetMetric(handsPlayed, averageMetric, rules, systemId);
}

/** Text sparkline of running-count history for end-of-shoe report. */
function buildCountGraphAscii(runningCountSamples, width = 40) {
  if (!runningCountSamples.length) return '(no count data)';
  const min = Math.min(...runningCountSamples), max = Math.max(...runningCountSamples);
  const range = Math.max(max - min, 1);
  const step = Math.max(1, Math.floor(runningCountSamples.length / width));
  const pts = [];
  for (let i = 0; i < runningCountSamples.length; i += step) pts.push(runningCountSamples[i]);
  const h = 8;
  const lines = [];
  for (let row = h - 1; row >= 0; row--) {
    let line = '';
    for (const v of pts) {
      const norm = (v - min) / range;
      line += norm * h >= row && norm * h < row + 1 ? '█' : ' ';
    }
    lines.push(line);
  }
  lines.push('─'.repeat(pts.length));
  lines.push(`Running count ${min} → ${max} (${runningCountSamples.length} samples)`);
  return lines.join('\n');
}

/** Canvas line chart of running count across the shoe (green = RC trend). */
function drawCountCanvas(canvas, runningCountSamples) {
  if (!canvas || !runningCountSamples.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth || 400;
  const h = canvas.height = 120;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...runningCountSamples, 0), max = Math.max(...runningCountSamples, 0);
  const pad = 8;
  const zeroY = h - pad - ((0 - min) / Math.max(max - min, 1)) * (h - 2 * pad);
  ctx.strokeStyle = 'rgba(148,163,184,.35)';
  ctx.beginPath();
  ctx.moveTo(pad, zeroY);
  ctx.lineTo(w - pad, zeroY);
  ctx.stroke();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.beginPath();
  runningCountSamples.forEach((v, i) => {
    const x = pad + (i / Math.max(runningCountSamples.length - 1, 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / Math.max(max - min, 1)) * (h - 2 * pad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '11px monospace';
  const lastRc = runningCountSamples[runningCountSamples.length - 1];
  ctx.fillText(`Running count ${lastRc >= 0 ? '+' : ''}${lastRc}`, pad, 14);
}

function canSplit(h) { return h.size === 2 && h.cards[0].rank === h.cards[1].rank; }

// ═══════════════════════════════════════════════════════════════
