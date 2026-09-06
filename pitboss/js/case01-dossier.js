/**
 * Case 01 dossier - score, leak, teachable lines, five-panel bet-vs-TC graph.
 */
(function (global) {
  'use strict';

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function computeLeak(engine) {
    const counter = engine.getCounterSeat();
    const callHand = engine.call ? engine.call.hand : engine.handIndex;
    let extra = 0;
    for (const h of counter.history) {
      if (h.hand > callHand) break;
      extra += Math.max(0, h.betUnits - 1);
    }
    return {
      extraUnitsExtracted: extra,
      leakCash: extra * CASE01.unitCash,
    };
  }

  function computeScore(engine) {
    const call = engine.call;
    let score = 0;
    const counter = engine.getCounterSeat();
    const leak = computeLeak(engine);
    const callHand = call.hand;
    const target =
      call.type === 'BACKOFF' ? engine.seats.find((s) => s.id === call.seatId) : null;
    const correct = call.type === 'BACKOFF' && target && target.archetype === 'COUNTER';

    if (call.type === 'BACKOFF' && target && target.archetype === 'COUNTER') {
      score += 100;
      if (callHand >= 8 && callHand <= 12) score += 30;
      else if (callHand >= 13 && callHand <= 18) score += 15;
      if (engine.cutCardReached) score -= 10;
    } else if (call.type === 'BACKOFF' && target && target.archetype !== 'COUNTER') {
      score -= 40;
      if (target.archetype === 'WHALE_LITE') score -= 25;
    } else if (call.type === 'PASS') {
      score -= 20;
    }

    score -= Math.min(30, Math.floor(leak.extraUnitsExtracted / 2));
    if (engine.peekUsed) score -= 15;
    if (engine.shuffleUsed && engine.tcAtShuffle != null && engine.tcAtShuffle < 1) score -= 8;
    if (
      engine.shuffleUsed &&
      engine.tcAtShuffle != null &&
      engine.tcAtShuffle >= 2 &&
      correct
    ) {
      score += 5;
    }
    if (
      engine.hoverUsed &&
      engine.hoverSeatId === counter.id &&
      correct
    ) {
      score += 5;
    }

    const scoreBeforeClamp = score;
    score = clamp(score, 0, 150);
    return { score, scoreBeforeClamp, leak, correct, target, counter };
  }

  function rankForScore(score) {
    if (score >= 120) return { rank: 'Clean pick', line: 'Quiet. Fast. That\'s the job.' };
    if (score >= 90) return { rank: 'Caught them', line: 'They\'re off the felt. Next time sooner.' };
    if (score >= 60) return { rank: 'Messy', line: 'Right seat or not, that was loud.' };
    if (score >= 30) return { rank: 'Whiff', line: null };
    return { rank: 'Heat', line: 'Go count a shoe in the back before you work my rail.' };
  }

  function teachableSentence(engine, meta) {
    const { correct, target, counter } = meta;
    const call = engine.call;
    const tourist = engine.seats.find((s) => s.archetype === 'LUCKY_TOURIST');
    const lines = [];

    if (call.type === 'PASS') {
      lines.push('Somebody here was buying extra tens. Pass is a tool. Not tonight.');
    } else if (correct) {
      if (engine.hoverUsed && engine.hoverSeatId === counter.id) {
        lines.push('They flattened when you stood behind them. Tourists don\'t do that.');
      } else if (engine.shuffleUsed && engine.tcAtShuffle != null && engine.tcAtShuffle >= 2) {
        lines.push('They hated the shuffle. That\'s an advantage player, not a streak.');
      } else if (call.hand <= 12) {
        lines.push(
          `The spread followed the true count. The heater at seat ${tourist ? tourist.id : '?'} was just a heater.`
        );
      } else {
        lines.push(
          `The spread followed the true count. The heater at seat ${tourist ? tourist.id : '?'} was just a heater.`
        );
      }
    } else if (target) {
      if (target.archetype === 'LUCKY_TOURIST') {
        lines.push(`Seat ${target.id} raised into a winning streak, not into tens. Look at the graph.`);
      } else if (target.archetype === 'MARTINGALE') {
        lines.push('That spread was doubling a loss. It does not care what left the shoe.');
      } else if (target.archetype === 'WHALE_LITE') {
        lines.push('Big is not the same as correlated. And now the shift manager knows your name.');
      } else if (target.archetype === 'CHATTER') {
        lines.push('Charts and tokes are costume. Watch the chips against the count.');
      } else if (target.archetype === 'FLAT_BETTOR') {
        lines.push('Quiet is not a tell. Flat bets ignore the count on purpose.');
      } else {
        lines.push('Wrong seat. The graph shows who paid for tens.');
      }
    }

    if (engine.peekUsed) {
      lines.push('You checked the book. Learn to live without it.');
    }
    return lines.join(' ');
  }

  function whiffLine(engine, meta) {
    if (engine.call.type === 'PASS') return 'You watched them get paid.';
    if (!meta.correct) return 'You pointed at a tourist.';
    return 'You watched them get paid.';
  }

  function buildDossier(engine) {
    const meta = computeScore(engine);
    const { score, leak, correct, target, counter } = meta;
    const rankInfo = rankForScore(score);
    let managerLine = rankInfo.line;
    if (rankInfo.rank === 'Whiff') managerLine = whiffLine(engine, meta);

    const call = engine.call;
    let callRow;
    if (call.type === 'PASS') {
      callRow = 'Call: PASS TABLE';
    } else {
      const label = correct ? 'COUNTER' : 'INNOCENT';
      callRow = `Call: Seat ${target.id} (${target.name}) - ${label}`;
    }

    const truthRow = `Truth: Seat ${counter.id} (${counter.name}) was counting. Cover: modest 1-6 Hi-Lo`;

    let hoverLine = 'Hover: not used';
    if (engine.hoverUsed) {
      const hs = engine.seats.find((s) => s.id === engine.hoverSeatId);
      const flat = hs && hs.archetype === 'COUNTER' && hs.flags.flattenedByHover;
      hoverLine = `Hover on seat ${engine.hoverSeatId} (${flat ? 'flattened' : 'no change'})`;
    }
    let shuffleLine = 'Shuffle: not used';
    if (engine.shuffleUsed) {
      const slumped = counter.flags.reactedToShuffle;
      shuffleLine = `Shuffle at TC=${engine.tcAtShuffle} (${slumped ? 'slumped' : 'no reaction'})`;
    }
    const peekLine = `Peek: ${engine.peekUsed ? 'yes' : 'no'}`;
    const toolsRow = `Tools: ${hoverLine}. ${shuffleLine}. ${peekLine}`;
    const burn = call.type === 'BACKOFF' && !correct;
    const civilianBurn = `Civilian burn: ${burn ? 'yes' : 'no'}`;

    const correlations = engine.seats.map((s) => {
      const hist = s.history.filter((h) => h.hand <= call.hand);
      if (hist.length < CASE01.correlationMinHands) {
        return { seatId: s.id, r: null, history: hist };
      }
      const xs = hist.map((h) => h.tcAtBet);
      const ys = hist.map((h) => h.betUnits);
      return { seatId: s.id, r: Case01Cards.pearsonR(xs, ys), history: hist };
    });

    return {
      score,
      scoreBeforeClamp: meta.scoreBeforeClamp,
      rank: rankInfo.rank,
      managerLine,
      callRow,
      truthRow,
      leakCash: leak.leakCash,
      leakUnits: leak.extraUnitsExtracted,
      toolsRow,
      civilianBurn,
      teachable: teachableSentence(engine, meta),
      correlations,
      seats: engine.seats,
      call,
      counterId: counter.id,
      accusedId: call.type === 'BACKOFF' ? call.seatId : null,
      seed: engine.seed,
    };
  }

  function formatR(r) {
    if (r == null || Number.isNaN(r)) return 'n/a';
    return (Math.round(r * 100) / 100).toFixed(2);
  }

  /**
   * Draw five-panel bet-vs-TC graph onto a canvas.
   */
  function drawBetVsTcGraph(canvas, dossier, options = {}) {
    if (!canvas) return;
    const showMarks = !!options.showMarks;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 420;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const pad = 8;
    const stacked = cssW < 500;
    const cols = stacked ? 1 : 5;
    const rows = stacked ? 5 : 1;
    const panelW = (cssW - pad * 2) / cols;
    const panelH = (cssH - 36) / rows;
    const xMin = -6;
    const xMax = 8;
    const yMin = 0;
    const yMax = 10;

    function xMap(tc, left) {
      return left + 28 + ((tc - xMin) / (xMax - xMin)) * (panelW - 36);
    }
    function yMap(bet, top) {
      return top + panelH - 28 - ((bet - yMin) / (yMax - yMin)) * (panelH - 44);
    }

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cssW, cssH);

    dossier.seats.forEach((seat, i) => {
      const col = stacked ? 0 : i;
      const row = stacked ? i : 0;
      const left = pad + col * panelW;
      const top = 4 + row * panelH;
      const corr = dossier.correlations[i];
      const hist = corr.history || [];
      const isAccused = dossier.accusedId === seat.id;
      const isCounter = seat.id === dossier.counterId;

      // panel bg
      ctx.fillStyle = '#161b22';
      ctx.fillRect(left + 2, top, panelW - 4, panelH - 4);
      if (isAccused) {
        ctx.strokeStyle = '#f0c040';
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 2, top, panelW - 4, panelH - 4);
      }

      // reference staircase
      ctx.strokeStyle = 'rgba(240,192,64,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let tc = xMin; tc <= xMax; tc++) {
        const y = tc <= 0 ? 1 : Math.min(6, 1 + tc);
        const px = xMap(tc, left);
        const py = yMap(y, top);
        if (tc === xMin) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // axes
      ctx.strokeStyle = '#30363d';
      ctx.beginPath();
      ctx.moveTo(xMap(xMin, left), yMap(0, top));
      ctx.lineTo(xMap(xMax, left), yMap(0, top));
      ctx.moveTo(xMap(0, left), yMap(yMin, top));
      ctx.lineTo(xMap(0, left), yMap(yMax, top));
      ctx.stroke();

      // connect line
      let color = '#6e7681';
      if (isCounter) color = '#f0c040';
      else if (isAccused) color = '#f85149';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hist.forEach((h, idx) => {
        const px = xMap(h.tcAtBet, left);
        const py = yMap(h.betUnits, top);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // dots
      hist.forEach((h) => {
        const px = xMap(h.tcAtBet, left);
        const py = yMap(h.betUnits, top);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // title
      const label = CASE01.archetypeLabels[seat.archetype] || seat.archetype;
      ctx.fillStyle = '#e6edf3';
      ctx.font = '11px system-ui,sans-serif';
      ctx.fillText(`Seat ${seat.id} · ${seat.name}`, left + 6, top + 14);
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(`r = ${formatR(corr.r)} · ${label}`, left + 6, top + 28);

      if (showMarks && seat.marks && seat.marks !== 'empty') {
        ctx.fillStyle = seat.marks === 'warm' ? '#f0c040' : '#58a6ff';
        ctx.fillText(seat.marks === 'warm' ? '▲' : '▼', left + panelW - 18, top + 14);
      }
    });

    ctx.fillStyle = '#8b949e';
    ctx.font = '11px system-ui,sans-serif';
    ctx.fillText('Same shoe. Same true count. Only one seat paid for tens.', pad, cssH - 10);

    // store hit regions for hover tooltips
    canvas._dossierHit = { dossier, panelW, pad, panelH, xMin, xMax, yMin, yMax, xMap, yMap, stacked };
  }

  function graphTooltipAt(canvas, clientX, clientY) {
    const hit = canvas._dossierHit;
    if (!hit) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const stacked = !!hit.stacked;
    let i;
    if (stacked) {
      i = Math.floor((y - 4) / hit.panelH);
    } else {
      i = Math.floor((x - hit.pad) / hit.panelW);
    }
    if (i < 0 || i > 4) return null;
    const seat = hit.dossier.seats[i];
    const corr = hit.dossier.correlations[i];
    const left = hit.pad + (stacked ? 0 : i) * hit.panelW;
    const top = 4 + (stacked ? i : 0) * hit.panelH;
    let best = null;
    let bestD = 12;
    for (const h of corr.history || []) {
      const px = hit.xMap(h.tcAtBet, left);
      const py = hit.yMap(h.betUnits, top);
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) return null;
    const tc = best.tcAtBet >= 0 ? `+${best.tcAtBet}` : `${best.tcAtBet}`;
    return `Hand ${best.hand} · TC ${tc} · ${best.betUnits} units · ${best.outcome}`;
  }

  global.Case01Dossier = {
    buildDossier,
    drawBetVsTcGraph,
    graphTooltipAt,
    computeScore,
    computeLeak,
    formatR,
  };
})(typeof window !== 'undefined' ? window : globalThis);
