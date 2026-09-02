// §14 CLUBS + SPIN UI — badge the crew screen; keep minigame Play armed (Play Store v54)
(function () {
  if (window.__CQ_CLUBS_SPIN_UI_BOOTED) return;
  window.__CQ_CLUBS_SPIN_UI_BOOTED = true;

  function dressClubs() {
    const head = document.querySelector('#screen-clubs > .text-center.py-2');
    if (!head || head.querySelector('.cq-crew-badge')) return;
    const badge = document.createElement('div');
    badge.className = 'cq-crew-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '👥';
    head.insertBefore(badge, head.firstChild);
    const h2 = head.querySelector('h2');
    if (h2) h2.textContent = 'Counting Crews';
  }

  function armMinigame() {
    const action = document.getElementById('btn-lobby-minigame-action');
    if (action && action.textContent && /close/i.test(action.textContent) === false) {
      action.disabled = false;
      action.removeAttribute('disabled');
    }
    const close = document.getElementById('btn-lobby-minigame-close');
    if (close) {
      close.disabled = false;
      close.removeAttribute('disabled');
    }
  }

  function patch() {
    dressClubs();
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqClubsSpinUiPatched) return true;
    proto.__cqClubsSpinUiPatched = true;
    if (typeof proto.renderClubs === 'function') {
      const orig = proto.renderClubs;
      proto.renderClubs = function () {
        const out = orig.apply(this, arguments);
        dressClubs();
        return out;
      };
    }
    if (typeof proto.openClubs === 'function') {
      const origOpen = proto.openClubs;
      proto.openClubs = function () {
        const out = origOpen.apply(this, arguments);
        dressClubs();
        return out;
      };
    }
    if (typeof proto.openLobbyMinigame === 'function') {
      const origMg = proto.openLobbyMinigame;
      proto.openLobbyMinigame = function () {
        const out = origMg.apply(this, arguments);
        armMinigame();
        return out;
      };
    }
    return true;
  }

  function boot() {
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
