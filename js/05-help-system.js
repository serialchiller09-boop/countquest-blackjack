// §5 HELP SYSTEM — coaching intensity (count visibility scales with level)
// ═══════════════════════════════════════════════════════════════
/**
 * Controls how much counting help the player sees:
 *   L0 Novice    — RC/TC on screen, per-card +1/−1 flashes, exact bet hint
 *   L1 Guided    — confirm RC before bet, bet range (not exact), hints on close calls
 *   L2 Practice  — count HIDDEN during play; post-hand RC quiz trains internal tracking
 *   L3 Challenge — no in-play help; full shoe analysis when the shoe reshuffles
 *   L4 Expert    — pure sim; analytics at session end only
 */
class HelpSystem {
  constructor(level = 0, modeProfile = 'normal') {
    this.level = level;
    this.modeProfile = modeProfile;
    this.shoeNum = 1;
    this.shoeHands = 0;
    this.shoeGuesses = 0;
    this.shoeCorrect = 0;
    this.shoeMistakes = 0;
    this.sessionMistakes = [];
    this.shoeDecisionMistakes = [];
    /** Running count after each dealt card — feeds shoe-end graph. */
    this.runningCountHistory = [];
    /** True count at each hand's bet phase — for shoe EV estimate. */
    this.trueCountsPerHand = [];
    this.shoeBets = [];
  }
  setModeProfile(p) { this.modeProfile = p; }
  modeHint() {
    const m = {
      tutorial: 'Tutorial — full coaching on every step.',
      'drill-count': 'Count drill — focus on tracking; count shown while dealing.',
      'drill-speed': 'Speed drill — Hi-Lo running count at deal speed.',
      'drill-true-count': 'True count drill — running count ÷ decks remaining.',
      'drill-decisions': 'Decision drill — count hidden; strategy coaching on mistakes.',
      'drill-combined': 'Combined practice — real hands; count hidden; strategy + count feedback each hand.',
      'drill-index': 'Index play drill — Hi-Lo strategy deviations at each true count.',
      'drill-bet-spread': 'Bet spread practice — ramp wagers to the true count.',
      'drill-betting': 'Bet drill — pick the right wager for the true count.',
      campaign: 'Campaign — standard help for your selected level.',
      daily: 'Daily challenge — play sharp; check progress in the header.',
      normal: null,
    };
    return m[this.modeProfile] || null;
  }
  showCountInPlay() {
    if (this.modeProfile === 'drill-decisions' || this.modeProfile === 'drill-combined') return false;
    if (this.modeProfile === 'drill-betting') return true;
    if (this.modeProfile === 'tutorial') return true;
    return this.level <= 1;
  }
  showCountAtTable() {
    if (this.modeProfile === 'drill-decisions' || this.modeProfile === 'drill-combined') return false;
    if (this.modeProfile === 'drill-betting') return true;
    if (this.modeProfile === 'tutorial') return true;
    return this.level <= 1;
  }
  showPerCardCount() {
    if (this.modeProfile === 'drill-combined') return false;
    if (this.modeProfile === 'tutorial' || this.modeProfile === 'drill-count') return true;
    return this.level === 0;
  }
  requireCountConfirm() {
    if (this.modeProfile === 'tutorial') return false;
    return this.level === 1 && this.modeProfile === 'normal';
  }
  showBetSuggestion() {
    if (this.modeProfile === 'drill-betting') return true;
    if (this.modeProfile === 'tutorial') return true;
    return this.level <= 1;
  }
  showExactBet() {
    if (this.modeProfile === 'drill-betting') return true;
    if (this.modeProfile === 'tutorial') return true;
    return this.level === 0;
  }
  showBetRange() { return this.level === 1 && this.modeProfile !== 'drill-betting'; }
  showEndOfHandCount() {
    if (this.modeProfile === 'drill-decisions') return false;
    if (this.modeProfile === 'drill-combined') return true;
    return this.level <= 2 || this.modeProfile === 'tutorial';
  }
  postHandQuiz() {
    if (this.modeProfile === 'drill-combined') return true;
    if (this.modeProfile === 'drill-decisions' || this.modeProfile === 'drill-betting') return false;
    return this.level === 2 || this.level === 3;
  }
  postHandQuizOptional() {
    if (this.modeProfile === 'tutorial') return true;
    return this.level === 0;
  }
  postHandReview() {
    if (this.modeProfile === 'drill-combined') return true;
    if (this.modeProfile === 'tutorial') return true;
    return this.level === 0;
  }
  showSessionStatsEachHand() { return this.level <= 3 || this.modeProfile === 'daily'; }
  postShoeSummary() {
    return this.level >= 2 || this.modeProfile === 'campaign' || this.modeProfile === 'daily' || this.modeProfile === 'drill-count';
  }
  expertOnly() { return this.level === 4 && this.modeProfile === 'normal'; }
  allowChart() {
    if (this.modeProfile === 'tutorial' || this.modeProfile === 'drill-decisions') return true;
    return this.level <= 3;
  }
  blockHints() { return this.level === 4 && this.modeProfile === 'normal'; }
  showStrategyAlways() {
    if (this.modeProfile === 'tutorial') return true;
    return this.level === 0;
  }
  showStrategyOnMistake() {
    if (this.modeProfile === 'drill-decisions' || this.modeProfile === 'drill-combined') return true;
    return this.level === 1 || this.level === 2;
  }
  showStrategyOnRequest() { return this.level === 3 && this.modeProfile === 'normal'; }
  isMistake(action, advice) { return action !== advice.action; }
  isClose(total) { return [12,13,14,15,16,17,18].includes(total); }
  isClearRisk(advice, total) {
    if (['hit','double','split'].includes(advice.action)) return total >= 9;
    return false;
  }
  shouldShowHint(advice, handTotal, afterAction = null) {
    if (this.blockHints()) return false;
    if (this.showStrategyAlways()) return true;
    if (this.showStrategyOnRequest()) return false;
    if (this.level === 1) return afterAction ? this.isMistake(afterAction, advice) : this.isClose(handTotal);
    if (this.level === 2) return afterAction ? this.isMistake(afterAction, advice) : this.isClearRisk(advice, handTotal);
    return false;
  }
  formatBetRange(sug, bankroll, minBet) {
    const lowU = Math.max(1, sug.units - 1), highU = Math.min(6, sug.units + 1);
    const cap = Math.max(Math.floor(bankroll * 0.1), minBet);
    const low = Math.max(minBet, Math.min(lowU * sug.unitSize, cap));
    const high = Math.max(low, Math.min(highU * sug.unitSize, cap, bankroll));
    if (sug.betMetricLabel === 'key') {
      const rs = sug.runningCount >= 0 ? `+${sug.runningCount}` : `${sug.runningCount}`;
      return `Running count ${rs} (key +${sug.pivot}) → bet $${low}–$${high}`;
    }
    const ts = sug.trueCount >= 0 ? `+${sug.trueCount.toFixed(1)}` : sug.trueCount.toFixed(1);
    return `True count ${ts} → bet $${low}–$${high}`;
  }
  levelBanner() {
    const mh = this.modeHint();
    const base = `${HELP_LABELS[this.level]} — ${HELP_DESC[this.level]}`;
    return mh ? `${base}\n${mh}` : base;
  }
  /** Append running count to shoe history (used for end-of-shoe ASCII/canvas graph). */
  recordRunningCountSnapshot(runningCount) { this.runningCountHistory.push(runningCount); }
  recordHandMeta(trueCount, bet, suggested) {
    this.trueCountsPerHand.push(trueCount);
    this.shoeBets.push({ bet, suggested, matched: bet === suggested });
  }
  recordDecisionMistake(d) { this.shoeDecisionMistakes.push(d); }
  newShoe() {
    const old = {
      num: this.shoeNum, hands: this.shoeHands, guesses: this.shoeGuesses,
      correct: this.shoeCorrect, mistakes: this.shoeMistakes,
      countSamples: [...this.runningCountHistory], decisionMistakes: [...this.shoeDecisionMistakes],
      shoeTCs: [...this.trueCountsPerHand], shoeBets: [...this.shoeBets],
    };
    this.shoeNum++;
    this.shoeHands = 0; this.shoeGuesses = 0; this.shoeCorrect = 0; this.shoeMistakes = 0;
    this.runningCountHistory = []; this.shoeDecisionMistakes = []; this.trueCountsPerHand = []; this.shoeBets = [];
    return old;
  }
  shoeReport(s, rules = DEFAULT_RULES, countingCtx = { systemId: 'hi-lo', numDecks: 6 }) {
    const systemId = countingCtx.systemId || 'hi-lo';
    const sys = COUNTING_SYSTEMS[systemId] || COUNTING_SYSTEMS['hi-lo'];
    const pivot = countingCtx.pivot ?? getKoPivot(countingCtx.numDecks || 6);
    const pct = s.guesses ? Math.round(100 * s.correct / s.guesses) : 0;
    const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
    const metrics = s.shoeTCs || [];
    const avgMetric = metrics.length ? metrics.reduce((a, b) => a + b, 0) / metrics.length : 0;
    const ev = estimateShoeEVFromBetMetric(s.hands, avgMetric, rules, systemId);
    const betMatch = s.shoeBets?.filter(b => b.matched).length || 0;
    const betTotal = s.shoeBets?.length || 0;
    const ascii = buildCountGraphAscii(s.countSamples || []);
    const topMistakes = (s.decisionMistakes || []).slice(-5).map((m, i) =>
      `  ${i+1}. You ${m.action} → optimal ${m.optimal}`
    ).join('\n');
    const metricSign = avgMetric >= 0 ? '+' : '';
    let text = `Shoe #${s.num} complete (${sys.shortName})\nHands: ${s.hands}\nCount quiz: ${s.correct}/${s.guesses} (${pct}%)\n[${bar}]\nStrategy mistakes: ${s.mistakes}`;
    if (betTotal) text += `\nBet spread: ${betMatch}/${betTotal} matched suggestion`;
    if (sys.balanced) {
      text += `\nAvg true count: ${metricSign}${avgMetric.toFixed(2)}`;
      text += `\nEst. player edge (from avg true count): ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}% (simplified)`;
    } else {
      text += `\nAvg vs key (+${pivot}): ${metricSign}${avgMetric.toFixed(2)}`;
      text += `\nEst. player edge (from avg vs key): ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}% (simplified)`;
    }
    text += `\n\nRunning count trend:\n${ascii}`;
    if (topMistakes) text += `\n\nBiggest mistakes:\n${topMistakes}`;
    return text;
  }
}

// ═══════════════════════════════════════════════════════════════
