// §16 CASINO THEME — pips, round actions, table lettering (v57)
(function () {
  if (window.__CQ_CASINO_V57_BOOTED) return;
  window.__CQ_CASINO_V57_BOOTED = true;

  const ORDER = ['stand', 'split', 'double', 'hit', 'surrender', 'read'];
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
    stand: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V7.5a1.5 1.5 0 1 1 3 0V11"/><path d="M11 11V6.5a1.5 1.5 0 1 1 3 0V11"/><path d="M14 11V7.8a1.5 1.5 0 1 1 3 0V13"/><path d="M8 11c-1.8.2-3 1.6-3 3.4 0 2.8 2.2 5.6 7 5.6s7-2.8 7-5.6c0-1.2-.6-2.2-1.6-2.8"/><path d="M7.2 11.2c-.7-1.4.2-3.2 1.8-3.2"/></svg>',
    split: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="3.2" y="5.2" width="8.2" height="11.4" rx="1.2" transform="rotate(-12 7.3 11)"/><rect x="12.4" y="5.2" width="8.2" height="11.4" rx="1.2" transform="rotate(12 16.5 11)"/><path d="M11.2 11h1.6M12 10.2v1.6" stroke="#c026d3" stroke-width="1.6" stroke-linecap="round"/></svg>',
    double: '<svg viewBox="0 0 24 24" fill="none"><circle cx="9.2" cy="13.2" r="5.1" fill="#fff" opacity=".95"/><circle cx="14.8" cy="10.4" r="5.1" fill="#fff"/><circle cx="9.2" cy="13.2" r="2.1" fill="#22d3ee"/><circle cx="14.8" cy="10.4" r="2.1" fill="#22d3ee"/></svg>',
    hit: '<svg viewBox="0 0 24 24" fill="none"><rect x="6.2" y="4.4" width="11.6" height="15.2" rx="1.6" fill="#fff"/><path d="M12 8.4v7.2M8.4 12h7.2" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round"/></svg>',
    surrender: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><path d="M6 20V5"/><path d="M6 5l10 3.2-10 3.2" fill="#fff" stroke="#fff"/></svg>',
    read: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1"><path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.4" fill="#fff"/></svg>'
  };

  function injectSheet() {
    if (!document.querySelector('link[href*="cq-modern.css"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/cq-modern.css?v=57';
      document.head.appendChild(l);
    }
    if (document.getElementById('cq-casino-v57-end')) return;
    const s = document.createElement('style');
    s.id = 'cq-casino-v57-end';
    s.textContent = 'dialog.cq-first-run{background:linear-gradient(180deg,#fffdf6,#efe4c8)!important;color:#1a140c!important;border:3px solid #f3d36a!important}'
      + 'dialog.cq-first-run::backdrop{background:rgba(6,40,20,.72)!important}'
      + '.cq-first-run-card h2{color:#8a4b12!important}'
      + '.cq-first-run-kicker{color:#b45309!important}'
      + '.cq-first-run-card p{color:#5c4a32!important}';
    document.head.appendChild(s);
  }

  function ensureLettering() {
    const root = document.querySelector('.casino-felt, .casino-table-surface, .cq-authentic-felt');
    if (!root || root.querySelector('.cq-table-lettering')) return;
    const el = document.createElement('div');
    el.className = 'cq-table-lettering';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cq-tl-title">Blackjack</div>'
      + '<div class="cq-tl-pays">Pays 3 to 2</div>'
      + '<div class="cq-tl-ins">Insurance pays 2 to 1</div>';
    root.appendChild(el);
  }

  function dressCard(card) {
    if (!card || card.classList.contains('back') || card.classList.contains('hole-hidden')) {
      if (card) {
        card.classList.remove('cq-pipped', 'cq-face');
        card.querySelector('.cq-pip-field')?.remove();
        card.querySelector('.cq-face-mark')?.remove();
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
    card.querySelector('.cq-face-mark')?.remove();
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
      if (suitEl) suitEl.style.opacity = '1';
    }
  }

  function dressAllCards(root) {
    (root || document).querySelectorAll('.playing-card').forEach(dressCard);
  }

  function dressActions() {
    const ab = document.getElementById('action-buttons');
    if (!ab) return;
    const btns = Array.from(ab.querySelectorAll('[data-action]'));
    if (!btns.length) return;
    btns.sort(function (a, b) {
      const ia = ORDER.indexOf(a.dataset.action);
      const ib = ORDER.indexOf(b.dataset.action);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    btns.forEach(function (btn) {
      ab.appendChild(btn);
      const act = btn.dataset.action;
      if (btn.dataset.cqRound === act && btn.querySelector('.cq-round-ico')) return;
      const label = (btn.textContent || act).trim();
      btn.dataset.cqRound = act;
      btn.classList.add('cq-round-act', 'cq-act-' + act);
      btn.innerHTML = '<span class="cq-round-ico" aria-hidden="true">' + (ICO[act] || '') + '</span>'
        + '<span class="cq-round-lbl">' + label + '</span>';
    });
  }

  function watch() {
    const mo = new MutationObserver(function (muts) {
      let cards = false;
      let acts = false;
      muts.forEach(function (m) {
        if (m.target && m.target.id === 'action-buttons') acts = true;
        if (m.target && (m.target.classList && (m.target.classList.contains('playing-card') || m.target.id === 'dealer-cards' || m.target.id === 'player-hands'))) {
          cards = true;
        }
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (!n || n.nodeType !== 1) return;
          if (n.id === 'action-buttons' || (n.querySelector && n.querySelector('#action-buttons'))) acts = true;
          if (n.classList && n.classList.contains('playing-card')) cards = true;
          if (n.querySelector && n.querySelector('.playing-card')) cards = true;
        });
      });
      if (acts) dressActions();
      if (cards) dressAllCards();
      ensureLettering();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    document.documentElement.classList.add('cq-v57');
    document.body && document.body.classList.add('cq-v57');
    injectSheet();
    ensureLettering();
    dressAllCards();
    dressActions();
    watch();
    window.addEventListener('load', function () {
      injectSheet();
      ensureLettering();
      dressAllCards();
      dressActions();
    });
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
