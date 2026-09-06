// §29 FIRST-RUN × DAILY-REWARD GATE
// Prevents #modal-daily-reward from opening over #cq-first-run (backdrop eats taps).
// Loads after 07 + 11 so the 400ms daily timer hits the gated method.
(function () {
  if (window.__CQ_FIRST_RUN_DAILY_GATE) return;
  window.__CQ_FIRST_RUN_DAILY_GATE = true;

  var STORAGE_KEY = 'cq.firstRunV1';

  function firstRunBlocksDaily() {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') return true;
    } catch (_) {
      return true;
    }
    var el = document.getElementById('cq-first-run');
    if (el && (el.open || el.hasAttribute('open'))) return true;
    return false;
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

  function showDailyAfterFirstRun() {
    if (!window.app) return;
    // dismiss() may already have opened daily; don't reset the flag and re-show.
    var daily = document.getElementById('modal-daily-reward');
    if (daily && daily.open) return;
    if (firstRunBlocksDaily()) return;
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
    closeDailyIfBlocked();
    watchFirstRun();
    // Retry briefly in case CountQuestApp arrives a tick later (tests / alternate boot).
    var n = 0;
    var t = setInterval(function () {
      patchMaybeShow();
      closeDailyIfBlocked();
      watchFirstRun();
      if (++n > 30) clearInterval(t);
    }, 50);
  }

  boot();
})();
