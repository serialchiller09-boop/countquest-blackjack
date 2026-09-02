// §11 FIRST-RUN ONBOARDING — one-time lobby overlay (Play Store v1)
// localStorage key: cq.firstRunV1  |  never blocks returning users
(function () {
  const STORAGE_KEY = 'cq.firstRunV1';

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

  function startTutorial() {
    dismiss();
    if (typeof window.app?.openTutorial === 'function') window.app.openTutorial();
  }

  function sitTable() {
    dismiss();
    if (typeof window.app?.openTableLobby === 'function') window.app.openTableLobby();
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
    applyDevPanelGate();
    if (window.__CQ_TEST_MODE) return;
    if (alreadySeen()) return;
    if (isReturningPlayer()) {
      markSeen();
      return;
    }
    if (window.app?.phase && window.app.phase !== 'menu') return;
    ensureMarkup();
    const dlg = document.getElementById('cq-first-run');
    document.body.classList.add('cq-first-run-open');
    if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  }

  function boot() {
    applyDevPanelGate();
    const run = () => setTimeout(maybeShow, 60);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  boot();
})();
