// §4 BASIC STRATEGY
// ═══════════════════════════════════════════════════════════════
/** Dealer upcard rank → numeric value for basic strategy lookups (Ace = 11). */
const parseDealerUpcardAsNumber = (rank) => isAceRank(rank) ? 11 : isTenValueRank(rank) ? 10 : parseInt(rank, 10);
const formatDealerUpcardLabel = (dealerValue) => dealerValue === 11 ? 'Ace' : String(dealerValue);

function makeStrategyAdvice(action, rationale) { return { action, rationale }; }

function pairStrat(rank, dealer) {
  const d = formatDealerUpcardLabel(dealer);
  if (rank === 'A') return makeStrategyAdvice('split', `Split Aces vs ${d}`);
  if (rank === '8') return makeStrategyAdvice('split', `Split 8s vs ${d}`);
  if (isTenValueRank(rank)) return makeStrategyAdvice('stand', `Stand on 20 vs ${d}`);
  if (rank === '9') return [7,10,11].includes(dealer) ? makeStrategyAdvice('stand', `Stand 18 vs ${d}`) : makeStrategyAdvice('split', `Split 9s vs ${d}`);
  if (rank === '7') return dealer >= 2 && dealer <= 7 ? makeStrategyAdvice('split', `Split 7s vs ${d}`) : makeStrategyAdvice('hit', `Hit 14 vs ${d}`);
  if (rank === '6') return dealer >= 2 && dealer <= 6 ? makeStrategyAdvice('split', `Split 6s vs ${d}`) : makeStrategyAdvice('hit', `Hit 12 vs ${d}`);
  if (rank === '4') return [5,6].includes(dealer) ? makeStrategyAdvice('split', `Split 4s vs ${d}`) : makeStrategyAdvice('hit', `Hit 8 vs ${d}`);
  if (rank === '2' || rank === '3') return dealer >= 2 && dealer <= 7 ? makeStrategyAdvice('split', `Split ${rank}s vs ${d}`) : makeStrategyAdvice('hit', `Hit vs ${d}`);
  return makeStrategyAdvice('hit', 'Treat 5+5 as hard 10');
}

function softStrat(total, dealer) {
  const d = formatDealerUpcardLabel(dealer);
  if (total >= 19) return makeStrategyAdvice('stand', `Stand soft ${total} vs ${d}`);
  if (total === 18) {
    if ([9,10,11].includes(dealer)) return makeStrategyAdvice('hit', `Hit soft 18 vs ${d}`);
    if (dealer >= 3 && dealer <= 6) return makeStrategyAdvice('double', `Double soft 18 vs ${d}`);
    return makeStrategyAdvice('stand', `Stand soft 18 vs ${d}`);
  }
  if (total === 17) return dealer >= 3 && dealer <= 6 ? makeStrategyAdvice('double', `Double soft 17 vs ${d}`) : makeStrategyAdvice('hit', `Hit soft 17 vs ${d}`);
  if (total === 15 || total === 16) return dealer >= 4 && dealer <= 6 ? makeStrategyAdvice('double', `Double soft ${total} vs ${d}`) : makeStrategyAdvice('hit', `Hit soft ${total} vs ${d}`);
  if (total === 13 || total === 14) return [5,6].includes(dealer) ? makeStrategyAdvice('double', `Double soft ${total} vs ${d}`) : makeStrategyAdvice('hit', `Hit soft ${total} vs ${d}`);
  return makeStrategyAdvice('hit', `Hit soft ${total}`);
}

function hardStrat(total, dealer) {
  const d = formatDealerUpcardLabel(dealer);
  if (total >= 17) return makeStrategyAdvice('stand', `Stand ${total} vs ${d}`);
  if (total >= 13 && total <= 16) return dealer >= 2 && dealer <= 6 ? makeStrategyAdvice('stand', `Stand ${total} vs ${d}`) : makeStrategyAdvice('hit', `Hit ${total} vs ${d}`);
  if (total === 12) return dealer >= 4 && dealer <= 6 ? makeStrategyAdvice('stand', `Stand 12 vs ${d}`) : makeStrategyAdvice('hit', `Hit 12 vs ${d}`);
  if (total === 11) return dealer === 11 ? makeStrategyAdvice('hit', 'Hit 11 vs Ace') : makeStrategyAdvice('double', `Double 11 vs ${d}`);
  if (total === 10) return dealer >= 2 && dealer <= 9 ? makeStrategyAdvice('double', `Double 10 vs ${d}`) : makeStrategyAdvice('hit', `Hit 10 vs ${d}`);
  if (total === 9) return dealer >= 3 && dealer <= 6 ? makeStrategyAdvice('double', `Double 9 vs ${d}`) : makeStrategyAdvice('hit', `Hit 9 vs ${d}`);
  return makeStrategyAdvice('hit', `Hit ${total} vs ${d}`);
}

