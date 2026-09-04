// §16 CASINO THEME — pips, round actions, table lettering (v63)
(function () {
  if (window.__CQ_CASINO_V63_BOOTED) return;
  window.__CQ_CASINO_V63_BOOTED = true;

  const ORDER = ['stand', 'split', 'double', 'hit', 'surrender'];
  const PIPS = {
    A: [[50, 50]],
    '2': [[50, 18], [50, 82]],
    '3': [[50, 18], [50, 50], [50, 82]],
    '4': [[28, 22], [72, 22], [28, 78], [72, 78]],
    '5': [[28, 22], [72, 22], [50, 50], [28, 78], [72, 78]],
    '6': [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
    '7': [[28, 20], [72, 20], [50, 36], [28, 50], [72, 50], [28, 80], [72, 80]],
    '8': [[28, 18], [72, 18], [28, 38], [72, 38], [28, 62], [72, 62], [28, 82], [72, 82]],
    '9': [[28, 16], [72, 16], [28, 34], [72, 34], [50, 50], [28, 66], [72, 66], [28, 84], [72, 84]],
    '10': [[28, 14], [72, 14], [50, 30], [28, 32], [72, 32], [28, 68], [72, 68], [50, 70], [28, 86], [72, 86]]
  };
  const ICO = {
    stand: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.2V6.4a1.45 1.45 0 0 1 2.9 0V11"/><path d="M11.9 11V5.7a1.45 1.45 0 0 1 2.9 0V11"/><path d="M14.8 11V6.8a1.45 1.45 0 0 1 2.9 0V12.4"/><path d="M9 11.2c-2 .3-3.3 1.8-3.3 3.7 0 3 2.4 6 7.4 6s7.4-3 7.4-6c0-1.3-.7-2.4-1.8-3"/><path d="M8.2 11.1c-.8-1.5.1-3.3 1.8-3.3"/></svg>',
    split: '<svg viewBox="0 0 24 24"><rect x="3.4" y="5.4" width="8.4" height="12.2" rx="1.3" fill="#fff" transform="rotate(-14 7.6 11.5)"/><rect x="12.2" y="5.4" width="8.4" height="12.2" rx="1.3" fill="#fff" transform="rotate(14 16.4 11.5)"/><circle cx="7.4" cy="10.2" r=".7" fill="#c026d3"/><circle cx="16.6" cy="10.2" r=".7" fill="#c026d3"/></svg>',
    double: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15.1" r="5.6" fill="#fff"/><circle cx="12" cy="15.1" r="2.05" fill="#0891b2"/><circle cx="12" cy="9.1" r="5.6" fill="#fff"/><circle cx="12" cy="9.1" r="2.05" fill="#0891b2"/></svg>',
    hit: '<svg viewBox="0 0 24 24"><rect x="5.5" y="3.4" width="13" height="17.2" rx="1.7" fill="#fff" stroke="#d1d5db" stroke-width="1"/><path d="M8.1 7h2.2M8.1 8.5h2.2" stroke="#16a34a" stroke-width="1.2" stroke-linecap="round"/><path d="M12 9.5v6.4M8.8 12.7h6.4" stroke="#16a34a" stroke-width="2.25" stroke-linecap="round"/></svg>',
    surrender: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><path d="M6 20V5"/><path d="M6 5l10 3.2-10 3.2" fill="#fff" stroke="#fff"/></svg>'
  };
  const PLAY_ACTIONS = { hit: 1, stand: 1, double: 1, split: 1, surrender: 1 };

  function injectChromeCSS() {
    let l = document.querySelector('link[href*="cq-v63-play.css"], link[href*="cq-v62-play.css"], link[href*="cq-v61-play.css"], link[href*="cq-v60-play.css"]');
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      l.id = 'cq-v63-chrome-link';
      document.head.appendChild(l);
    }
    l.href = 'css/cq-v63-play.css?v=63';
    if (document.getElementById('cq-v63-chrome')) return;
    const s = document.createElement('style');
    s.id = 'cq-v63-chrome';
    s.textContent = "/* v63 play chrome */\nbody.casino-play-active #btn-help-settings,\nbody.casino-play-active #btn-chart,\nbody.casino-play-active #btn-sound,\nbody.casino-play-active #btn-toggle-stats,\nbody.casino-play-active #btn-quit,\nbody.casino-play-active #header-mode,\nbody.casino-play-active .app-title-sub,\nbody.casino-play-active #cq-build-stamp { display: none !important; }\nbody.casino-play-active #app-header .brand-lockup { opacity: .78; }\nbody.casino-play-active #header-currency { opacity: .88; transform: scale(.92); transform-origin: top right; }\nbody.casino-play-active .cq-table-options-btn { box-shadow: 0 4px 14px rgba(0,0,0,.35), 0 0 0 2px rgba(243,211,106,.45) !important; }\n#toast-stack .toast-item.cq-strategy-tip { max-width: min(22rem, calc(100vw - 1.5rem)); border-color: rgba(243,211,106,.55) !important; background: rgba(15,23,42,.94) !important; pointer-events: none; }\n#toast-stack .toast-item.cq-result-tip { max-width: min(18rem, calc(100vw - 1.5rem)); pointer-events: none; font-weight: 700; }";
    document.head.appendChild(s);
  }

  function injectSheet() {
    let l = document.querySelector('link[href*="cq-modern.css"]');
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      document.head.appendChild(l);
    }
    l.href = 'css/cq-modern.css?v=63';
  }

  function ensureLettering() {
    const root = document.querySelector('.casino-felt, .casino-table-surface, .cq-authentic-felt');
    if (!root || root.querySelector('.cq-table-lettering')) return;
    const el = document.createElement('div');
    el.className = 'cq-table-lettering';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cq-tl-title">Blackjack</div>' + '<div class="cq-tl-pays">Pays 3 to 2</div>' + '<div class="cq-tl-ins">Insurance pays 2 to 1</div>';
    root.appendChild(el);
  }

  function dressCard(card) {
    if (!card || card.classList.contains('back') || card.classList.contains('hole-hidden')) {
      if (card) {
        card.classList.remove('cq-pipped', 'cq-face');
        card.querySelector('.cq-pip-field')?.remove();
        if (card.dataset) delete card.dataset.cqPips;
      }
      return;
    }
    const rankEl = card.querySelector('.corner-tl span');
    const suitEl = card.querySelector('.center-suit');
    const rank = (rankEl && rankEl.textContent || '').trim();
    const suit = (suitEl && suitEl.textContent || '').trim();
    if (!rank || !suit) return;
    const key = rank === '10' ? '10' : rank;
    if (card.dataset.cqPips === key + '|' + suit) return;
    card.dataset.cqPips = key + '|' + suit;
    card.querySelector('.cq-pip-field')?.remove();
    if (PIPS[key]) {
      card.classList.add('cq-pipped');
      card.classList.remove('cq-face');
      const field = document.createElement('div');
      field.className = 'cq-pip-field';
      field.setAttribute('aria-hidden', 'true');
      PIPS[key].forEach(function (xy) {
        const p = document.createElement('i');
        p.className = 'cq-pip' + (xy[1] > 55 ? ' is-flip' : '');
        p.textContent = suit;
        p.style.left = xy[0] + '%';
        p.style.top = xy[1] + '%';
        field.appendChild(p);
      });
      card.appendChild(field);
    } else {
      card.classList.add('cq-face');
      card.classList.remove('cq-pipped');
    }
  }

  function dressAllCards(root) {
    (root || document).querySelectorAll('.playing-card').forEach(dressCard);
  }

  function showSessionTip(msg) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast-item cq-session-tip px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start gap-2 bg-slate-800/95 border-slate-600 text-white backdrop-blur-sm';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="shrink-0 opacity-90" aria-hidden="true">💡</span><span class="flex-1 leading-snug">' + msg + '</span>';
    stack.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  function showStrategyTip(msg) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    stack.querySelectorAll('.cq-strategy-tip').forEach(function (n) { n.remove(); });
    const el = document.createElement('div');
    el.className = 'toast-item cq-strategy-tip px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start gap-2 text-white backdrop-blur-sm';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="shrink-0 opacity-90" aria-hidden="true">📘</span><span class="flex-1 leading-snug"><span class="cq-strategy-tip-label">Strategy</span>' + msg + '</span>';
    stack.appendChild(el);
    setTimeout(function () { el.remove(); }, 3400);
  }

  function maybeFirstDealTip() {
    if (window.__CQ_FIRST_DEAL_TIP_SHOWN) return;
    if (!document.body || !document.body.classList.contains('casino-play-active')) return;
    if (document.body.classList.contains('casino-bet-active')) return;
    const n = document.querySelectorAll('#player-hands .playing-card, .casino-player-rail .playing-card').length;
    if (n < 2) return;
    window.__CQ_FIRST_DEAL_TIP_SHOWN = true;
    showSessionTip('Hit draws a card · Stand holds. Menu ☰ has Stats & Quit.');
  }

  function formatActionLabel(action) {
    if (typeof formatIndexPlayAction === 'function') return formatIndexPlayAction(action);
    return String(action || '').toUpperCase();
  }

  function maybeStrategyFeedback(app, action) {
    try {
      if (!document.body || !document.body.classList.contains('casino-play-active')) return;
      if (document.body.classList.contains('casino-bet-active')) return;
      if (!PLAY_ACTIONS[action]) return;
      if (!app || app.phase !== 'playing') return;
      if (app.dealing) return;
      if (app.save && app.save.sessionDrill === 'decisions') return;
      if (document.getElementById('modal-insurance')?.open) return;
      const st = typeof app.activeState === 'function' ? app.activeState() : null;
      if (!st || st.finished || !st.hand) return;
      if (!app.dealer || !app.dealer.cards || !app.dealer.cards[0]) return;
      if (typeof advise !== 'function') return;
      const up = app.dealer.cards[0].rank;
      const snap = app.shoe && app.counter ? app.counter.getCountSnapshot(app.shoe) : null;
      const stratOpts = typeof app.buildStratOpts === 'function'
        ? app.buildStratOpts(snap)
        : { trueCount: null, countingSystemId: 'hi-lo', useIndexDeviations: false };
      const basicOpts = Object.assign({}, stratOpts, { useIndexDeviations: false });
      const canDouble = typeof app.canDouble === 'function' ? app.canDouble(st) : false;
      const canSplit = typeof app.canSplit === 'function' ? app.canSplit(st) : false;
      if (action === 'double' && !canDouble) return;
      if (action === 'split' && !canSplit) return;
      if (action === 'surrender' && typeof app.canSurrender === 'function' && !app.canSurrender(st)) return;
      const advice = advise(st.hand, up, canDouble, canSplit, basicOpts);
      if (!advice || !advice.action || action === advice.action) return;
      const you = formatActionLabel(action);
      const best = formatActionLabel(advice.action);
      const why = advice.rationale ? String(advice.rationale) : ('prefer ' + best);
      showStrategyTip('You ' + you + ' → chart says ' + best + '. ' + why);
    } catch (_) { /* non-blocking */ }
  }

  function patchStrategyFeedback() {
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqStrategyToastV61) return true;
    if (typeof proto.playerAction !== 'function') return false;
    proto.__cqStrategyToastV61 = true;
    const orig = proto.playerAction;
    proto.playerAction = function (action) {
      maybeStrategyFeedback(this, action);
      return orig.apply(this, arguments);
    };
    return true;
  }

  function dressActions() {
    const ab = document.getElementById('action-buttons');
    if (!ab) return;
    const btns = Array.from(ab.querySelectorAll('[data-action]')).filter(function (b) {
      return b.dataset.action !== 'read';
    });
    if (!btns.length) return;
    const ordered = btns.slice().sort(function (a, b) {
      const ia = ORDER.indexOf(a.dataset.action);
      const ib = ORDER.indexOf(b.dataset.action);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const already = ordered.every(function (btn, i) {
      return btn === btns[i] && btn.dataset.cqRound === btn.dataset.action && btn.querySelector('.cq-round-ico');
    });
    if (already) return;
    ordered.forEach(function (btn) {
      const act = btn.dataset.action;
      if (!(btn.dataset.cqRound === act && btn.querySelector('.cq-round-ico'))) {
        const label = (btn.querySelector('.cq-round-lbl') ? btn.querySelector('.cq-round-lbl').textContent : btn.textContent || act).trim();
        btn.dataset.cqRound = act;
        btn.classList.add('cq-round-act', 'cq-act-' + act);
        btn.innerHTML = '<span class="cq-round-ico" aria-hidden="true">' + (ICO[act] || '') + '</span>' + '<span class="cq-round-lbl">' + label + '</span>';
      }
      ab.appendChild(btn);
    });
  }

  function tick() {
    ensureLettering();
    dressAllCards();
    dressActions();
    maybeFirstDealTip();
    patchStrategyFeedback();
  }

  function watch() {
    const mo = new MutationObserver(function () {
      mo.disconnect();
      tick();
      mo.observe(document.body, { childList: true, subtree: true });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    document.documentElement.classList.add('cq-v63');
    document.body && document.body.classList.add('cq-v63');
    injectSheet();
    injectChromeCSS();
    tick();
    watch();
    window.addEventListener('load', function () {
      injectSheet();
      injectChromeCSS();
      tick();
    });
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
