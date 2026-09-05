/**
 * Pit Boss Case 01 entry — adds Play menu button when lobby is present.
 */
(function () {
  'use strict';
  function addButton() {
    if (document.getElementById('btnPitBoss')) return;
    var modes = document.getElementById('lobbyPlayModes') || document.querySelector('.play-modes, .lobby-modes');
    var play = document.getElementById('btnPlay') || document.querySelector('[data-action="play"]');
    var menu = document.getElementById('mainMenu') || document.querySelector('.menu-screen, #menu, .lobby');
    var a = document.createElement('a');
    a.id = 'btnPitBoss';
    a.href = 'pitboss/index.html';
    a.className = 'btn primary pitboss-entry';
    a.textContent = 'Pit Boss — Five Seats';
    a.style.cssText = 'display:block;margin:12px auto;max-width:280px;text-align:center;text-decoration:none;padding:12px 16px;border-radius:10px;background:#c9a227;color:#111;font-weight:700;';
    if (modes) {
      modes.appendChild(a);
      return;
    }
    if (play && play.parentNode) {
      play.parentNode.insertBefore(a, play.nextSibling);
      return;
    }
    if (menu) {
      menu.appendChild(a);
      return;
    }
    a.style.position = 'fixed';
    a.style.bottom = '16px';
    a.style.right = '16px';
    a.style.zIndex = '9999';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
  var n = 0;
  var t = setInterval(function () {
    addButton();
    if (++n > 20) clearInterval(t);
  }, 500);
})();