/** Normalize rank for index-play hand matching (tens → '10'). */
function rankForIndexPlayMatch(rank) {
  return isTenValueRank(rank) ? '10' : rank;
}

function handRanksMatchIndexPlay(hand, play) {
  if (!hand || hand.size !== play.playerRanks.length) return false;
  const actual = hand.cards.map(c => rankForIndexPlayMatch(c.rank)).sort();
  const expected = [...play.playerRanks].sort();
  return actual.every((r, i) => r === expected[i]);
}

function findMatchingIndexPlay(hand, dealerUpcardRank) {
  const up = rankForIndexPlayMatch(dealerUpcardRank);
  return INDEX_PLAY_CATALOG.find(p => p.category !== 'insurance' && p.dealerUp === up && handRanksMatchIndexPlay(hand, p)) || null;
}

function isIndexDeviationRationale(rationale) {
  return typeof rationale === 'string' && rationale.startsWith('Index ');
}

function formatStrategyHintText(advice) {
  const prefix = isIndexDeviationRationale(advice.rationale) ? 'INDEX' : 'Strategy';
  return `${prefix} → ${advice.action.toUpperCase()}: ${advice.rationale}`;
}

function getLiveIndexContext(hand, dealerUpcardRank, trueCount, countingSystemId = 'hi-lo', useIndexDeviations = true) {
  if (!useIndexDeviations || countingSystemId !== 'hi-lo' || trueCount == null || Number.isNaN(trueCount)) {
    return { hasIndexPlay: false, useIndex: false, play: null };
  }
  const play = findMatchingIndexPlay(hand, dealerUpcardRank);
  if (!play) return { hasIndexPlay: false, useIndex: false, play: null };
  const idx = getIndexPlayCorrectAction(play, trueCount);
  return { hasIndexPlay: true, useIndex: !!idx.useIndex, play };
}

function applyIndexPlayDeviation(hand, dealerUpcardRank, canDouble, canSplit, trueCount, countingSystemId = 'hi-lo', useIndexDeviations = true) {
  if (!useIndexDeviations || countingSystemId !== 'hi-lo' || trueCount == null || Number.isNaN(trueCount)) return null;
  const play = findMatchingIndexPlay(hand, dealerUpcardRank);
  if (!play) return null;
  const idx = getIndexPlayCorrectAction(play, trueCount);
  if (idx.action === 'insurance' || idx.action === 'no-insurance') return null;
  let action = idx.action;
  if (action === 'double' && !canDouble) action = 'hit';
  if (action === 'split' && !canSplit) action = 'hit';
  const indexFmt = play.index >= 0 ? `+${play.index}` : `${play.index}`;
  const rationale = idx.useIndex
    ? `Index ${indexFmt} — ${idx.explanation}`
    : `${idx.explanation}`;
  return makeStrategyAdvice(action, rationale);
}

/** Insurance deviation vs dealer Ace (Hi-Lo true count +3 index). */
function adviseInsurance(trueCount, countingSystemId = 'hi-lo', useIndexDeviations = true) {
  const play = INDEX_PLAY_CATALOG.find(p => p.id === 'ins-tc3');
  if (!useIndexDeviations || !play || countingSystemId !== 'hi-lo' || trueCount == null || Number.isNaN(trueCount)) {
    return { action: 'no-insurance', rationale: 'Skip insurance — basic strategy (count not used).' };
  }
  const idx = getIndexPlayCorrectAction(play, trueCount);
  return {
    action: idx.action,
    rationale: idx.explanation,
    useIndex: idx.useIndex,
    summary: idx.summary,
  };
}

