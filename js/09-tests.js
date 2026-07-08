// §9 TESTS
// ═══════════════════════════════════════════════════════════════
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

function runTests() {
  let passed = 0;
  const check = (cond, msg) => { assert(cond, msg); passed++; };
  const eq = (a, b, msg) => { assertEq(a, b, msg); passed++; };
  const h = new Hand([createPlayingCard('A','S'), createPlayingCard('K','H')]);
  check(h.isBlackjack(), 'BJ');
  check(getHiLoTagForCard(createPlayingCard('5','C')) === 1, 'low card +1');
  check(getHiLoTagForCard(createPlayingCard('K','C')) === -1, 'high card -1');
  check(getKoTagForCard(createPlayingCard('7','C')) === 1, 'KO: seven is +1');
  check(getHiLoTagForCard(createPlayingCard('7','C')) === 0, 'Hi-Lo: seven is 0');

  // Rank 10 (real-life notation)
  eq(createPlayingCard('T','S').rank, '10', 'T normalizes to 10');
  check(isTenValueRank('10') && isTenValueRank('T'), 'ten value ranks');
  eq(getHiLoTagForCard(createPlayingCard('10','C')), -1, 'ten is hi-lo high');
  eq(new Hand([createPlayingCard('10','S'), createPlayingCard('6','H')]).value(), 16, '10+6=16');
  check(new Hand([createPlayingCard('10','S'), createPlayingCard('A','H')]).isBlackjack(), '10+A blackjack');
  const rankCounts = {};
  for (const card of FULL_DECK_TEMPLATE) rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
  eq(rankCounts['10'], 4, 'four tens per deck');
  check(!rankCounts['T'], 'no T rank in deck');
  check(RANKS.includes('10') && !RANKS.includes('T'), 'RANKS uses 10');

  const shoe = new Shoe(1);
  check(shoe.initialCount === 52, 'deck size');
  const counter = new HiLoCounter();
  counter.recordCardRemovedFromShoe(createPlayingCard('2','S'));
  eq(counter.runningCount, 1, 'running count after one low card');
  const koCounter = new CardCounter('ko');
  koCounter.recordCardRemovedFromShoe(createPlayingCard('7','S'));
  eq(koCounter.runningCount, 1, 'KO running count after seven');
  const koSnap = koCounter.getCountSnapshot(new Shoe(6));
  const koSug = suggestWagerFromCountSnapshot(koSnap, 1000, 10, 10);
  check(koSug.betMetricLabel === 'key', 'KO bet uses key metric');
  check(koSug.amount >= 10, 'KO bet min');

  // KO pivot table
  check(getKoPivot(1) === 0 && getKoPivot(6) === 4 && getKoPivot(8) === 4, 'KO pivots');
  eq(getKoPivot(99), 4, 'KO pivot clamps high');
  eq(getKoPivot(0), 4, 'KO pivot clamps low');

  // Bet spread boundaries
  eq(betSpreadUnitsFromTrueCount(0), 1, 'tc zero');
  eq(betSpreadUnitsFromTrueCount(0.99), 1, 'tc below 1');
  eq(betSpreadUnitsFromTrueCount(1), 2, 'tc one');
  eq(betSpreadUnitsFromTrueCount(5.99), 6, 'tc5.9');
  eq(betSpreadUnitsFromTrueCount(100), 6, 'tc cap');
  eq(betSpreadUnitsFromKoRunningCount(4, 4), 1, 'ko at pivot');
  eq(betSpreadUnitsFromKoRunningCount(3, 4), 1, 'ko below pivot');
  eq(betSpreadUnitsFromKoRunningCount(5, 4), 2, 'ko pivot+1');
  eq(betSpreadUnitsFromKoRunningCount(9, 4), 6, 'ko max units');

  const hiSnap = { systemId: 'hi-lo', trueCount: 2.5, runningCount: 5, numDecks: 6 };
  eq(suggestWagerFromCountSnapshot(hiSnap, 1000, 10, 10).amount, 30, 'hi-lo tc2.5 → 3 units');
  const koHigh = { systemId: 'ko', runningCount: 7, pivot: 4, abovePivot: 3, trueCount: 0, numDecks: 6 };
  eq(suggestWagerFromCountSnapshot(koHigh, 1000, 10, 10).amount, 40, 'ko rc7 key4 → 4 units');
  const capped = suggestWagerFromCountSnapshot({ systemId: 'hi-lo', trueCount: 5, runningCount: 0, numDecks: 6 }, 250, 10, 10);
  eq(capped.amount, 25, 'bankroll 10% cap');
  check(capped.wasCappedByBankroll, 'cap flag');

  const tcCounter = new CardCounter('hi-lo');
  tcCounter.runningCount = 3;
  const tinyShoe = { decksRemaining: () => 0.2, numDecks: 1 };
  eq(tcCounter.calculateTrueCount(0.2), 6, 'true count floor');
  eq(tcCounter.getCountSnapshot(tinyShoe).trueCount, 6, 'true count floor snapshot');

  check(payout(10, 'blackjack') === 15, 'bj pay');
  check(payout(10, 'win') === 10, 'win pay');
  check(payout(10, 'blackjack', { blackjackPayout: 1.2 }) === 12, '6:5 bj pay');
  eq(payout(20, 'surrender'), -10, 'surrender half');
  check(dealerShouldHit(new Hand([createPlayingCard('A','S'), createPlayingCard('6','H')])), 'soft 17 hit');
  check(!dealerShouldHit(new Hand([createPlayingCard('10','S'), createPlayingCard('7','H')])), 'hard 17 stand');
  check(!dealerShouldHit(new Hand([createPlayingCard('A','S'), createPlayingCard('6','H')]), { dealerHitsSoft17: false }), 'S17 stand');
  const sug = suggestWagerFromTrueCount(2, 1000, 10, 10);
  check(sug.amount >= 10, 'bet min');
  const adv = advise(new Hand([createPlayingCard('10','S'), createPlayingCard('6','H')]), '6', false, false);
  eq(adv.action, 'stand', 'stand 16 vs 6');
  eq(advise(new Hand([createPlayingCard('8','S'), createPlayingCard('8','H')]), '6', false, true).action, 'split', 'split 8s vs 6');
  eq(advise(new Hand([createPlayingCard('10','S'), createPlayingCard('5','H')]), '6', false, false).action, 'stand', 'stand 15 vs 6');
  eq(advise(new Hand([createPlayingCard('6','S'), createPlayingCard('5','H')]), '6', true, false).action, 'double', 'double 11 vs 6');

  const help = new HelpSystem(2);
  check(!help.showCountAtTable(), 'L2 hide count');
  check(help.postHandQuiz(), 'L2 quiz');
  const drillHelp = new HelpSystem(2, 'drill-decisions');
  check(!drillHelp.showCountAtTable(), 'drill hide count');
  check(drillHelp.showStrategyOnMistake(), 'drill strategy hints');
  const combinedHelp = new HelpSystem(1, 'drill-combined');
  check(!combinedHelp.showCountAtTable(), 'combined hide count at table');
  check(combinedHelp.postHandQuiz(), 'combined post-hand count quiz');
  check(combinedHelp.showStrategyOnMistake(), 'combined strategy on mistake');
  check(combinedHelp.postHandReview(), 'combined post-hand review');

  const migrated = migrateSave({ version: 1, stats: defaultStats(), bankroll: 500, settings: { minBet: 10 } });
  check(migrated.version === SAVE_VERSION && migrated.campaign.unlocks.includes('classic'), 'migrate save version');
  check(migrated.chips === 500 && migrated.gems === 10, 'migrate v4 bankroll to chips + default gems');
  check(migrated.personalBests && migrated.achievements !== undefined, 'migrate bests');
  check(migrated.countingUnlocks.includes('hi-lo') && migrated.settings.countingSystem === 'hi-lo', 'migrate counting');

  const unlockSave = defaultSave();
  unlockSave.stats.helpLevel = 2;
  unlockSave.stats.countGuesses = 30;
  unlockSave.stats.countCorrect = 24;
  const koUnlock = checkCountingUnlocks(unlockSave);
  check(koUnlock.includes('ko') && unlockSave.countingUnlocks.includes('ko'), 'unlock KO');

  const blockedSave = defaultSave();
  blockedSave.stats.helpLevel = 2;
  blockedSave.stats.countGuesses = 24;
  blockedSave.stats.countCorrect = 18;
  check(!checkCountingUnlocks(blockedSave).includes('ko'), 'KO unlock blocked low guesses');
  const blockedAcc = defaultSave();
  blockedAcc.stats.helpLevel = 2;
  blockedAcc.stats.countGuesses = 30;
  blockedAcc.stats.countCorrect = 22;
  check(!checkCountingUnlocks(blockedAcc).includes('ko'), 'KO unlock blocked low accuracy');

  const badSysSave = { version: 4, stats: defaultStats(), bankroll: 1000,
    settings: { minBet: 10, unitSize: 10, numDecks: 6, countingSystem: 'omega-ii' },
    countingUnlocks: ['hi-lo'], campaign: { chapter: 0, unlocks: ['classic'], goalsCompleted: [] },
    personalBests: defaultPersonalBests(), achievements: [] };
  const repairedSys = validateAndRepairSave(badSysSave);
  check(repairedSys.ok && repairedSys.value.settings.countingSystem === 'hi-lo', 'invalid countingSystem');

  const testSave = defaultSave();
  testSave.stats.handsPlayed = 1;
  const ach = checkAchievements(testSave);
  check(ach.some(a => a.id === 'first-hand'), 'first-hand achievement');
  updatePersonalBests(testSave, { type: 'handEnd', handNetPL: 10, sessionNetPL: 10 });
  eq(testSave.stats.winStreak, 1, 'win streak');
  check(dailyChallengeForDate(new Date('2026-07-07')).date === '2026-07-07', 'daily date');
  check(buildCountGraphAscii([0, 1, 2, 3]).includes('Running count'), 'ascii graph');

  check(!validateBetAmount('abc', 1000, 10).ok, 'reject non-numeric bet');
  check(!validateBetAmount(5, 1000, 10).ok, 'reject below min bet');
  const goodBet = validateBetAmount(50, 1000, 10);
  check(goodBet.ok && goodBet.value === 50, 'accept valid bet');
  check(!validateBetAmount(600, 500, 10).ok, 'reject over bankroll');
  check(!validateRunningCountGuess('3.5').ok, 'reject decimal count');
  const goodRc = validateRunningCountGuess('-4', new Shoe(1));
  check(goodRc.ok && goodRc.value === -4, 'accept integer count');

  const repaired = validateAndRepairSave({ bankroll: -5, stats: { helpLevel: 99 } });
  check(repaired.ok && repaired.value.bankroll >= 0 && repaired.value.stats.helpLevel <= 4, 'repair save');

  eq(compareHands(new Hand([createPlayingCard('10','S'), createPlayingCard('9','H')]), new Hand([createPlayingCard('10','D'), createPlayingCard('8','C')])), 'win', 'compare 19 vs 18');
  check(new CardCounter('bogus').systemId === 'hi-lo', 'unknown system falls back');

  // Tutorial navigation (todo 1.1)
  check(TUTORIAL_STEPS.length === 5, 'tutorial has 5 steps');
  const navApp = window.app;
  const navOrigPhase = navApp.phase;
  const navOrigTutorial = { step: navApp.save.tutorial.step, completed: navApp.save.tutorial.completed };
  const clearTutorialNavLock = () => { navApp.tutorialNavBusyUntil = 0; };
  clearTutorialNavLock();
  navApp.phase = 'tutorial';
  navApp.save.tutorial = { step: 0, completed: false };
  navApp.tutorialBack();
  check(navApp.phase === 'menu', 'tutorial back on page 1 exits to menu');
  clearTutorialNavLock();
  navApp.phase = 'tutorial';
  navApp.save.tutorial = { step: 2, completed: false };
  navApp.tutorialBack();
  check(navApp.save.tutorial.step === 1, 'tutorial back decrements step');
  clearTutorialNavLock();
  navApp.tutorialNext();
  check(navApp.save.tutorial.step === 2, 'tutorial next increments step');
  clearTutorialNavLock();
  navApp.save.tutorial.step = 4;
  navApp.tutorialBack();
  check(navApp.save.tutorial.step === 3, 'tutorial back from final page');
  eq(navApp.tutorialStepIndex(), 3, 'tutorialStepIndex valid');
  navApp.phase = navOrigPhase;
  navApp.save.tutorial = navOrigTutorial;

  check(formatCountChangeLabel(1) === 'Count Change: +1', 'count change label +1');
  check(formatCountChangeLabel(-1) === 'Count Change: -1', 'count change label -1');
  check(formatHandRunningCountReview(2, 5).includes('change +3'), 'hand count review plain English');
  check(formatHandRunningCountReviewCompact(2, 5).includes('RC +2→+5'), 'compact hand count review');
  check(typeof formatHandEndReviewCompact === 'function', 'compact handend review formatter');
  const hardHand = new Hand([createPlayingCard('10','S'), createPlayingCard('6','H')]);
  check(hardHand.beginnerDisplaySummary().startsWith('Hard 16'), 'beginner hard hand label');
  const softHand = new Hand([createPlayingCard('A','S'), createPlayingCard('6','H')]);
  check(softHand.beginnerDisplaySummary().includes('Soft 17'), 'beginner soft hand label');
  check(navApp.resetCountQuizModal && navApp.dismissCountQuiz, 'count quiz manual dismiss helpers');
  check(!document.getElementById('modal-count-quiz').innerHTML.includes('setTimeout'), 'count quiz modal no auto-advance in markup');

  // Full-width layout (todo 1.3)
  const headerEl = document.getElementById('app-header');
  const statsEl = document.getElementById('stats-sidebar');
  check(!headerEl.className.includes('lg:mr-80'), 'header uses full width (no stats margin)');
  check(!statsEl.className.includes('lg:translate-x-0'), 'stats sidebar is collapsible overlay');
  check(statsEl.className.includes('translate-x-full'), 'stats sidebar hidden by default');
  check(document.getElementById('stats-backdrop'), 'stats backdrop for overlay dim');
  check(document.querySelector('.game-table-wrap'), 'centered game table wrapper');
  check(document.getElementById('screen-casino-play'), 'unified casino play shell');
  check(document.getElementById('casino-seat-grid')?.dataset?.seatCount === '7', 'seven seat grid');
  check(document.querySelectorAll('#casino-seat-grid .casino-seat').length === 7, 'seven seat nodes');
  check(document.getElementById('casino-seat-human')?.dataset?.seat === '4', 'human seat marker');
  check(document.querySelectorAll('.casino-seat-spot').length >= 7, 'seven seat betting spots');
  check(document.querySelectorAll('#casino-seat-grid .casino-seat .casino-seat-label').length === 7, 'seven seat label slots');
  check(document.querySelectorAll('#casino-seat-grid .casino-seat .casino-seat-spot').length === 7, 'seven seat spot circles');
  check(document.getElementById('casino-seat-human')?.querySelector('.casino-seat-label'), 'human seat label slot');
  check(document.getElementById('screen-bet')?.closest('.casino-table-surface'), 'bet controls on felt surface');
  check(document.getElementById('casino-felt-bet-rail'), 'felt bet rail present');
  check(typeof navApp.syncCasinoShellMetrics === 'function', 'casino shell metrics sync');
  check(!document.querySelector('[class*="casino-seat-spot-active"]'), 'no spot-active class (parent styles human spot)');
  check(!document.querySelector('[class*="casino-seat-badge"]'), 'no badge class (parent styles human label)');
  check(document.getElementById('screen-table')?.className.includes('max-w-6xl'), 'table screen uses wide layout');
  check(getComputedStyle(document.documentElement).getPropertyValue('--cq-felt-deep').trim().length > 0, 'felt theme variable');
  check(getComputedStyle(document.documentElement).getPropertyValue('--cq-gold').trim().length > 0, 'gold theme variable');
  check(getComputedStyle(document.documentElement).getPropertyValue('--cq-cyan-glow').trim().length > 0, 'cyan theme variable');
  check(document.getElementById('btn-menu-stats'), 'menu stats button present');
  check(typeof navApp.toggleStatsSidebar === 'function', 'toggleStatsSidebar helper');

  check(SPEED_DRILL_CARD_OPTIONS.length === 3, 'speed drill card options');
  check(SPEED_DRILL_MS.normal === 700, 'speed drill normal pace');
  const sdSave = defaultSave();
  check(sdSave.speedDrill && Array.isArray(sdSave.speedDrill.sessions), 'speed drill save default');
  recordSpeedDrillSession(sdSave, { cardCount: 20, speed: 'normal', showCount: false, guess: 3, actual: 3 });
  check(sdSave.speedDrill.sessions.length === 1 && sdSave.speedDrill.sessions[0].exact, 'record speed drill session');
  const sdSum = summarizeSpeedDrillHistory(sdSave.speedDrill.sessions);
  check(sdSum.accuracy === 100 && sdSum.avgError === 0, 'summarize speed drill history');
  const sdVisit = summarizeSpeedDrillRounds([
    { error: 0, withinOne: true }, { error: 2, withinOne: false },
  ]);
  check(sdVisit.accuracy === 50 && sdVisit.avgError === 1, 'summarize speed drill session visit');
  check(document.getElementById('screen-drill-speed'), 'speed drill screen present');
  check(PRACTICE_DRILLS.some(d => d.id === 'count-speed'), 'speed drill in practice range');
  check(TRAINING_DRILLS.length >= 8, 'training drill catalog');
  check(TRAINING_DRILLS.filter(d => d.status === 'live').length >= 4, 'live training drills');
  check(TRAINING_DRILLS.filter(d => d.status === 'soon').length === 0, 'all training drills live');
  check(TRAINING_DRILLS.find(d => d.id === 'card-bursts')?.status === 'live', 'card burst drill live');
  check(TRAINING_DRILLS.find(d => d.id === 'decks-left')?.status === 'live', 'decks left drill live');
  check(typeof generateDecksLeftProblem === 'function', 'decks left problem generator');
  check(typeof navApp.openCardBurstDrill === 'function', 'card burst drill handler');
  check(typeof navApp.openDecksLeftDrill === 'function', 'decks left drill handler');
  check(typeof navApp.joinSpecialEventDealerShift === 'function', 'dealer night event join');
  check(SPECIAL_EVENTS.some(e => e.id === 'dealer-night'), 'dealer night event');
  check(typeof dealerAITakesInsurance === 'function', 'dealer AI insurance helper');
  check(typeof navApp.submitDealerInsurancePayout === 'function', 'dealer insurance payout');
  check(document.getElementById('screen-training'), 'training mode screen');
  check(typeof navApp.openTrainingMode === 'function' && typeof navApp.launchTrainingDrill === 'function', 'training mode handlers');

  const tcProb = generateTrueCountProblem('whole');
  check(tcProb.runningCount === Math.round(tcProb.trueCount) * tcProb.decksRemaining, 'whole TC problem integer');
  check(isTrueCountGuessCorrect(3, 3, 'whole'), 'whole TC exact');
  check(isTrueCountGuessCorrect(2.2, 2.14, 'decimal'), 'decimal TC tolerance');
  check(validateTrueCountGuessInput('2.5', 'decimal').ok, 'decimal TC input');
  check(!validateTrueCountGuessInput('2.5', 'whole').ok, 'whole rejects decimal');
  const tcSave = defaultSave();
  recordTrueCountDrillRound(tcSave, { difficulty: 'decimal', roundSize: 10, runningCount: 6, decksRemaining: 2, trueCount: 3, guess: 3, error: 0, correct: true });
  check(tcSave.trueCountDrill.sessions.length === 1, 'true count drill persisted');
  check(document.getElementById('screen-drill-true-count'), 'true count drill screen');
  check(TRAINING_DRILLS.find(d => d.id === 'true-count')?.status === 'live', 'true count drill live in catalog');

  const cpVisit = summarizeCombinedPracticeVisit([
    { countOk: true, stratCorrect: 2, stratTotal: 2 },
    { countOk: false, stratCorrect: 1, stratTotal: 2 },
  ]);
  check(cpVisit.hands === 2 && cpVisit.countAccuracy === 50 && cpVisit.strategyAccuracy === 75, 'summarize combined practice visit');
  const cpSave = defaultSave();
  recordCombinedPracticeSession(cpSave, { hands: [
    { countOk: true, stratCorrect: 1, stratTotal: 1 },
    { countOk: true, stratCorrect: 2, stratTotal: 2 },
  ]});
  check(cpSave.combinedPractice.sessions.length === 1 && cpSave.combinedPractice.sessions[0].countAccuracy === 100, 'record combined practice session');
  check(TRAINING_DRILLS.find(d => d.id === 'combined')?.status === 'live', 'combined practice live in catalog');
  check(typeof formatCombinedHandReview === 'function', 'combined hand review formatter');

  const thSave = defaultSave();
  recordTrainingHistorySession(thSave, 'count-speed', { attempts: 1, accuracy: 100, avgError: 0 });
  recordTrainingHistorySession(thSave, 'true-count', { attempts: 10, accuracy: 80, avgError: 0.2 }, { ts: Date.now() - 86400000 });
  recordTrainingHistorySession(thSave, 'true-count', { attempts: 10, accuracy: 90, avgError: 0.1 });
  check(thSave.trainingHistory.sessions.length === 3, 'training history sessions stored');
  check(getTrainingHistorySessions(thSave, 'true-count').length === 2, 'training history filter by drill');
  const thTrend = summarizeTrainingHistoryTrend(getTrainingHistorySessions(thSave, 'true-count'));
  check(thTrend.count === 2 && thTrend.delta === 10, 'training history trend delta');
  check(document.getElementById('screen-training-history'), 'training history screen');
  check(typeof navApp.openTrainingHistory === 'function', 'openTrainingHistory handler');

  const mrSave = defaultSave();
  recordMistakeReviewEntry(mrSave, {
    drillId: 'count-speed', category: 'count', context: 'After 20 cards',
    wrong: '+2', correct: '+5', detail: 'Off by 3',
  });
  recordMistakeReviewEntry(mrSave, {
    drillId: 'true-count', category: 'count', context: 'Running count +6 ÷ 2 decks',
    wrong: '+2', correct: '+3', detail: 'Off by 1',
  });
  check(mrSave.mistakeReviewLog.entries.length === 2, 'mistake review entries stored');
  check(getMistakeReviewEntries(mrSave, 'count-speed').length === 1, 'mistake review filter by drill');
  const mrSum = summarizeMistakeReview(getMistakeReviewEntries(mrSave));
  check(mrSum.count === 2 && mrSum.byCategory.count === 2, 'mistake review summary');
  check(document.getElementById('screen-training-mistakes'), 'mistake review screen');
  check(document.getElementById('btn-training-mistakes'), 'review mistakes button');
  check(typeof navApp.openMistakeReview === 'function', 'openMistakeReview handler');

  const dtGoal = dailyTrainingGoalForDate();
  check(DAILY_TRAINING_GOAL_TYPES.length >= 5, 'daily training goal catalog');
  check(dtGoal.date && dtGoal.title && dtGoal.rewardChips, 'daily training goal for today');
  const dtSave = defaultSave();
  ensureDailyTrainingCurrent(dtSave, dtGoal);
  const speedGoal = DAILY_TRAINING_GOAL_TYPES.find(g => g.drillId === 'count-speed');
  const speedMet = evaluateDailyTrainingProgress(speedGoal, {}, 'drillSession', { drillId: 'count-speed', accuracy: 100, attempts: 1 });
  check(speedMet.met, 'speed drill daily goal met at 100%');
  const combinedGoal = DAILY_TRAINING_GOAL_TYPES.find(g => g.type === 'combinedHands');
  const at48 = evaluateDailyTrainingProgress(combinedGoal, { hands: 48 }, 'combinedHand');
  check(!at48.met && at48.progress.hands === 49, 'combined hands below target');
  const at49 = evaluateDailyTrainingProgress(combinedGoal, { hands: 49 }, 'combinedHand');
  check(at49.progress.hands === 50, 'combined hands increments to 50');
  check(at49.met, 'combined 50 hands goal completes');
  check(computeDailyTrainingReward(speedGoal, 3) > speedGoal.rewardChips, 'streak increases reward');
  check(document.getElementById('daily-training-panel'), 'daily training panel');
  check(document.getElementById('training-daily-goal'), 'training mode daily goal card');
  check(typeof navApp.checkDailyTrainingProgress === 'function', 'checkDailyTrainingProgress handler');

  check(formatDurationMs(125000) === '2m 5s', 'format duration');
  const ssSummary = buildDrillSessionSummary('true-count', {
    rounds: [{ correct: true, error: 0 }, { correct: false, error: 1 }],
    sum: { total: 2, accuracy: 50, avgError: 0.5 },
    durationMs: 60000,
  });
  check(ssSummary.accuracy === 50 && ssSummary.avgError === 0.5 && ssSummary.correct === 1, 'build drill session summary');
  const ssSave = defaultSave();
  const cmp1 = updateDrillPersonalBest(ssSave, ssSummary);
  check(cmp1.isNewBest, 'first session is personal best');
  const cmp2 = updateDrillPersonalBest(ssSave, { ...ssSummary, accuracy: 60 });
  check(cmp2.isNewBest && ssSave.drillSessionBests['true-count'].accuracy === 60, 'personal best updates');
  check(renderDrillSessionSummaryHtml(ssSummary, cmp1).includes('Session Accuracy'), 'summary html renders');
  check(document.getElementById('screen-drill-session-summary'), 'drill session summary screen');
  check(typeof navApp.finishDrillWithSummary === 'function', 'finishDrillWithSummary handler');

  check(INDEX_PLAY_CATALOG.length >= 8, 'index play catalog size');
  const idxProb = generateIndexPlayProblem('insurance');
  check(idxProb.play.category === 'insurance', 'insurance mode filter');
  const idx16 = INDEX_PLAY_CATALOG.find(p => p.id === '16v10-0');
  eq(getIndexPlayCorrectAction(idx16, 0).action, 'stand', '16v10 stand at tc0');
  eq(getIndexPlayCorrectAction(idx16, -1).action, 'hit', '16v10 hit below index');
  eq(getIndexPlayCorrectAction(INDEX_PLAY_CATALOG.find(p => p.id === 'ins-tc3'), 3).action, 'insurance', 'insurance at tc3');
  const hand16v10 = new Hand([createPlayingCard('K', 'S'), createPlayingCard('6', 'H')]);
  eq(advise(hand16v10, '10', false, false, { trueCount: 0, countingSystemId: 'hi-lo' }).action, 'stand', 'live index 16v10 stand tc0');
  eq(advise(hand16v10, '10', false, false, { trueCount: -1, countingSystemId: 'hi-lo' }).action, 'hit', 'live index 16v10 hit below');
  eq(advise(hand16v10, '10', false, false, { trueCount: 0, countingSystemId: 'ko' }).action, 'hit', 'ko skips index deviations');
  const hand10v10 = new Hand([createPlayingCard('6', 'S'), createPlayingCard('4', 'H')]);
  eq(advise(hand10v10, '10', true, false, { trueCount: 4, countingSystemId: 'hi-lo' }).action, 'double', 'live index 10v10 double tc4');
  eq(adviseInsurance(3, 'hi-lo').action, 'insurance', 'live insurance index tc3');
  eq(adviseInsurance(2.5, 'hi-lo').action, 'no-insurance', 'live insurance below index');
  check(document.getElementById('screen-drill-index'), 'index play drill screen');
  check(TRAINING_DRILLS.find(d => d.id === 'index-plays')?.status === 'live', 'index play drill live');
  check(typeof navApp.openIndexPlayDrill === 'function', 'openIndexPlayDrill handler');

  eq(betSpreadUnitsFromTrueCountWithMax(0, 12), 1, 'spread tc0');
  eq(betSpreadUnitsFromTrueCountWithMax(3.2, 12), 4, 'spread tc3');
  eq(betSpreadUnitsFromTrueCountWithMax(11, 12), 12, 'spread tc11 cap12');
  const bsProb = generateBetSpreadProblem('high', { minUnits: 1, maxUnits: 12 });
  check(bsProb.trueCount >= 3, 'high scenario tc');
  check(kellyBetUnitsFromTrueCount(4, 1000, 10, 12) >= 1, 'kelly units');
  check(detectBetSpreadHeat(2, 7).heated, 'heat jump detected');
  check(betSpreadBankrollStress(30, 1000).stressed, 'bankroll stress over 2%');
  const koProb = generateBetSpreadProblem('high', { minUnits: 1, maxUnits: 6 }, { countingSystem: 'ko', numDecks: 6 });
  check(koProb.countingSystem === 'ko' && koProb.pivot != null, 'ko spread problem');
  check(renderBetSpreadSessionChartHtml([{ chosenUnits: 2, optimalUnits: 3, exact: false }], 6).includes('<svg'), 'bet spread chart');
  check(typeof navApp.betSpreadClearTimer === 'function', 'bet spread timer helpers');
  check(isBetSpreadChoiceAppropriate(3, 4) && !isBetSpreadChoiceExact(3, 4), 'spread within 1 unit');
  const bsSum = summarizeBetSpreadRounds([
    { trueCount: -2, chosenUnits: 1, optimalUnits: 1, exact: true, appropriate: true },
    { trueCount: 5, chosenUnits: 4, optimalUnits: 6, exact: false, appropriate: false },
    { trueCount: 4, chosenUnits: 5, optimalUnits: 5, exact: true, appropriate: true },
  ]);
  check(bsSum.rampScore === 100 && bsSum.avgChosenHigh > bsSum.avgChosenLow, 'bet spread ramp score');
  check(document.getElementById('screen-drill-bet-spread'), 'bet spread drill screen');
  check(TRAINING_DRILLS.find(d => d.id === 'bet-ramp')?.status === 'live', 'bet spread drill live');
  check(typeof navApp.openBetSpreadDrill === 'function', 'openBetSpreadDrill handler');

  check(TABLE_TIERS.length === 4, 'four table tiers');
  check(TABLE_TIERS.every(t => t.minHelpLevel === 0), 'table tiers open at any help level');
  check(TABLE_AI_SEAT_NUMS.length === 6, 'six ai table seats');
  check(Object.keys(createTableAiSeats()).length === 6, 'create table ai seats');
  check(typeof tableAiStrategyAction === 'function', 'table ai strategy helper');
  check(typeof renderTableAiMiniCard === 'function', 'table ai mini card render');
  eq(TABLE_WIN_MULTIPLIER, 1.8, 'table win multiplier');
  const tierBeginner = getTableTier('beginner');
  const tierPro = getTableTier('pro');
  check(tierBeginner && tierPro, 'table tier lookup');
  eq(calcTableWinPayout(50), 90, 'beginner win payout 1.8x');
  eq(calcTableWinPayout(5000), 9000, 'pro win payout 1.8x');
  const walletSave = defaultSave();
  eq(walletSave.chips, 2500, 'default chips');
  eq(walletSave.gems, 10, 'default gems');
  const entrySave = defaultSave();
  const paidEntry = payTableEntry(entrySave, tierBeginner);
  check(paidEntry.ok && entrySave.chips === 2450, 'pay table entry deducts chips');
  eq(paidEntry.pot, 100, 'pot is 2x entry');
  eq(paidEntry.winPayout, 90, 'win payout from entry');
  check(!canJoinTable(defaultSave(), tierPro).ok, 'pro tier locked for default save');
  const winSettleSave = { ...defaultSave(), chips: 2450 };
  const winResult = settleTableSession(winSettleSave, { tableTierId: 'beginner', tableEntryFee: 50, netPL: 120 });
  check(winResult.won && winSettleSave.chips === 2540, 'settle table win awards 1.8x payout');
  const loseSettleSave = { ...defaultSave(), chips: 2450 };
  const loseResult = settleTableSession(loseSettleSave, { tableTierId: 'beginner', tableEntryFee: 50, netPL: -80 });
  check(!loseResult.won && loseSettleSave.chips === 2450, 'settle table loss keeps chips');
  check(document.getElementById('screen-table-lobby'), 'table lobby screen');
  check(document.getElementById('menu-currency-bar'), 'menu currency bar');
  check(document.getElementById('header-currency'), 'header currency display');
  check(typeof navApp.openTableLobby === 'function' && typeof navApp.joinTable === 'function', 'table lobby handlers');
  check(typeof settleTableSession === 'function' && typeof payTableEntry === 'function', 'table economy helpers');

  eq(CLUB_MAX_MEMBERS, 50, 'club max members');
  check(!validateClubName('ab').ok, 'club name too short');
  check(validateClubName('Ace Trackers').ok, 'club name valid');
  const crewSave = defaultSave();
  ensurePlayerId(crewSave);
  const crewName = 'Test Crew ' + Date.now().toString(36);
  const crewCreated = createClub(crewSave, { name: crewName, description: 'Unit test crew', visibility: 'public' });
  check(crewCreated.ok && crewSave.club.role === 'leader', 'create club as leader');
  eq(normalizeClubRole('owner'), 'leader', 'migrate owner role');
  check(hasClubPermission('leader', 'transferLeadership'), 'leader can transfer');
  check(!hasClubPermission('officer', 'promoteDemote'), 'officer cannot promote');
  check(canKickMember('officer', 'member'), 'officer can kick member');
  check(!canKickMember('officer', 'co-leader'), 'officer cannot kick co-leader');
  const hierSave = defaultSave();
  ensurePlayerId(hierSave);
  const hName = 'Hier Crew ' + Date.now().toString(36);
  const hCreated = createClub(hierSave, { name: hName, description: 'Hierarchy test', visibility: 'public' });
  const recruit = defaultSave();
  recruit.playerId = 'p_recruit_' + Date.now().toString(36);
  joinClub(recruit, hCreated.club.id);
  const promoted = promoteClubMember(hierSave, recruit.playerId);
  check(promoted.ok && promoted.newRole === 'officer', 'leader promotes member to officer');
  check(typeof updateClubInfo === 'function' && typeof transferClubLeadership === 'function', 'hierarchy helpers');
  check(document.getElementById('clubs-edit-view'), 'club edit view');
  check(searchClubs(crewName).some(c => c.id === crewCreated.club.id), 'search finds new club');
  const joinerSave = defaultSave();
  joinerSave.playerId = 'p_join_test_' + Date.now().toString(36);
  joinerSave.stats.playerName = 'JoinTester';
  const crewJoined = joinClub(joinerSave, crewCreated.club.id);
  check(crewJoined.ok && joinerSave.club.role === 'member', 'join club');
  check(clubMemberCount(ClubsRegistry.getById(crewCreated.club.id)) === 2, 'club member count');
  check(leaveClub(crewSave).ok && !crewSave.club.clubId, 'leave club');
  check(document.getElementById('screen-clubs'), 'clubs screen');
  ClubsRegistry.invalidate();
  try { localStorage.removeItem(CLUBS_REGISTRY_KEY); } catch { /* */ }
  const freshClubs = ClubsRegistry.getAll();
  check(Array.isArray(freshClubs) && freshClubs.length >= 2, 'clubs registry loads without recursion');
  check(freshClubs.every(c => c.inviteCode?.length === CLUB_INVITE_CODE_LENGTH), 'demo clubs get invite codes on load');
  check(typeof navApp.openClubs === 'function', 'openClubs handler');
  check(typeof recordClubWeeklyActivity === 'function', 'weekly activity recorder');
  check(typeof postClubChatMessage === 'function', 'club chat helper');
  check(clubWeekKey().includes('-W'), 'club week key format');
  const hubSave = defaultSave();
  ensurePlayerId(hubSave);
  const hubCreated = createClub(hubSave, { name: 'Hub ' + Date.now().toString(36), description: 'Hub', visibility: 'public' });
  const wkAct = recordClubWeeklyActivity(hubSave, 'hand', { won: true });
  check(wkAct && wkAct.delta >= CLUB_WEEKLY_POINT_RULES.hand, 'weekly hand points');
  const chatOk = postClubChatMessage(hubSave, 'Hello crew!');
  check(chatOk.ok && chatOk.message?.text === 'Hello crew!', 'post club chat');
  check(document.getElementById('clubs-hub-view'), 'club hub view');
  check(document.getElementById('club-hub-leaderboard'), 'club hub leaderboard');
  check(typeof navApp.renderClubHub === 'function', 'renderClubHub');

  check(DAILY_LOGIN_REWARD_TABLE.length === 7, 'seven-day login reward ladder');
  const loginSave = defaultSave();
  ensureDailyRewardsCurrent(loginSave);
  check(canClaimDailyLogin(loginSave), 'can claim login on fresh day');
  const loginClaim = claimDailyLoginReward(loginSave);
  check(loginClaim.ok && loginSave.dailyRewards.claimedToday, 'claim daily login');
  check(!canClaimDailyLogin(loginSave), 'cannot double-claim login');
  const socialSave = defaultSave();
  const fb = connectSocialAccount(socialSave, 'facebook');
  check(fb.ok && fb.bonus?.chips === SOCIAL_CONNECT_CHIP_BONUS, 'facebook connect bonus');
  const googleDup = connectSocialAccount(socialSave, 'google');
  check(googleDup.ok && googleDup.bonus?.gems === SOCIAL_CONNECT_GEM_BONUS, 'google connect bonus');
  const vipSave = defaultSave();
  vipSave.gems = VIP_PASS_COST_GEMS;
  const vipBuy = purchaseVipPass(vipSave);
  check(vipBuy.ok && isVipActive(vipSave), 'purchase vip pass');
  check(applyVipChipBonus(vipSave, 100) === 200, 'vip 2x chip bonus');
  check(vipTableWinBonus(vipSave, 90) === 9, 'vip table win 10% bonus');
  check(getEffectiveSynergyBonus(vipSave) === DAILY_TRAINING_SYNERGY_BONUS * 2, 'vip synergy 2x');
  const trialSave = defaultSave();
  const trial = claimVipTrial(trialSave);
  check(trial.ok && trialSave.vipPass.trialUsed, 'vip trial once');
  check(!claimVipTrial(trialSave).ok, 'vip trial not repeatable');
  check(document.getElementById('screen-daily-rewards'), 'daily rewards screen');
  check(document.getElementById('modal-daily-reward'), 'daily reward modal');
  check(typeof navApp.openDailyRewards === 'function', 'openDailyRewards handler');
  check(typeof claimDailyLoginReward === 'function', 'claimDailyLoginReward helper');

  check(CLUB_WEEKLY_TOP3_PAYOUTS.length === 3, 'top3 weekly payout tiers');
  check(typeof contributeToClubBankroll === 'function', 'crew bankroll contribute');
  check(typeof joinClubByInviteCode === 'function', 'join by invite code');
  check(typeof regenerateClubInviteCode === 'function', 'regenerate invite');
  check(typeof processWeeklyTop3Payouts === 'function', 'weekly top3 processor');
  check(typeof ExternalAuth.connectGoogle === 'function', 'external google auth');
  check(typeof ExternalIAP.purchaseVip === 'function', 'external iap vip');
  const bankClubSave = defaultSave();
  ensurePlayerId(bankClubSave);
  bankClubSave.chips = 5000;
  const bankClub = createClub(bankClubSave, { name: 'Bank ' + Date.now().toString(36), description: 'Bankroll test', visibility: 'private' });
  check(bankClub.ok && bankClub.club.inviteCode?.length === CLUB_INVITE_CODE_LENGTH, 'club invite code on create');
  const contributed = contributeToClubBankroll(bankClubSave, { chips: 200 });
  check(contributed.ok && bankClub.club.bankroll.chips >= 200, 'bankroll contribution');
  const inviteJoiner = defaultSave();
  inviteJoiner.playerId = 'p_inv_' + Date.now().toString(36);
  const invited = joinClubByInviteCode(inviteJoiner, bankClub.club.inviteCode);
  check(invited.ok && invited.club.id === bankClub.club.id, 'join via invite code');
  const payoutClub = ClubsRegistry.getById(bankClub.club.id);
  payoutClub.weekly.memberScores[bankClubSave.playerId] = { points: 120, hands: 10, countCorrect: 2, countTotal: 2, trainingPts: 20, playPts: 10, handPts: 50, countPts: 30 };
  payoutClub.weekly.crewTotal = 120;
  const prevWeek = { ...payoutClub.weekly, weekKey: '2099-W01', payoutsAwardedTop3: false };
  const top3 = processWeeklyTop3Payouts(bankClubSave, payoutClub, prevWeek);
  check(top3.payouts.length >= 1 && top3.playerPayout?.chips === 500, 'top3 payout to leader');
  check(document.getElementById('club-hub-bankroll'), 'club bankroll panel');
  check(document.getElementById('club-hub-invite'), 'club invite panel');
  check(document.getElementById('cfg-google-client-id'), 'oauth config in settings');

  check(LOBBY_PLAY_MODES.length >= 5, 'lobby play modes');
  check(LOBBY_MINIGAMES.length === 4, 'lobby minigames');
  check(document.getElementById('lobby-clubs-btn'), 'lobby clubs button');
  check(document.getElementById('lobby-hero-play'), 'lobby hero play');
  check(document.getElementById('lobby-bottom-dock'), 'lobby bottom dock');
  check(document.getElementById('lobby-xp-bar'), 'lobby xp bar');
  check(document.querySelector('.lobby-currency-buy'), 'lobby currency buy');
  check(document.getElementById('lobby-top-nav'), 'lobby top nav');
  check(document.getElementById('lobby-play-grid'), 'lobby play grid');
  check(document.getElementById('lobby-pass-banner'), 'countquest pass banner');
  check(typeof startLobbyPassTimer === 'function', 'lobby pass timer');
  check(typeof renderSpinWheelMarkup === 'function', 'spin wheel markup');
  check(typeof navApp.renderLobby === 'function', 'renderLobby');
  check(typeof navApp.handleLobbyNav === 'function', 'handleLobbyNav');
  check(typeof navApp.handleLobbyCurrencyBuy === 'function', 'lobby currency buy handler');
  check(typeof canPlayLobbyMinigame === 'function', 'lobby minigame helper');

  check(typeof lobbyTapFeedback === 'function', 'lobby tap feedback');
  check(typeof showModalPremium === 'function', 'premium modal helper');
  check(typeof bumpCurrencyEl === 'function', 'currency bump animation');
  check(document.querySelector('.dialog-premium') || document.getElementById('modal-lobby-shop'), 'dialog premium class');
  check(typeof PHASE_SCREEN_IDS === 'object' && PHASE_SCREEN_IDS.menu === 'screen-menu', 'phase screen map');

  check(TOURNAMENT_BRACKET_SIZE === 8, 'tournament bracket size');
  check(typeof canEnterTournament === 'function', 'canEnterTournament');
  check(typeof handleInviteDeepLink === 'function', 'invite deep link');
  check(typeof handleDeepLinks === 'function', 'unified deep link router');
  check(typeof buildClubInviteUrl === 'function', 'buildClubInviteUrl');
  check(typeof buildTournamentInviteUrl === 'function', 'buildTournamentInviteUrl');
  check(typeof handleTournamentInviteDeepLink === 'function', 'tournament invite deep link');
  check(typeof createTournamentInvite === 'function', 'createTournamentInvite');
  check(typeof TournamentInviteRegistry.getAll === 'function', 'tournament invite registry');
  check(document.getElementById('screen-tournament'), 'tournament screen');
  check(document.getElementById('tournament-bracket-tree'), 'tournament bracket tree');
  check(typeof navApp.openTournament === 'function', 'openTournament');
  check(typeof navApp.startTournament === 'function', 'startTournament');
  check(typeof navApp.resolveTournamentMatch === 'function', 'resolveTournamentMatch');

  check(SPECIAL_EVENTS.length >= 5, 'special events rotate');
  check(typeof getCurrentSpecialEvent === 'function', 'getCurrentSpecialEvent');
  check(typeof getSpecialEventTier === 'function', 'getSpecialEventTier');
  check(typeof getGlobalCrewLeaderboard === 'function', 'global crew leaderboard');
  check(typeof ensureSpecialEventProgress === 'function', 'special event progress');
  check(document.getElementById('screen-special-event'), 'special event screen');
  check(typeof navApp.openSpecialEvent === 'function', 'openSpecialEvent');
  check(typeof navApp.joinSpecialEventTable === 'function', 'joinSpecialEventTable');
  const evSave = defaultSave();
  evSave.chips = 5000;
  evSave.stats.helpLevel = 1;
  // Pin to a table event — getCurrentSpecialEvent() rotates weekly (dealer-night has no table tier).
  const ev = SPECIAL_EVENTS.find(e => e.id === 'count-rush');
  const evTier = getSpecialEventTier(ev);
  check(evTier && evTier.entryFeeChips < getTableTier(ev.baseTierId).entryFeeChips, 'event entry discount');
  const evPaid = payTableEntry(evSave, getTableTier(ev.baseTierId), {
    entryFeeChips: evTier.entryFeeChips,
    entryFeeGems: evTier.entryFeeGems,
    winMultiplier: ev.winMultiplier,
  });
  check(evPaid.ok && evPaid.winPayout === calcTableWinPayout(evTier.entryFeeChips, ev.winMultiplier), 'event table payment');
  const evSession = {
    tableTierId: evTier.id,
    tableEntryFee: evTier.entryFeeChips,
    tableWinMultiplier: ev.winMultiplier,
    tableBonusGemsOnWin: ev.bonusGemsOnWin || 0,
    netPL: 100,
  };
  const gemsBefore = evSave.gems;
  const evSettle = settleTableSession(evSave, evSession);
  check(evSettle?.won && evSettle.multiplier === ev.winMultiplier, 'event settle win multiplier');
  if (ev.bonusGemsOnWin) check(evSave.gems === gemsBefore + ev.bonusGemsOnWin, 'event bonus gems on win');
  const evMode = LOBBY_PLAY_MODES.find(m => m.id === 'event');
  check(evMode?.action === 'special-event', 'lobby event routes to special-event');

  check(DEALER_MODE.minPlayers === 3 && DEALER_MODE.maxPlayers === 5, 'dealer mode player range');
  check(typeof createDealerAISeats === 'function', 'createDealerAISeats');
  check(typeof validateDealerPayoutGuess === 'function', 'validateDealerPayoutGuess');
  check(typeof dealerActionPrompt === 'function', 'dealerActionPrompt');
  check(document.getElementById('screen-dealer-mode'), 'dealer mode screen');
  check(typeof navApp.openDealerMode === 'function', 'openDealerMode');
  check(typeof navApp.startDealerShift === 'function', 'startDealerShift');
  check(typeof navApp.submitDealerPayout === 'function', 'submitDealerPayout');
  check(TRAINING_DRILLS.find(d => d.id === 'dealer-mode')?.status === 'live', 'dealer mode drill live');
  const pHand = new Hand([createPlayingCard('10','S'), createPlayingCard('9','H')]);
  const dHand = new Hand([createPlayingCard('10','D'), createPlayingCard('8','C')]);
  const payCheck = validateDealerPayoutGuess('win', pHand, dHand);
  check(payCheck.ok && payCheck.expected === 'win', 'dealer payout validation');
  const prompt = dealerActionPrompt(new Hand([createPlayingCard('10','S'), createPlayingCard('6','H')]));
  check(prompt.mustHit === true && prompt.correct === 'hit', 'dealer action prompt hit 16');
  const dealerMode = LOBBY_PLAY_MODES.find(m => m.id === 'dealer');
  check(dealerMode?.action === 'dealer-mode', 'lobby dealer shift routes');
  check(LOBBY_SECONDARY_RIGHT.includes('dealer'), 'dealer shift in lobby secondary');
  check(typeof computeDealerShiftReward === 'function', 'dealer shift reward helper');
  const rewardFull = computeDealerShiftReward(95, 12, false, 500);
  check(rewardFull.chips > 0 && rewardFull.gems === 1, 'dealer shift reward scales');
  check(computeDealerShiftReward(80, 12, true, 0).chips === 0, 'early shift no reward');
  check(typeof dealerUpShowsPeek === 'function' && dealerUpShowsPeek('A'), 'dealer peek on ace');
  const splitHand = { hand: new Hand([createPlayingCard('8','S'), createPlayingCard('8','H')]), doubled: false, fromSplit: false, splitAces: false };
  check(dealerModeAIStrategyAction(splitHand, '6', DEFAULT_RULES, 0) === 'split', 'dealer AI splits pairs');
  check(DAILY_TRAINING_GOAL_TYPES.some(g => g.drillId === 'dealer-mode'), 'daily dealer training goal');
  check(MISTAKE_REVIEW_CATEGORIES.dealer === 'Dealer', 'dealer mistake category');
  check(ACHIEVEMENTS.some(a => a.id === 'dealer-shift'), 'dealer shift achievement');
  const tourSave = defaultSave();
  tourSave.chips = 50000;
  tourSave.gems = 10;
  tourSave.stats.rank = 2;
  tourSave.stats.helpLevel = 3;
  ensurePlayerId(tourSave);
  const canTour = canEnterTournament(tourSave);
  check(canTour.ok, 'tournament entry eligible');
  const paid = payTournamentEntry(tourSave);
  check(paid.ok, 'tournament entry payment');
  tourSave.tournament.bracket = createTournamentBracket(tourSave);
  check(tourSave.tournament.bracket.length === 8, 'tournament bracket generated');
  const inviteUrl = buildClubInviteUrl('ABC123');
  check(inviteUrl.includes('join=ABC123'), 'invite url has join param');
  const tourInvite = createTournamentInvite(tourSave);
  check(tourInvite.ok && tourInvite.url.includes('tournament='), 'tournament invite url');
  const tourLookup = lookupTournamentInvite(tourInvite.invite.code);
  check(tourLookup && tourLookup.inviterId === tourSave.playerId, 'tournament invite registry lookup');
  const tourUrl = buildTournamentInviteUrl('XYZ789');
  check(tourUrl.includes('tournament=XYZ789'), 'tournament url has tournament param');
  const acceptSave = defaultSave();
  ensurePlayerId(acceptSave);
  acceptSave.playerId = 'player_accept_test';
  const accepted = acceptTournamentInviteMeta(acceptSave, tourLookup);
  check(accepted.ok && acceptSave.tournament.pendingInvite?.inviterName, 'accept tournament invite');
  check(acceptTournamentInviteMeta(tourSave, tourLookup).ok === false, 'cannot accept own tournament invite');

  console.log(`✓ All CountQuest tests passed (${passed} assertions)`);
  return passed;
}

function bootstrapEmbeddedTests() {
  if (!window.__CQ_TEST_MODE || window.__runTestsBootstrapped) return;
  window.__runTestsBootstrapped = true;
  let banner = document.getElementById('test-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'test-banner';
    document.body.prepend(banner);
  }
  banner.className = 'fixed top-0 inset-x-0 z-[100] text-white text-center py-2 font-bold';
  try {
    const n = runTests();
    banner.classList.add('bg-green-600');
    banner.textContent = `✓ All CountQuest tests passed (${n} assertions)`;
  } catch (e) {
    console.error(e);
    banner.classList.add('bg-red-700');
    banner.textContent = `✗ Tests failed: ${e.message}`;
    throw e;
  } finally {
    window.__runTestsDone = true;
  }
}

try {
  window.app = new CountQuestApp();
  if (window.__CQ_TEST_MODE) {
    setTimeout(bootstrapEmbeddedTests, 0);
  }
} catch (err) {
  console.error(err);
  window.__runTestsDone = true;
  document.body.innerHTML = '<div style="padding:2rem;color:#fff;background:#7f1d1d;font-family:sans-serif"><h1>CountQuest failed to start</h1><pre>' + err.message + '\n' + err.stack + '</pre></div>';
}
