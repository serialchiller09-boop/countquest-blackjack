// End of Shift Report for Dealer Mode.
// Statically loaded. Math + UI. Does not rewrite the engine.

function createDealerShiftWatch() {
  return {
    bets: [],
    lastUnitsBySeat: {},
    biggestBet: 0,
    biggestBetSeat: null,
    biggestPot: 0,
    heatFlags: [],
  };
}

function recordDealerShiftBets(watch, seats, snapshot, handNumber) {
  if (!watch || !seats) return watch;
  const minBet = (typeof DEALER_MODE !== 'undefined' && DEALER_MODE.minBet) || 25;
  const heatFn = typeof detectBetSpreadHeat === 'function' ? detectBetSpreadHeat : null;
  let pot = 0;
  for (const seat of seats) {
    const bet = (typeof dealerSeatTotalBet === 'function' ? dealerSeatTotalBet(seat) : 0) || seat.bet || 0;
    pot += bet;
    const units = minBet ? bet / minBet : 0;
    const prev = watch.lastUnitsBySeat[seat.id];
    const heat = heatFn
      ? heatFn(prev, units)
      : { heated: prev != null && Math.abs(units - prev) >= 4, jump: prev == null ? 0 : Math.abs(units - prev) };
    if (heat.heated) {
      watch.heatFlags.push({ seatName: seat.name, jump: heat.jump, hand: handNumber });
    }
    watch.lastUnitsBySeat[seat.id] = units;
    watch.bets.push({
      hand: handNumber,
      seatId: seat.id,
      seatName: seat.name,
      bet,
      units,
      tc: snapshot && snapshot.trueCount != null ? snapshot.trueCount : null,
      rc: snapshot && snapshot.runningCount != null ? snapshot.runningCount : null,
    });
    if (bet > watch.biggestBet) {
      watch.biggestBet = bet;
      watch.biggestBetSeat = seat.name;
    }
  }
  if (pot > watch.biggestPot) watch.biggestPot = pot;
  return watch;
}

function dealerShiftAwarenessScore(analytics) {
  const a = analytics || {};
  const parts = [];
  if (a.payoutTotal) parts.push([(a.payoutCorrect || 0) / a.payoutTotal, 50]);
  if (a.countTotal) parts.push([(a.countCorrect || 0) / a.countTotal, 30]);
  if (a.dealerActionTotal) parts.push([(a.dealerActionCorrect || 0) / a.dealerActionTotal, 20]);
  if (!parts.length) return null;
  let score = 0, weight = 0;
  for (const [ratio, w] of parts) {
    score += ratio * w;
    weight += w;
  }
  return Math.round((score / weight) * 100);
}

function buildDealerShiftReport(ds, extras) {
  extras = extras || {};
  const early = !!extras.early;
  const watch = (ds && ds.shiftWatch) || extras.watch || createDealerShiftWatch();
  const a = (ds && ds.analytics) || {};
  const payoutAcc = a.payoutTotal ? Math.round(100 * a.payoutCorrect / a.payoutTotal) : null;
  const countAcc = a.countTotal ? Math.round(100 * a.countCorrect / a.countTotal) : null;
  const actionAcc = a.dealerActionTotal ? Math.round(100 * a.dealerActionCorrect / a.dealerActionTotal) : null;
  const housePL = ((ds && ds.houseBank) || 0) - ((ds && ds.startBank) || 0);
  const dealerMistakes =
    ((a.payoutTotal || 0) - (a.payoutCorrect || 0))
    + ((a.countTotal || 0) - (a.countCorrect || 0))
    + ((a.dealerActionTotal || 0) - (a.dealerActionCorrect || 0));
  return {
    hands: (ds && ds.handsPlayed) || 0,
    targetHands: (ds && ds.targetHands) || (typeof DEALER_MODE !== 'undefined' ? DEALER_MODE.handsPerSession : 12),
    early,
    housePL,
    finalBank: (ds && ds.houseBank) || 0,
    payoutAcc,
    countAcc,
    actionAcc,
    payoutCorrect: a.payoutCorrect || 0,
    payoutTotal: a.payoutTotal || 0,
    countCorrect: a.countCorrect || 0,
    countTotal: a.countTotal || 0,
    dealerMistakes,
    biggestBet: watch.biggestBet || 0,
    biggestBetSeat: watch.biggestBetSeat || null,
    biggestPot: watch.biggestPot || 0,
    heatFlags: watch.heatFlags || [],
    awareness: dealerShiftAwarenessScore(a),
    playerDeviationsNote: 'AI seats play basic strategy. Player deviations are not scored yet.',
  };
}

