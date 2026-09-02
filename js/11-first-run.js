// §11 FIRST-RUN ONBOARDING — one-time lobby overlay (Play Store v1)
// localStorage key: cq.firstRunV1  |  never blocks returning users
(function () {
  if (window.__CQ_FIRST_RUN_BOOTED) return;
  window.__CQ_FIRST_RUN_BOOTED = true;

  const STORAGE_KEY = 'cq.firstRunV1';

  const INJECTED_CSS = [
    '#external-services-panel{display:none!important}',
    'html.cq-dev #external-services-panel{display:block!important}',
    'dialog.cq-first-run{border:1px solid rgba(212,175,55,.45);border-radius:1.25rem;padding:0;max-width:min(28rem,92vw);width:92vw;background:radial-gradient(ellipse 120% 90% at 50% -10%,#123828 0%,#0a1612 55%,#060e0b 100%);color:#f0fff7;box-shadow:0 24px 64px rgba(0,0,0,.55)}',
    'dialog.cq-first-run::backdrop{background:rgba(6,14,11,.78);backdrop-filter:blur(6px)}',
    '.cq-first-run-card{padding:1.75rem 1.5rem 1.35rem;text-align:center}',
    '.cq-first-run-kicker{margin:0 0 .45rem;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:#d4af37;font-weight:700}',
    '.cq-first-run-card h2{margin:0 0 .65rem;font-size:1.55rem;line-height:1.2;color:#d4af37;font-weight:800}',
    '.cq-first-run-card p#cq-first-run-copy{margin:0 0 1.35rem;font-size:.95rem;line-height:1.45;color:rgba(209,250,229,.9)}',
    '.cq-first-run-actions{display:flex;flex-direction:column;gap:.55rem}',
    '.cq-first-run-primary{width:100%;min-height:3rem;border-radius:.85rem;border:0;font-weight:800;font-size:1rem;color:#1a1208;background:linear-gradient(90deg,#d4af37,#f5d76e);cursor:pointer}',
    '.cq-first-run-secondary{width:100%;min-height:2.75rem;border-radius:.85rem;border:1px solid rgba(212,175,55,.35);font-weight:700;font-size:.95rem;color:#e8d5a3;background:rgba(255,255,255,.06);cursor:pointer}',
    '.cq-first-run-skip{width:100%;min-height:2.4rem;border:0;background:transparent;color:rgba(167,243,208,.7);font-size:.82rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.cq-first-run-primary:focus-visible,.cq-first-run-secondary:focus-visible,.cq-first-run-skip:focus-visible{outline:2px solid rgba(212,175,55,.85);outline-offset:2px}',
  ].join('');

  function injectCss() {
    if (document.getElementById('cq-first-run-css')) return;
    const s = document.createElement('style');
    s.id = 'cq-first-run-css';
    s.textContent = INJECTED_CSS;
    document.head.appendChild(s);
  }

  function isDevMode() {
    return !!(window.__CQ_DEV_MODE || /(?:^|[?&])dev=1(?:&|$)/.test(location.search));
  }

  function applyDevPanelGate() {
    if (isDevMode()) document.documentElement.classList.add('cq-dev');
    const panel = document.getElementById('external-services-panel');
    if (!panel) return;
    if (isDevMode()) {
      panel.removeAttribute('hidden');
      panel.style.removeProperty('display');
      return;
    }
    panel.setAttribute('hidden', '');
    panel.open = false;
  }

  function alreadySeen() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  }

  function isReturningPlayer() {
    const save = window.app?.save;
    if (!save) return false;
    const st = save.stats || {};
    return (st.handsPlayed || 0) > 0 || !!save.tutorial?.completed || !!save.sessionActive;
  }

  function dismiss() {
    markSeen();
    const el = document.getElementById('cq-first-run');
    if (el) {
      try { if (typeof el.close === 'function' && el.open) el.close(); } catch (_) {}
      el.remove();
    }
    document.body.classList.remove('cq-first-run-open');
  }

  function callApp(name) {
    const run = () => {
      const fn = window.app && window.app[name];
      if (typeof fn === 'function') { fn.call(window.app); return true; }
      return false;
    };
    if (run()) return;
    let n = 0;
    const t = setInterval(() => { if (run() || ++n > 25) clearInterval(t); }, 40);
  }

  function startTutorial() {
    dismiss();
    callApp('openTutorial');
  }

  function sitTable() {
    dismiss();
    callApp('openTableLobby');
  }

  function ensureMarkup() {
    if (document.getElementById('cq-first-run')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'cq-first-run';
    dlg.className = 'cq-first-run';
    dlg.setAttribute('aria-labelledby', 'cq-first-run-title');
    dlg.setAttribute('aria-describedby', 'cq-first-run-copy');
    dlg.innerHTML =
      '<div class="cq-first-run-card">'
      + '<p class="cq-first-run-kicker">CountQuest Blackjack</p>'
      + '<h2 id="cq-first-run-title">Quest Through the Casinos</h2>'
      + '<p id="cq-first-run-copy">Learn Hi-Lo by playing, not by reading a book.</p>'
      + '<div class="cq-first-run-actions">'
      + '<button type="button" id="cq-first-run-tutorial" class="cq-first-run-primary">Start tutorial</button>'
      + '<button type="button" id="cq-first-run-table" class="cq-first-run-secondary">Sit a table</button>'
      + '<button type="button" id="cq-first-run-skip" class="cq-first-run-skip">Skip</button>'
      + '</div></div>';
    document.body.appendChild(dlg);
    document.getElementById('cq-first-run-tutorial')?.addEventListener('click', startTutorial);
    document.getElementById('cq-first-run-table')?.addEventListener('click', sitTable);
    document.getElementById('cq-first-run-skip')?.addEventListener('click', dismiss);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); dismiss(); });
  }

  function maybeShow() {
    injectCss();
    applyDevPanelGate();
    if (window.__CQ_TEST_MODE) return;
    if (alreadySeen()) return;
    if (isReturningPlayer()) {
      markSeen();
      return;
    }
    if (!window.app) {
      maybeShow._tries = (maybeShow._tries || 0) + 1;
      if (maybeShow._tries < 25) setTimeout(maybeShow, 80);
      return;
    }
    if (window.app.phase && window.app.phase !== 'menu') return;
    ensureMarkup();
    const dlg = document.getElementById('cq-first-run');
    document.body.classList.add('cq-first-run-open');
    if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  }

  function boot() {
    injectCss();
    applyDevPanelGate();
    const run = () => setTimeout(maybeShow, 60);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  boot();
})();
