// §13 NEW-PLAYER LOBBY — hide VIP / crews / tournaments until one hand is played (Play Store v1)
(function () {
  if (window.__CQ_NEW_PLAYER_LOBBY_BOOTED) return;
  window.__CQ_NEW_PLAYER_LOBBY_BOOTED = true;
  if (window.__CQ_TEST_MODE || navigator.webdriver) return;

  const CSS = [
    'html.cq-new-player #lobby-minigames-row{display:none!important}',
    'html.cq-new-player #lobby-clubs-btn{display:none!important}',
    'html.cq-new-player #lobby-pass-banner{display:none!important}',
    'html.cq-new-player [data-lobby-play="tournament"]{display:none!important}',
    'html.cq-new-player [data-lobby-play="special-event"]{display:none!important}',
    'html.cq-new-player [data-lobby-play="clubs"]{display:none!important}',
    'html.cq-new-player [data-k="3"]{display:none!important}',
    'html.cq-new-player [data-k="7"]{display:none!important}',
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

  function relabelHero(app) {
    if (!isNewPlayer(app)) return;
    const sub = document.querySelector('#lobby-hero-play .hero-sub');
    if (sub) sub.textContent = 'Beginner table — learn Hi-Lo at the felt';
    const title = document.querySelector('#lobby-hero-play .hero-title');
    if (title && title.textContent === 'Play') title.textContent = 'Sit a table';
  }

  function apply(app) {
    injectCss();
    const newbie = isNewPlayer(app);
    document.documentElement.classList.toggle('cq-new-player', newbie);
    if (newbie) relabelHero(app);
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
