// §6 STATS & STORAGE
// ═══════════════════════════════════════════════════════════════
function defaultStats() {
  return { playerName:'Player', helpLevel:0, rank:0, handsPlayed:0, shoesPlayed:0,
    countGuesses:0, countCorrect:0, recentCount:[], decisionsTotal:0, decisionsCorrect:0,
    strategyMistakes:0, betsMatched:0, betsTotal:0, totalNetPL:0, bestBankroll:0,
    bankrollHistory:[], lastLevelUpHand:0, helpLevelups:0, winStreak:0 };
}

/** Lifetime running-count quiz accuracy (%). */
function calculateCountAccuracyPercent(stats) {
  return stats.countGuesses ? 100 * stats.countCorrect / stats.countGuesses : 0;
}
/** Lifetime basic-strategy decision accuracy (%). */
function calculateStrategyAccuracyPercent(stats) {
  return stats.decisionsTotal ? 100 * stats.decisionsCorrect / stats.decisionsTotal : 0;
}
/** Rolling count-quiz accuracy over the last N hands (%). */
function calculateRecentCountAccuracyPercent(stats, windowSize = 50) {
  const recentResults = stats.recentCount.slice(-windowSize);
  return recentResults.length
    ? 100 * recentResults.filter(Boolean).length / recentResults.length
    : 0;
}

function updateRank(s) {
  const old = s.rank;
  let newRank = 0;
  const cp = s.countGuesses >= 10 ? calculateCountAccuracyPercent(s) : 0;
  const dp = s.decisionsTotal >= 20 ? calculateStrategyAccuracyPercent(s) : 0;
  for (const [r, mh, mc, md] of RANK_THRESHOLDS) {
    if (s.handsPlayed >= mh && (s.countGuesses < 10 || cp >= mc) && (s.decisionsTotal < 20 || dp >= md))
      newRank = r;
  }
  if (newRank > old) s.rank = newRank;
  return newRank > old ? newRank : null;
}

function tryAutoLevelUp(s) {
  /* Help levels are player-selected in Settings — no automatic promotion. */
  return null;
}

function recordHandEnd(s, bankroll, netPL) {
  const oldRank = s.rank, oldHelp = s.helpLevel;
  s.handsPlayed++; s.totalNetPL += netPL;
  s.bankrollHistory.push(bankroll);
  if (s.bankrollHistory.length > 200) s.bankrollHistory.shift();
  s.bestBankroll = Math.max(s.bestBankroll, bankroll);
  const rankUp = updateRank(s);
  const levelUp = tryAutoLevelUp(s);
  return {
    rankUp: rankUp !== null ? rankUp : null,
    levelUp: levelUp !== null && levelUp !== oldHelp ? levelUp : null
  };
}

function formatStats(s, bankroll, practice) {
  const lines = [
    `PLAYER STATS — ${s.playerName}`,
    `Rank: ${['Novice','Apprentice','Journeyman','Expert','Master'][s.rank]} | Help: ${s.helpLevel} | Hands: ${s.handsPlayed}`,
    `Count accuracy: ${calculateCountAccuracyPercent(s).toFixed(1)}% (${s.countCorrect}/${s.countGuesses})`,
    `Decision accuracy: ${calculateStrategyAccuracyPercent(s).toFixed(1)}% (${s.decisionsCorrect}/${s.decisionsTotal})`,
    `Recent count (50): ${calculateRecentCountAccuracyPercent(s).toFixed(1)}%`,
    practice ? `Practice bankroll: $${bankroll.toLocaleString()}` : `Bankroll: $${bankroll.toLocaleString()} | Best: $${s.bestBankroll}`,
  ];
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
