// S26 Honor path - Dealer Shift -> Pit Boss progression (lobby + unlock)
(function () {
  'use strict';

  var CAREER = ['Railbird', 'Dealer', 'Boxman', 'Floor', 'Pit Boss'];
  var PITBOSS_HREF = 'pitboss/index.html';
  var LEGACY_RANKS = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];

  function ensureCss() {
    if (document.getElementById('cq-honor-path-css')) return;
    var link = document.createElement('link');
    link.id = 'cq-honor-path-css';
    link.rel = 'stylesheet';
    link.href = 'css/cq-honor-path.css?v=38';
    document.head.appendChild(link);
  }

  function isHonored(save) {
    return !!(save && save.honorPath && save.honorPath.dealerCleared);
  }

  function markHonored(app) {
    if (!app || !app.save) return false;
    app.save.honorPath = app.save.honorPath || {};
    if (app.save.honorPath.dealerCleared) return false;
    app.save.honorPath.dealerCleared = true;
    app.save.honorPath.clearedAt = Date.now();
    if (typeof app.persist === 'function') app.persist();
    return true;
  }

  function qualifiesHonor(early, handsPlayed, payoutTotal) {
    if (early) return false;
    handsPlayed = Number(handsPlayed) || 0;
    payoutTotal = Number(payoutTotal) || 0;
    if (handsPlayed < 1) return false;
    return payoutTotal > 0 || handsPlayed >= 5;
  }

  function patchLobbyCopy() {
    try {
      if (typeof LOBBY_PLAY_MODES !== 'undefined') {
        var dealer = LOBBY_PLAY_MODES.find(function (m) { return m.id === 'dealer'; });
        if (dealer) {
          dealer.sub = 'Prove yourself on the table - then earn the pit rail';
          dealer.title = dealer.title || 'Dealer Shift';
        }
      }
      if (typeof LOBBY_HERO_PLAY !== 'undefined') {
        LOBBY_HERO_PLAY.id = 'pitboss';
        LOBBY_HERO_PLAY.title = 'Pit Boss - Five Seats';
        LOBBY_HERO_PLAY.sub = 'Run the pit - five seats, one boss';
        LOBBY_HERO_PLAY.icon = '\uD83C\uDFA9';
        LOBBY_HERO_PLAY.action = 'pitboss';
        LOBBY_HERO_PLAY.cls = 'lobby-play-pitboss';
      }
    } catch (e) {}
  }

  function mapLegacyRankName(s) {
    return String(s || '')
      .replace(/\bNovice\b/g, 'Railbird')
      .replace(/\bApprentice\b/g, 'Dealer')
      .replace(/\bJourneyman\b/g, 'Boxman')
      .replace(/\bMaster\b/g, 'Pit Boss')
      .replace(/\bExpert\b/g, 'Floor');
  }

  function careerRankName(rankIdx) {
    var i = Number(rankIdx) || 0;
    return CAREER[i] || CAREER[0];
  }

  function fixRankLabels(root) {
    root = root || document;
    try {
      var prank = root.getElementById ? root.getElementById('lobby-profile-rank') : null;
      if (prank) {
        var app = window.app;
        var st = app && app.save && app.save.stats;
        var rankName = careerRankName(st && st.rank);
        var help = (st && st.helpLevel != null) ? st.helpLevel : 0;
        prank.textContent = rankName + ' \u00B7 Help Level ' + help;
      }
      root.querySelectorAll && root.querySelectorAll('.text-gold.font-bold, #stats-sidebar-body .text-gold').forEach(function (el) {
        var t = el.textContent || '';
        if (LEGACY_RANKS.some(function (r) { return t === r || t.indexOf(r) === 0; })) {
          el.textContent = mapLegacyRankName(t);
        }
      });
    } catch (e) {}
  }

  function renderPitBossHeroHtml() {
    return (
      '<a id="lobby-hero-play" class="lobby-hero-play cq-honor-hero-pitboss" href="' +
      PITBOSS_HREF +
      '" title="Pit Boss - Five Seats" aria-label="Pit Boss - Five Seats - run the pit">' +
      '<span class="hero-icon" aria-hidden="true">\uD83C\uDFA9</span>' +
      '<span class="hero-title">Pit Boss - Five Seats</span>' +
      '<span class="hero-sub">The front door - five seats, one boss</span>' +
      '</a>'
    );
  }

  function enhancePitBossEntry(honored) {
    var btn = document.getElementById('btnPitBoss');
    if (!btn) return;
    btn.classList.add('cq-honor-pitboss-primary');
    btn.textContent = honored ? 'Honored - Play Pit Boss' : 'Pit Boss - Five Seats';
    btn.setAttribute('aria-label', honored ? 'Honored - Play Pit Boss Five Seats' : 'Play Pit Boss Five Seats');
    btn.style.cssText =
      'display:block;margin:12px auto;max-width:320px;text-align:center;text-decoration:none;' +
      'padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,#f0d060,#c9a227);' +
      'color:#111;font-weight:800;position:static;z-index:auto;box-shadow:0 0 0 2px rgba(201,162,39,.45),0 8px 24px rgba(0,0,0,.35);' +
      'letter-spacing:.02em;';
  }

  function demoteDealerSecondary() {
    try {
      document.querySelectorAll('[data-lobby-play="dealer-mode"]').forEach(function (el) {
        el.classList.add('cq-honor-dealer-secondary');
        var sub = el.querySelector('.play-sub, .hero-sub');
        if (sub) sub.textContent = 'Prove yourself on the table - then earn the pit rail';
      });
    } catch (e) {}
  }

  function injectHonorHint(host, honored) {
    if (!host) return;
    var existing = host.querySelector('.cq-honor-path-hint');
    if (existing) existing.remove();
    var p = document.createElement('p');
    p.className = 'cq-honor-path-hint text-xs text-center mt-3';
    if (honored) {
      p.innerHTML =
        '<span class="cq-honor-cleared">Honored - Play Pit Boss</span> \u00B7 ' +
        '<a class="cq-honor-rail-link" href="' + PITBOSS_HREF + '">Take the rail</a>';
    } else {
      p.textContent = 'Finish a full shift to unlock Pit Boss honor path';
    }
    host.appendChild(p);
  }

  function showTakeTheRailCta(container) {
    if (!container) return;
    var existing = container.querySelector('#cq-honor-take-rail');
    if (existing) return;
    var wrap = document.createElement('div');
    wrap.id = 'cq-honor-take-rail';
    wrap.className = 'cq-honor-take-rail';
    wrap.innerHTML =
      '<a class="cq-honor-take-rail-btn" href="' +
      PITBOSS_HREF +
      '">Take the rail (Pit Boss)</a>';
    container.appendChild(wrap);
  }

  function decorateDealerScreens(app) {
    if (!app) return;
    var honored = isHonored(app.save);
    var intro = document.getElementById('dealer-mode-intro');
    if (intro && !intro.classList.contains('hidden')) {
      var career = document.getElementById('dealer-mode-career-stats') || intro;
      injectHonorHint(career, honored);
    }
    var summary = document.getElementById('dealer-mode-summary');
    if (summary && !summary.classList.contains('hidden')) {
      var body = document.getElementById('dealer-summary-body') || summary;
      injectHonorHint(body, honored);
      if (honored) showTakeTheRailCta(summary);
    }
    var drillBody = document.getElementById('drill-summary-body');
    if (drillBody && app.phase === 'drill-session-summary' && app.drillSummaryDrillId === 'dealer-mode') {
      injectHonorHint(drillBody, honored);
      if (honored) showTakeTheRailCta(document.getElementById('drill-session-summary') || drillBody.parentElement || drillBody);
    }
  }

  function promoteLobbyHero(app) {
    var heroSlot = document.getElementById('lobby-hero-play-slot');
    if (heroSlot) {
      heroSlot.innerHTML = renderPitBossHeroHtml();
    } else {
      var hero = document.getElementById('lobby-hero-play');
      if (hero && hero.tagName === 'BUTTON') {
        var parent = hero.parentElement;
        if (parent) parent.innerHTML = renderPitBossHeroHtml();
      }
    }
    enhancePitBossEntry(isHonored(app && app.save));
    demoteDealerSecondary();
    fixRankLabels(document);
  }

  function afterHonorClear(app, justCleared) {
    if (!app) return;
    if (justCleared && typeof app.toast === 'function') {
      app.toast('Shift honored - the rail is open', 'level', 5000);
      if (typeof lobbyTapFeedback === 'function') lobbyTapFeedback('sparkle');
    }
    setTimeout(function () {
      decorateDealerScreens(app);
      var drillRoot =
        document.getElementById('drill-session-summary') ||
        document.getElementById('drill-summary-body') ||
        document.getElementById('dealer-mode-summary');
      if (drillRoot) showTakeTheRailCta(drillRoot);
      var backBtn = document.getElementById('btn-drill-summary-back');
      if (backBtn && backBtn.parentElement) showTakeTheRailCta(backBtn.parentElement);
      var again = document.getElementById('btn-dealer-summary-again');
      if (again && again.parentElement) showTakeTheRailCta(again.parentElement);
    }, 0);
  }

  function wrapEndDealerShift(proto) {
    var current = proto.endDealerShift;
    if (!current || current.__cqHonorPath26) return;
    var wrapped = function (early) {
      early = !!early;
      var ds = this.dealerSession;
      var handsPlayed = ds ? ds.handsPlayed : 0;
      var payoutTotal = ds && ds.analytics ? ds.analytics.payoutTotal : 0;
      var out = current.apply(this, arguments);
      if (qualifiesHonor(early, handsPlayed, payoutTotal)) {
        var just = markHonored(this);
        afterHonorClear(this, just);
      } else {
        decorateDealerScreens(this);
      }
      return out;
    };
    wrapped.__cqHonorPath26 = true;
    proto.endDealerShift = wrapped;
    proto.__cqHonorPath26EndWrapped = wrapped;
  }

  function applyPatches() {
    patchLobbyCopy();
    if (typeof CountQuestApp === 'undefined') return false;
    var proto = CountQuestApp.prototype;

    wrapEndDealerShift(proto);

    if (!proto.__cqHonorPath26Lobby) {
      proto.__cqHonorPath26Lobby = true;
      var origRenderLobby = proto.renderLobby;
      proto.renderLobby = function () {
        patchLobbyCopy();
        origRenderLobby.call(this);
        promoteLobbyHero(this);
        fixRankLabels(document);
        enhancePitBossEntry(isHonored(this.save));
      };

      var origRenderDealer = proto.renderDealerMode;
      if (typeof origRenderDealer === 'function') {
        proto.renderDealerMode = function () {
          origRenderDealer.call(this);
          decorateDealerScreens(this);
        };
      }

      var origDrillSummary = proto.renderDrillSessionSummary;
      if (typeof origDrillSummary === 'function') {
        proto.renderDrillSessionSummary = function () {
          origDrillSummary.call(this);
          if (this.drillSummaryDrillId === 'dealer-mode') {
            decorateDealerScreens(this);
            if (isHonored(this.save)) {
              var root =
                document.getElementById('drill-session-summary') ||
                document.getElementById('drill-summary-body');
              if (root) showTakeTheRailCta(root);
            }
          }
        };
      }
    }

    if (!proto.endDealerShift || !proto.endDealerShift.__cqHonorPath26) {
      wrapEndDealerShift(proto);
    }

    proto.__cqHonorPath26 = true;
    return true;
  }

  function watchRanks() {
    if (window.__cqHonorPath26Observer) return;
    try {
      var obs = new MutationObserver(function () {
        fixRankLabels(document);
        demoteDealerSecondary();
        var hero = document.getElementById('lobby-hero-play');
        if (hero && hero.tagName === 'BUTTON' && /1v1|Play/i.test(hero.textContent || '')) {
          promoteLobbyHero(window.app);
        }
        enhancePitBossEntry(isHonored(window.app && window.app.save));
      });
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      window.__cqHonorPath26Observer = obs;
    } catch (e) {}
  }

  function boot() {
    ensureCss();
    patchLobbyCopy();
    applyPatches();
    watchRanks();
    promoteLobbyHero(window.app);
    var n = 0;
    var t = setInterval(function () {
      ensureCss();
      patchLobbyCopy();
      applyPatches();
      promoteLobbyHero(window.app);
      if (++n > 60) clearInterval(t);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(function () { promoteLobbyHero(window.app); }, 400);
  setTimeout(function () { promoteLobbyHero(window.app); }, 1200);
})();
