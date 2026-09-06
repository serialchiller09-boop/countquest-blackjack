// S27 Rail Count Increment 1 — loads chunked readable source (c0..c7)
(function () {
  'use strict';
  if (window.__cqRailSrcEvaled) return;
  var v = '51';
  var urls = [
    'js/27-rail-chunks/c0.txt',
    'js/27-rail-chunks/c1.txt',
    'js/27-rail-chunks/c2.txt',
    'js/27-rail-chunks/c3.txt',
    'js/27-rail-chunks/c4.txt',
    'js/27-rail-chunks/c5.txt',
    'js/27-rail-chunks/c6.txt',
    'js/27-rail-chunks/c7.txt'
  ];
  Promise.all(urls.map(function (u) {
    return fetch(u + '?v=' + v, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('missing ' + u);
      return r.text();
    });
  })).then(function (parts) {
    if (window.__cqRailSrcEvaled) return;
    window.__cqRailSrcEvaled = true;
    (0, eval)(parts.join(''));
  }).catch(function (err) {
    console.error('CountQuest Rail Count failed to load', err);
  });
})();
