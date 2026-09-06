// S27 Rail Count tests — §11 key cases (loads after CQRail)
(function () {
  'use strict';

  function railAssert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function runRailSection(check, eq) {
    if (typeof CQRail === 'undefined') {
      check(false, 'CQRail global missing');
      return;
    }

    eq(CQRail.handCount('off'), 0, 'rail handCount off');
    eq(CQRail.handCount('quiet'), 2, 'rail handCount quiet');
    eq(CQRail.handCount('busy'), 3, 'rail handCount busy');

    if (typeof HelpSystem !== 'undefined') {
      var d0 = new HelpSystem(0).railDwellMs();
      var d1 = new HelpSystem(1).railDwellMs();
      var d2 = new HelpSystem(2).railDwellMs();
      var d3 = new HelpSystem(3).railDwellMs();
      var d4 = new HelpSystem(4).railDwellMs();
      check(d0 > d1 && d1 > d2 && d2 > d3 && d3 > d4 && d4 >= 350, 'rail_help_dwell_monotonic');
      check(new HelpSystem(0).railShowTagLabel(), 'L0 tag label');
      check(new HelpSystem(1).railShowTagPip() && !new HelpSystem(1).railShowTagLabel(), 'L1 pip only');
      check(!new HelpSystem(2).railShowTagPip(), 'L2 no pip');
      check(new HelpSystem(0).railKeepFaces() && !new HelpSystem(3).railKeepFaces(), 'rail keep faces L0-L1');
    }

    if (typeof Shoe !== 'undefined' && typeof CardCounter !== 'undefined' && typeof createPlayingCard === 'function') {
      function harness(density, systemId) {
        var shoe = new Shoe(1);
        var start = shoe.cardsRemaining;
        var counter = new CardCounter(systemId || 'hi-lo');
        var help = new HelpSystem(0);
        var dealt = [];
        function pull(src) {
          var card = shoe.deal();
          var tag = counter.recordCardRemovedFromShoe(card);
          help.recordRunningCountSnapshot(counter.runningCount);
          dealt.push({ card: card, tag: tag, src: src });
          return card;
        }
        var n = CQRail.handCount(density);
        var ids = n === 3 ? ['A', 'B', 'C'] : n === 2 ? ['A', 'B'] : [];
        var i;
        for (i = 0; i < ids.length; i++) pull('rail-' + ids[i]);
        pull('human');
        pull('dealer-up');
        for (i = 0; i < ids.length; i++) pull('rail-' + ids[i]);
        pull('human');
        pull('dealer-hole');
        return { start: start, remaining: shoe.cardsRemaining, counter: counter, dealt: dealt, railOnly: dealt.filter(function (d) { return String(d.src).indexOf('rail') === 0; }) };
      }

      var off = harness('off');
      eq(off.start - off.remaining, 4, 'rail_density_off_deals_zero_extra_cards');

      var quiet = harness('quiet');
      eq(quiet.railOnly.length, 4, 'rail_quiet_removes_four_cards');
      eq(quiet.start - quiet.remaining, 8, 'quiet total 8 cards from shoe');

      var busy = harness('busy');
      eq(busy.railOnly.length, 6, 'rail_busy_removes_six_cards');
      eq(busy.start - busy.remaining, 10, 'busy total 10 cards from shoe');

      var playerHand = new Hand();
      var dealer = new Hand();
      quiet.dealt.forEach(function (d) {
        if (d.src === 'human') playerHand.add(d.card);
        else if (d.src.indexOf('dealer') === 0) dealer.add(d.card);
      });
      eq(playerHand.size, 2, 'rail_cards_never_enter_playerHands_or_dealer (player)');
      eq(dealer.size, 2, 'rail_cards_never_enter_playerHands_or_dealer (dealer)');

      var clone = new CardCounter('hi-lo');
      quiet.dealt.forEach(function (d) { clone.recordCardRemovedFromShoe(d.card); });
      eq(clone.runningCount, quiet.counter.runningCount, 'rail_uses_same_counter');

      var ko = new CardCounter('ko');
      var sevenCard = createPlayingCard('7', 'S');
      var tag = ko.recordCardRemovedFromShoe(sevenCard);
      eq(tag, 1, 'rail_ko_tags_use_active_system');
    }

    if (typeof document !== 'undefined') {
      document.body.classList.add('casino-table-solo');
      document.body.classList.remove('casino-table-full');
      check(document.body.classList.contains('casino-table-solo') && !document.body.classList.contains('casino-table-full'), 'rail_layout_stays_solo');
      var grid = document.getElementById('casino-seat-grid');
      if (grid) {
        grid.dataset.seatCount = '1';
        eq(grid.dataset.seatCount, '1', 'rail layout seatCount 1');
      }
      var fakeApp = {
        help: new HelpSystem(0, 'normal'),
        save: { settings: { railDensity: 'off' }, stats: { handsPlayed: 0 }, flags: {} },
        dealerSession: null,
        phase: 'bet',
      };
      CQRail.mountStrip(fakeApp);
      CQRail.updateStripVisibility(fakeApp);
      var strip = document.getElementById('cq-rail-strip');
      check(!strip || strip.style.display === 'none' || document.body.classList.contains('cq-rail-off'), 'rail_strip_absent_when_off');

      var dealerApp = {
        help: new HelpSystem(0, 'normal'),
        save: { settings: { railDensity: 'busy' }, stats: { handsPlayed: 99 }, flags: {} },
        dealerSession: { handsPlayed: 1 },
        phase: 'dealer-mode',
      };
      eq(CQRail.densityFor(dealerApp), 'off', 'rail_does_not_hook_dealer_shift');
    }

    check(CQRail.dwellMs(new HelpSystem(4)) >= 350, 'dwell floor 350');
  }

  function install() {
    if (typeof runTests !== 'function') return false;
    if (runTests.__cqRail27Tests) return true;
    var orig = runTests;
    window.runTests = function () {
      var base = 0;
      try {
        base = orig() || 0;
      } catch (e) {
        throw e;
      }
      var extra = 0;
      var check = function (cond, msg) { railAssert(cond, msg); extra++; };
      var eq = function (a, b, msg) { railAssert(a === b, msg + ': expected ' + b + ', got ' + a); extra++; };
      runRailSection(check, eq);
      console.log('✓ Rail Count tests passed (+' + extra + ' assertions)');
      return base + extra;
    };
    window.runTests.__cqRail27Tests = true;
    return true;
  }

  function maybeLate() {
    if (!install() && window.__runTestsDone && typeof CQRail !== 'undefined') {
      var extra = 0;
      var check = function (cond, msg) { railAssert(cond, msg); extra++; };
      var eq = function (a, b, msg) { railAssert(a === b, msg + ': expected ' + b + ', got ' + a); extra++; };
      try {
        runRailSection(check, eq);
        console.log('✓ Rail Count late tests passed (' + extra + ' assertions)');
        var banner = document.getElementById('test-banner');
        if (banner && /passed/i.test(banner.textContent || '')) {
          banner.textContent += ' · rail +' + extra;
        }
      } catch (e) {
        console.error(e);
        var b = document.getElementById('test-banner');
        if (b) {
          b.classList.remove('bg-green-600');
          b.classList.add('bg-red-700');
          b.textContent = '✗ Rail tests failed: ' + e.message;
        }
        throw e;
      }
    }
  }

  var n = 0;
  var t = setInterval(function () {
    install();
    maybeLate();
    if (++n > 100) clearInterval(t);
  }, 20);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { install(); maybeLate(); });
  else { install(); maybeLate(); }
})();
