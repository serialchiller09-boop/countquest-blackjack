// §16 CASINO THEME — pips, round actions, table lettering (v58)
(function () {
  if (window.__CQ_CASINO_V58_BOOTED) return;
  window.__CQ_CASINO_V58_BOOTED = true;

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
    hit: '<svg viewBox="0 0 24 24"><rect x="6.4" y="4.2" width="11.2" height="15.6" rx="1.5" fill="#fff"/><path d="M12 8.6v6.8M8.6 12h6.8" stroke="#16a34a" stroke-width="2.15" stroke-linecap="round"/></svg>',
    surrender: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><path d="M6 20V5"/><path d="M6 5l10 3.2-10 3.2" fill="#fff" stroke="#fff"/></svg>'
  };

  function injectSheet() {
    let l = document.querySelector('link[href*="cq-modern.css"]');
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      document.head.appendChild(l);
    }
    l.href = 'css/cq-modern.css?v=59';
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
    document.documentElement.classList.add('cq-v58');
    document.body && document.body.classList.add('cq-v58');
    injectSheet();
    tick();
    watch();
    window.addEventListener('load', function () {
      injectSheet();
      tick();
    });
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
