// §22 Dealer catch-up — honest payout accuracy when payoutTotal===0 (Jeff)
(function () {
  'use strict';

  function apply() {
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqDealerCatchup22) return true;
    proto.__cqDealerCatchup22 = true;

    proto.endDealerShift = function (early) {
      early = !!early;
      this.stopDealerTimer();
      const ds = this.dealerSession;
      if (!ds) return;
      const stats = this.save.dealerMode || defaultDealerModeStats();
      stats.sessionsPlayed += 1;
      stats.totalHands += ds.handsPlayed;
      stats.totalPayoutCorrect += ds.analytics.payoutCorrect;
      stats.totalPayoutAttempts += ds.analytics.payoutTotal;
      stats.totalCountCorrect += ds.analytics.countCorrect;
      stats.totalCountAttempts += ds.analytics.countTotal;
      const payoutAcc = ds.analytics.payoutTotal
        ? Math.round(100 * ds.analytics.payoutCorrect / ds.analytics.payoutTotal) : 0;
      const countAcc = ds.analytics.countTotal
        ? Math.round(100 * ds.analytics.countCorrect / ds.analytics.countTotal) : 0;
      const dealerActionAcc = ds.analytics.dealerActionTotal
        ? Math.round(100 * ds.analytics.dealerActionCorrect / ds.analytics.dealerActionTotal) : null;
      if (ds.analytics.payoutTotal) {
        stats.bestPayoutAccuracy = Math.max(stats.bestPayoutAccuracy, payoutAcc);
      }
      stats.bestCountAccuracy = Math.max(stats.bestCountAccuracy, countAcc);
      const housePL = ds.houseBank - ds.startBank;
      const avgResponseMs = ds.analytics.responseCount
        ? Math.round(ds.analytics.responseMsSum / ds.analytics.responseCount) : 0;
      stats.lastSession = {
        at: Date.now(),
        hands: ds.handsPlayed,
        payoutAcc,
        countAcc,
        dealerActionAcc,
        avgResponseMs,
        housePL,
        early,
      };
      this.save.dealerMode = stats;
      recordTrainingHistorySession(this.save, 'dealer-mode', {
        attempts: ds.handsPlayed,
        accuracy: payoutAcc,
        avgError: avgResponseMs,
        meta: { housePL, countAcc, dealerActionAcc },
      });
      const reward = computeDealerShiftReward(payoutAcc, ds.handsPlayed, early, housePL, ds.eventMode);
      if (reward.chips) addChips(this.save, reward.chips);
      if (reward.gems) addGems(this.save, reward.gems);
      if (ds.eventMode && !early) {
        const prog = ensureSpecialEventProgress(this.save);
        prog.dealerShifts = (prog.dealerShifts || 0) + 1;
        if (ds.analytics.payoutTotal) {
          prog.dealerBestAcc = Math.max(prog.dealerBestAcc || 0, payoutAcc);
        }
        if (reward.gems) prog.gemsEarned = (prog.gemsEarned || 0) + reward.gems;
      }
      this.dealerEventActive = null;
      this.checkDailyTrainingProgress('drillSession', {
        drillId: 'dealer-mode',
        accuracy: payoutAcc,
        attempts: ds.handsPlayed,
      });
      this.checkEngagement();
      this.dealerSession = null;
      this.save.sessionActive = false;
      Sounds.play(reward.chips || reward.gems ? 'reward' : housePL >= 0 ? 'win' : 'loss');
      if (reward.chips || reward.gems) {
        const parts = [];
        if (reward.chips) parts.push('+' + reward.chips.toLocaleString() + ' chips');
        if (reward.gems) parts.push('+' + reward.gems + ' gem');
        this.toast('Shift reward: ' + parts.join(' · '), 'level', 4500);
        lobbyTapFeedback('sparkle');
      } else if (reward.reason) {
        this.toast(early ? 'Shift ended early — no reward' : 'Finish more hands for shift rewards', 'info', 3500);
      }
      this.finishDrillWithSummary('dealer-mode', {
        payoutAcc: payoutAcc,
        payoutCorrect: ds.analytics.payoutCorrect,
        payoutTotal: ds.analytics.payoutTotal,
        countAcc: countAcc,
        dealerActionAcc: dealerActionAcc,
        housePL: housePL,
        handsPlayed: ds.handsPlayed,
        avgResponseMs: avgResponseMs,
        early: early,
        rewardChips: reward.chips,
        rewardGems: reward.gems,
      });
    };

    const origRender = proto.renderDealerMode;
    proto.renderDealerMode = function () {
      origRender.call(this);
      const ds = this.dealerSession;
      if (!ds || !ds.analytics) return;
      const bank = document.getElementById('dealer-bank-bar');
      if (bank && !ds.analytics.payoutTotal && ds.view === 'active') {
        const pl = ds.houseBank - ds.startBank;
        bank.innerHTML =
          '<div class="text-xs"><span class="text-emerald-400/70">House Bank</span> <span class="font-mono font-bold text-gold text-lg">' +
          ds.houseBank.toLocaleString() +
          '</span></div>' +
          '<div class="text-xs"><span class="text-emerald-400/70">Hand</span> <span class="font-mono text-emerald-200">' +
          (ds.handsPlayed + 1) + '/' + ds.targetHands +
          '</span></div>' +
          '<div class="text-xs"><span class="text-emerald-400/70">Session P/L</span> <span class="font-mono ' +
          (pl >= 0 ? 'text-green-400' : 'text-red-300') + '">' +
          (pl >= 0 ? '+' : '') + pl.toLocaleString() +
          '</span></div>' +
          '<div class="text-xs"><span class="text-emerald-400/70">Payout score</span> <span class="font-mono text-amber-300">—</span></div>';
      }
      if (ds.view === 'summary' && !ds.analytics.payoutTotal) {
        const body = document.getElementById('dealer-summary-body');
        const val = body && body.querySelector('.stat-val');
        const lbl = body && body.querySelector('.stat-lbl');
        if (val) val.textContent = '—';
        if (lbl) lbl.textContent = 'No payouts graded';
      }
    };

    return true;
  }

  function boot() {
    if (apply()) return;
    let n = 0;
    const t = setInterval(function () {
      if (apply() || ++n > 50) clearInterval(t);
    }, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
