// S27 Rail Count Increment 1 — assembles p0+p1 then boots CQRail
(function () {
  'use strict';
  function boot() {
    var p = window.__cqRailSrcParts;
    if (!p || p[0] == null || p[1] == null || window.__cqRailSrcEvaled) return;
    window.__cqRailSrcEvaled = true;
    (0, eval)(String(p[0]) + String(p[1]));
  }
  function inj(name, next) {
    if (document.querySelector('script[src*="' + name + '"]')) { next(); return; }
    var s = document.createElement('script');
    s.src = 'js/' + name + '?v=50';
    s.async = false;
    s.onload = next;
    s.onerror = function () { console.error('CountQuest: missing', name); };
    document.head.appendChild(s);
  }
  inj('27-rail-p0.js', function () { inj('27-rail-p1.js', boot); });
})();
