// End of Shift Report for Dealer Mode.
// Statically loaded. Wraps existing shift methods. Does not rewrite the engine.

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
