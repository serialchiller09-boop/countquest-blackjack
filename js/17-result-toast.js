// §17 RESULT TOAST — brief Win/Lose/Push after hand resolve (v64)
(function () {
  if (window.__CQ_RESULT_TOAST_V64_BOOTED) return;
  window.__CQ_RESULT_TOAST_V64_BOOTED = true;

  function clearGenericHandToasts(stack) {
    stack.querySelectorAll('.toast-item').forEach(function (el) {
      if (el.classList.contains('cq-result-tip') || el.classList.contains('cq-strategy-tip') || el.classList.contains('cq-session-tip')) return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/this hand$/.test(t) || /^Big win!/.test(t) || /^Blackjack!/.test(t)) el.remove();
    });
  }

  function formatChipDelta(net) {
    if (net == null || !Number.isFinite(net) || net === 0) return '';
    const sign = net > 0 ? '+' : '−';
    return sign + Math.abs(Math.round(net)).toLocaleString() + ' chips';
  }

  function parseResultFromDom() {
    const handend = document.getElementById('screen-handend');
    if (!handend || handend.classList.contains('hidden')) return null;
    const summary = document.getElementById('handend-summary');
    const text = (summary && summary.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text === 'Hand complete') return null;
    let kind = null;
    const hasWin = /\bWIN\b/i.test(text) || text.indexOf('★') >= 0;
    const hasLose = /\bLOSE\b/i.test(text) || /\bSURRENDER\b/i.test(text) || /\bLOSS\b/i.test(text);
    const hasPush = /\bPUSH\b/i.test(text);
    const hasBj = /\bBLACKJACK\b/i.test(text) || text.indexOf('★') >= 0;
    if (hasBj && !hasLose) kind = 'blackjack';
    else if (hasWin && !hasLose) kind = 'win';
    else if (hasLose && !hasWin) kind = 'lose';
    else if (hasPush && !hasWin && !hasLose) kind = 'push';
    let net = 0;
    let sawDelta = false;
    const re = /\(([+-])\$(\d+(?:\.\d+)?)\)/g;
    let m;
    while ((m = re.exec(text))) {
      sawDelta = true;
      const n = parseFloat(m[2]);
      net += m[1] === '-' ? -n : n;
    }
    if (!kind) {
      if (sawDelta && net > 0) kind = 'win';
      else if (sawDelta && net < 0) kind = 'lose';
      else if (sawDelta) kind = 'push';
    }
    if (!kind) return null;
    return { kind: kind, net: sawDelta ? net : null, fromDom: true };
  }

  function resultFromApp(app) {
    if (!app) return null;
    const results = app.results || [];
    const net = typeof app.handNetPL === 'number' ? app.handNetPL : 0;
    if (results.length === 1) {
      const r = results[0].r;
      if (r === 'blackjack') return { kind: 'blackjack', net: net, fromDom: false };
      if (r === 'win') return { kind: 'win', net: net, fromDom: false };
      if (r === 'push') return { kind: 'push', net: net, fromDom: false };
      if (r === 'loss' || r === 'lose' || r === 'bust' || r === 'surrender') {
        return { kind: 'lose', net: net, fromDom: false };
      }
    }
    if (results.length > 1) {
      const wins = results.filter(function (x) { return x.r === 'win' || x.r === 'blackjack'; }).length;
      const losses = results.filter(function (x) {
        return x.r === 'loss' || x.r === 'lose' || x.r === 'bust' || x.r === 'surrender';
      }).length;
      if (net > 0 || wins > losses) return { kind: 'win', net: net, fromDom: false };
      if (net < 0 || losses > wins) return { kind: 'lose', net: net, fromDom: false };
      return { kind: 'push', net: net, fromDom: false };
    }
    if (net > 0) return { kind: 'win', net: net, fromDom: false };
    if (net < 0) return { kind: 'lose', net: net, fromDom: false };
    if (results.length) return { kind: 'push', net: 0, fromDom: false };
    return null;
  }

  function showResultToast(kind, deltaText) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    clearGenericHandToasts(stack);
    stack.querySelectorAll('.cq-result-tip').forEach(function (n) { n.remove(); });
    const labels = { win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack' };
    const icons = { win: '✓', lose: '✗', push: '═', blackjack: '★' };
    const el = document.createElement('div');
    el.className = 'toast-item cq-result-tip cq-result-' + kind + ' px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start gap-2 text-white backdrop-blur-sm';
    el.setAttribute('role', 'status');
    const label = labels[kind] || 'Result';
    const delta = deltaText ? (' · ' + deltaText) : '';
    el.innerHTML = '<span class="shrink-0 opacity-90" aria-hidden="true">' + (icons[kind] || '•') + '</span>'
      + '<span class="flex-1 leading-snug"><span class="cq-result-tip-label">' + label + '</span>' + delta + '</span>';
    stack.appendChild(el);
    setTimeout(function () { el.remove(); }, 1800);
  }

  function maybeResultToast(app) {
    try {
      if (!document.body || !document.body.classList.contains('casino-play-active')) return;
      let info = parseResultFromDom();
      if (!info) info = resultFromApp(app);
      if (!info || !info.kind) return;
      const token = String((app && app.session && app.session.hands) || 0) + ':' + String(info.kind) + ':' + String(info.net);
      if (window.__CQ_LAST_RESULT_TOAST === token) return;
      window.__CQ_LAST_RESULT_TOAST = token;
      showResultToast(info.kind, formatChipDelta(info.net));
    } catch (_) { /* non-blocking */ }
  }

  function patchResultToast() {
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqResultToastV64) return true;
    if (typeof proto.finishHand !== 'function') return false;
    proto.__cqResultToastV64 = true;
    const orig = proto.finishHand;
    proto.finishHand = function () {
      const out = orig.apply(this, arguments);
      const self = this;
      queueMicrotask(function () { maybeResultToast(self); });
      requestAnimationFrame(function () { maybeResultToast(self); });
      return out;
    };
    return true;
  }

  function tick() { patchResultToast(); }

  function watch() {
    if (!document.body) return;
    const mo = new MutationObserver(function () {
      mo.disconnect();
      tick();
      mo.observe(document.body, { childList: true, subtree: true });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    tick();
    watch();
    window.addEventListener('load', tick);
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
