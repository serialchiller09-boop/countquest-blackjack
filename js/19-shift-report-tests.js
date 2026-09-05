// Extra assertions for End of Shift Report. Loaded after js/09-tests.js.
(function dealerShiftReportTests() {
  if (typeof check !== 'function') return;
  check(typeof createDealerShiftWatch === 'function', 'createDealerShiftWatch');
  check(typeof buildDealerShiftReport === 'function', 'buildDealerShiftReport');
  const watch = createDealerShiftWatch();
  const seatA = { id: 'seat_0', name: 'VegasVic', bet: 25, hands: [{ bet: 25 }] };
  const seatB = { id: 'seat_1', name: 'HighLimit', bet: 25, hands: [{ bet: 25 }] };
  recordDealerShiftBets(watch, [seatA, seatB], { trueCount: 0, runningCount: 1 }, 1);
  seatB.bet = 125;
  seatB.hands = [{ bet: 125 }];
  recordDealerShiftBets(watch, [seatA, seatB], { trueCount: 4, runningCount: 8 }, 2);
  check(watch.biggestBet === 125 && watch.biggestBetSeat === 'HighLimit', 'shift watch biggest bet');
  check(watch.biggestPot === 150, 'shift watch biggest pot');
  check(watch.heatFlags.length >= 1 && watch.heatFlags[0].seatName === 'HighLimit', 'shift watch heat flag');
  const fakeDs = {
    handsPlayed: 12,
    targetHands: 12,
    houseBank: 10400,
    startBank: 10000,
    analytics: {
      payoutCorrect: 10, payoutTotal: 10,
      countCorrect: 3, countTotal: 4,
      dealerActionCorrect: 2, dealerActionTotal: 2,
    },
    shiftWatch: watch,
  };
  const report = buildDealerShiftReport(fakeDs, { early: false });
  check(report.hands === 12 && report.housePL === 400, 'shift report hands and house PL');
  check(report.biggestBet === 125, 'shift report biggest bet');
  check(report.dealerMistakes === 1, 'shift report counts dealer mistakes');
  check(report.awareness != null && report.awareness >= 90, 'shift report awareness score');
  const reportHtml = renderDealerShiftReportHtml(report);
  check(reportHtml.indexOf('Awareness') !== -1, 'report html has awareness');
  check(reportHtml.indexOf('\u2014') === -1 && reportHtml.indexOf('\u2013') === -1, 'report html has no em dash');
})();
