// §29 FIRST-RUN × DAILY-REWARD GATE
// Prevents #modal-daily-reward from opening over #cq-first-run (backdrop eats taps).
// Loads after 07 + 11 so the 400ms daily timer hits the gated method.
(function () {
  if (window.__CQ_FIRST_RUN_DAILY_GATE) return;
  window.__CQ_FIRST_RUN_DAILY_GATE = true;

  var STORAGE_KEY = 'cq.firstRunV1';

  function firstRunPendingOrOpen() {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') return true;
    } catch (_) {
      return true;
    }
    var el = document.getElementById('cq-first-run');
    if (el && (el.open || el.hasAttribute('open'))) return true;
    return false;
  }

  function firstRunBlocksDaily() {
    return firstRunPendingOrOpen();
  }

  function closeDailyIfBlocked() {
    if (!firstRunBlocksDaily()) return;
    var daily = document.getElementById('modal-daily-reward');
    if (daily && daily.open) {
      try { daily.close(); } catch (_) {}
    }
    if (window.app) window.app._dailyRewardModalShown = false;
  }

  function patchMaybeShow() {
    var Proto = window.CountQuestApp && window.CountQuestApp.prototype;
    if (!Proto || typeof Proto.maybeShowDailyRewardModal !== 'function') return false;
    if (Proto.maybeShowDailyRewardModal.__cqFirstRunGated) return true;

    var orig = Proto.maybeShowDailyRewardModal;
    function gated() {
      // Return BEFORE setting _dailyRewardModalShown when blocked by first-run.
      if (firstRunBlocksDaily()) return;
      return orig.apply(this, arguments);
    }
    gated.__cqFirstRunGated = true;
    Proto.maybeShowDailyRewardModal = gated;

    if (window.app && typeof window.app.maybeShowDailyRewardModal === 'function') {
      window.app.maybeShowDailyRewardModal = function () {
        return gated.apply(window.app, arguments);
      };
      window.app.maybeShowDailyRewardModal.__cqFirstRunGated = true;
    }
    return true;
  }

  function patchShowClaim() {
    var Proto = window.CountQuestApp && window.CountQuestApp.prototype;
    if (!Proto || typeof Proto.showDailyRewardClaimModal !== 'function') return false;
    if (Proto.showDailyRewardClaimModal.__cqFirstRunGated) return true;

    var orig = Proto.showDailyRewardClaimModal;
    function gated() {
      if (firstRunBlocksDaily()) return;
      return orig.apply(this, arguments);
    }
    gated.__cqFirstRunGated = true;
    Proto.showDailyRewardClaimModal = gated;

    if (window.app && typeof window.app.showDailyRewardClaimModal === 'function') {
      window.app.showDailyRewardClaimModal = function () {
        return gated.apply(window.app, arguments);
      };
      window.app.showDailyRewardClaimModal.__cqFirstRunGated = true;
    }
    return true;
  }

  function canShowDailyAfterFirstRun() {
    // storage must be seen
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') return false;
    } catch (_) {
      return false;
    }
    // dialog must be gone
    var el = document.getElementById('cq-first-run');
    if (el) return false;
    // only on menu (not tutorial / table-lobby / mid-navigate)
    var leaving = window.__cqLeavingFirstRunFor;
    if (leaving && leaving !== 'menu') return false;
    var app = window.app;
    if (!app) return false;
    var phase = app.phase || 'menu';
    if (phase !== 'menu') return false;
    if (phase === 'tutorial' || phase === 'table-lobby') return false;
    return true;
  }

  function showDailyAfterFirstRun() {
    if (!window.app) return;
    var daily = document.getElementById('modal-daily-reward');
    if (daily && daily.open) return;
    if (!canShowDailyAfterFirstRun()) return;
    window.app._dailyRewardModalShown = false;
    if (typeof window.app.maybeShowDailyRewardModal === 'function') {
      try { window.app.maybeShowDailyRewardModal(); } catch (_) {}
    }
  }

  function hookFirstRunDialog(el) {
    if (!el || el.__cqDailyHooked) return;
    el.__cqDailyHooked = true;
    el.addEventListener('close', function () {
      setTimeout(showDailyAfterFirstRun, 0);
    });
  }

  function watchFirstRun() {
    var el = document.getElementById('cq-first-run');
    if (el) hookFirstRunDialog(el);
    if (window.__CQ_FR_DAILY_MO) return;
    if (typeof MutationObserver !== 'function') return;
    window.__CQ_FR_DAILY_MO = new MutationObserver(function () {
      var d = document.getElementById('cq-first-run');
      if (d) hookFirstRunDialog(d);
      closeDailyIfBlocked();
    });
    try {
      window.__CQ_FR_DAILY_MO.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  function boot() {
    patchMaybeShow();
    patchShowClaim();
    closeDailyIfBlocked();
    watchFirstRun();
    // Retry briefly in case CountQuestApp arrives a tick later (tests / alternate boot).
    var n = 0;
    var t = setInterval(function () {
      patchMaybeShow();
      patchShowClaim();
      closeDailyIfBlocked();
      watchFirstRun();
      if (++n > 30) clearInterval(t);
    }, 50);
  }

  boot();
})();