function advise(hand, dealerUpcardRank, canDouble, canSplit, opts = {}) {
  const { trueCount = null, countingSystemId = 'hi-lo', useIndexDeviations = true } = opts;
  const indexAdvice = applyIndexPlayDeviation(hand, dealerUpcardRank, canDouble, canSplit, trueCount, countingSystemId, useIndexDeviations);
  if (indexAdvice) return indexAdvice;
  const dealerUpcardValue = parseDealerUpcardAsNumber(dealerUpcardRank);
  if (canSplit && hand.size === 2 && hand.cards[0].rank === hand.cards[1].rank) {
    const p = pairStrat(hand.cards[0].rank, dealerUpcardValue);
    if (p.action === 'split') return p;
  }
  let a = hand.isSoft() ? softStrat(hand.value(), dealerUpcardValue) : hardStrat(hand.value(), dealerUpcardValue);
  if (a.action === 'double' && !canDouble) return makeStrategyAdvice('hit', a.rationale + " (can't double → hit)");
  return a;
}

const CHART_BODY = `HARD: 8↓ Hit | 9 Dbl 3–6 | 10 Dbl 2–9 | 11 Dbl 2–10 Hit vs A
12 Stand 4–6 | 13–16 Stand 2–6 | 17+ Stand

SOFT: A2–A3 Dbl 5–6 | A4–A5 Dbl 4–6 | A6 Dbl 3–6
A7 Stand 2,7,8 Dbl 3–6 Hit 9,10,A | A8+ Stand

PAIRS: A,A/8,8 Split | 2,2/3,3 Split 2–7 | 4,4 Split 5–6
5,5 Never split | 6,6 Split 2–6 | 7,7 Split 2–7
9,9 Split 2–6,8,9 Stand 7,10,A | 10,10 Stand`;

const CHART_TEXT = `BASIC STRATEGY (6–8 deck, dealer hits soft 17)\n\n${CHART_BODY}`;

/** Strategy chart header reflecting active table rules. */
function describeRulesForChart(rules = DEFAULT_RULES) {
  return [
    rules.blackjackPayout < 1.5 ? '6:5 blackjack' : '3:2 blackjack',
    rules.das ? 'DAS' : 'no DAS',
    rules.lateSurrender ? 'late surrender' : 'no surrender',
    rules.dealerHitsSoft17 ? 'dealer hits soft 17' : 'dealer stands soft 17',
  ].join(' · ');
}

/** Full chart modal text — adapts to counting system and table rules. */
function buildStrategyChartContent(rules = DEFAULT_RULES, systemId = 'hi-lo') {
  const sys = COUNTING_SYSTEMS[systemId] || COUNTING_SYSTEMS['hi-lo'];
  const pivot = getKoPivot(6);
  const lines = [];
  if (rulesDifferFromChart(rules)) {
    lines.push('⚠ TABLE RULES DIFFER FROM THE DEFAULT CHART — strategy hints are approximate.');
    lines.push(`Your table: ${describeRulesForChart(rules)}`);
    lines.push('');
  }
  if (systemId === 'ko') {
    lines.push(`ℹ Counting: ${sys.name} — basic strategy plays are the same as Hi-Lo.`);
    lines.push(`Bet sizing uses running count vs key (pivot ≈ +${pivot} on 6 decks), not true count.`);
  } else {
    lines.push('ℹ Counting: Hi-Lo — use true count (running count ÷ decks remaining) for bet sizing.');
    lines.push('Index deviations (e.g. stand 16 vs 10 at TC 0+) apply in live play when Help Level shows strategy hints.');
  }
  lines.push('');
  lines.push(`BASIC STRATEGY (${describeRulesForChart(rules)})`);
  lines.push('');
  lines.push(CHART_BODY);
  return lines.join('\n');
}

/** Settings advisory: rule mismatches + KO-specific chart note. */
function buildSettingsAdvisoryText(rules = DEFAULT_RULES, systemId = 'hi-lo', numDecks = 6) {
  const parts = [];
  if (rulesDifferFromChart(rules)) {
    parts.push('⚠ These rules differ from the default chart (6–8 deck, H17, 3:2, DAS). Strategy hints are approximate.');
    parts.push(`Active: ${describeRulesForChart(rules)}`);
  }
  if (systemId === 'ko') {
    const pivot = getKoPivot(numDecks);
    parts.push(`ℹ KO counting active — chart shows play strategy only. Bet from running count vs key (+${pivot} on ${numDecks} decks), not true count.`);
  }
  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════
