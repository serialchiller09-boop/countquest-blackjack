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
    } catch (err) {
      console.warn('CountQuest: reset failed —', err);
    }
  },
};

function defaultSave() {
  return {
    version: SAVE_VERSION, stats: defaultStats(), bankroll: 2500,
    chips: 2500, gems: 10,
    settings: {
      practiceMode: false, numDecks: 6, startingBankroll: 1000, minBet: 10, unitSize: 10,
      soundEnabled: true, theme: 'classic', rules: defaultRules(), countingSystem: 'hi-lo',
      showCountDisplay: true, showCountPopups: true,
    },
    uiHints: { shoeTermExplained: false, hardHandTips: 0 },
    countingUnlocks: ['hi-lo'],
    campaign: { chapter: 0, unlocks: ['classic'], goalsCompleted: [] },
    tutorial: { step: 0, completed: false },
    daily: { lastDate: '', challengeId: '', completed: false, progress: {} },
    dailyTraining: defaultDailyTraining(),
    dailyRewards: defaultDailyRewards(),
    vipPass: defaultVipPass(),
    drillSessionBests: defaultDrillSessionBests(),
    personalBests: defaultPersonalBests(),
    achievements: [],
    sessionActive: false, sessionHands: 0, sessionNetPL: 0,
    sessionMode: null, sessionDrill: null, sessionChapter: null, sessionTableTier: null,
    speedDrill: defaultSpeedDrillStats(),
    trueCountDrill: defaultTrueCountDrillStats(),
    combinedPractice: defaultCombinedPracticeStats(),
    trainingHistory: defaultTrainingHistory(),
    mistakeReviewLog: defaultMistakeReviewLog(),
    indexPlayDrill: defaultIndexPlayDrillStats(),
    betSpreadDrill: defaultBetSpreadDrillStats(),
    playerId: null,
    club: defaultClubMembership(),
    lobbyMinigames: defaultLobbyMinigames(),
    shopClaims: {},
    tournament: defaultTournament(),
    specialEvent: defaultSpecialEventProgress(),
    dealerMode: defaultDealerModeStats(),
    cardBurstDrill: defaultCardBurstDrillStats(),
    decksLeftDrill: defaultDecksLeftDrillStats(),
    lastSavedAt: null,
  };
}

function buildCountGuideHtml(systemId = 'hi-lo') {
  const sys = COUNTING_SYSTEMS[systemId] || COUNTING_SYSTEMS['hi-lo'];
  const low = [...sys.lowRanks].sort((a, b) => {
    const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return order.indexOf(a) - order.indexOf(b);
  }).join(' ');
  const neutral = [...sys.neutralRanks].join(' ');
  const pivot = getKoPivot(6);
  const betLine = sys.balanced
    ? `<p><strong class="text-emerald-200">True count</strong> = running count ÷ decks left in the shoe. Example: running count +6 with 3 decks left → true count +2. Bet a little more when true count is +1 or higher; stick to the minimum when it is 0 or negative.</p>`
    : `<p><strong class="text-emerald-200">Betting with KO:</strong> On a 6-deck shoe the key count is <strong class="text-emerald-200">+${pivot}</strong>. At or below the key, bet the minimum. Each +1 above the key, bet one step higher.</p>`;
  return `
  <details class="hilo-guide rounded-xl border border-emerald-700/30 bg-emerald-950/40 overflow-hidden">
    <summary class="px-4 py-3 text-sm font-semibold text-emerald-200 flex items-center justify-between gap-2">
      <span>📖 How to Count (${sys.shortName}) — beginner guide</span>
      <span class="chevron text-emerald-500/60">▼</span>
    </summary>
    <div class="px-4 pb-4 text-xs text-emerald-300/80 space-y-3 border-t border-emerald-800/30 pt-3">
      <p><strong class="text-emerald-200">What is the shoe?</strong> The shoe is the card dispenser on the table — it holds several decks mixed together. Cards are dealt from it until it is time to shuffle.</p>
      <p><strong class="text-emerald-200">Running count:</strong> Start at 0 after a shuffle. Each dealt card changes your count using the chart below — count every card, even ones you cannot see yet.</p>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-green-900/30 p-2 border border-green-700/30"><div class="text-green-400 font-bold">+1</div><div class="text-[10px]">Low cards<br>${low}</div></div>
        <div class="rounded-lg bg-slate-800/50 p-2 border border-slate-600/30"><div class="text-slate-300 font-bold">0</div><div class="text-[10px]">Middle cards<br>${neutral}</div></div>
        <div class="rounded-lg bg-red-900/30 p-2 border border-red-700/30"><div class="text-red-400 font-bold">−1</div><div class="text-[10px]">High cards<br>10 J Q K A</div></div>
      </div>
      ${betLine}
      <p class="text-emerald-500/60">You can switch counting systems later in Settings once KO is unlocked.</p>
    </div>
  </details>`;
}

