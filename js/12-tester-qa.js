// §12 TESTER QA — dead-button guards (Play Store v1 / v49)
(function () {
  if (window.__CQ_TESTER_QA_BOOTED) return;
  window.__CQ_TESTER_QA_BOOTED = true;
  if (window.__CQ_TEST_MODE || navigator.webdriver) return;

  const FIRST_RUN_KEY = 'cq.firstRunV1';
  const RANK_FALLBACK = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];

  function injectPanelCss() {
    if (document.getElementById('cq-play-store-v1-css')) return;
    const s = document.createElement('style');
    s.id = 'cq-play-store-v1-css';
    s.textContent = '#external-services-panel{display:none!important}html.cq-native #external-services-panel{display:none!important}html.cq-dev #external-services-panel{display:block!important}';
    document.head.appendChild(s);
    if (!document.querySelector('link[href*="play-store-v1.css"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/play-store-v1.css?v=49';
      document.head.appendChild(l);
    }
  }

  function relabelSkip() {
    const skip = document.getElementById('btn-tutorial-skip');
    if (!skip) return;
    if (/Full Campaign/i.test(skip.textContent || '')) skip.textContent = 'Skip Tutorial';
    skip.setAttribute('aria-label', 'Skip tutorial and sit a beginner table');
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

  function fixProTableCopy() {
    try {
      if (typeof TABLE_TIERS !== 'undefined' && Array.isArray(TABLE_TIERS)) {
        TABLE_TIERS.forEach((tier) => {
          if (!tier || typeof tier.desc !== 'string') return;
          if (tier.id === 'pro' && /Expert rank required/i.test(tier.desc)) {
            tier.desc = tier.desc.replace(/Expert rank required/gi, 'Journeyman rank required');
          }
        });
      }
    } catch (_) {}
  }

  function clearFirstRunFlag() {
    try { localStorage.removeItem(FIRST_RUN_KEY); } catch (_) {}
  }

  function rankNames() {
    return (typeof RANK_NAMES !== 'undefined' && Array.isArray(RANK_NAMES) && RANK_NAMES.length)
      ? RANK_NAMES
      : RANK_FALLBACK;
  }

  function tableTier(tierId) {
    if (typeof getTableTier === 'function') {
      const t = getTableTier(tierId);
      if (t) return t;
    }
    if (typeof TABLE_TIERS !== 'undefined' && Array.isArray(TABLE_TIERS)) {
      return TABLE_TIERS.find((x) => x.id === tierId) || null;
    }
    return null;
  }

  function lockedTableMessage(app, tierId) {
    const tier = tableTier(tierId);
    if (typeof canJoinTable === 'function' && app && app.save && tier) {
      const check = canJoinTable(app.save, tier);
      if (check && check.reasons && check.reasons.length) return check.reasons.join(' · ');
    }
    if (tier && tier.minRank) {
      const name = rankNames()[tier.minRank] || 'higher';
      return name + ' rank required';
    }
    return 'This table is locked';
  }

  function unlockLockedTableButtons() {
    const list = document.getElementById('table-tier-list');
    if (!list) return;
    list.querySelectorAll('[data-table-tier]').forEach((btn) => {
      const locked = btn.disabled || btn.hasAttribute('disabled') || btn.dataset.locked === '1' || /🔒/.test(btn.innerHTML);
      if (!locked) return;
      const tierId = btn.dataset.tableTier;
      const tier = tableTier(tierId);
      const requiredName = tier ? (rankNames()[tier.minRank] || '') : '';
      if (requiredName && requiredName !== 'Expert') {
        btn.innerHTML = btn.innerHTML.replace(/Expert rank required/g, requiredName + ' rank required');
      }
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.dataset.locked = '1';
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.remove('cursor-not-allowed');
      btn.style.pointerEvents = 'auto';
    });
  }

  function enableMinigameClose() {
    const close = document.getElementById('btn-lobby-minigame-close');
    if (close) {
      close.disabled = false;
      close.removeAttribute('disabled');
      close.removeAttribute('aria-disabled');
    }
    const action = document.getElementById('btn-lobby-minigame-action');
    if (action) {
      const label = (action.textContent || '').trim();
      if (/^close$/i.test(label)) {
        action.disabled = false;
        action.removeAttribute('disabled');
      }
    }
  }

  function unstickDealLock(app) {
    try {
      if (!app) return;
      const waiting = !!(app._awaitingNextHand || app.phase === 'handEnd' || app.phase === 'bet');
      if (waiting && (app.dealing || app._betSubmitting)) {
        app.dealing = false;
        app._betSubmitting = false;
      }
      if (typeof app.unlockDealButton === 'function') app.unlockDealButton();
    } catch (_) {}
  }

  function ensureDealNext(app) {
    try {
      unstickDealLock(app);
      if (app && app._awaitingNextHand && typeof app.renderSoloHandEndDealCta === 'function') {
        app.renderSoloHandEndDealCta();
      }
      const deal = document.getElementById('btn-deal');
      if (deal && app && (app._awaitingNextHand || app.phase === 'handEnd')) {
        deal.disabled = false;
        deal.removeAttribute('disabled');
        deal.removeAttribute('aria-disabled');
        deal.classList.remove('cq-deal-locked');
      }
    } catch (_) {}
  }

  function patch() {
    injectPanelCss();
    relabelSkip();
    enableMinigameClose();
    fixProTableCopy();

    if (typeof Storage !== 'undefined' && Storage && typeof Storage.reset === 'function' && !Storage.__cqFirstRunResetPatched) {
      const origReset = Storage.reset.bind(Storage);
      Storage.reset = function () {
        origReset();
        clearFirstRunFlag();
      };
      Storage.__cqFirstRunResetPatched = true;
    }

    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqTesterQaPatched) return true;
    proto.__cqTesterQaPatched = true;

    const origMini = proto.openLobbyMinigame;
    proto.openLobbyMinigame = function (id) {
      origMini.call(this, id);
      const action = document.getElementById('btn-lobby-minigame-action');
      if (action) action.disabled = false;
      enableMinigameClose();
    };

    if (typeof proto.playLobbyMinigame === 'function') {
      const origPlay = proto.playLobbyMinigame;
      proto.playLobbyMinigame = function () {
        const out = origPlay.apply(this, arguments);
        enableMinigameClose();
        if (out && typeof out.then === 'function') out.then(() => enableMinigameClose(), () => enableMinigameClose());
        return out;
      };
    }

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
        unlockLockedTableButtons();
        return out;
      };
    }

    if (typeof proto.joinTable === 'function') {
      const origJoin = proto.joinTable;
      proto.joinTable = function (tierId) {
        const btn = document.querySelector('[data-table-tier="' + tierId + '"]');
        if (btn && btn.dataset.locked === '1') {
          this.toast(lockedTableMessage(this, tierId), 'info', 2800);
          return;
        }
        return origJoin.apply(this, arguments);
      };
    }

    if (typeof proto.confirmResetProgress === 'function') {
      const origConfirm = proto.confirmResetProgress;
      proto.confirmResetProgress = function () {
        const out = origConfirm.apply(this, arguments);
        clearFirstRunFlag();
        return out;
      };
    }

    if (typeof proto.finishHand === 'function') {
      const origFinish = proto.finishHand;
      proto.finishHand = function () {
        const out = origFinish.apply(this, arguments);
        ensureDealNext(this);
        return out;
      };
    }

    if (typeof proto.dealNextHand === 'function') {
      const origDealNext = proto.dealNextHand;
      proto.dealNextHand = function () {
        unstickDealLock(this);
        return origDealNext.apply(this, arguments);
      };
    }

    if (typeof proto.continueToNextHand === 'function') {
      const origContinue = proto.continueToNextHand;
      proto.continueToNextHand = function () {
        unstickDealLock(this);
        return origContinue.apply(this, arguments);
      };
    }

    if (typeof proto.skipTutorial === 'function') {
      proto.skipTutorial = function () {
        if (typeof this.canTutorialNav === 'function' && !this.canTutorialNav()) return;
        if (typeof this.lockTutorialNav === 'function') this.lockTutorialNav();
        if (this.save && this.save.tutorial) {
          this.save.tutorial.completed = true;
          if (typeof TUTORIAL_STEPS !== 'undefined' && TUTORIAL_STEPS.length) {
            this.save.tutorial.step = TUTORIAL_STEPS.length - 1;
          }
        }
        if (typeof this.persist === 'function') this.persist();
        if (typeof this.openTableLobby === 'function') this.openTableLobby();
        else if (typeof this.goMenu === 'function') this.goMenu();
      };
    }

    return true;
  }

  function boot() {
    injectPanelCss();
    relabelSkip();
    enableMinigameClose();
    fixProTableCopy();
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
