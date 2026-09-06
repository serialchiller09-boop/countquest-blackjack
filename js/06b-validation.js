// §6b INPUT VALIDATION & SAFE GUARDS
// ═══════════════════════════════════════════════════════════════
const VALID_PLAYER_ACTIONS = new Set(['hit', 'stand', 'double', 'split', 'surrender']);

/**
 * Parse a whole-number form field with optional bounds.
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function parseBoundedInteger(rawValue, options = {}) {
  const {
    fieldName = 'Value',
    min = -Infinity,
    max = Infinity,
    required = true,
  } = options;
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    return required
      ? { ok: false, error: `${fieldName} is required` }
      : { ok: true, value: null };
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: `${fieldName} must be a whole number (no decimals)` };
  }
  const value = parseInt(trimmed, 10);
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${fieldName} is not a valid number` };
  }
  if (value < min || value > max) {
    return { ok: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { ok: true, value };
}

/** Running count guess — bounded by plausible Hi-Lo range for this shoe size. */
function validateRunningCountGuess(rawValue, shoe = null) {
  const decks = shoe?.numDecks || 6;
  const maxAbs = decks * 22 + 15;
  return parseBoundedInteger(rawValue, {
    fieldName: 'Running count',
    min: -maxAbs,
    max: maxAbs,
  });
}

/** Bet amount: positive integer, min bet, and bankroll cap (skipped in practice mode). */
function validateBetAmount(rawAmount, bankroll, minBet, options = {}) {
  const { practice = false } = options;
  const upper = practice ? 1_000_000 : Math.max(minBet, Math.floor(bankroll));
  const parsed = parseBoundedInteger(rawAmount, {
    fieldName: 'Bet',
    min: minBet,
    max: upper,
  });
  if (!parsed.ok) return parsed;
  if (!practice && parsed.value > bankroll) {
    return { ok: false, error: `Bet cannot exceed bankroll ($${bankroll.toLocaleString()})` };
  }
  return { ok: true, value: parsed.value };
}

/** Clamp and repair save data after load — prevents corrupt localStorage from crashing the app. */
function validateAndRepairSave(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Save data is missing or invalid' };
  }
  const repaired = migrateSave(data);
  if (!repaired.stats || typeof repaired.stats !== 'object') {
    repaired.stats = defaultStats();
  }
  const helpLevel = repaired.stats.helpLevel;
  if (!Number.isInteger(helpLevel) || helpLevel < 0 || helpLevel > 4) {
    repaired.stats.helpLevel = Math.max(0, Math.min(4, helpLevel | 0));
  }
  const bankroll = Number(repaired.bankroll);
  repaired.bankroll = Number.isFinite(bankroll) && bankroll >= 0
    ? Math.floor(bankroll)
    : defaultSave().bankroll;
  if (!repaired.settings) repaired.settings = defaultSave().settings;
  repaired.settings.minBet = Math.max(1, Math.floor(Number(repaired.settings.minBet) || 10));
  repaired.settings.unitSize = Math.max(1, Math.floor(Number(repaired.settings.unitSize) || 10));
  repaired.settings.numDecks = Math.max(1, Math.min(8, Math.floor(Number(repaired.settings.numDecks) || 6)));
  if (!Array.isArray(repaired.countingUnlocks)) repaired.countingUnlocks = ['hi-lo'];
  if (!repaired.countingUnlocks.includes('hi-lo')) repaired.countingUnlocks.unshift('hi-lo');
  const sys = repaired.settings.countingSystem || 'hi-lo';
  repaired.settings.countingSystem = COUNTING_SYSTEMS[sys] ? sys : 'hi-lo';
  if (!repaired.countingUnlocks.includes(repaired.settings.countingSystem)) {
    repaired.settings.countingSystem = 'hi-lo';
  }
  return { ok: true, value: repaired };
}

const Storage = {
  load() {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem('countquest-v1');
        if (legacy) raw = legacy;
      }
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const check = validateAndRepairSave(parsed);
      if (!check.ok) {
        console.warn('CountQuest: corrupt save discarded —', check.error);
        return null;
      }
      return check.value;
    } catch (err) {
      console.warn('CountQuest: failed to load save —', err);
      return null;
    }
  },
  save(data) {
    try {
      const check = validateAndRepairSave(data);
      if (!check.ok) throw new Error(check.error);
      check.value.version = SAVE_VERSION;
      localStorage.setItem(SAVE_KEY, JSON.stringify(check.value));
      localStorage.removeItem('countquest-v1');
      return { ok: true };
    } catch (err) {
      console.error('CountQuest: save failed —', err);
      return { ok: false, error: err.name === 'QuotaExceededError'
        ? 'Storage full — export stats then reset progress'
        : 'Could not save progress' };
    }
  },
  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('countquest-v1');
      localStorage.removeItem('cq.firstRunV1');
    } catch (err) {
      console.warn('CountQuest: reset failed —', err);
    }
  },
};
