// §11 FIRST-RUN ONBOARDING — fixed overlay (NOT <dialog>; avoids native top-layer fights)
// localStorage key: cq.firstRunV1  |  never blocks returning users
(function () {
  if (window.__CQ_FIRST_RUN_BOOTED) return;
  window.__CQ_FIRST_RUN_BOOTED = true;

  var STORAGE_KEY = 'cq.firstRunV1';

  var INJECTED_CSS = [
    '#external-services-panel{display:none!important}',
    'html.cq-dev #external-services-panel{display:block!important}',
    '#cq-first-run{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;background:rgba(6,14,11,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);pointer-events:auto}',
    '#cq-first-run .cq-first-run-card{width:min(28rem,92vw);border:1px solid rgba(212,175,55,.45);border-radius:1.25rem;padding:1.75rem 1.5rem 1.35rem;text-align:center;background:radial-gradient(ellipse 120% 90% at 50% -10%,#123828 0%,#0a1612 55%,#060e0b 100%);color:#f0fff7;box-shadow:0 24px 64px rgba(0,0,0,.55);pointer-events:auto}',
    '.cq-first-run-kicker{margin:0 0 .45rem;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#d4af37;font-weight:700}',
    '#cq-first-run-title{margin:0 0 .65rem;font-size:1.55rem;line-height:1.2;color:#d4af37;font-weight:800}',
    '#cq-first-run-copy{margin:0 0 .55rem;font-size:.95rem;line-height:1.45;color:rgba(209,250,229,.9)}',
    '#cq-first-run-steps{margin:0 0 1.35rem;font-size:.82rem;line-height:1.4;color:rgba(167,243,208,.75)}',
    '.cq-first-run-actions{display:flex;flex-direction:column;gap:.55rem}',
    '.cq-first-run-primary,.cq-first-run-secondary,.cq-first-run-skip{pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.cq-first-run-primary{width:100%;min-height:3rem;border-radius:.85rem;border:0;font-weight:800;font-size:1rem;color:#1a1208;background:linear-gradient(90deg,#d4af37,#f5d76e);cursor:pointer}',
    '.cq-first-run-secondary{width:100%;min-height:2.75rem;border-radius:.85rem;border:1px solid rgba(212,175,55,.35);font-weight:700;font-size:.95rem;color:#e8d5a3;background:rgba(255,255,255,.06);cursor:pointer}',
    '.cq-first-run-skip{width:100%;min-height:2.4rem;border:0;background:transparent;color:rgba(167,243,208,.7);font-size:.82rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.cq-first-run-legal{margin:.85rem 0 0;font-size:.78rem}',
    '.cq-first-run-legal a{color:#7dd3c0}',
    '.cq-lobby-legal{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;padding:.65rem 1rem 1.15rem;font-size:.78rem}',
    '.cq-lobby-legal a{color:#7dd3c0;text-decoration:underline;text-underline-offset:3px}',
  ].join('');

  function injectCss() {
    if (document.getElementById('cq-first-run-css')) return;
    var s = document.createElement('style');
    s.id = 'cq-first-run-css';
    s.textContent = INJECTED_CSS;
    document.head.appendChild(s);
  }

  function isDevMode() {
    return !!(window.__CQ_DEV_MODE || /(?:^|[?&])dev=1(?:&|$)/.test(location.search));
  }

  function applyDevPanelGate() {
    if (isDevMode()) document.documentElement.classList.add('cq-dev');
    var panel = document.getElementById('external-services-panel');
    if (!panel) return;
    if (isDevMode()) {
      panel.removeAttribute('hidden');
      panel.style.removeProperty('display');
      return;
    }
    panel.setAttribute('hidden', '');
    panel.open = false;
  }

  function ensureLobbyLegal() {
    if (document.getElementById('cq-lobby-legal')) return;
    var nav = document.createElement('nav');
    nav.id = 'cq-lobby-legal';
    nav.className = 'cq-lobby-legal';
    nav.setAttribute('aria-label', 'Legal');
    nav.innerHTML =
      '<a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>'
      + '<a href="mailto:j.pierson1990@outlook.com">Support</a>';
    var save = document.getElementById('menu-save-info');
    if (save && save.parentNode) save.parentNode.insertBefore(nav, save.nextSibling);
    else {
      var menu = document.getElementById('screen-menu');
      (menu || document.body).appendChild(nav);
    }
  }

  function alreadySeen() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  }

  function isReturningPlayer() {
    var save = window.app && window.app.save;
    if (!save) return false;
    var st = save.stats || {};
    return (st.handsPlayed || 0) > 0 || !!(save.tutorial && save.tutorial.completed) || !!save.sessionActive;
  }

  function forceCloseDaily() {
    var daily = document.getElementById('modal-daily-reward');
    if (daily && daily.open) {
      try { daily.close(); } catch (_) { daily.removeAttribute('open'); }
    }
    if (window.app) window.app._dailyRewardModalShown = false;
  }

  function closeFirstRunOnly() {
    markSeen();
    var el = document.getElementById('cq-first-run');
    if (el) el.remove();
    document.body.classList.remove('cq-first-run-open');
  }

  function maybeShowDailyOnMenu() {
    try {
      if (!window.app) return;
      var phase = window.app.phase || 'menu';
      if (phase !== 'menu') return;
      window.app._dailyRewardModalShown = false;
      if (typeof window.app.maybeShowDailyRewardModal === 'function') {
        window.app.maybeShowDailyRewardModal();
      }
    } catch (_) {}
  }

  function callApp(name) {
    var run = function () {
      var fn = window.app && window.app[name];
      if (typeof fn === 'function') { fn.call(window.app); return true; }
      return false;
    };
    if (run()) return;
    var n = 0;
    var t = setInterval(function () { if (run() || ++n > 25) clearInterval(t); }, 40);
  }

  function startTutorial(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    closeFirstRunOnly();
    callApp('openTutorial');
    return false;
  }

  function sitTable(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    closeFirstRunOnly();
    callApp('openTableLobby');
    return false;
  }

  function skipToMenu(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    closeFirstRunOnly();
    maybeShowDailyOnMenu();
    return false;
  }

  function bindBtn(el, fn) {
    if (!el) return;
    el.addEventListener('click', fn);
    el.addEventListener('touchend', function (e) {
      e.preventDefault();
      fn(e);
    }, { passive: false });
  }

  function ensureMarkup() {
    if (document.getElementById('cq-first-run')) return;
    var root = document.createElement('div');
    root.id = 'cq-first-run';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'cq-first-run-title');
    root.setAttribute('aria-describedby', 'cq-first-run-copy');
    root.innerHTML =
      '<div class="cq-first-run-card">'
      + '<p class="cq-first-run-kicker">Welcome to the floor</p>'
      + '<h2 id="cq-first-run-title">Pit Boss Training Path</h2>'
      + '<p id="cq-first-run-copy">Learn the count and climb from Railbird to Pit Boss — by playing, not by reading a book.</p>'
      + '<p id="cq-first-run-steps">Start with the tutorial, then sit one beginner table. Tournaments, crews, and VIP wait until you have played a hand.</p>'
      + '<div class="cq-first-run-actions">'
      + '<button type="button" id="cq-first-run-tutorial" class="cq-first-run-primary">Start tutorial</button>'
      + '<button type="button" id="cq-first-run-table" class="cq-first-run-secondary">Sit a table</button>'
      + '<button type="button" id="cq-first-run-skip" class="cq-first-run-skip">Skip</button>'
      + '</div>'
      + '<p class="cq-first-run-legal"><a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>'
      + '</div>';
    document.body.appendChild(root);
    bindBtn(document.getElementById('cq-first-run-tutorial'), startTutorial);
    bindBtn(document.getElementById('cq-first-run-table'), sitTable);
    bindBtn(document.getElementById('cq-first-run-skip'), skipToMenu);
  }

  function maybeShow() {
    injectCss();
    applyDevPanelGate();
    ensureLobbyLegal();
    if (window.__CQ_TEST_MODE) return;
    if (alreadySeen()) return;
    if (isReturningPlayer()) {
      markSeen();
      return;
    }
    if (!window.app) {
      maybeShow._tries = (maybeShow._tries || 0) + 1;
      if (maybeShow._tries < 40) setTimeout(maybeShow, 80);
      return;
    }
    if (window.app.phase && window.app.phase !== 'menu') return;
    ensureMarkup();
    document.body.classList.add('cq-first-run-open');
    forceCloseDaily();
    setTimeout(forceCloseDaily, 450);
    setTimeout(forceCloseDaily, 900);
  }

  window.__cqFirstRun = {
    startTutorial: startTutorial,
    sitTable: sitTable,
    skipToMenu: skipToMenu,
  };

  function boot() {
    injectCss();
    applyDevPanelGate();
    var run = function () { ensureLobbyLegal(); setTimeout(maybeShow, 60); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  boot();
})();
