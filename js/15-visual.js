// §15 VISUAL — labeled prize wheel + modern modal dress (v65)
(function () {
  if (window.__CQ_VISUAL_V55_BOOTED) return;
  window.__CQ_VISUAL_V55_BOOTED = true;

  function injectSheet() {
    let l = document.querySelector('link[href*="cq-modern.css"]');
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      document.head.appendChild(l);
    }
    l.href = 'css/cq-modern.css?v=65';
  }

  function segs() {
    if (typeof LOBBY_SPIN_SEGMENTS !== 'undefined' && Array.isArray(LOBBY_SPIN_SEGMENTS) && LOBBY_SPIN_SEGMENTS.length) {
      return LOBBY_SPIN_SEGMENTS;
    }
    return [
      { label: '50 chips' }, { label: '100 chips' }, { label: '25 chips' },
      { label: '1 gem' }, { label: '200 chips' }, { label: 'Try again' }
    ];
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function labeledSpinMarkup(locked) {
    const list = segs();
    const n = list.length;
    const slice = 360 / n;
    const colors = ['#e11d48', '#f97316', '#eab308', '#16a34a', '#2563eb', '#7c3aed'];
    const stops = list.map(function (_, i) {
      const c = colors[i % colors.length];
      return c + ' ' + (i * slice) + 'deg ' + ((i + 1) * slice) + 'deg';
    }).join(', ');
    const labels = list.map(function (seg, i) {
      const rot = i * slice + slice / 2;
      return '<span class="cq-spin-label" style="transform:rotate(' + rot + 'deg) translateY(-5.15rem)">' + '<span class="cq-spin-label-text">' + esc(seg.label) + '</span></span>';
    }).join('');
    return '<div class="lobby-spin-wheel-wrap cq-spin-wrap' + (locked ? ' cq-spin-locked' : '') + '">' + '<div class="lobby-spin-pointer cq-spin-pointer" aria-hidden="true"></div>' + '<div id="lobby-spin-wheel" class="lobby-spin-wheel cq-spin-wheel" style="background:conic-gradient(' + stops + ')">' + labels + '<div class="cq-spin-hub" aria-hidden="true"><span>SPIN</span></div>' + '</div></div>' + '<p id="lobby-spin-result" class="cq-spin-result">' + (locked ? 'Come back tomorrow' : '') + '</p>';
  }

  function dressMinigameModal() {
    const action = document.getElementById('btn-lobby-minigame-action');
    if (action && action.textContent && !/close/i.test(action.textContent)) {
      action.disabled = false;
      action.removeAttribute('disabled');
    }
  }

  function patch() {
    injectSheet();
    try { window.renderSpinWheelMarkup = function () { return labeledSpinMarkup(false); }; } catch (_) {}
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqVisualV55Patched) return true;
    proto.__cqVisualV55Patched = true;
    if (typeof proto.renderMinigameBody === 'function') {
      const orig = proto.renderMinigameBody;
      proto.renderMinigameBody = function (id, ready) {
        if (id === 'spin-win') return labeledSpinMarkup(!ready);
        return orig.apply(this, arguments);
      };
    }
    if (typeof proto.openLobbyMinigame === 'function') {
      const origOpen = proto.openLobbyMinigame;
      proto.openLobbyMinigame = function () {
        const out = origOpen.apply(this, arguments);
        dressMinigameModal();
        return out;
      };
    }
    return true;
  }

  function boot() {
    injectSheet();
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
