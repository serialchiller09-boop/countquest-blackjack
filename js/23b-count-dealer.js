// S23b Jeff - negative count inputs + dealer simpler faces + deck backs
(function () {
  'use strict';

  var DECK_BACKS = [
    { id: 'red', label: 'Classic red' },
    { id: 'blue', label: 'Blue bicycle' },
    { id: 'charcoal', label: 'Charcoal gold' },
    { id: 'green', label: 'Green felt' },
  ];
  var COUNT_INPUT_IDS = [
    'count-quiz-input',
    'count-confirm-input',
    'dealer-count-quiz-input',
    'speed-drill-guess',
    'burst-drill-guess',
    'rc-guess',
  ];

  function injectCss() {
    if (document.getElementById('cq-jeff-23-css')) return;
    var l = document.createElement('link');
    l.id = 'cq-jeff-23-css';
    l.rel = 'stylesheet';
    l.href = 'css/cq-jeff-23.css?v=48';
    document.head.appendChild(l);
  }

  function toggleMinusOnInput(input) {
    if (!input) return;
    var raw = String(input.value || '').trim();
    if (!raw || raw === '-' || raw === '+') {
      input.value = '-';
      input.focus();
      return;
    }
    if (raw.charAt(0) === '-') input.value = raw.slice(1);
    else if (raw.charAt(0) === '+') input.value = '-' + raw.slice(1);
    else input.value = '-' + raw;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  function enhanceCountInput(el) {
    if (!el || el.dataset.cqNegReady === '1') return;
    el.dataset.cqNegReady = '1';
    el.setAttribute('type', 'text');
    el.setAttribute('inputmode', 'text');
    el.setAttribute('pattern', '[+-]?[0-9]*');
    el.setAttribute('autocomplete', 'off');
    el.removeAttribute('min');
    el.removeAttribute('max');
    el.removeAttribute('step');
    var parent = el.parentElement;
    if (!parent) return;
    if (parent.classList.contains('cq-count-guess-row')) return;
    if (parent.querySelector('.cq-minus-btn')) return;
    var row = document.createElement('div');
    row.className = 'cq-count-guess-row';
    parent.insertBefore(row, el);
    row.appendChild(el);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cq-minus-btn';
    btn.setAttribute('aria-label', 'Toggle negative sign');
    btn.title = 'Negative';
    btn.textContent = '-';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleMinusOnInput(el);
    });
    row.appendChild(btn);
  }

  function enhanceAllCountInputs() {
    COUNT_INPUT_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) enhanceCountInput(el);
    });
  }

  function currentDeckBack(app) {
    var fromSession = app && app.dealerSession && app.dealerSession.deckBack;
    var fromSave = app && app.save && app.save.settings && app.save.settings.dealerDeckBack;
    var id = fromSession || fromSave || 'red';
    if (!DECK_BACKS.some(function (d) { return d.id === id; })) id = 'red';
    return id;
  }

  function applyDeckBackClasses(id) {
    var deckId = id || 'red';
    document.querySelectorAll('.playing-card.back').forEach(function (card) {
      DECK_BACKS.forEach(function (d) { card.classList.remove('cq-deck-' + d.id); });
      card.classList.add('cq-deck-' + deckId);
    });
  }

  function setDeckBack(app, id) {
    if (!DECK_BACKS.some(function (d) { return d.id === id; })) return;
    if (app) {
      if (!app.save.settings) app.save.settings = {};
      app.save.settings.dealerDeckBack = id;
      if (app.dealerSession) app.dealerSession.deckBack = id;
      if (typeof app.persist === 'function') app.persist();
    }
    applyDeckBackClasses(id);
  }

  function ensureDealerDeckPicker(app) {
    var intro = document.getElementById('dealer-mode-intro');
    if (!intro) return;
    var existing = document.getElementById('dealer-deck-picker');
    if (existing) {
      existing.querySelectorAll('.dealer-deck-opt').forEach(function (btn) {
        btn.classList.toggle('is-selected', btn.dataset.deck === currentDeckBack(app));
      });
      return;
    }
    var startBtn = document.getElementById('btn-dealer-mode-start');
    var picker = document.createElement('div');
    picker.id = 'dealer-deck-picker';
    picker.className = 'dealer-deck-picker';
    picker.innerHTML =
      '<div class="dealer-deck-picker-label">Deck back design</div>' +
      DECK_BACKS.map(function (d) {
        return (
          '<button type="button" class="dealer-deck-opt' +
          (currentDeckBack(app) === d.id ? ' is-selected' : '') +
          '" data-deck="' + d.id + '" title="' + d.label + '" aria-label="' + d.label +
          '"><span class="swatch" aria-hidden="true"></span></button>'
        );
      }).join('');
    if (startBtn && startBtn.parentNode === intro) intro.insertBefore(picker, startBtn);
    else intro.appendChild(picker);
    picker.addEventListener('click', function (e) {
      var btn = e.target.closest('.dealer-deck-opt');
      if (!btn) return;
      setDeckBack(app || window.app, btn.dataset.deck);
      picker.querySelectorAll('.dealer-deck-opt').forEach(function (b) {
        b.classList.toggle('is-selected', b === btn);
      });
    });
  }

  function simplifyDealerFaces() {
    document.querySelectorAll('#screen-dealer-mode .playing-card.cq-pipped').forEach(function (card) {
      var field = card.querySelector('.cq-pip-field');
      if (field) field.style.display = 'none';
      var center = card.querySelector('.center-suit');
      if (center) center.style.opacity = '1';
    });
  }

  function applyPatches() {
    if (typeof CountQuestApp === 'undefined') return false;
    var proto = CountQuestApp.prototype;
    if (proto.__cqJeff23b) return true;
    proto.__cqJeff23b = true;

    var origRenderDealerMode = proto.renderDealerMode;
    proto.renderDealerMode = function () {
      origRenderDealerMode.call(this);
      ensureDealerDeckPicker(this);
      applyDeckBackClasses(currentDeckBack(this));
      enhanceAllCountInputs();
      simplifyDealerFaces();
    };

    var origStart = proto.startDealerShift;
    proto.startDealerShift = function () {
      var id = currentDeckBack(this);
      if (!this.save.settings) this.save.settings = {};
      this.save.settings.dealerDeckBack = id;
      var out = origStart.apply(this, arguments);
      if (this.dealerSession) this.dealerSession.deckBack = id;
      applyDeckBackClasses(id);
      return out;
    };

    var origRenderCard = proto.renderCard;
    proto.renderCard = function (c, hidden, animIndex) {
      var html = origRenderCard.call(this, c, hidden, animIndex);
      if (hidden) {
        html = html.replace(
          'playing-card back',
          'playing-card back cq-deck-' + currentDeckBack(this)
        );
      }
      return html;
    };

    var origRender = proto.render;
    proto.render = function () {
      var out = origRender.apply(this, arguments);
      enhanceAllCountInputs();
      var dm = document.getElementById('screen-dealer-mode');
      if (this.phase === 'dealer-mode' || (dm && !dm.classList.contains('hidden'))) {
        applyDeckBackClasses(currentDeckBack(this));
        ensureDealerDeckPicker(this);
        simplifyDealerFaces();
      }
      return out;
    };

    enhanceAllCountInputs();
    return true;
  }

  function watchDom() {
    if (window.__cqJeff23bObs) return;
    try {
      var obs = new MutationObserver(function () {
        enhanceAllCountInputs();
        applyDeckBackClasses(currentDeckBack(window.app));
        simplifyDealerFaces();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      window.__cqJeff23bObs = obs;
    } catch (e) {}
  }

  function boot() {
    injectCss();
    enhanceAllCountInputs();
    watchDom();
    if (applyPatches()) return;
    var n = 0;
    var t = setInterval(function () {
      if (applyPatches() || ++n > 60) clearInterval(t);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
