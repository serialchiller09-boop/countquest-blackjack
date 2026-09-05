/**
 * Pit Boss Case 01 — Five Seats
 * Tunable constants (spec §15). Do not scatter magic numbers.
 */
(function (global) {
  'use strict';

  const CASE01 = {
    caseId: 'case01_five_seats',
    title: 'Five Seats',
    dealerName: 'Margaret "Mags" Hawthorne',
    pitName: 'Grosvenor Victoria',
    shift: 'Swing shift',

    decks: 6,
    cutDecks: 1.5,
    cardsPerDeck: 52,
    minCallHand: 8,
    unitCash: 25,
    tableMaxUnits: 20,

    counterCap: 6,
    counterCoverChance: 0.18,
    counterCamouflageChance: 0.35,
    counterCamouflageHandMin: 3,
    counterCamouflageHandMax: 10,
    counterTipBjTc: 2,
    counterInsuranceTc: 3,
    counterStand16v10Tc: 0,
    counterStand15v10Tc: 4,

    hoverHands: 3,
    rerollIfCounterRBelow: 0.45,
    maxRerolls: 8,
    correlationMinHands: 6,

    speedsMs: [800, 1600, 2400],
    defaultSpeedIndex: 1,
    betHoldMs: 600,

    seatCount: 5,

    buyIn: {
      COUNTER: 40,
      LUCKY_TOURIST: 24,
      MARTINGALE: 32,
      CHATTER: 20,
      WHALE_LITE: 80,
      FLAT_BETTOR: 16,
    },

    archetypeLabels: {
      COUNTER: 'COUNTER',
      LUCKY_TOURIST: 'STREAK',
      MARTINGALE: 'MARTINGALE',
      CHATTER: 'CHATTER',
      WHALE_LITE: 'WHALE',
      FLAT_BETTOR: 'FLAT',
    },

    fillerPool: ['CHATTER', 'WHALE_LITE', 'FLAT_BETTOR'],
  };

  /** 20 display names. Never reuse Mags as a player. */
  const CASE01_NAME_POOL = [
    'Elena Voss',
    'Marcus Chen',
    'Priya Nair',
    'Tom Brennan',
    'Sofia Alvarez',
    'Jonah Pike',
    'Aisha Rahman',
    'Leo Hart',
    'Nina Kowalski',
    'Owen Blake',
    'Yuki Tanaka',
    'Carmen Ruiz',
    'Dev Patel',
    'Hannah Cole',
    'Sam Okonkwo',
    'Iris Novak',
    'Felix Grant',
    'Maya Singh',
    'Chris Doyle',
    'Lena Berg',
  ];

  global.CASE01 = CASE01;
  global.CASE01_NAME_POOL = CASE01_NAME_POOL;
})(typeof window !== 'undefined' ? window : globalThis);
