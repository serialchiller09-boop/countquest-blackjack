// §8 TUTORIAL HELPERS (global — callable when counting system changes)
// ═══════════════════════════════════════════════════════════════
function updateTutorialCountExplanation() {
  window.app?.updateTutorialCountExplanation();
}

// Load first-run overlay after app boot if index.html has not already included it.
(function loadFirstRunModule() {
  function inject() {
    if (window.__CQ_FIRST_RUN_BOOTED) return;
    if (document.querySelector('script[src*="11-first-run.js"]')) return;
    const s = document.createElement('script');
    s.src = 'js/11-first-run.js?v=46';
    document.head.appendChild(s);
  }
  if (document.readyState === 'complete') inject();
  else window.addEventListener('load', inject);
})();

// ═══════════════════════════════════════════════════════════════
