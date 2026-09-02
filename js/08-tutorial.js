// §8 TUTORIAL HELPERS (global — callable when counting system changes)
function updateTutorialCountExplanation() {
  window.app?.updateTutorialCountExplanation();
}

(function loadFirstRunModule() {
  function inject(name) {
    if (document.querySelector('script[src*="' + name + '"]')) return;
    const s = document.createElement('script');
    s.src = 'js/' + name + '?v=46';
    document.head.appendChild(s);
  }
  function injectAll() {
    inject('11-first-run.js');
    inject('12-tester-qa.js');
  }
  if (document.readyState === 'complete') injectAll();
  else window.addEventListener('load', injectAll);
})();