/** Plain-English sentence explaining why the recommended bet was chosen. */
function recommendedBetWhyText(suggestion) {
  if (!suggestion) return '';
  if (suggestion.betMetricLabel === 'key') {
    const rc = suggestion.runningCount >= 0 ? `+${suggestion.runningCount}` : `${suggestion.runningCount}`;
    if (suggestion.abovePivot > 0) {
      return `Running count is ${rc} — ${suggestion.abovePivot} above the key (+${suggestion.pivot}). More high cards may remain, so a slightly larger bet is suggested.`;
    }
    return `Running count is ${rc}, at or below the key (+${suggestion.pivot}). A minimum-style bet is suggested until the count rises.`;
  }
  const tc = suggestion.trueCount;
  const ts = tc >= 0 ? `+${tc.toFixed(1)}` : tc.toFixed(1);
  if (tc >= 1) {
    return `True count is ${ts} — more high cards may be left in the shoe, giving you a small edge. That is why we suggest $${suggestion.amount} instead of the table minimum.`;
  }
  if (tc > 0) {
    return `True count is ${ts} — slightly positive but still low. A modest bet is suggested until the count climbs higher.`;
  }
  return `True count is ${ts} — no player edge right now. We suggest betting close to the table minimum until the count turns positive.`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Web Audio API — lightweight synthetic casino sounds (no external files). */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('cq-sound') !== 'false';
  }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('cq-sound', on ? 'true' : 'false');
  }
  tone(freq, dur, type = 'sine', vol = 0.08, slide = 0) {
    if (!this.enabled) return;
    try {
      this.init();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (_) { /* audio blocked until user gesture */ }
  }
  play(name) {
    switch (name) {
      case 'chip': this.tone(880, 0.06, 'square', 0.05); this.tone(1200, 0.04, 'square', 0.03); break;
      case 'card': this.tone(320, 0.08, 'triangle', 0.06, 180); break;
      case 'flip': this.tone(440, 0.1, 'sine', 0.07, -120); break;
      case 'win': this.tone(523, 0.12, 'sine', 0.07); setTimeout(() => this.tone(659, 0.15, 'sine', 0.07), 80); setTimeout(() => this.tone(784, 0.2, 'sine', 0.06), 160); break;
      case 'bigwin': this.tone(440, 0.1, 'sine', 0.08); [523,659,784,1047].forEach((f,i) => setTimeout(() => this.tone(f, 0.18, 'sine', 0.06), i * 90)); break;
      case 'loss': this.tone(330, 0.2, 'sawtooth', 0.05, -80); break;
      case 'count': this.tone(600, 0.05, 'sine', 0.04); break;
      case 'level': this.tone(392, 0.1, 'sine', 0.06); setTimeout(() => this.tone(523, 0.15, 'sine', 0.06), 100); setTimeout(() => this.tone(659, 0.2, 'sine', 0.05), 200); break;
      case 'tap': this.tone(520, 0.04, 'sine', 0.035); break;
      case 'whoosh': this.tone(280, 0.12, 'sine', 0.04, 320); break;
      case 'reward': this.tone(660, 0.08, 'sine', 0.05); setTimeout(() => this.tone(880, 0.1, 'sine', 0.04), 70); break;
      case 'sparkle': this.tone(1047, 0.06, 'triangle', 0.035); setTimeout(() => this.tone(1319, 0.05, 'triangle', 0.03), 50); break;
    }
  }
}
const Sounds = new SoundFX();

const PHASE_SCREEN_IDS = {
  menu: 'screen-menu', training: 'screen-training', 'training-history': 'screen-training-history',
  'training-mistakes': 'screen-training-mistakes', 'drill-session-summary': 'screen-drill-session-summary',
  'practice-range': 'screen-practice-range', tutorial: 'screen-tutorial', campaign: 'screen-campaign',
  daily: 'screen-daily', 'daily-rewards': 'screen-daily-rewards', 'table-lobby': 'screen-table-lobby',
  tournament: 'screen-tournament', 'special-event': 'screen-special-event', clubs: 'screen-clubs',
  'drill-count': 'screen-drill-count', 'drill-speed': 'screen-drill-speed',
  'drill-true-count': 'screen-drill-true-count', 'drill-index': 'screen-drill-index',
  'drill-bet-spread': 'screen-drill-bet-spread', 'drill-card-burst': 'screen-drill-card-burst',
  'drill-decks-left': 'screen-drill-decks-left', 'dealer-mode': 'screen-dealer-mode',
  bet: 'screen-casino-play', playing: 'screen-casino-play', handEnd: 'screen-casino-play',
};

function lobbyTapFeedback(kind = 'tap') {
  Sounds.init();
  Sounds.play(kind);
  if (navigator.vibrate) {
    try { navigator.vibrate(kind === 'whoosh' ? 12 : 8); } catch (_) { /* unsupported */ }
  }
}

function bumpCurrencyEl(el, newVal) {
  if (!el) return;
  const prev = el.dataset.lastVal;
  if (prev != null && prev !== String(newVal)) {
    el.classList.remove('currency-bump');
    void el.offsetWidth;
    el.classList.add('currency-bump');
  }
  el.dataset.lastVal = String(newVal);
}

function showModalPremium(id) {
  const d = document.getElementById(id);
  if (!d) return null;
  d.classList.add('dialog-premium');
  d.showModal();
  const onClose = () => d.classList.remove('dialog-premium');
  d.addEventListener('close', onClose, { once: true });
  return d;
}

// ═══════════════════════════════════════════════════════════════
