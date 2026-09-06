// S23a loader - pulls bet tray / career ranks / titles body
(function () {
  if (document.querySelector('script[src*="23a-bet-ranks-body.js"]')) return;
  var s = document.createElement('script');
  s.src = 'js/23a-bet-ranks-body.js?v=48';
  document.head.appendChild(s);
})();
