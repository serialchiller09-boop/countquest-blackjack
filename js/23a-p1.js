// S23a Jeff - bet tray + career ranks + Pit Boss titles
(function () {
  'use strict';

  var CAREER = ['Railbird', 'Dealer', 'Boxman', 'Floor', 'Pit Boss'];
  var STANDARD_DENOMS = [10, 25, 50, 100, 250, 500, 1000];

  function applyCareerGlobals() {
    try {
      if (typeof HELP_LABELS !== 'undefined') {
        for (var i = 0; i < CAREER.length; i++) HELP_LABELS[i] = CAREER[i];
        HELP_LABELS.length = CAREER.length;
      }
      if (typeof RANK_NAMES !== 'undefined') {
        for (var j = 0; j < CAREER.length; j++) RANK_NAMES[j] = CAREER[j];
        RANK_NAMES.length = CAREER.length;
      }
      if (typeof HELP_DESC !== 'undefined') {
        HELP_DESC[0] = 'Railbird - counts, strategy, and bet hints always on.';
        HELP_DESC[1] = 'Dealer - confirm count each hand; bet range; hints on mistakes.';
        HELP_DESC[2] = 'Boxman - count hidden in play; quiz after each hand.';
        HELP_DESC[3] = 'Floor - no in-play help; post-shoe report.';
        HELP_DESC[4] = 'Pit Boss - pure simulation; analytics at session end only.';
      }
      if (typeof HELP_LEVEL_WHATS_NEW !== 'undefined') {
        HELP_LEVEL_WHATS_NEW[1] = '<strong>Dealer desk</strong> - count check before you bet each hand.';
        HELP_LEVEL_WHATS_NEW[2] = '<strong>Boxman watch</strong> - count hides during play; post-hand quizzes.';
        HELP_LEVEL_WHATS_NEW[3] = '<strong>Floor walk</strong> - coaching off at the table; shoe analysis after.';
        HELP_LEVEL_WHATS_NEW[4] = '<strong>Pit Boss</strong> - no hints until the session ends. You run the floor.';
      }
      if (typeof HELP_LEVEL_ENCOURAGEMENT !== 'undefined') {
        HELP_LEVEL_ENCOURAGEMENT[1] = 'Welcome to the floor - confirming the count builds discipline.';
        HELP_LEVEL_ENCOURAGEMENT[2] = 'Boxman pace - trust your head, not the HUD.';
        HELP_LEVEL_ENCOURAGEMENT[3] = 'Floor duty - review every shoe report carefully.';
        HELP_LEVEL_ENCOURAGEMENT[4] = 'Pit Boss path - bet sharp, play sharp, review everything.';
      }
      if (typeof TUTORIAL_STEPS !== 'undefined' && TUTORIAL_STEPS[0]) {
        TUTORIAL_STEPS[0].title = 'Welcome to the floor';
        TUTORIAL_STEPS[0].body =
          'Learn Hi-Lo counting, basic strategy, and bet sizing on the path to Pit Boss. Take your time; each step builds on the last.';
        var last = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
        if (last && last.final) {
          last.body =
            'Start in Practice Range drills to isolate skills, or jump into Full Campaign. Pick any help level (Railbird through Pit Boss) in Settings whenever you want.';
        }
      }
      if (typeof TABLE_TIERS !== 'undefined') {
        TABLE_TIERS.forEach(function (t) {
          if (t && /Apprentice/i.test(t.desc || '')) {
            t.desc = 'Serious action - Dealer rank and a deep bankroll required.';
          }
          if (t && /Expert rank required/i.test(t.desc || '')) {
            t.desc = 'Elite tier - 1 gem + 5,000 chips entry. Boxman rank required.';
          }
        });
      }
    } catch (e) {}
  }

  function applyTitles() {
    try {
      document.title = 'Pit Boss';
      var apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (apple) apple.setAttribute('content', 'Pit Boss');
      var appTitle = document.getElementById('app-title');
      if (appTitle) appTitle.textContent = 'Pit Boss';
      var menuTitle = document.getElementById('menu-app-title');
      if (menuTitle) menuTitle.textContent = 'Pit Boss';
      var logo = document.getElementById('logo');
      if (logo) logo.setAttribute('aria-label', 'Pit Boss');
      document.querySelectorAll('.lobby-pass-banner .font-bold, #lobby-pass-banner .font-bold').forEach(function (el) {
        if (/CountQuest Pass/i.test(el.textContent || '')) el.textContent = 'Pit Boss Pass';
      });
      var tut = document.getElementById('tutorial-title');
      if (tut && /CountQuest/i.test(tut.textContent || '')) {
        tut.textContent = (tut.textContent || '').replace(/CountQuest/gi, 'Pit Boss');
      }
      var frKicker = document.querySelector('.cq-first-run-kicker');
      if (frKicker && /CountQuest/i.test(frKicker.textContent || '')) {
        frKicker.textContent = 'Welcome to the floor';
      }
      var frTitle = document.getElementById('cq-first-run-title');
      if (frTitle && /Quest Through/i.test(frTitle.textContent || '')) {
        frTitle.textContent = 'Pit Boss Training Path';
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

  function buildChipTray(app) {
    var minBet = Math.max(1, Number(app.minBet) || 10);
    var bankroll = Math.max(0, Number(app.bankroll) || 0);
    var tableMax =
      app.session && app.session.tableMaxBet != null
        ? Number(app.session.tableMaxBet)
        : Infinity;
    var cap = Math.min(bankroll || Infinity, tableMax);
    if (app.practice) cap = Math.min(1000000, tableMax === Infinity ? 1000000 : tableMax);
    var rec = app.betSuggestion && app.betSuggestion.amount;
    var denoms = STANDARD_DENOMS.filter(function (d) {
      return d >= minBet && d <= cap;
    });
    if (!denoms.length) denoms = [Math.min(minBet, cap || minBet)];
    if (minBet <= cap && denoms.indexOf(minBet) < 0) denoms = [minBet].concat(denoms);
    denoms = denoms
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; });

    function renderChip(c) {
      var isRec = rec != null && c === rec;
      var colors = isRec
        ? 'recommended bg-gradient-to-br from-amber-400 to-amber-600 text-stone-900'
        : c === minBet
          ? 'bg-emerald-700 text-white'
          : c >= 500
            ? 'bg-purple-800 text-white'
            : c >= 100
              ? 'bg-red-800 text-white'
              : 'bg-slate-700 text-white';
      var badges = isRec
        ? '<span class="absolute -top-2 -right-1 text-[9px] bg-gold text-stone-900 px-1 rounded">REC</span>'
        : '';
      var denom = c >= 100 ? '100' : c >= 25 ? '25' : (c >= 5 ? '5' : '1');
      return (
        '<button type="button" class="bet-chip px-4 py-2 ' +
        colors +
        ' relative" data-bet="' +
        c +
        '" data-denom="' +
        denom +
        '">$' +
        c +
        badges +
        '</button>'
      );
    }
    return denoms.map(renderChip).join('');
  }


  window.__cqJeff23aPart1 = { CAREER: CAREER, applyCareerGlobals: applyCareerGlobals, applyTitles: applyTitles, mapLegacyRankName: mapLegacyRankName, buildChipTray: buildChipTray };
})();
(function () {
  if (document.querySelector('script[src*="23a-p2.js"]')) return;
  var s = document.createElement('script');
  s.src = 'js/23a-p2.js?v=48';
  document.head.appendChild(s);
})();
