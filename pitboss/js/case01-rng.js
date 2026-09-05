/**
 * Seeded RNG for Case 01 — mulberry32 + forks for replay-stable action noise.
 * Action randomness MUST use case seed + hand + seat, never Math.random().
 */
(function (global) {
  'use strict';

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mixSeed(base, ...parts) {
    let s = (base >>> 0) ^ 0x9e3779b9;
    for (const p of parts) {
      const v = typeof p === 'string' ? hashString(p) : (p >>> 0);
      s = Math.imul(s ^ v, 0x85ebca6b) >>> 0;
      s ^= s >>> 13;
    }
    return s >>> 0;
  }

  class Case01Rng {
    constructor(seed) {
      this.seed = (seed >>> 0) || 1;
      this._next = mulberry32(this.seed);
    }

    /** Uniform [0, 1) */
    random() {
      return this._next();
    }

    int(minInclusive, maxInclusive) {
      const lo = Math.min(minInclusive, maxInclusive);
      const hi = Math.max(minInclusive, maxInclusive);
      return lo + Math.floor(this.random() * (hi - lo + 1));
    }

    pick(arr) {
      if (!arr.length) return undefined;
      return arr[Math.floor(this.random() * arr.length)];
    }

    weightedPick(weightMap) {
      const keys = Object.keys(weightMap);
      let total = 0;
      for (const k of keys) total += weightMap[k];
      let r = this.random() * total;
      for (const k of keys) {
        r -= weightMap[k];
        if (r <= 0) return Number(k);
      }
      return Number(keys[keys.length - 1]);
    }

    shuffleInPlace(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }

    /** Child stream: caseSeed + label + optional hand/seat. */
    fork(...parts) {
      return new Case01Rng(mixSeed(this.seed, ...parts));
    }
  }

  function parseSeedFromQuery(search) {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    const raw = q.get('seed');
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n >>> 0;
    return hashString(String(raw));
  }

  global.Case01Rng = Case01Rng;
  global.case01Mulberry32 = mulberry32;
  global.case01MixSeed = mixSeed;
  global.case01ParseSeedFromQuery = parseSeedFromQuery;
})(typeof window !== 'undefined' ? window : globalThis);
