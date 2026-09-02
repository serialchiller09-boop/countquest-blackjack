// §13 NEW-PLAYER LOBBY — hide extras until one hand; clubs + minigames stay visible (v54)
(function () {
  if (window.__CQ_NEW_PLAYER_LOBBY_BOOTED) return;
  window.__CQ_NEW_PLAYER_LOBBY_BOOTED = true;
  if (window.__CQ_TEST_MODE || navigator.webdriver) return;

  const CSS = [
    'html.cq-new-player #lobby-pass-banner{display:none!important}',
    'html.cq-new-player [data-lobby-play="tournament"]{display:none!important}',
    'html.cq-new-player [data-lobby-play="special-event"]{display:none!important}',
    'html.cq-new-player [data-lobby-play="dealer-mode"]{display:none!important}',
    'html.cq-new-player [data-lobby-nav="shop"]{display:none!important}',
    'html.cq-new-player [data-lobby-nav="leaderboards"]{display:none!important}',
    'html.cq-new-player [data-k="3"]{display:none!important}',
    'html.cq-new-player [data-k="7"]{display:none!important}',
    'html.cq-new-player [data-table-tier="high-roller"]{display:none!important}',
    'html.cq-new-player [data-table-tier="pro"]{display:none!important}',
    '.cq-recommended{margin-left:.4rem;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:#f5d76e;font-weight:700}',
  ].join('');

  function injectCss() {
    if (document.getElementById('cq-new-player-lobby-css')) return;
    const s = document.createElement('style');
    s.id = 'cq-new-player-lobby-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function isNewPlayer(app) {
    try {
      const hands = app && app.save && app.save.stats ? (app.save.stats.handsPlayed || 0) : 0;
      return hands < 1;
    } catch (_) {
      return true;
    }
  }

  function canSitBeginner(app) {
    try {
      if (!app || typeof app.joinTable !== 'function') return false;
      if (typeof getTableTier === 'function' && typeof canJoinTable === 'function') {
        const tier = getTableTier('beginner');
        if (!tier) return false;
        const check = canJoinTable(app.save, tier);
        return !!(check && check.ok);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function relabelHero(app) {
    if (!isNewPlayer(app)) return;
    const sub = document.querySelector('#lobby-hero-play .hero-sub');
    if (sub) sub.textContent = 'Beginner table — learn Hi-Lo at the felt';
    const title = document.querySelector('#lobby-hero-play .hero-title');
    if (title && (title.textContent === 'Play' || title.textContent === '1v1 Tables')) title.textContent = 'Sit a table';
    const hint = document.getElementById('menu-beginner-hint');
    if (hint) {
      hint.classList.remove('hidden');
      hint.innerHTML = '<span class="text-gold font-semibold">Welcome!</span> Start the tutorial, or sit the beginner table.';
    }
  }

  function recommendBeginner(app) {
    if (!isNewPlayer(app)) return;
    const btn = document.querySelector('[data-table-tier="beginner"]');
    if (!btn || btn.querySelector('.cq-recommended')) return;
    const name = btn.querySelector('.font-bold');
    if (!name) return;
    const tag = document.createElement('span');
    tag.className = 'cq-recommended';
    tag.textContent = 'Recommended';
    name.appendChild(tag);
  }

  function apply(app) {
    injectCss();
    const newbie = isNewPlayer(app);
    document.documentElement.classList.toggle('cq-new-player', newbie);
    if (newbie) {
      relabelHero(app);
      recommendBeginner(app);
    }
  }

  function patch() {
    injectCss();
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqNewPlayerLobbyPatched) {
      apply(window.app);
      return true;
    }
    proto.__cqNewPlayerLobbyPatched = true;
    if (typeof proto.renderLobby === 'function') {
      const orig = proto.renderLobby;
      proto.renderLobby = function () {
        const out = orig.apply(this, arguments);
        apply(this);
        return out;
      };
    }
    if (typeof proto.renderTableLobby === 'function') {
      const origTable = proto.renderTableLobby;
      proto.renderTableLobby = function () {
        const out = origTable.apply(this, arguments);
        apply(this);
        return out;
      };
    }
    if (typeof proto.openTableLobby === 'function') {
      const origOpen = proto.openTableLobby;
      proto.openTableLobby = function () {
        if (isNewPlayer(this) && canSitBeginner(this)) {
          this.joinTable('beginner');
          return;
        }
        return origOpen.apply(this, arguments);
      };
    }
    apply(window.app);
    return true;
  }

  function boot() {
    injectCss();
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