function renderDealerShiftReportHtml(report) {
  const r = report || {};
  const pl = r.housePL || 0;
  const plCls = pl >= 0 ? 'text-green-400' : 'text-red-300';
  const plTxt = (pl >= 0 ? '+' : '') + Number(pl).toLocaleString();
  const heat = r.heatFlags || [];
  const heatLine = heat.length
    ? heat.slice(0, 4).map(h => `${h.seatName} jumped ${Math.round(h.jump)} units on hand ${h.hand}`).join('; ')
      + (heat.length > 4 ? ` (+${heat.length - 4} more)` : '')
    : 'No 4+ unit bet jumps this shift.';
  const awareness = r.awareness == null ? 'n/a' : `${r.awareness}%`;
  const biggest = r.biggestBet
    ? `$${Number(r.biggestBet).toLocaleString()}${r.biggestBetSeat ? ` (${r.biggestBetSeat})` : ''}`
    : 'No bets recorded';
  const pot = r.biggestPot ? `$${Number(r.biggestPot).toLocaleString()}` : 'n/a';
  const pct = (v) => (v == null ? 'n/a' : `${v}%`);
  return `
    <div class="dealer-analytics-grid">
      <div><div class="stat-val">${awareness}</div><div class="stat-lbl">Awareness</div></div>
      <div><div class="stat-val">${r.hands || 0}</div><div class="stat-lbl">Hands dealt</div></div>
      <div><div class="stat-val ${plCls}">${plTxt}</div><div class="stat-lbl">House P/L</div></div>
    </div>
    <div class="text-sm space-y-1 mt-3">
      <div class="flex justify-between gap-3"><span>Biggest bet</span><span class="font-mono text-gold text-right">${biggest}</span></div>
      <div class="flex justify-between gap-3"><span>Biggest pot</span><span class="font-mono text-gold text-right">${pot}</span></div>
      <div class="flex justify-between gap-3"><span>Your payout accuracy</span><span class="font-mono text-gold">${pct(r.payoutAcc)}</span></div>
      <div class="flex justify-between gap-3"><span>Your count checks</span><span class="font-mono text-gold">${pct(r.countAcc)}</span></div>
      <div class="flex justify-between gap-3"><span>Dealer rules</span><span class="font-mono text-gold">${pct(r.actionAcc)}</span></div>
      <div class="flex justify-between gap-3"><span>Mistakes on your shift</span><span class="font-mono ${r.dealerMistakes ? 'text-red-300' : 'text-green-400'}">${r.dealerMistakes || 0}</span></div>
    </div>
    <div class="mt-3 text-xs text-emerald-200/85 space-y-1">
      <p><span class="uppercase tracking-wider text-cyan-400/80">Suspicious betting</span></p>
      <p>${heatLine}</p>
      <p class="text-emerald-500/70">${r.playerDeviationsNote}</p>
      <p class="text-center text-emerald-400/70 mt-2">${r.early ? 'Shift ended early.' : 'Full shift complete.'}</p>
    </div>`;
}

(function installDealerShiftReport() {
  function patch() {
    const App = window.CountQuestApp;
    if (!App || !App.prototype || App.prototype._cqShiftReportInstalled) return !!App;
    if (typeof buildDealerShiftReport !== 'function') return false;
    App.prototype._cqShiftReportInstalled = true;

    const origStart = App.prototype.startDealerShift;
    App.prototype.startDealerShift = function () {
      origStart.call(this);
      if (this.dealerSession) {
        this.dealerSession.shiftWatch = createDealerShiftWatch();
      }
    };

    const origBets = App.prototype.dealerPlaceBets;
    App.prototype.dealerPlaceBets = function () {
      origBets.call(this);
      const ds = this.dealerSession;
      if (!ds || !ds.shiftWatch) return;
      const snap = ds.counter && ds.counter.getCountSnapshot
        ? ds.counter.getCountSnapshot(ds.shoe)
        : {};
      recordDealerShiftBets(ds.shiftWatch, ds.seats, snap, (ds.handsPlayed || 0) + 1);
    };

    const origEnd = App.prototype.endDealerShift;
    App.prototype.endDealerShift = function (early) {
      const ds = this.dealerSession;
      if (ds) this._lastShiftReport = buildDealerShiftReport(ds, { early: !!early });
      origEnd.call(this, early);
    };

    const origFinish = App.prototype.finishDrillWithSummary;
    App.prototype.finishDrillWithSummary = function (drillId, payload) {
      if (drillId === 'dealer-mode' && this._lastShiftReport) {
        const durationMs = this.drillSessionStartedAt
          ? Date.now() - this.drillSessionStartedAt
          : 0;
        const summary = typeof buildDrillSessionSummary === 'function'
          ? buildDrillSessionSummary(drillId, Object.assign({ durationMs }, payload || {}))
          : null;
        if (summary && summary.accuracy != null && this.trackClubWeekly) {
          this.trackClubWeekly('training', { accuracy: summary.accuracy });
        }
        if (summary && typeof updateDrillPersonalBest === 'function') {
          updateDrillPersonalBest(this.save, summary);
        }
        this.pendingDrillSummary = summary;
        this.save.sessionActive = false;
        this.save.sessionDrill = null;
        if (this.persist) this.persist();
        this.showDealerShiftReport(this._lastShiftReport);
        return;
      }
      return origFinish.call(this, drillId, payload);
    };

    App.prototype.showDealerShiftReport = function (report) {
      this.phase = 'dealer-mode';
      this.dealerSession = {
        view: 'summary',
        shiftReport: report,
        handsPlayed: report.hands,
        houseBank: report.finalBank,
        startBank: report.finalBank - (report.housePL || 0),
        analytics: {
          payoutCorrect: report.payoutCorrect,
          payoutTotal: report.payoutTotal,
          countCorrect: report.countCorrect,
          countTotal: report.countTotal,
          dealerActionCorrect: 0,
          dealerActionTotal: report.actionAcc == null ? 0 : 1,
          responseMsSum: 0,
          responseCount: 0,
        },
      };
      this.render();
      const body = document.getElementById('dealer-summary-body');
      if (body && typeof renderDealerShiftReportHtml === 'function') {
        body.innerHTML = renderDealerShiftReportHtml(report);
      }
      const title = document.querySelector('#dealer-mode-summary h2');
      if (title) title.textContent = 'End of Shift Report';
      const sub = document.querySelector('#dealer-mode-summary p');
      if (sub) sub.textContent = report.early ? 'Shift ended early' : 'Shift complete';
    };

    return true;
  }

  if (!patch()) {
    window.addEventListener('load', patch);
  }
})();
