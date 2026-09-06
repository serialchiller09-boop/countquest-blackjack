/**
 * Case 01 archetype bet brains — exact per PITBOSS_CASE01_SPEC §7.
 */
(function (global) {
  'use strict';

  const C = () => global.CASE01;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /**
   * Compute next bet in units for a seat.
   * @param {object} seat
   * @param {object} ctx { hand, tcAtBet, rcAtBet, rng, justShuffled, shuffleSlumpHands }
   */
  function computeArchetypeBet(seat, ctx) {
    const arch = seat.archetype;
    switch (arch) {
      case 'COUNTER':
        return betCounter(seat, ctx);
      case 'LUCKY_TOURIST':
        return betLuckyTourist(seat, ctx);
      case 'MARTINGALE':
        return betMartingale(seat, ctx);
      case 'CHATTER':
        return betChatter(seat, ctx);
      case 'WHALE_LITE':
        return betWhaleLite(seat, ctx);
      case 'FLAT_BETTOR':
        return betFlatBettor(seat, ctx);
      default:
        return 1;
    }
  }

  function betCounter(seat, ctx) {
    const cfg = C();
    const tc = ctx.tcAtBet | 0;
    const rng = ctx.rng;
    let bet;

    // First hand after any shuffle: always 1
    if (ctx.justShuffled) {
      bet = 1;
    } else if (seat.flags.hoveredHandsRemaining > 0) {
      bet = 1;
    } else if (ctx.shuffleSlumpHands > 0) {
      bet = 1;
    } else if (tc <= 0) {
      bet = 1;
    } else {
      bet = clamp(1 + tc, 1, cfg.counterCap);
    }

    // Cover: 18% of hands where raw bet >= 3, shave one unit
    if (bet >= 3 && rng.random() < cfg.counterCoverChance) {
      bet -= 1;
    }

    // Camouflage error, once, hands 3–10, only if tc <= 0
    const h = ctx.hand;
    if (
      !seat.flags.camouflageSpent &&
      h >= cfg.counterCamouflageHandMin &&
      h <= cfg.counterCamouflageHandMax &&
      tc <= 0 &&
      rng.random() < cfg.counterCamouflageChance
    ) {
      bet = 2;
      seat.flags.camouflageSpent = true;
    }

    return clamp(bet, 1, cfg.tableMaxUnits);
  }

  /** Raw counter policy without cover (for debug / staircase). */
  function counterRawWanted(tc, hovered, justShuffled, shuffleSlump) {
    const cap = C().counterCap;
    if (justShuffled || hovered || shuffleSlump) return 1;
    if (tc <= 0) return 1;
    return clamp(1 + tc, 1, cap);
  }

  function betLuckyTourist(seat, ctx) {
    const rng = ctx.rng;
    const hist = seat.history;
    let winsInARow = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const o = hist[i].outcome;
      if (o === 'win' || o === 'bj') winsInARow++;
      else break;
    }
    const last = hist.length ? hist[hist.length - 1] : null;
    const lastBet = last ? last.betUnits : 2;
    const lastOutcome = last ? last.outcome : null;

    let desired = 2;
    if (winsInARow >= 2) desired = rng.pick([4, 5, 6]);
    else if (lastBet >= 4 && lastOutcome === 'lose') desired = 2;
    else desired = 2;

    if (rng.random() < 0.10) desired = rng.pick([1, 3]);
    return desired;
  }

  function betMartingale(seat, ctx) {
    const hist = seat.history;
    const last = hist.length ? hist[hist.length - 1] : null;
    if (last && last.outcome === 'lose') {
      return Math.min(last.betUnits * 2, 8);
    }
    return 1;
  }

  function betChatter(seat, ctx) {
    return ctx.rng.random() < 0.12 ? 3 : 2;
  }

  function betWhaleLite(seat, ctx) {
    return ctx.rng.weightedPick({ 4: 0.35, 6: 0.35, 8: 0.20, 10: 0.10 });
  }

  function betFlatBettor() {
    return 2;
  }

  /**
   * Insurance decision.
   */
  function wantsInsurance(seat, tcAtBet, rng) {
    switch (seat.archetype) {
      case 'COUNTER':
        return tcAtBet >= C().counterInsuranceTc;
      case 'LUCKY_TOURIST':
      case 'FLAT_BETTOR':
        return false;
      case 'MARTINGALE':
        return rng.random() < 0.15;
      case 'CHATTER':
        return rng.random() < 0.40;
      case 'WHALE_LITE':
        return rng.random() < 0.25;
      default:
        return false;
    }
  }

  /**
   * Play noise / index deviations.
   * Returns preferred action override or null to use basic.
   * actions: 'H'|'S'|'D'|'P'
   */
  function playDecision(seat, basicAction, handInfo, tcAtBet, rng) {
    const { hardTotal, soft, isPair, dealerUpValue, canDouble, canSplit } = handInfo;

    // COUNTER soft deviations only
    if (seat.archetype === 'COUNTER') {
      if (!soft && !isPair && dealerUpValue === 10) {
        if (hardTotal === 16 && tcAtBet >= C().counterStand16v10Tc) {
          return { action: 'S', indexDeviation: true };
        }
        if (hardTotal === 15 && tcAtBet >= C().counterStand15v10Tc) {
          return { action: 'S', indexDeviation: true };
        }
      }
      return { action: basicAction, indexDeviation: false };
    }

    // Noise on hit/stand only (never weird doubles) for tourist/martingale/chatter
    if (seat.archetype === 'LUCKY_TOURIST') {
      if ((basicAction === 'H' || basicAction === 'S') && rng.random() < 0.15) {
        return { action: basicAction === 'H' ? 'S' : 'H', indexDeviation: false };
      }
    }
    if (seat.archetype === 'MARTINGALE') {
      // Hits 16 vs 10 too often
      if (!soft && hardTotal === 16 && dealerUpValue === 10 && rng.random() < 0.55) {
        return { action: 'H', indexDeviation: false };
      }
      if ((basicAction === 'H' || basicAction === 'S') && rng.random() < 0.25) {
        return { action: basicAction === 'H' ? 'S' : 'H', indexDeviation: false };
      }
    }
    if (seat.archetype === 'CHATTER') {
      if ((basicAction === 'H' || basicAction === 'S') && rng.random() < 0.20) {
        return { action: basicAction === 'H' ? 'S' : 'H', indexDeviation: false };
      }
    }
    if (seat.archetype === 'WHALE_LITE') {
      // Hits 18 sometimes (8%)
      if (!soft && hardTotal === 18 && rng.random() < 0.08) {
        return { action: 'H', indexDeviation: false };
      }
    }
    // FLAT_BETTOR: true basic
    return { action: basicAction, indexDeviation: false };
  }

  function tipsOnBlackjack(seat, tcAtBet) {
    if (seat.archetype === 'COUNTER') {
      return tcAtBet >= C().counterTipBjTc;
    }
    return false;
  }

  function chatterTipThisHand(seat, hand, rng) {
    if (seat.archetype !== 'CHATTER') return false;
    // every 4–6 hands
    const interval = 4 + Math.floor(rng.random() * 3); // 4,5,6
    return hand > 0 && hand % interval === 0;
  }

  global.Case01Archetypes = {
    computeArchetypeBet,
    counterRawWanted,
    wantsInsurance,
    playDecision,
    tipsOnBlackjack,
    chatterTipThisHand,
    clamp,
  };
})(typeof window !== 'undefined' ? window : globalThis);
