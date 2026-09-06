// S23a part2 - patches
(function () {
  'use strict';
  var P = window.__cqJeff23aPart1;
  if (!P) return;
  var applyCareerGlobals = P.applyCareerGlobals;
  var applyTitles = P.applyTitles;
  var mapLegacyRankName = P.mapLegacyRankName;
  var buildChipTray = P.buildChipTray;
  var CAREER = P.CAREER;
  function applyPatches() {
    if (typeof CountQuestApp === 'undefined') return false;
    var proto = CountQuestApp.prototype;
    if (proto.__cqJeff23a) return true;
    proto.__cqJeff23a = true;
    applyCareerGlobals();

    var origRenderBet = proto.renderBet;
    proto.renderBet = function () {
      origRenderBet.call(this);
      var chipsEl = document.getElementById('chip-buttons');
      if (chipsEl) chipsEl.innerHTML = buildChipTray(this);
      var betInput = document.getElementById('bet-input');
      if (betInput) {
        var wrap = betInput.closest('.flex');
        if (wrap) wrap.classList.remove('hidden');
        betInput.classList.remove('hidden');
        betInput.removeAttribute('hidden');
        betInput.style.display = '';
        var minBet = this.minBet || 10;
        var maxBet = this.practice ? 1000000 : Math.max(minBet, this.bankroll || minBet);
        if (this.session && this.session.tableMaxBet != null) {
          maxBet = Math.min(maxBet, this.session.tableMaxBet);
        }
        betInput.min = minBet;
        betInput.max = maxBet;
        betInput.step = 1;
        if (!betInput.value) {
          betInput.value = (this.betSuggestion && this.betSuggestion.amount) || minBet;
        }
      }
      var rail = document.getElementById('casino-felt-bet-rail');
      if (rail) rail.classList.remove('hidden');
      var dock = document.getElementById('casino-bottom-dock');
      if (dock) dock.classList.remove('hidden');
      if (typeof this.syncBottomDockVisibility === 'function') this.syncBottomDockVisibility();
      if (typeof this.syncCasinoShellMetrics === 'function') this.syncCasinoShellMetrics();
      var seatInd = document.getElementById('casino-seat-bet-indicator');
      if (seatInd) {
        seatInd.classList.remove('hidden');
        seatInd.setAttribute('aria-hidden', 'false');
      }
    };

    proto.dealNextHand = async function (lastBet) {
      this.clearAutoNextHandTimer();
      this._awaitingNextHand = false;
      if (this.isDealLocked()) return;
      var prefer = lastBet ?? this.roundReview?.bet ?? this.betSuggestion?.amount ?? this.minBet;
      this.beginBetPhase();
      if (this.phase !== 'bet' && this.phase !== 'countConfirm') return;
      var betInput = document.getElementById('bet-input');
      if (betInput && prefer != null) {
        betInput.value = prefer;
        if (typeof this.updateSeatBetIndicator === 'function') this.updateSeatBetIndicator(prefer);
        else if (typeof updateCasinoSeatBetChipVisual === 'function') updateCasinoSeatBetChipVisual(prefer);
      }
    };

    var origSoloCta = proto.renderSoloHandEndDealCta;
    proto.renderSoloHandEndDealCta = function () {
      origSoloCta.call(this);
      if (typeof this.syncBottomDockVisibility === 'function') this.syncBottomDockVisibility();
    };

    var origRenderLobby = proto.renderLobby;
    proto.renderLobby = function () {
      applyCareerGlobals();
      origRenderLobby.call(this);
      var st = this.save && this.save.stats;
      var rankName = CAREER[(st && st.rank) || 0] || CAREER[0];
      var prank = document.getElementById('lobby-profile-rank');
      if (prank) prank.textContent = rankName + ' | Help Level ' + ((st && st.helpLevel) || 0);
      var passLabel = document.getElementById('lobby-pass-label');
      if (passLabel && /CountQuest Pass/i.test(passLabel.textContent || '')) {
        passLabel.textContent = (passLabel.textContent || '').replace(/CountQuest Pass/gi, 'Pit Boss Pass');
      }
      applyTitles();
    };

    if (typeof proto.renderStatsSidebar === 'function') {
      var origStats = proto.renderStatsSidebar;
      proto.renderStatsSidebar = function () {
        applyCareerGlobals();
        origStats.call(this);
        var body = document.getElementById('stats-sidebar-body');
        if (!body) return;
        var gold = body.querySelector('.text-gold.font-bold');
        if (gold) gold.textContent = CAREER[this.stats.rank] || CAREER[0];
      };
    }

    if (typeof proto.toast === 'function') {
      var origToast = proto.toast;
      proto.toast = function (msg) {
        if (typeof msg === 'string') msg = mapLegacyRankName(msg);
        return origToast.apply(this, arguments);
      };
    }

    var origTut = proto.renderTutorial;
    proto.renderTutorial = function () {
      applyCareerGlobals();
      applyTitles();
      origTut.call(this);
      var title = document.getElementById('tutorial-title');
      if (title && /CountQuest/i.test(title.textContent || '')) {
        title.textContent = (title.textContent || '').replace(/CountQuest/gi, 'Pit Boss');
      }
      if (title && !title.textContent) title.textContent = 'Training Aids';
    };

    var origRender = proto.render;
    proto.render = function () {
      var out = origRender.apply(this, arguments);
      if (this.phase === 'bet' || this.phase === 'countConfirm') {
        var rail = document.getElementById('casino-felt-bet-rail');
        if (rail) rail.classList.remove('hidden');
        if (typeof this.syncBottomDockVisibility === 'function') this.syncBottomDockVisibility();
      }
      applyTitles();
      return out;
    };

    applyTitles();
    return true;
  }

  function boot() {
    applyCareerGlobals();
    applyTitles();
    if (applyPatches()) return;
    var n = 0;
    var t = setInterval(function () {
      applyCareerGlobals();
      applyTitles();
      if (applyPatches() || ++n > 60) clearInterval(t);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(applyTitles, 0);
  setTimeout(applyTitles, 400);
})();
