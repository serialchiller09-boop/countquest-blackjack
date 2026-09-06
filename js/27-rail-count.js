// S27 Rail Count Increment 1 — fetch+eval readable source parts
(function () {
  'use strict';
  if (window.__cqRailSrcEvaled) return;
  var v = '50';
  function load(url) {
    return fetch(url + '?v=' + v, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('missing ' + url);
      return r.text();
    });
  }
  Promise.all([
    load('js/27-rail-count.part0.txt'),
    load('js/27-rail-count.part1.txt'),
  ]).then(function (parts) {
    if (window.__cqRailSrcEvaled) return;
    window.__cqRailSrcEvaled = true;
    (0, eval)(parts[0] + parts[1]);
  }).catch(function (err) {
    console.error('CountQuest Rail Count failed to load', err);
  });
})();
