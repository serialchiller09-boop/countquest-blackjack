// Emergency click restore — dealing locks, orphan dialogs, leftover backdrops.
// Does not dismiss a healthy first-run dialog (those buttons must keep working).
(function () {
  'use strict';

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
    var open = panel && !panel.classList.contains('hidden') && panel.getAttribute('aria-hidden') !== 'true';
    if (!open) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function closeDeadDialogs() {
    document.querySelectorAll('dialog[open]').forEach(function (d) {
      if (d.id === 'cq-first-run') return;
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
    setTimeout(unstick, 600);
    setTimeout(unstick, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
