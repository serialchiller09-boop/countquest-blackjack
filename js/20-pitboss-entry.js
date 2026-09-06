/**
 * Pit Boss Case 01 entry — lobby-only. Never overlays the table Hit button.
 */
(function () {
  'use strict';

  function inLiveHand() {
    return !!(
      document.getElementById('btnHit') ||
      document.getElementById('hitBtn') ||
      document.getElementById('btn-hit') ||
      document.querySelector('#player-actions, .hand-actions, .action-bar')
    );
  }

  function findLobbyHost() {
    var secondary = document.getElementById('lobby-secondary-right');
    if (secondary) return secondary;
    var dealerBtn = document.querySelector('[data-lobby-play="dealer-mode"]');
    if (dealerBtn && dealerBtn.parentElement) return dealerBtn.parentElement;
    var stage = document.getElementById('lobby-play-stage');
    if (stage) return stage;
    return (
      document.getElementById('lobbyPlayModes') ||
      document.querySelector('.play-modes, .lobby-modes, .lobby-play-modes') ||
      null
    );
  }

  function addButton() {
    if (inLiveHand()) {
      var floating = document.getElementById('btnPitBoss');
      if (floating) floating.remove();
      return;
    }
    var host = findLobbyHost();
    if (!host) return;
    var existing = document.getElementById('btnPitBoss');
    if (existing) {
      if (existing.parentNode !== host) host.appendChild(existing);
      existing.style.position = 'static';
      existing.style.zIndex = 'auto';
      existing.style.bottom = '';
      existing.style.right = '';
      return;
    }
    var a = document.createElement('a');
    a.id = 'btnPitBoss';
    a.href = 'pitboss/index.html';
    a.className = 'btn primary pitboss-entry';
    a.textContent = 'Pit Boss — Five Seats';
    a.setAttribute('aria-label', 'Play Pit Boss Five Seats');
    a.style.cssText =
      'display:block;margin:12px auto;max-width:280px;text-align:center;text-decoration:none;' +
      'padding:12px 16px;border-radius:10px;background:#c9a227;color:#111;font-weight:700;' +
      'position:static;z-index:auto;';
    host.appendChild(a);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
  var n = 0;
  var t = setInterval(function () {
    addButton();
    if (++n > 40) clearInterval(t);
  }, 500);
})();
