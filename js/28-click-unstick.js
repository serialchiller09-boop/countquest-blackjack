// Emergency click restore — dealing locks, orphan dialogs, leftover backdrops.
(function () {
  'use strict';
  if (window.__CQ_CLICK_UNSTICK) return;
  window.__CQ_CLICK_UNSTICK = true;

  function clearDealLocks() {
    var a = window.app;
    if (!a) return;
    a.dealing = false;
    a._betSubmitting = false;
    if (typeof a.unlockDealButton === 'function') {
      try { a.unlockDealButton(); } catch (e) {}
    }
  }

  function hideStrayBackdrops() {
    var bd = document.getElementById('stats-backdrop');
    if (!bd) return;
    var panel = document.getElementById('stats-sidebar') || document.getElementById('stats-panel');
    var open = panel && panel.classList.contains('open');
    if (!open) {
      bd.classList.add('hidden');
      bd.classList.remove('visible');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function closeDeadDialogs() {
    var firstRunOpen = document.body.classList.contains('cq-first-run-open') || !!document.getElementById('cq-first-run');
    document.querySelectorAll('dialog[open]').forEach(function (d) {
      if (d.id === 'cq-first-run') return;
      if (firstRunOpen && d.id === 'modal-daily-reward') {
        try { d.close(); } catch (e) { d.removeAttribute('open'); }
        if (window.app) window.app._dailyRewardModalShown = false;
        return;
      }
      var rect = d.getBoundingClientRect();
      var buttons = d.querySelectorAll('button');
      if (rect.width < 8 && rect.height < 8) {
        try { d.close(); } catch (e) { d.removeAttribute('open'); }
      }
      if (!buttons.length) {
        try { d.close(); } catch (e) { d.removeAttribute('open'); }
      }
    });
  }

  function restoreButtonHits() {
    document.querySelectorAll('button, [role="button"], .action-btn, .chip-btn').forEach(function (b) {
      if (b.style.pointerEvents === 'none') b.style.pointerEvents = 'auto';
    });
    if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = '';
  }

  function unstick() {
    closeDeadDialogs();
    hideStrayBackdrops();
    clearDealLocks();
    restoreButtonHits();
  }

  window.cqUnstick = unstick;

  function boot() {
    setTimeout(unstick, 400);
    setTimeout(unstick, 1000);
    setTimeout(unstick, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
