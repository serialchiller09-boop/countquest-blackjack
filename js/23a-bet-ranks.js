// S23a loader - bet tray / career ranks / titles (p1 then p2)
(function () {
  function inject(name, next) {
    if (document.querySelector('script[src*="' + name + '"]')) {
      if (next) next();
      return;
    }
    var s = document.createElement('script');
    s.src = 'js/' + name + '?v=48';
    s.onload = function () { if (next) next(); };
    document.head.appendChild(s);
  }
  inject('23a-p1.js', function () { inject('23a-p2.js'); });
})();
