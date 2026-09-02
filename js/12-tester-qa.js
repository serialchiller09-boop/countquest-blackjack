// §12 TESTER QA — dead-button guards (Play Store v1)
(function () {
  if (window.__CQ_TESTER_QA_BOOTED) return;
  window.__CQ_TESTER_QA_BOOTED = true;

  function injectPanelCss() {
    if (document.getElementById('cq-play-store-v1-css')) return;
    const s = document.createElement('style');
    s.id = 'cq-play-store-v1-css';
    s.textContent = '#external-services-panel{display:none!important}html.cq-dev #external-services-panel{display:block!important}';
    document.head.appendChild(s);
    if (!document.querySelector('link[href*="play-store-v1.css"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/play-store-v1.css?v=46';
      document.head.appendChild(l);
    }
  }

  function relabelSkip() {
    const skip = document.getElementById('btn-tutorial-skip');
    if (skip && /Full Campaign/i.test(skip.textContent || '')) skip.textContent = 'Skip Tutorial';
  }

  function rewriteOauthCopy() {
    const el = document.getElementById('daily-rewards-social');
    if (!el) return;
    el.querySelectorAll('p').forEach((p) => {
      const t = p.textContent || '';
      if (t.includes('Configure OAuth in Settings') || t.includes('OAuth configured in Settings')) {
        p.innerHTML = p.innerHTML
          .replace('Configure OAuth in Settings, or use local connect.', 'Local connect — simulated chips and gems only.')
          .replace('OAuth configured in Settings.', 'OAuth is ready.');
      }
    });
  }

  function patch() {
    injectPanelCss();
    relabelSkip();
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqTesterQaPatched) return true;
    proto.__cqTesterQaPatched = true;

    const origMini = proto.openLobbyMinigame;
    proto.openLobbyMinigame = function (id) {
      origMini.call(this, id);
      const action = document.getElementById('btn-lobby-minigame-action');
      if (action) action.disabled = false;
      const close = document.getElementById('btn-lobby-minigame-close');
      if (close) close.disabled = false;
    };

    if (typeof proto.renderDailyRewards === 'function') {
      const orig = proto.renderDailyRewards;
      proto.renderDailyRewards = function () {
        const out = orig.apply(this, arguments);
        rewriteOauthCopy();
        return out;
      };
    }

    if (typeof proto.renderTableLobby === 'function') {
      const orig = proto.renderTableLobby;
      proto.renderTableLobby = function () {
        const out = orig.apply(this, arguments);
        const list = document.getElementById('table-tier-list');
        if (list) {
          list.innerHTML = list.innerHTML.replace(/Expert rank required/g, 'Journeyman rank required');
        }
        document.querySelectorAll('#table-tier-list [data-table-tier][disabled]').forEach((btn) => {
          btn.disabled = false;
          btn.dataset.locked = '1';
        });
        return out;
      };
    }

    if (typeof proto.joinTable === 'function') {
      const origJoin = proto.joinTable;
      proto.joinTable = function (tierId) {
        const btn = document.querySelector('[data-table-tier="' + tierId + '"]');
        if (btn && btn.dataset.locked === '1') {
          let msg = 'This table is locked';
          if (typeof canJoinTable === 'function' && typeof getTableTier === 'function') {
            const tier = getTableTier(tierId);
            const check = tier ? canJoinTable(this.save, tier) : null;
            if (check && check.reasons && check.reasons.length) msg = check.reasons.join(' · ');
          }
          this.toast(msg, 'info', 2800);
          return;
        }
        return origJoin.apply(this, arguments);
      };
    }

    return true;
  }

  function boot() {
    injectPanelCss();
    relabelSkip();
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
