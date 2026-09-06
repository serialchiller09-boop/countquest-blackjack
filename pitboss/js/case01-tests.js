/**
 * Case 01 must-pass tests (spec §15 + success criteria).
 * Run with ?test=1 or Case01Tests.runAll() in console.
 */
(function (global) {
  'use strict';

  const results = [];

  function assert(name, cond, detail) {
    results.push({ name, pass: !!cond, detail: detail || '' });
    return !!cond;
  }

  function runExactlyOneCounter(samples) {
    let ok = 0;
    for (let i = 0; i < samples; i++) {
      const e = new Case01Engine({ seed: 1000 + i, simMode: true, helpLevel: 4 });
      const counters = e.seats.filter((s) => s.archetype === 'COUNTER');
      const tourists = e.seats.filter((s) => s.archetype === 'LUCKY_TOURIST');
      const marts = e.seats.filter((s) => s.archetype === 'MARTINGALE');
      if (counters.length === 1 && tourists.length === 1 && marts.length === 1) ok++;
    }
    assert('exactly_one_counter', ok === samples, `${ok}/${samples}`);
  }

  function runHoverFlattensOnlyCounter() {
    const seed = 424242;
    const e = new Case01Engine({ seed, helpLevel: 4, debug: true });
    // advance to hand where TC likely positive: play several hands then hover counter
    for (let i = 0; i < 6; i++) {
      e.beginBettingWindow();
      e.resolveHand();
    }
    const counter = e.getCounterSeat();
    const innocent = e.seats.find((s) => s.archetype !== 'COUNTER');
    // Measure mean bet when TC>=2 without hover — use history
    // Hover counter for 3 hands
    e.requestHover(counter.id);
    // force apply at betting
    const betsDuringHover = [];
    const innocentBets = [];
    for (let i = 0; i < 3; i++) {
      e.beginBettingWindow();
      betsDuringHover.push(counter.betUnits);
      innocentBets.push(innocent.betUnits);
      e.resolveHand();
    }
    const meanC = betsDuringHover.reduce((a, b) => a + b, 0) / betsDuringHover.length;
    // Counter should be flat at 1 during hover
    const counterFlat = betsDuringHover.every((b) => b === 1);
    // Innocent should not all be forced to 1 (whale/tourist/etc may vary but not forced flatten)
    const innocentNotForced = !(innocent.archetype !== 'COUNTER' && innocentBets.every((b) => b === 1) && innocent.archetype !== 'FLAT_BETTOR' && innocent.archetype !== 'MARTINGALE');
    // Stronger: only COUNTER has flatten flag
    const onlyCounterFlag = counter.flags.flattenedByHover || counterFlat;
    let otherFlattened = false;
    for (const s of e.seats) {
      if (s.archetype !== 'COUNTER' && s.flags.flattenedByHover) otherFlattened = true;
    }
    assert(
      'hover_flattens_only_counter',
      counterFlat && !otherFlattened,
      `counterBets=${betsDuringHover.join(',')} mean=${meanC.toFixed(2)} otherFlag=${otherFlattened}`
    );
  }

  function runShuffleResetsRc() {
    const e = new Case01Engine({ seed: 777, helpLevel: 1 });
    e.beginBettingWindow();
    e.resolveHand();
    e.beginBettingWindow();
    e.resolveHand();
    // consume some count
    const before = e.runningCount;
    e.phase = 'betting';
    e._doShuffle();
    assert('shuffle_resets_rc', e.runningCount === 0, `before=${before} after=${e.runningCount}`);
  }

  function runCannotCallBefore8() {
    const e = new Case01Engine({ seed: 99, helpLevel: 4 });
    let blocked = true;
    for (let i = 0; i < 7; i++) {
      e.beginBettingWindow();
      e.resolveHand();
      const r = e.backOff(e.seats[0].id);
      if (r.ok) blocked = false;
    }
    assert('cannot_call_before_8', blocked && e.handIndex === 7 && !e.canCall(), `hands=${e.handIndex}`);
    e.beginBettingWindow();
    e.resolveHand();
    assert('can_call_at_8', e.canCall(), `hands=${e.handIndex}`);
  }

  function runPeekPenalizes() {
    const e1 = new Case01Engine({ seed: 55, helpLevel: 4 });
    for (let i = 0; i < 8; i++) {
      e1.beginBettingWindow();
      e1.resolveHand();
    }
    const counter = e1.getCounterSeat();
    e1.backOff(counter.id);
    const d1 = Case01Dossier.buildDossier(e1);

    const e2 = new Case01Engine({ seed: 55, helpLevel: 4 });
    for (let i = 0; i < 8; i++) {
      e2.beginBettingWindow();
      e2.resolveHand();
    }
    e2.peekCount(e2.runningCount);
    e2.backOff(e2.getCounterSeat().id);
    const d2 = Case01Dossier.buildDossier(e2);
    assert('peek_penalizes', d2.score <= d1.score - 15, `noPeek=${d1.score} peek=${d2.score}`);
  }

  function runGraphHasFiveSeries() {
    const e = new Case01Engine({ seed: 12, helpLevel: 4 });
    for (let i = 0; i < 10; i++) {
      e.beginBettingWindow();
      e.resolveHand();
    }
    e.backOff(e.getCounterSeat().id);
    const d = Case01Dossier.buildDossier(e);
    const five = d.correlations.length === 5 && d.seats.length === 5;
    const allHaveHist = d.correlations.every((c) => c.history && c.history.length > 0);
    assert('graph_has_five_series', five && allHaveHist, `series=${d.correlations.length}`);
  }

  function runReplaySeed() {
    function first5Bets(seed) {
      const e = new Case01Engine({ seed, helpLevel: 4 });
      const out = [];
      for (let i = 0; i < 5; i++) {
        e.beginBettingWindow();
        out.push(e.seats.map((s) => s.betUnits).join(','));
        e.resolveHand();
      }
      return out.join('|');
    }
    const a = first5Bets(12345);
    const b = first5Bets(12345);
    const c = first5Bets(12346);
    assert('replay_seed', a === b && a !== c, `a===b:${a === b} a!==c:${a !== c}`);
  }

  function runWhalePenalty() {
    // Construct score difference via dossier math helpers with synthetic calls
    // Use same seed, back off whale vs flat if both present; else skip soft
    let found = false;
    for (let seed = 200; seed < 400 && !found; seed++) {
      const eW = new Case01Engine({ seed, helpLevel: 4 });
      const whale = eW.getWhaleSeat();
      const flat = eW.seats.find((s) => s.archetype === 'FLAT_BETTOR');
      if (!whale || !flat) continue;
      found = true;
      for (let i = 0; i < 10; i++) {
        eW.beginBettingWindow();
        eW.resolveHand();
      }
      // clone path: two engines same seed
      const eFlat = new Case01Engine({ seed, helpLevel: 4 });
      for (let i = 0; i < 10; i++) {
        eFlat.beginBettingWindow();
        eFlat.resolveHand();
      }
      eW.backOff(whale.id);
      eFlat.backOff(eFlat.seats.find((s) => s.archetype === 'FLAT_BETTOR').id);
      const sW = Case01Dossier.buildDossier(eW).scoreBeforeClamp;
      const sF = Case01Dossier.buildDossier(eFlat).scoreBeforeClamp;
      assert(
        'whale_wrong_backoff_penalty',
        sF - sW >= 25,
        `flatRaw=${sF} whaleRaw=${sW} delta=${sF - sW}`
      );
    }
    if (!found) {
      assert('whale_wrong_backoff_penalty', false, 'no seed with whale+flat in range');
    }
  }

  function runAll() {
    results.length = 0;
    runExactlyOneCounter(50);
    runHoverFlattensOnlyCounter();
    runShuffleResetsRc();
    runCannotCallBefore8();
    runPeekPenalizes();
    runGraphHasFiveSeries();
    runReplaySeed();
    runWhalePenalty();

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);
    const summary = {
      passed,
      failed: failed.length,
      total: results.length,
      results,
    };
    console.log('[Case01Tests]', summary);
    if (typeof document !== 'undefined') {
      let pre = document.getElementById('testResults');
      if (!pre) {
        pre = document.createElement('pre');
        pre.id = 'testResults';
        pre.style.cssText =
          'margin:1rem;padding:1rem;background:#111;color:#9f9;white-space:pre-wrap;font-size:12px';
        document.body.appendChild(pre);
      }
      pre.textContent = results
        .map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
        .join('\n');
      pre.style.color = failed.length ? '#f88' : '#9f9';
    }
    return summary;
  }

  global.Case01Tests = { runAll, results };

  if (typeof document !== 'undefined') {
    const boot = () => {
      if (new URLSearchParams(location.search).get('test') === '1') {
        runAll();
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
