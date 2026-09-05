// §18 SOFT TOTAL BADGE — soft vs hard hint on white total oval (v65)
(function () {
  if (window.__CQ_SOFT_TOTAL_V65_BOOTED) return;
  window.__CQ_SOFT_TOTAL_V65_BOOTED = true;

  function injectSheet() {
    let l = document.querySelector('link[href*="cq-v65-play.css"], link[href*="cq-v64-play.css"]');
    if (!l) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      l.id = 'cq-v65-soft-link';
      document.head.appendChild(l);
    }
    // Prefer v65 sheet when theme has not set it yet
    if (!l.href || l.href.indexOf('cq-v65-play.css') < 0) {
      l.href = 'css/cq-v65-play.css?v=65';
    }
  }

  /** Ace still counting as 11 after soft/hard reduction. */
  function handIsSoft(hand) {
    if (!hand || !hand.cards || !hand.cards.length) return false;
    if (typeof hand.isBlackjack === 'function' && hand.isBlackjack()) return false;
    if (typeof hand.isBust === 'function' && hand.isBust()) return false;
    if (typeof hand.rawValue === 'function') {
      var rv = hand.rawValue();
      var total = rv.total;
      var aces = rv.aces;
      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }
      return aces > 0 && total <= 21;
    }
    return typeof hand.isSoft === 'function' && hand.isSoft();
  }

  function setSoftHint(badge, soft) {
    if (!badge) return;
    badge.classList.toggle('cq-is-soft', !!soft);
    badge.classList.toggle('is-soft', !!soft);
    var hint = badge.querySelector('.cq-soft-hint, .cq-hand-soft-tag');
    if (soft) {
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'cq-soft-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = 'soft';
        badge.appendChild(hint);
      } else {
        hint.className = 'cq-soft-hint';
        hint.textContent = 'soft';
      }
      var label = badge.getAttribute('aria-label') || '';
      if (label && label.indexOf('soft') < 0) {
        badge.setAttribute('aria-label', label + ' (soft)');
      }
    } else if (hint) {
      hint.remove();
      var al = badge.getAttribute('aria-label') || '';
      if (al.indexOf(' (soft)') >= 0) {
        badge.setAttribute('aria-label', al.replace(' (soft)', ''));
      }
    }
  }

  function dressPlayerHands(app) {
    var hands = app && app.playerHands;
    if (!hands || !hands.length) return;
    var nodes = document.querySelectorAll('#player-hands .casino-player-hand');
    nodes.forEach(function (node, i) {
      var hs = hands[i];
      var hand = hs && hs.hand;
      var badge = node.querySelector('.cq-hand-total-badge');
      if (!badge) return;
      setSoftHint(badge, handIsSoft(hand));
    });
  }

  function dressDealer(app) {
    if (!app || !app.dealer) return;
    var badge = document.querySelector('#dealer-total .cq-hand-total-badge');
    if (!badge) return;
    // Only annotate when hole is visible (full hand known)
    if (app.hideHole) {
      setSoftHint(badge, false);
      return;
    }
    setSoftHint(badge, handIsSoft(app.dealer));
  }

  function dress() {
    try {
      if (!document.body || !document.body.classList.contains('casino-play-active')) return;
      var app = window.app;
      if (!app) return;
      dressPlayerHands(app);
      dressDealer(app);
    } catch (_) { /* non-blocking */ }
  }

  function patchRender() {
    if (typeof CountQuestApp === 'undefined') return false;
    var proto = CountQuestApp.prototype;
    if (proto.__cqSoftTotalV65) return true;
    if (typeof proto.renderTable !== 'function') return false;
    proto.__cqSoftTotalV65 = true;
    var orig = proto.renderTable;
    proto.renderTable = function () {
      var out = orig.apply(this, arguments);
      queueMicrotask(function () { dress(); });
      requestAnimationFrame(function () { dress(); });
      return out;
    };
    return true;
  }

  function tick() {
    injectSheet();
    patchRender();
    dress();
  }

  function watch() {
    if (!document.body) return;
    var mo = new MutationObserver(function () {
      mo.disconnect();
      tick();
      mo.observe(document.body, { childList: true, subtree: true });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    document.documentElement.classList.add('cq-v65');
    if (document.body) document.body.classList.add('cq-v65');
    tick();
    watch();
    window.addEventListener('load', tick);
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
