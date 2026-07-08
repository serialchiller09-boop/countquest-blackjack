// §1 CONSTANTS
// ═══════════════════════════════════════════════════════════════
const SAVE_KEY = 'countquest-v2';
const SAVE_VERSION = 18;

/** Plan 21 lobby — 8 Ball Pool production home (Clubs = dedicated left button) */
const LOBBY_NAV_ITEMS = [
  { id: 'training-aids', icon: '📖', label: 'Aids', action: 'tutorial', title: 'Training Aids' },
  { id: 'free-rewards', icon: '🎁', label: 'Free', action: 'daily-rewards', badge: 'reward', title: 'Free Rewards' },
  { id: 'leaderboards', icon: '🏆', label: 'Ranks', action: 'leaderboards', title: 'Leaderboards' },
  { id: 'shop', icon: '🛒', label: 'Shop', action: 'shop', title: 'Shop' },
];

const LOBBY_HERO_PLAY = { id: '1v1', title: 'Play', sub: '1v1 Tables — quick match', icon: '🎴', action: 'tables' };
const LOBBY_SECONDARY_LEFT = ['tournament', 'event'];
const LOBBY_SECONDARY_RIGHT = ['dealer', 'training'];

const LOBBY_PLAY_MODES = [
  { id: '1v1', title: '1v1 Tables', sub: 'Quick match — pay entry, beat the dealer', icon: '🎴', cls: 'lobby-play-1v1', action: 'tables' },
  { id: 'tournament', title: 'Tournaments', sub: 'High stakes brackets — Pro tier tables', icon: '🏆', cls: 'lobby-play-tournament', action: 'tournament' },
  { id: 'event', title: 'Special Event', sub: 'Daily challenge + rotating event tables', icon: '✨', cls: 'lobby-play-event', action: 'special-event' },
  { id: 'training', title: 'Training Drills', sub: 'Running count, true count, deviations, bet spread', icon: '🏋️', cls: 'lobby-play-training', action: 'training' },
  { id: 'dealer', title: 'Dealer Shift', sub: 'Run the table — payouts & count under pressure', icon: '🎰', cls: 'lobby-play-dealer', action: 'dealer-mode' },
  { id: 'friends', title: 'With Friends', sub: 'Counting Crews — invite code & crew chat', icon: '🤝', cls: 'lobby-play-friends', action: 'clubs' },
];

const LOBBY_MINIGAMES = [
  { id: 'surprise-box', icon: '📦', label: 'Surprise Box', key: 'box' },
  { id: 'spin-win', icon: '🎡', label: 'Spin & Win', key: 'spin' },
  { id: 'scratch-win', icon: '🎫', label: 'Scratch & Win', key: 'scratch' },
  { id: 'lucky-shot', icon: '🎯', label: 'Lucky Shot', key: 'lucky' },
];

const LOBBY_SPIN_SEGMENTS = [
  { label: '50 chips', chips: 50, weight: 30 },
  { label: '100 chips', chips: 100, weight: 25 },
  { label: '25 chips', chips: 25, weight: 20 },
  { label: '1 gem', chips: 0, gems: 1, weight: 8 },
  { label: '200 chips', chips: 200, weight: 10 },
  { label: 'Try again', chips: 0, weight: 7 },
];

function defaultLobbyMinigames() {
  return { lastDates: {}, spinUsed: false, scratchRevealed: [], luckyAnswer: null };
}

function playerLobbyLevel(save) {
  const st = save.stats || defaultStats();
  return Math.max(1, (st.rank || 0) + 1 + Math.floor((st.handsPlayed || 0) / 100));
}

function playerLobbyXpProgress(save) {
  const hands = save.stats?.handsPlayed || 0;
  const inLevel = hands % 100;
  return { pct: inLevel, current: inLevel, next: 100 };
}

let _lobbyPassTimerId = null;

function stopLobbyPassTimer() {
  if (_lobbyPassTimerId != null) {
    clearInterval(_lobbyPassTimerId);
    _lobbyPassTimerId = null;
  }
}

function formatPassCountdownLive(save) {
  if (isVipActive(save) && save.vipPass?.expiresAt) {
    const exp = new Date(save.vipPass.expiresAt + 'T23:59:59');
    const ms = exp - Date.now();
    if (ms <= 0) return '00:00:00';
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    return hrs >= 24
      ? `${Math.floor(hrs / 24)}d ${pad(hrs % 24)}:${pad(mins)}:${pad(secs)}`
      : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  if (canClaimDailyLogin(save)) return 'Reward ready!';
  const dr = save.dailyRewards;
  if (dr?.streak) return `🔥 ${dr.streak}-day streak`;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight - now;
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const pad = n => String(n).padStart(2, '0');
  return `Next in ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function startLobbyPassTimer(app) {
  stopLobbyPassTimer();
  const tick = () => {
    const el = document.getElementById('lobby-pass-timer');
    if (!el || app.phase !== 'menu') { stopLobbyPassTimer(); return; }
    el.textContent = formatPassCountdownLive(app.save);
  };
  tick();
  _lobbyPassTimerId = setInterval(tick, 1000);
}

function renderSpinWheelMarkup() {
  const n = LOBBY_SPIN_SEGMENTS.length;
  const slice = 360 / n;
  const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed'];
  const stops = LOBBY_SPIN_SEGMENTS.map((seg, i) => {
    const c = colors[i % colors.length];
    return `${c} ${i * slice}deg ${(i + 1) * slice}deg`;
  }).join(', ');
  return `<div class="lobby-spin-wheel-wrap">
    <div class="lobby-spin-pointer"></div>
    <div id="lobby-spin-wheel" class="lobby-spin-wheel" style="background:conic-gradient(${stops})"></div>
  </div>
  <p id="lobby-spin-result" class="text-xs text-amber-300/90 mt-2 min-h-[1rem]"></p>`;
}

function spinWheelToSegment(segIndex) {
  const wheel = document.getElementById('lobby-spin-wheel');
  if (!wheel) return Promise.resolve();
  const n = LOBBY_SPIN_SEGMENTS.length;
  const slice = 360 / n;
  const target = 360 * 5 + (360 - segIndex * slice - slice / 2);
  wheel.style.transform = `rotate(${target}deg)`;
  return new Promise(r => setTimeout(r, 3600));
}

function canPlayLobbyMinigame(save, key) {
  const lg = save.lobbyMinigames || defaultLobbyMinigames();
  const today = todayDateKey();
  return lg.lastDates?.[key] !== today;
}

function markLobbyMinigamePlayed(save, key) {
  if (!save.lobbyMinigames) save.lobbyMinigames = defaultLobbyMinigames();
  if (!save.lobbyMinigames.lastDates) save.lobbyMinigames.lastDates = {};
  save.lobbyMinigames.lastDates[key] = todayDateKey();
}

function pickWeightedSegment(segments) {
  const total = segments.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const seg of segments) {
    r -= seg.weight;
    if (r <= 0) return seg;
  }
  return segments[0];
}

function formatPassCountdown(save) {
  if (isVipActive(save) && save.vipPass?.expiresAt) {
    const exp = new Date(save.vipPass.expiresAt + 'T23:59:59');
    const now = new Date();
    const ms = exp - now;
    if (ms <= 0) return 'Expires soon';
    const days = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h left`;
  }
  if (canClaimDailyLogin(save)) return 'Reward ready!';
  const dr = save.dailyRewards;
  if (dr?.streak) return `🔥 ${dr.streak}-day streak`;
  return 'Claim daily reward';
}

/** Inline SVG logo — theme color via .cq-logo { currentColor } on body.theme-* */
function countQuestLogoMarkup(size = 42) {
  return `<svg class="logo cq-logo" width="${size}" height="${size}" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CountQuest">
  <circle cx="21" cy="21" r="19" stroke="currentColor" stroke-width="2.5"/>
  <rect x="12" y="11" width="18" height="20" rx="2" ry="2" fill="currentColor" opacity="0.15"/>
  <path d="M15 14 L21 20 L27 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="21" cy="26" r="3" fill="currentColor"/>
  <text x="21" y="23" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="currentColor">CQ</text>
</svg>`;
}
const PRACTICE_BANKROLL = 50_000;
const HELP_LABELS = ['Novice','Guided','Practice','Challenge','Expert'];
const HELP_DESC = [
  'Counts, strategy, and bet hints always on.',
  'Confirm count each hand; bet range; hints on mistakes.',
  'Count hidden in play; quiz after each hand.',
  'No in-play help; post-shoe report.',
  'Pure simulation; analytics at session end only.',
];
/** Shown on auto level-up — what changes for the player at each new help level. */
const HELP_LEVEL_WHATS_NEW = [
  '',
  '<strong>Count check</strong> before you bet each hand — proves you\'re tracking.',
  '<strong>Count hides</strong> during play. Post-hand quizzes train real casino conditions.',
  '<strong>Coaching off</strong> at the table. Detailed shoe analysis when the shoe ends.',
  '<strong>Expert mode</strong> — no hints until the session ends. You\'re on your own.',
];
const HELP_LEVEL_ENCOURAGEMENT = [
  '',
  'Great start — confirming the count builds discipline.',
  'This is where counters get sharp. Trust your head, not the HUD.',
  'Serious training begins here. Review every shoe report carefully.',
  'Welcome to the deep end. Bet sharp, play sharp, review everything.',
];
const MODE_LABELS = {
  tutorial: 'Tutorial',
  'practice-range': 'Practice Range',
  'training': 'Training Mode',
  'training-history': 'Training History',
  campaign: 'Full Campaign',
  daily: 'Daily Challenge',
  tables: 'Table Match',
  'special-event': 'Special Event',
  'dealer-mode': 'Dealer Mode',
  clubs: 'Counting Crews',
  drill: 'Drill',
};

/** Dual currency + ranked table tiers — foundation for economy features. */
const TABLE_WIN_MULTIPLIER = 1.8;
const TABLE_RAKE_FRACTION = 0.10;

const TABLE_TIERS = [
  {
    id: 'beginner', name: 'Beginner', icon: '🌱',
    entryFeeChips: 50, entryFeeGems: 0,
    minChips: 200, minHelpLevel: 0, minRank: 0,
    minBet: 10, maxBet: 100, unitSize: 10,
    desc: 'Low stakes — perfect for learning table flow and pot mechanics.',
    theme: 'classic',
  },
  {
    id: 'casual', name: 'Casual', icon: '🎲',
    entryFeeChips: 200, entryFeeGems: 0,
    minChips: 800, minHelpLevel: 0, minRank: 0,
    minBet: 25, maxBet: 500, unitSize: 25,
    desc: 'Comfortable blinds — build your bankroll with mid-stakes action.',
    theme: 'classic',
  },
  {
    id: 'high-roller', name: 'High Roller', icon: '🎰',
    entryFeeChips: 1000, entryFeeGems: 0,
    minChips: 5000, minHelpLevel: 0, minRank: 1,
    minBet: 100, maxBet: 2500, unitSize: 100,
    desc: 'Serious action — Apprentice rank and a deep bankroll required.',
    theme: 'neon',
  },
  {
    id: 'pro', name: 'Pro', icon: '👑',
    entryFeeChips: 5000, entryFeeGems: 1,
    minChips: 20000, minHelpLevel: 0, minRank: 2,
    minBet: 500, maxBet: 10000, unitSize: 500,
    desc: 'Elite tier — 1 gem + 5,000 chips entry. Expert rank required.',
    theme: 'monte',
  },
];

const RANK_NAMES = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];

function defaultWallet() {
  return { chips: 2500, gems: 10 };
}

function syncWalletSave(save) {
  if (save.chips == null) save.chips = save.bankroll ?? defaultWallet().chips;
  if (save.gems == null) save.gems = defaultWallet().gems;
  save.bankroll = save.chips;
  return save;
}

function getWallet(save) {
  syncWalletSave(save);
  return { chips: save.chips, gems: save.gems };
}

function addChips(save, amount) {
  syncWalletSave(save);
  save.chips += amount;
  save.bankroll = save.chips;
}

function addGems(save, amount) {
  syncWalletSave(save);
  save.gems += amount;
}

function getTableTier(tierId) {
  return TABLE_TIERS.find(t => t.id === tierId) || null;
}

/** Rotating weekly special-event tables — keyed by ISO week (clubWeekKey). */
const SPECIAL_EVENTS = [
  {
    id: 'count-rush',
    name: 'Count Rush',
    icon: '🔢',
    desc: 'Discounted Casual tables with boosted 2.1× win payouts.',
    baseTierId: 'casual',
    entryDiscount: 0.25,
    winMultiplier: 2.1,
    bonusGemsOnWin: 0,
    theme: 'neon',
    tagline: '25% off entry · 2.1× win',
  },
  {
    id: 'gem-vault',
    name: 'Gem Vault',
    icon: '💎',
    desc: 'High Roller event — win +1 gem on every victorious session.',
    baseTierId: 'high-roller',
    entryDiscount: 0.10,
    winMultiplier: 2.0,
    bonusGemsOnWin: 1,
    theme: 'monte',
    tagline: '10% off entry · +1 💎 per win',
  },
  {
    id: 'high-stakes-heat',
    name: 'High Stakes Heat',
    icon: '🔥',
    desc: 'Pro-tier adrenaline — elite blinds with a massive 2.2× payout.',
    baseTierId: 'pro',
    entryDiscount: 0.15,
    winMultiplier: 2.2,
    bonusGemsOnWin: 0,
    theme: 'monte',
    tagline: '15% off entry · 2.2× win',
  },
  {
    id: 'beginner-boost',
    name: 'Beginner Boost',
    icon: '🌱',
    desc: 'Half-price Beginner entry for new counters — 2.0× wins + bonus gem.',
    baseTierId: 'beginner',
    entryDiscount: 0.50,
    winMultiplier: 2.0,
    bonusGemsOnWin: 1,
    theme: 'classic',
    tagline: '50% off entry · 2.0× win · +1 💎',
  },
  {
    id: 'dealer-night',
    name: 'Dealer Night',
    icon: '🎰',
    eventType: 'dealer',
    desc: 'Run a dealer shift — 1.5× chip rewards and +2 gems for 95%+ payout accuracy.',
    rewardMultiplier: 1.5,
    bonusGemsOnShift: 2,
    bonusGemsThreshold: 95,
    tagline: '1.5× shift chips · +2 💎 for sharp dealers',
  },
];

function specialEventWeekIndex(d = new Date()) {
  const wk = clubWeekKey(d);
  const year = parseInt(wk.slice(0, 4), 10);
  const week = parseInt(wk.slice(6), 10);
  return (year * 53 + week) % SPECIAL_EVENTS.length;
}

function getCurrentSpecialEvent(d = new Date()) {
  return SPECIAL_EVENTS[specialEventWeekIndex(d)];
}

function getSpecialEventTier(event = getCurrentSpecialEvent()) {
  const base = getTableTier(event?.baseTierId);
  if (!base || !event) return null;
  const discount = event.entryDiscount || 0;
  return {
    ...base,
    id: `event-${event.id}`,
    name: `${event.name} Table`,
    entryFeeChips: Math.max(10, Math.round(base.entryFeeChips * (1 - discount))),
    entryFeeGems: event.entryGemsOverride ?? base.entryFeeGems,
    theme: event.theme || base.theme,
    desc: event.desc,
    _eventId: event.id,
  };
}

function defaultSpecialEventProgress() {
  return { weekKey: '', wins: 0, attempts: 0, gemsEarned: 0, dealerShifts: 0, dealerBestAcc: 0 };
}

function ensureSpecialEventProgress(save) {
  const wk = clubWeekKey();
  if (!save.specialEvent) save.specialEvent = defaultSpecialEventProgress();
  if (save.specialEvent.weekKey !== wk) {
    save.specialEvent = { weekKey: wk, wins: 0, attempts: 0, gemsEarned: 0, dealerShifts: 0, dealerBestAcc: 0 };
  }
  return save.specialEvent;
}

function formatSpecialEventCountdown() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const daysUntilSunday = 7 - day;
  const end = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 23, 59, 59,
  ));
  const ms = Math.max(0, end - now);
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h`;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(Math.floor((ms % 60000) / 1000))}`;
}

function getGlobalCrewLeaderboard(limit = 10) {
  const wk = clubWeekKey();
  return ClubsRegistry.getAll()
    .map(club => {
      ensureClubHubData(club);
      const total = club.weekly?.weekKey === wk ? (club.weekly.crewTotal || 0) : 0;
      return {
        id: club.id,
        name: club.name,
        memberCount: (club.members || []).length,
        crewTotal: total,
      };
    })
    .filter(c => c.crewTotal > 0)
    .sort((a, b) => b.crewTotal - a.crewTotal)
    .slice(0, limit);
}

const TOURNAMENT_BRACKET_SIZE = 8;
const TOURNAMENT_HANDS_PER_MATCH = 5;
const TOURNAMENT_MATCH_CHIPS = 3000;
const TOURNAMENT_TIER_ID = 'pro';
const TOURNAMENT_ROUND_LABELS = ['Quarterfinals', 'Semifinals', 'Final'];
const TOURNAMENT_PRIZES = {
  1: { chips: 25000, gems: 3, label: '🥇 Champion' },
  2: { chips: 10000, gems: 1, label: '🥈 Runner-up' },
  3: { chips: 5000, gems: 0, label: '🥉 Semifinalist' },
};
const TOURNAMENT_AI_NAMES = [
  'CardShark99', 'AceHunter', 'TrueCountPro', 'SplitMaster',
  'DealerSlayer', 'HiLoKing', 'MonteCarlo', 'KO_Crusher',
  'BetSpread42', 'IndexPlayer', 'Soft17Fan', 'DoubleDown',
];

function defaultTournament() {
  return {
    active: false,
    round: 1,
    bracket: [],
    contenders: [],
    playedMatches: [],
    results: [],
    playerSlotId: null,
    status: 'idle',
    placement: null,
    match: null,
    entryFee: 0,
    entryGems: 0,
    inviteCode: null,
    pendingInvite: null,
    stats: { played: 0, won: 0, bestPlacement: null },
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureTournament(save) {
  if (!save.tournament) save.tournament = defaultTournament();
  return save.tournament;
}

function getTournamentTier() {
  return getTableTier(TOURNAMENT_TIER_ID);
}

function canEnterTournament(save) {
  const tier = getTournamentTier();
  if (!tier) return { ok: false, reasons: ['Tournament unavailable'] };
  const check = canJoinTable(save, tier);
  if (!check.ok) return check;
  const t = ensureTournament(save);
  if (t.active) return { ok: false, reasons: ['Finish your current bracket first'] };
  return { ok: true, reasons: [] };
}

function payTournamentEntry(save) {
  const tier = getTournamentTier();
  if (!tier) return { ok: false, error: 'Tournament unavailable' };
  syncWalletSave(save);
  if (save.chips < tier.entryFeeChips) return { ok: false, error: `Need ${tier.entryFeeChips.toLocaleString()} chips` };
  if (save.gems < tier.entryFeeGems) return { ok: false, error: `Need ${tier.entryFeeGems} gem(s)` };
  save.chips -= tier.entryFeeChips;
  save.gems -= tier.entryFeeGems;
  save.bankroll = save.chips;
  return { ok: true, fee: tier.entryFeeChips, gems: tier.entryFeeGems };
}

function createTournamentBracket(save) {
  ensurePlayerId(save);
  const aiNames = shuffleArray(TOURNAMENT_AI_NAMES).slice(0, 7);
  const playerName = (save.stats?.playerName || 'Player').trim().slice(0, 12) || 'Player';
  const bracket = aiNames.map((name, i) => ({
    id: `ai_${i}_${Date.now().toString(36).slice(-4)}`,
    name,
    avatar: name.slice(0, 2).toUpperCase(),
    skill: 3 + Math.floor(Math.random() * 6),
    isPlayer: false,
    eliminated: false,
  }));
  const playerSlot = {
    id: save.playerId,
    name: playerName,
    avatar: playerName.slice(0, 2).toUpperCase(),
    skill: 8 + (save.stats?.helpLevel || 0),
    isPlayer: true,
    eliminated: false,
  };
  bracket.push(playerSlot);
  return shuffleArray(bracket);
}

function getBracketSlot(t, slotId) {
  return t.bracket.find(s => s.id === slotId) || null;
}

function tournamentMatchKey(aId, bId) {
  return [aId, bId].sort().join('|');
}

function tournamentPairContenders(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return pairs;
}

function simulateTournamentAIMatch(slotA, slotB) {
  const scoreA = slotA.skill * 22 + Math.floor(Math.random() * 90);
  const scoreB = slotB.skill * 22 + Math.floor(Math.random() * 90);
  return scoreA >= scoreB ? slotA.id : slotB.id;
}

function rollTournamentOpponentTarget(opponent, round) {
  const base = [70, 110, 150][Math.min(round - 1, 2)] || 70;
  return opponent.skill * 18 + base + Math.floor(Math.random() * 80) - 35;
}

function tournamentPlacementForRound(round, won) {
  if (won) return null;
  if (round >= 3) return 2;
  if (round >= 2) return 3;
  return 5;
}

function awardTournamentPrize(save, placement) {
  const prize = TOURNAMENT_PRIZES[placement];
  if (!prize) return null;
  if (prize.chips) addChips(save, prize.chips);
  if (prize.gems) addGems(save, prize.gems);
  return prize;
}

function simulateTournamentRoundAI(t) {
  const pairs = tournamentPairContenders(t.contenders);
  for (const [aId, bId] of pairs) {
    const key = tournamentMatchKey(aId, bId);
    if (t.playedMatches.includes(key)) continue;
    const a = getBracketSlot(t, aId);
    const b = getBracketSlot(t, bId);
    if (!a || !b) continue;
    if (a.isPlayer || b.isPlayer) continue;
    const winnerId = simulateTournamentAIMatch(a, b);
    const loserId = winnerId === aId ? bId : aId;
    t.playedMatches.push(key);
    t.results.push({ round: t.round, winnerId, loserId, simulated: true });
    const loser = getBracketSlot(t, loserId);
    if (loser) loser.eliminated = true;
    t.contenders = t.contenders.filter(id => id !== loserId);
  }
}

function getPlayerTournamentPairing(t) {
  const pairs = tournamentPairContenders(t.contenders);
  for (const [aId, bId] of pairs) {
    const key = tournamentMatchKey(aId, bId);
    if (t.playedMatches.includes(key)) continue;
    const a = getBracketSlot(t, aId);
    const b = getBracketSlot(t, bId);
    if (!a || !b) continue;
    if (a.isPlayer) return { aId, bId, opponent: b, key };
    if (b.isPlayer) return { aId, bId, opponent: a, key };
  }
  return null;
}

function buildClubInviteUrl(code) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('join', code);
  return url.toString();
}

function handleInviteDeepLink(app, params) {
  const code = params.get('join') || params.get('club');
  if (!code) return false;
  ensurePlayerId(app.save);
  const result = joinClubByInviteCode(app.save, code);
  if (result.ok) {
    app.persist();
    Sounds.play('level');
    app.toast(`Joined ${result.club.name} via invite link!`, 'level', 4500);
    app.clubsView = 'hub';
    app.openClubs();
    return true;
  }
  app.toast(result.error || 'Invalid invite link', 'error');
  app.openClubs();
  return true;
}

const TOURNAMENT_INVITE_REGISTRY_KEY = 'countquest-tournament-invites';
const TOURNAMENT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const TournamentInviteRegistry = {
  _cache: null,
  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(TOURNAMENT_INVITE_REGISTRY_KEY);
      this._cache = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this._cache)) this._cache = [];
    } catch {
      this._cache = [];
    }
    return this._cache;
  },
  save(invites) {
    this._cache = invites;
    try { localStorage.setItem(TOURNAMENT_INVITE_REGISTRY_KEY, JSON.stringify(invites)); } catch { /* quota */ }
  },
  getAll() { return this.load(); },
  getByCode(code) {
    const normalized = (code || '').trim().toUpperCase();
    return this.getAll().find(i => i.code === normalized) || null;
  },
  upsert(invite) {
    const invites = this.getAll();
    const idx = invites.findIndex(i => i.id === invite.id || i.code === invite.code);
    if (idx >= 0) invites[idx] = invite;
    else invites.push(invite);
    this.save(invites);
    return invite;
  },
  invalidate() { this._cache = null; },
};

function generateTournamentInviteCode(registry = TournamentInviteRegistry.getAll()) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let guard = 0;
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    guard += 1;
  } while (registry.some(i => i.code === code) && guard < 40);
  return code;
}

function buildTournamentInviteUrl(code) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('tournament', code);
  return url.toString();
}

function lookupTournamentInvite(code) {
  const invite = TournamentInviteRegistry.getByCode(code);
  if (!invite || invite.status !== 'open') return null;
  if (invite.expiresAt && invite.expiresAt < Date.now()) {
    invite.status = 'expired';
    TournamentInviteRegistry.upsert(invite);
    return null;
  }
  return invite;
}

function createTournamentInvite(save) {
  ensurePlayerId(save);
  const registry = TournamentInviteRegistry.getAll();
  const code = generateTournamentInviteCode(registry);
  const t = ensureTournament(save);
  const invite = {
    id: `tinv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    code,
    inviterId: save.playerId,
    inviterName: (save.stats?.playerName || 'Player').trim().slice(0, 24) || 'Player',
    createdAt: Date.now(),
    expiresAt: Date.now() + TOURNAMENT_INVITE_TTL_MS,
    status: 'open',
    acceptedBy: null,
    acceptedAt: null,
    tournamentActive: !!t.active,
  };
  TournamentInviteRegistry.upsert(invite);
  t.inviteCode = code;
  return { ok: true, invite, url: buildTournamentInviteUrl(code) };
}

function acceptTournamentInviteMeta(save, invite) {
  ensurePlayerId(save);
  if (!invite) return { ok: false, error: 'Invite not found' };
  if (invite.inviterId === save.playerId) return { ok: false, error: 'This is your own invite link' };
  invite.status = 'accepted';
  invite.acceptedBy = save.playerId;
  invite.acceptedAt = Date.now();
  TournamentInviteRegistry.upsert(invite);
  const t = ensureTournament(save);
  t.pendingInvite = {
    code: invite.code,
    inviterName: invite.inviterName,
    inviterId: invite.inviterId,
    acceptedAt: invite.acceptedAt,
  };
  return { ok: true, invite };
}

function handleTournamentInviteDeepLink(app, params) {
  const code = params.get('tournament') || params.get('tournament-invite');
  if (!code) return false;
  ensurePlayerId(app.save);
  const invite = lookupTournamentInvite(code);
  if (!invite) {
    app.toast('Tournament invite expired or invalid', 'error');
    app.openTournament();
    return true;
  }
  const result = acceptTournamentInviteMeta(app.save, invite);
  if (result.ok) {
    app.persist();
    Sounds.play('level');
    app.toast(`${invite.inviterName} invited you to a Pro Tournament!`, 'level', 5000);
    app.openTournament();
    return true;
  }
  app.toast(result.error || 'Invalid tournament invite', 'error');
  app.openTournament();
  return true;
}

function handleDeepLinks(app, params) {
  if (params.get('tournament') || params.get('tournament-invite')) {
    return handleTournamentInviteDeepLink(app, params);
  }
  if (params.get('join') || params.get('club')) {
    return handleInviteDeepLink(app, params);
  }
  return false;
}

function canJoinTable(save, tier) {
  syncWalletSave(save);
  const st = save.stats || defaultStats();
  const w = getWallet(save);
  const reasons = [];
  if (w.chips < tier.minChips) reasons.push(`Need ${tier.minChips.toLocaleString()} chips in bankroll`);
  if (w.chips < tier.entryFeeChips) reasons.push(`Entry costs ${tier.entryFeeChips.toLocaleString()} chips`);
  if (w.gems < tier.entryFeeGems) reasons.push(`Entry costs ${tier.entryFeeGems} gem${tier.entryFeeGems === 1 ? '' : 's'}`);
  if (st.helpLevel < tier.minHelpLevel) reasons.push(`Help Level ${tier.minHelpLevel}+ required`);
  if (st.rank < tier.minRank) reasons.push(`${RANK_NAMES[tier.minRank]}+ rank required`);
  return { ok: !reasons.length, reasons };
}

function payTableEntry(save, tier, opts = {}) {
  const feeChips = opts.entryFeeChips ?? tier.entryFeeChips;
  const feeGems = opts.entryFeeGems ?? tier.entryFeeGems;
  const effectiveTier = { ...tier, entryFeeChips: feeChips, entryFeeGems: feeGems };
  const check = canJoinTable(save, effectiveTier);
  if (!check.ok) return { ok: false, error: check.reasons[0], reasons: check.reasons };
  syncWalletSave(save);
  save.chips -= feeChips;
  save.gems -= feeGems;
  save.bankroll = save.chips;
  const pot = feeChips * 2;
  const rake = Math.round(pot * TABLE_RAKE_FRACTION);
  const multiplier = opts.winMultiplier ?? TABLE_WIN_MULTIPLIER;
  return {
    ok: true,
    pot,
    rake,
    playerAnte: feeChips,
    houseAnte: feeChips,
    winPayout: Math.round(feeChips * multiplier),
    winMultiplier: multiplier,
  };
}

function calcTableWinPayout(entryFee, multiplier = TABLE_WIN_MULTIPLIER) {
  return Math.round(entryFee * multiplier);
}

function settleTableSession(save, session) {
  if (!session?.tableTierId || session.tableEntryFee == null) return null;
  const entry = session.tableEntryFee;
  const multiplier = session.tableWinMultiplier ?? TABLE_WIN_MULTIPLIER;
  const pot = entry * 2;
  const payout = calcTableWinPayout(entry, multiplier);
  const rake = pot - payout;
  if (session.netPL > 0) {
    addChips(save, payout);
    const vipBonus = vipTableWinBonus(save, payout);
    if (vipBonus) addChips(save, vipBonus);
    const bonusGems = session.tableBonusGemsOnWin || 0;
    if (bonusGems) addGems(save, bonusGems);
    return {
      won: true, payout, vipBonus, bonusGems, pot, rake, entry, netPL: session.netPL, multiplier,
    };
  }
  return { won: false, payout: 0, bonusGems: 0, pot, rake, entry, netPL: session.netPL, multiplier };
}

function formatWalletShort(save) {
  const w = getWallet(save);
  return { chips: w.chips.toLocaleString(), gems: w.gems.toLocaleString() };
}

/** Counting Crews — local club registry (shared via browser localStorage). */
const CLUBS_REGISTRY_KEY = 'countquest-clubs-v1';
const CLUB_MAX_MEMBERS = 50;
const CLUB_NAME_MIN = 3;
const CLUB_NAME_MAX = 24;
const CLUB_DESC_MAX = 120;
const CLUB_GOAL_MAX = 80;
const CLUB_MAX_CO_LEADERS = 3;

const CLUB_ROLES = ['leader', 'co-leader', 'officer', 'member'];
const CLUB_ROLE_RANK = { leader: 0, 'co-leader': 1, officer: 2, member: 3 };
const CLUB_ROLE_LABELS = {
  leader: '👑 Leader',
  'co-leader': '⭐ Co-Leader',
  officer: '🛡 Officer',
  member: 'Member',
};
const CLUB_PERMISSIONS = {
  editClub: new Set(['leader', 'co-leader']),
  setGoals: new Set(['leader', 'co-leader']),
  promoteDemote: new Set(['leader', 'co-leader']),
  kick: new Set(['leader', 'co-leader', 'officer']),
  transferLeadership: new Set(['leader']),
};

function normalizeClubRole(role) {
  if (role === 'owner') return 'leader';
  if (CLUB_ROLE_RANK[role] != null) return role;
  return 'member';
}

function clubRoleRank(role) {
  return CLUB_ROLE_RANK[normalizeClubRole(role)] ?? 3;
}

function clubRoleLabel(role) {
  return CLUB_ROLE_LABELS[normalizeClubRole(role)] || CLUB_ROLE_LABELS.member;
}

function hasClubPermission(actorRole, permission) {
  const allowed = CLUB_PERMISSIONS[permission];
  return allowed ? allowed.has(normalizeClubRole(actorRole)) : false;
}

function canActOnMember(actorRole, targetRole) {
  return clubRoleRank(actorRole) < clubRoleRank(targetRole);
}

function getPromoteTarget(role) {
  const r = normalizeClubRole(role);
  if (r === 'member') return 'officer';
  if (r === 'officer') return 'co-leader';
  return null;
}

function getDemoteTarget(role) {
  const r = normalizeClubRole(role);
  if (r === 'co-leader') return 'officer';
  if (r === 'officer') return 'member';
  return null;
}

function countMembersWithRole(club, role) {
  return (club.members || []).filter(m => normalizeClubRole(m.role) === role).length;
}

function defaultClubGoal() {
  return { text: '', updatedAt: null, updatedBy: null };
}

function migrateClubRecord(club, allClubs) {
  if (!club) return club;
  club.leaderId = club.leaderId || club.ownerId || null;
  delete club.ownerId;
  if (!club.goal) club.goal = defaultClubGoal();
  club.members = (club.members || []).map(m => ({ ...m, role: normalizeClubRole(m.role) }));
  const leader = club.members.find(m => m.role === 'leader');
  if (leader) club.leaderId = leader.id;
  else if (club.members.length) {
    club.members[0].role = 'leader';
    club.leaderId = club.members[0].id;
  }
  ensureClubInviteCode(club, allClubs);
  ensureClubBankroll(club);
  if (!club.bankroll.chips && club.id === 'club_demo_aces') {
    club.bankroll.chips = 1200;
    club.bankroll.gems = 3;
  }
  ensureClubHubData(club);
  seedClubHubDemoData(club);
  return club;
}

function migrateAllClubs(clubs) {
  const list = clubs || [];
  return list.map(c => migrateClubRecord(c, list));
}

function sortClubMembers(members) {
  return [...(members || [])].sort((a, b) => {
    const dr = clubRoleRank(a.role) - clubRoleRank(b.role);
    if (dr !== 0) return dr;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
}

function pickNextLeader(members, excludeId) {
  for (const role of ['co-leader', 'officer', 'member']) {
    const cands = members
      .filter(m => m.id !== excludeId && normalizeClubRole(m.role) === role)
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    if (cands.length) return cands[0];
  }
  return null;
}

function getActorClubContext(save) {
  const club = getPlayerClub(save);
  if (!club || !save.club?.clubId) return { ok: false, error: 'Not in a crew' };
  const profile = getPlayerClubProfile(save);
  const actor = (club.members || []).find(m => m.id === profile.id);
  if (!actor) return { ok: false, error: 'You are not listed in this crew' };
  return { ok: true, club, actor, profile };
}

function canPromoteMember(actorRole, targetRole) {
  const actor = normalizeClubRole(actorRole);
  const target = normalizeClubRole(targetRole);
  if (!hasClubPermission(actor, 'promoteDemote')) return false;
  if (!canActOnMember(actor, target)) return false;
  const next = getPromoteTarget(target);
  if (!next) return false;
  if (next === 'co-leader' && actor !== 'leader') return false;
  if (actor === 'co-leader' && target !== 'member') return false;
  return true;
}

function canDemoteMember(actorRole, targetRole) {
  const actor = normalizeClubRole(actorRole);
  const target = normalizeClubRole(targetRole);
  if (!hasClubPermission(actor, 'promoteDemote')) return false;
  if (!canActOnMember(actor, target)) return false;
  if (!getDemoteTarget(target)) return false;
  if (actor === 'co-leader' && target === 'co-leader') return false;
  return true;
}

function canKickMember(actorRole, targetRole) {
  const actor = normalizeClubRole(actorRole);
  const target = normalizeClubRole(targetRole);
  if (!hasClubPermission(actor, 'kick')) return false;
  if (!canActOnMember(actor, target)) return false;
  if (actor === 'officer' && target !== 'member') return false;
  return true;
}

function defaultClubMembership() {
  return { clubId: null, role: null, joinedAt: null };
}

function ensurePlayerId(save) {
  if (!save.playerId) {
    save.playerId = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  return save.playerId;
}

function getPlayerClubProfile(save) {
  ensurePlayerId(save);
  const st = save.stats || defaultStats();
  return {
    id: save.playerId,
    displayName: ((st.playerName || 'Player').trim().slice(0, 20)) || 'Player',
    rank: st.rank ?? 0,
    helpLevel: st.helpLevel ?? 0,
  };
}

function validateClubName(name) {
  const t = (name || '').trim();
  if (t.length < CLUB_NAME_MIN) return { ok: false, error: `Name needs at least ${CLUB_NAME_MIN} characters` };
  if (t.length > CLUB_NAME_MAX) return { ok: false, error: `Name max ${CLUB_NAME_MAX} characters` };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\s\-_.]*$/.test(t)) {
    return { ok: false, error: 'Name: letters, numbers, spaces, - _ . only' };
  }
  return { ok: true, value: t };
}

function validateClubDescription(desc) {
  const t = (desc || '').trim();
  if (t.length > CLUB_DESC_MAX) return { ok: false, error: `Description max ${CLUB_DESC_MAX} characters` };
  return { ok: true, value: t };
}

function seedDemoClubsIfEmpty() {
  const now = Date.now();
  const demo = [
    {
      id: 'club_demo_aces',
      name: 'Ace Counters',
      description: 'Friendly crew grinding true count drills together.',
      visibility: 'public',
      leaderId: 'p_demo_owner_1',
      goal: { text: 'Hit 80%+ on speed count drills this week', updatedAt: now - 86400000, updatedBy: 'p_demo_owner_1' },
      members: [
        { id: 'p_demo_owner_1', displayName: 'ShoeMaster', rank: 2, helpLevel: 3, role: 'leader', joinedAt: now - 86400000 * 14 },
        { id: 'p_demo_cl', displayName: 'TrueCountAce', rank: 2, helpLevel: 3, role: 'co-leader', joinedAt: now - 86400000 * 10 },
        { id: 'p_demo_m1', displayName: 'RC_Swift', rank: 1, helpLevel: 2, role: 'officer', joinedAt: now - 86400000 * 7 },
        { id: 'p_demo_m2', displayName: 'SplitKing', rank: 1, helpLevel: 1, role: 'member', joinedAt: now - 86400000 * 3 },
      ],
      createdAt: now - 86400000 * 14,
    },
    {
      id: 'club_demo_ko',
      name: 'KO Knockouts',
      description: 'KO pivot enthusiasts — practice shoes and share tips.',
      visibility: 'public',
      leaderId: 'p_demo_owner_2',
      goal: { text: 'Complete 20 KO pivot hands as a crew', updatedAt: now - 86400000 * 2, updatedBy: 'p_demo_owner_2' },
      members: [
        { id: 'p_demo_owner_2', displayName: 'PivotPro', rank: 3, helpLevel: 3, role: 'leader', joinedAt: now - 86400000 * 30 },
        { id: 'p_demo_m3', displayName: 'KeyCount', rank: 2, helpLevel: 2, role: 'officer', joinedAt: now - 86400000 * 5 },
      ],
      createdAt: now - 86400000 * 30,
    },
  ];
  try { localStorage.setItem(CLUBS_REGISTRY_KEY, JSON.stringify(demo)); } catch { /* quota */ }
  return demo;
}

const ClubsRegistry = {
  _cache: null,
  load() {
    if (this._cache) return this._cache;
    let clubs;
    let raw = null;
    try {
      raw = localStorage.getItem(CLUBS_REGISTRY_KEY);
      if (!raw) {
        clubs = seedDemoClubsIfEmpty();
      } else {
        const parsed = JSON.parse(raw);
        clubs = Array.isArray(parsed) && parsed.length ? parsed : seedDemoClubsIfEmpty();
      }
    } catch {
      clubs = seedDemoClubsIfEmpty();
    }
    // Pin cache before migration — ensureClubInviteCode must not re-enter load().
    this._cache = clubs;
    const migrated = migrateAllClubs(clubs);
    this._cache = migrated;
    const serialized = JSON.stringify(migrated);
    if (!raw || raw !== serialized) {
      try { localStorage.setItem(CLUBS_REGISTRY_KEY, serialized); } catch { /* quota */ }
    }
    return this._cache;
  },
  save(clubs) {
    this._cache = clubs;
    try { localStorage.setItem(CLUBS_REGISTRY_KEY, JSON.stringify(clubs)); } catch { /* quota */ }
  },
  getAll() { return this.load(); },
  getById(id) { return this.getAll().find(c => c.id === id) || null; },
  upsert(club) {
    const clubs = this.getAll();
    const idx = clubs.findIndex(c => c.id === club.id);
    if (idx >= 0) clubs[idx] = club;
    else clubs.push(club);
    this.save(clubs);
    return club;
  },
  remove(id) { this.save(this.getAll().filter(c => c.id !== id)); },
  invalidate() { this._cache = null; },
};

function searchClubs(query) {
  const q = (query || '').trim().toLowerCase();
  return ClubsRegistry.getAll()
    .filter(c => c.visibility === 'public')
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))
    .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0) || a.name.localeCompare(b.name));
}

function syncMemberProfileInClub(club, save) {
  const profile = getPlayerClubProfile(save);
  const m = (club.members || []).find(x => x.id === profile.id);
  if (m) {
    m.displayName = profile.displayName;
    m.rank = profile.rank;
    m.helpLevel = profile.helpLevel;
  }
  return club;
}

function createClub(save, { name, description, visibility }) {
  if (save.club?.clubId) return { ok: false, error: 'Leave your current crew before creating a new one' };
  const nameCheck = validateClubName(name);
  if (!nameCheck.ok) return nameCheck;
  const descCheck = validateClubDescription(description);
  if (!descCheck.ok) return descCheck;
  const vis = visibility === 'private' ? 'private' : 'public';
  if (ClubsRegistry.getAll().some(c => c.name.toLowerCase() === nameCheck.value.toLowerCase())) {
    return { ok: false, error: 'A crew with that name already exists' };
  }
  const profile = getPlayerClubProfile(save);
  const club = {
    id: 'club_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: nameCheck.value,
    description: descCheck.value,
    visibility: vis,
    leaderId: profile.id,
    goal: defaultClubGoal(),
    hub: defaultClubHub(),
    weekly: defaultClubWeekly(clubWeekKey()),
    bankroll: defaultClubBankroll(),
    weeklyHistory: [],
    members: [{ ...profile, role: 'leader', joinedAt: Date.now() }],
    createdAt: Date.now(),
  };
  ensureClubInviteCode(club);
  ClubsRegistry.upsert(club);
  save.club = { clubId: club.id, role: 'leader', joinedAt: Date.now() };
  return { ok: true, club };
}

function joinClub(save, clubId) {
  if (save.club?.clubId) return { ok: false, error: 'Leave your current crew first' };
  const club = ClubsRegistry.getById(clubId);
  if (!club) return { ok: false, error: 'Crew not found' };
  const members = club.members || [];
  if (members.length >= CLUB_MAX_MEMBERS) {
    return { ok: false, error: `Crew is full (${CLUB_MAX_MEMBERS}/${CLUB_MAX_MEMBERS})` };
  }
  const profile = getPlayerClubProfile(save);
  const existing = members.find(m => m.id === profile.id);
  if (existing) {
    save.club = { clubId: club.id, role: existing.role, joinedAt: existing.joinedAt || Date.now() };
    syncMemberProfileInClub(club, save);
    ClubsRegistry.upsert(club);
    return { ok: true, club };
  }
  club.members = [...members, { ...profile, role: 'member', joinedAt: Date.now() }];
  ClubsRegistry.upsert(club);
  save.club = { clubId: club.id, role: 'member', joinedAt: Date.now() };
  return { ok: true, club };
}

function leaveClub(save) {
  const clubId = save.club?.clubId;
  if (!clubId) return { ok: false, error: 'You are not in a crew' };
  const club = ClubsRegistry.getById(clubId);
  const profile = getPlayerClubProfile(save);
  if (club) {
    const remaining = (club.members || []).filter(m => m.id !== profile.id);
    if (!remaining.length) {
      ClubsRegistry.remove(clubId);
    } else {
      if (normalizeClubRole(save.club.role) === 'leader' || club.leaderId === profile.id) {
        const next = pickNextLeader(club.members, profile.id);
        if (next) {
          next.role = 'leader';
          club.leaderId = next.id;
        }
      }
      club.members = remaining;
      ClubsRegistry.upsert(club);
    }
  }
  save.club = defaultClubMembership();
  return { ok: true };
}

function promoteClubMember(save, targetId) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  const target = (ctx.club.members || []).find(m => m.id === targetId);
  if (!target) return { ok: false, error: 'Member not found' };
  if (!canPromoteMember(ctx.actor.role, target.role)) {
    return { ok: false, error: 'You cannot promote this member' };
  }
  const next = getPromoteTarget(target.role);
  if (next === 'co-leader' && countMembersWithRole(ctx.club, 'co-leader') >= CLUB_MAX_CO_LEADERS) {
    return { ok: false, error: `Max ${CLUB_MAX_CO_LEADERS} Co-Leaders allowed` };
  }
  target.role = next;
  if (targetId === save.playerId) save.club.role = next;
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club, member: target, newRole: next };
}

function demoteClubMember(save, targetId) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  const target = (ctx.club.members || []).find(m => m.id === targetId);
  if (!target) return { ok: false, error: 'Member not found' };
  if (!canDemoteMember(ctx.actor.role, target.role)) {
    return { ok: false, error: 'You cannot demote this member' };
  }
  const next = getDemoteTarget(target.role);
  target.role = next;
  if (targetId === save.playerId) save.club.role = next;
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club, member: target, newRole: next };
}

function kickClubMember(save, targetId) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (targetId === ctx.profile.id) return { ok: false, error: 'Cannot kick yourself — use Leave Crew' };
  const target = (ctx.club.members || []).find(m => m.id === targetId);
  if (!target) return { ok: false, error: 'Member not found' };
  if (!canKickMember(ctx.actor.role, target.role)) {
    return { ok: false, error: 'You cannot kick this member' };
  }
  ctx.club.members = (ctx.club.members || []).filter(m => m.id !== targetId);
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club, kicked: target };
}

function transferClubLeadership(save, targetId) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (!hasClubPermission(ctx.actor.role, 'transferLeadership')) {
    return { ok: false, error: 'Only the Leader can transfer leadership' };
  }
  if (targetId === ctx.profile.id) return { ok: false, error: 'You are already the Leader' };
  const target = (ctx.club.members || []).find(m => m.id === targetId);
  if (!target) return { ok: false, error: 'Member not found' };
  ctx.actor.role = 'co-leader';
  target.role = 'leader';
  ctx.club.leaderId = target.id;
  save.club.role = 'co-leader';
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club, newLeader: target };
}

function updateClubInfo(save, { name, description, visibility, goalText } = {}) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (name != null || description != null || visibility != null) {
    if (!hasClubPermission(ctx.actor.role, 'editClub')) {
      return { ok: false, error: 'You cannot edit crew info' };
    }
  }
  if (name != null) {
    const nameCheck = validateClubName(name);
    if (!nameCheck.ok) return nameCheck;
    const dup = ClubsRegistry.getAll().some(
      c => c.id !== ctx.club.id && c.name.toLowerCase() === nameCheck.value.toLowerCase(),
    );
    if (dup) return { ok: false, error: 'A crew with that name already exists' };
    ctx.club.name = nameCheck.value;
  }
  if (description != null) {
    const descCheck = validateClubDescription(description);
    if (!descCheck.ok) return descCheck;
    ctx.club.description = descCheck.value;
  }
  if (visibility != null) {
    ctx.club.visibility = visibility === 'private' ? 'private' : 'public';
  }
  if (goalText != null) {
    if (!hasClubPermission(ctx.actor.role, 'setGoals')) {
      return { ok: false, error: 'You cannot set crew goals' };
    }
    const text = (goalText || '').trim().slice(0, CLUB_GOAL_MAX);
    ctx.club.goal = { text, updatedAt: Date.now(), updatedBy: ctx.profile.id };
  }
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club };
}

function getPlayerClub(save) {
  if (!save.club?.clubId) return null;
  const club = ClubsRegistry.getById(save.club.clubId);
  if (!club) {
    save.club = defaultClubMembership();
    return null;
  }
  const profile = getPlayerClubProfile(save);
  const me = (club.members || []).find(m => m.id === profile.id);
  const roleBefore = me ? normalizeClubRole(me.role) : null;
  const weekBefore = club.weekly?.weekKey;
  syncMemberProfileInClub(club, save);
  ensureClubHubData(club, save);
  if (me && save.club) save.club.role = normalizeClubRole(me.role);
  const profileChanged = me && (
    me.displayName !== profile.displayName
    || me.rank !== profile.rank
    || me.helpLevel !== profile.helpLevel
  );
  const weekRolled = weekBefore && club.weekly?.weekKey !== weekBefore;
  const roleChanged = me && roleBefore !== normalizeClubRole(me.role);
  if (profileChanged || weekRolled || roleChanged || club._pendingPlayerPayout) {
    ClubsRegistry.upsert(club);
  }
  return club;
}

function clubMemberCount(club) {
  return (club?.members || []).length;
}

function isClubFull(club) {
  return clubMemberCount(club) >= CLUB_MAX_MEMBERS;
}

/** Club Hub + Weekly Crew Championship */
const CLUB_CHAT_MAX = 60;
const CLUB_CHAT_MSG_MAX = 200;
const CLUB_ANNOUNCEMENT_MAX = 160;
const CLUB_CHAT_REACTIONS = ['👍', '🔥', '💯', '🃏', '⭐'];
const CLUB_WEEKLY_POINT_RULES = { hand: 5, handWin: 8, countCorrect: 15, trainingAccuracyMult: 0.5 };
const CLUB_WEEKLY_MILESTONES = [
  { at: 250, chips: 25, label: '250 crew pts' },
  { at: 500, chips: 50, label: '500 crew pts' },
  { at: 1000, chips: 100, gems: 1, label: '1000 crew pts' },
];
const CLUB_WEEKLY_TOP3_PAYOUTS = [
  { rank: 1, chips: 500, gems: 2, label: '🥇 1st place' },
  { rank: 2, chips: 300, gems: 1, label: '🥈 2nd place' },
  { rank: 3, chips: 150, gems: 0, label: '🥉 3rd place' },
];
const CLUB_BANKROLL_MIN_CONTRIBUTE = 10;
const CLUB_BANKROLL_LOG_MAX = 40;
const CLUB_INVITE_CODE_LENGTH = 6;
const CLUB_INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function defaultClubBankroll() {
  return { chips: 0, gems: 0, log: [] };
}

function generateClubInviteCode() {
  let code = '';
  for (let i = 0; i < CLUB_INVITE_CODE_LENGTH; i++) {
    code += CLUB_INVITE_CHARS[Math.floor(Math.random() * CLUB_INVITE_CHARS.length)];
  }
  return code;
}

function ensureClubInviteCode(club, allClubs = null) {
  if (!club.inviteCode) {
    const registry = allClubs || ClubsRegistry._cache || ClubsRegistry.getAll();
    let code;
    let attempts = 0;
    do {
      code = generateClubInviteCode();
      attempts += 1;
    } while (
      attempts < 50
      && registry.some(c => c.inviteCode === code && c.id !== club.id)
    );
    club.inviteCode = code;
  }
  return club.inviteCode;
}

function ensureClubBankroll(club) {
  if (!club.bankroll) club.bankroll = defaultClubBankroll();
  if (!club.bankroll.log) club.bankroll.log = [];
  return club.bankroll;
}

function appendClubBankrollLog(club, entry) {
  ensureClubBankroll(club);
  club.bankroll.log.unshift(entry);
  if (club.bankroll.log.length > CLUB_BANKROLL_LOG_MAX) {
    club.bankroll.log = club.bankroll.log.slice(0, CLUB_BANKROLL_LOG_MAX);
  }
}

function contributeToClubBankroll(save, { chips = 0, gems = 0 } = {}) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  const chipAmt = Math.max(0, Math.floor(chips));
  const gemAmt = Math.max(0, Math.floor(gems));
  if (!chipAmt && !gemAmt) return { ok: false, error: 'Enter chips or gems to contribute' };
  if (chipAmt && chipAmt < CLUB_BANKROLL_MIN_CONTRIBUTE) {
    return { ok: false, error: `Minimum ${CLUB_BANKROLL_MIN_CONTRIBUTE} chips per contribution` };
  }
  syncWalletSave(save);
  if (chipAmt && save.chips < chipAmt) return { ok: false, error: 'Not enough chips' };
  if (gemAmt && save.gems < gemAmt) return { ok: false, error: 'Not enough gems' };
  if (chipAmt) { save.chips -= chipAmt; save.bankroll = save.chips; }
  if (gemAmt) save.gems -= gemAmt;
  ensureClubBankroll(ctx.club);
  ctx.club.bankroll.chips += chipAmt;
  ctx.club.bankroll.gems += gemAmt;
  appendClubBankrollLog(ctx.club, {
    type: 'contribute',
    memberId: ctx.profile.id,
    memberName: ctx.profile.displayName,
    chips: chipAmt,
    gems: gemAmt,
    ts: Date.now(),
  });
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, chips: chipAmt, gems: gemAmt, bankroll: ctx.club.bankroll, club: ctx.club };
}

function distributeClubBankroll(save, targetMemberId, { chips = 0, gems = 0 } = {}) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (!hasClubPermission(ctx.actor.role, 'editClub')) {
    return { ok: false, error: 'Only Leaders and Co-Leaders can distribute from crew bankroll' };
  }
  const target = (ctx.club.members || []).find(m => m.id === targetMemberId);
  if (!target) return { ok: false, error: 'Member not found' };
  const chipAmt = Math.max(0, Math.floor(chips));
  const gemAmt = Math.max(0, Math.floor(gems));
  if (!chipAmt && !gemAmt) return { ok: false, error: 'Enter an amount to distribute' };
  ensureClubBankroll(ctx.club);
  if (chipAmt && ctx.club.bankroll.chips < chipAmt) {
    return { ok: false, error: `Crew bankroll only has ${ctx.club.bankroll.chips.toLocaleString()} chips` };
  }
  if (gemAmt && ctx.club.bankroll.gems < gemAmt) {
    return { ok: false, error: `Crew bankroll only has ${ctx.club.bankroll.gems} gems` };
  }
  ctx.club.bankroll.chips -= chipAmt;
  ctx.club.bankroll.gems -= gemAmt;
  if (targetMemberId === save.playerId) {
    if (chipAmt) addChips(save, chipAmt);
    if (gemAmt) addGems(save, gemAmt);
  }
  appendClubBankrollLog(ctx.club, {
    type: 'distribute',
    memberId: ctx.profile.id,
    memberName: ctx.profile.displayName,
    targetId: target.id,
    targetName: target.displayName,
    chips: chipAmt,
    gems: gemAmt,
    ts: Date.now(),
  });
  ClubsRegistry.upsert(ctx.club);
  return {
    ok: true,
    chips: chipAmt,
    gems: gemAmt,
    target,
    simulated: targetMemberId !== save.playerId,
    bankroll: ctx.club.bankroll,
    club: ctx.club,
  };
}

function joinClubByInviteCode(save, code) {
  const normalized = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < CLUB_INVITE_CODE_LENGTH) {
    return { ok: false, error: `Invite codes are ${CLUB_INVITE_CODE_LENGTH} characters` };
  }
  const club = ClubsRegistry.getAll().find(c => c.inviteCode === normalized);
  if (!club) return { ok: false, error: 'Invite code not found' };
  const joined = joinClub(save, club.id);
  if (joined.ok) joined.inviteCode = normalized;
  return joined;
}

function regenerateClubInviteCode(save) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (!hasClubPermission(ctx.actor.role, 'editClub')) {
    return { ok: false, error: 'Only Leaders and Co-Leaders can regenerate invite codes' };
  }
  const registry = ClubsRegistry.getAll();
  let code;
  let attempts = 0;
  do {
    code = generateClubInviteCode();
    attempts += 1;
  } while (
    attempts < 50
    && registry.some(c => c.inviteCode === code && c.id !== ctx.club.id)
  );
  ctx.club.inviteCode = code;
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, inviteCode: code, club: ctx.club };
}

function getWeeklyLeaderboardFromScores(club, memberScores) {
  return (club.members || []).map(m => {
    const weekly = memberScores[m.id] || defaultMemberWeeklyScore();
    return { ...m, weekly };
  }).sort((a, b) => (b.weekly.points || 0) - (a.weekly.points || 0));
}

function processWeeklyTop3Payouts(save, club, prevWeekly) {
  if (!prevWeekly || prevWeekly.payoutsAwardedTop3) return { payouts: [], playerPayout: null };
  prevWeekly.payoutsAwardedTop3 = true;
  ensureClubBankroll(club);
  const board = getWeeklyLeaderboardFromScores(club, prevWeekly.memberScores || {});
  const payouts = [];
  let playerPayout = null;
  for (let i = 0; i < Math.min(3, board.length); i++) {
    const member = board[i];
    const pts = member.weekly.points || 0;
    if (pts < 1) continue;
    const tier = CLUB_WEEKLY_TOP3_PAYOUTS[i];
    if (!tier) continue;
    const chipsPaid = tier.chips;
    const gemsPaid = tier.gems || 0;
    const fromBankChips = Math.min(club.bankroll.chips, chipsPaid);
    const fromBankGems = Math.min(club.bankroll.gems, gemsPaid);
    club.bankroll.chips -= fromBankChips;
    club.bankroll.gems -= fromBankGems;
    const houseChips = chipsPaid - fromBankChips;
    const houseGems = gemsPaid - fromBankGems;
    const entry = {
      weekKey: prevWeekly.weekKey,
      memberId: member.id,
      displayName: member.displayName,
      rank: tier.rank,
      label: tier.label,
      points: pts,
      chips: chipsPaid,
      gems: gemsPaid,
      fromBankChips,
      fromBankGems,
      houseChips,
      houseGems,
      ts: Date.now(),
    };
    payouts.push(entry);
    if (save && member.id === save.playerId) {
      addChips(save, chipsPaid);
      if (gemsPaid) addGems(save, gemsPaid);
      playerPayout = entry;
    }
    appendClubBankrollLog(club, {
      type: 'weekly_payout',
      memberId: member.id,
      memberName: member.displayName,
      rank: tier.rank,
      chips: chipsPaid,
      gems: gemsPaid,
      fromBankChips,
      fromBankGems,
      weekKey: prevWeekly.weekKey,
      ts: Date.now(),
    });
  }
  if (!club.weeklyHistory) club.weeklyHistory = [];
  club.weeklyHistory.unshift({
    weekKey: prevWeekly.weekKey,
    payouts,
    crewTotal: prevWeekly.crewTotal || 0,
    processedAt: Date.now(),
  });
  if (club.weeklyHistory.length > 12) club.weeklyHistory = club.weeklyHistory.slice(0, 12);
  return { payouts, playerPayout };
}

function clubWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function defaultClubHub() {
  return { chat: [], announcements: [] };
}

function defaultMemberWeeklyScore() {
  return { points: 0, hands: 0, countCorrect: 0, countTotal: 0, trainingPts: 0, playPts: 0, handPts: 0, countPts: 0 };
}

function defaultClubWeekly(weekKey) {
  return {
    weekKey,
    challenge: { text: 'Earn 500 crew points together this week', targetPoints: 500, setAt: Date.now(), setBy: null },
    memberScores: {},
    crewTotal: 0,
    milestonesAwarded: [],
    payoutsAwardedTop3: false,
  };
}

function ensureClubHubData(club, save = null) {
  if (!club.hub) club.hub = defaultClubHub();
  if (!club.hub.chat) club.hub.chat = [];
  if (!club.hub.announcements) club.hub.announcements = [];
  ensureClubInviteCode(club);
  ensureClubBankroll(club);
  const wk = clubWeekKey();
  if (!club.weekly || club.weekly.weekKey !== wk) {
    const prev = club.weekly;
    if (prev && prev.weekKey) {
      const payoutResult = processWeeklyTop3Payouts(save, club, prev);
      if (payoutResult.playerPayout) club._pendingPlayerPayout = payoutResult.playerPayout;
    }
    club.weekly = defaultClubWeekly(wk);
    if (club.goal?.text) {
      club.weekly.challenge.text = club.goal.text;
    }
  }
  return club;
}

function seedClubHubDemoData(club) {
  if (club.id !== 'club_demo_aces') return;
  if (!club.hub.announcements.length) {
    club.hub.announcements.push({
      id: 'ann_demo_1',
      authorId: 'p_demo_owner_1',
      authorName: 'ShoeMaster',
      text: 'Weekly Crew Championship is live — earn points from play, drills & count quizzes!',
      ts: Date.now() - 3600000,
    });
  }
  if (!club.hub.chat.length) {
    const now = Date.now();
    club.hub.chat.push(
      { id: 'chat_d1', authorId: 'p_demo_m1', authorName: 'RC_Swift', text: 'Just hit 85% on the speed drill 🔥', ts: now - 7200000, reactions: { '🔥': ['p_demo_owner_1'] } },
      { id: 'chat_d2', authorId: 'p_demo_owner_1', authorName: 'ShoeMaster', text: 'Nice work — keep stacking crew points this week!', ts: now - 3600000, reactions: { '👍': ['p_demo_m1', 'p_demo_m2'] } },
    );
  }
  const scores = club.weekly.memberScores;
  if (!scores.p_demo_owner_1) {
    scores.p_demo_owner_1 = { points: 156, hands: 14, countCorrect: 4, countTotal: 5, trainingPts: 42, playPts: 32, handPts: 70, countPts: 60 };
    scores.p_demo_cl = { points: 128, hands: 10, countCorrect: 3, countTotal: 4, trainingPts: 38, playPts: 24, handPts: 50, countPts: 45 };
    scores.p_demo_m1 = { points: 95, hands: 8, countCorrect: 2, countTotal: 3, trainingPts: 30, playPts: 16, handPts: 40, countPts: 30 };
    scores.p_demo_m2 = { points: 42, hands: 4, countCorrect: 1, countTotal: 2, trainingPts: 12, playPts: 8, handPts: 20, countPts: 15 };
    recomputeCrewWeeklyTotal(club);
  }
}

function getMemberWeeklyScore(club, memberId) {
  ensureClubHubData(club);
  if (!club.weekly.memberScores[memberId]) {
    club.weekly.memberScores[memberId] = defaultMemberWeeklyScore();
  }
  return club.weekly.memberScores[memberId];
}

function recomputeCrewWeeklyTotal(club) {
  ensureClubHubData(club);
  let total = 0;
  for (const id of Object.keys(club.weekly.memberScores)) {
    total += club.weekly.memberScores[id].points || 0;
  }
  club.weekly.crewTotal = total;
  return total;
}

function getClubWeeklyLeaderboard(club) {
  ensureClubHubData(club);
  return (club.members || []).map(m => {
    const weekly = club.weekly.memberScores[m.id] || defaultMemberWeeklyScore();
    return { ...m, weekly };
  }).sort((a, b) => (b.weekly.points || 0) - (a.weekly.points || 0));
}

function checkClubWeeklyRewards(save, club) {
  ensureClubHubData(club);
  const awarded = [];
  const total = club.weekly.crewTotal;
  for (const ms of CLUB_WEEKLY_MILESTONES) {
    const key = String(ms.at);
    if (total >= ms.at && !club.weekly.milestonesAwarded.includes(key)) {
      club.weekly.milestonesAwarded.push(key);
      addChips(save, ms.chips);
      if (ms.gems) addGems(save, ms.gems);
      awarded.push({ type: 'milestone', ...ms });
    }
  }
  return awarded;
}

function recordClubWeeklyActivity(save, type, data = {}) {
  if (!save.club?.clubId) return null;
  const club = ClubsRegistry.getById(save.club.clubId);
  if (!club) return null;
  ensureClubHubData(club, save);
  const pid = ensurePlayerId(save);
  const score = getMemberWeeklyScore(club, pid);
  let delta = 0;
  switch (type) {
    case 'hand':
      score.hands = (score.hands || 0) + 1;
      delta += CLUB_WEEKLY_POINT_RULES.hand;
      score.handPts = (score.handPts || 0) + CLUB_WEEKLY_POINT_RULES.hand;
      if (data.won) {
        delta += CLUB_WEEKLY_POINT_RULES.handWin;
        score.playPts = (score.playPts || 0) + CLUB_WEEKLY_POINT_RULES.handWin;
      }
      break;
    case 'countCorrect':
      score.countCorrect = (score.countCorrect || 0) + 1;
      score.countTotal = (score.countTotal || 0) + 1;
      delta += CLUB_WEEKLY_POINT_RULES.countCorrect;
      score.countPts = (score.countPts || 0) + CLUB_WEEKLY_POINT_RULES.countCorrect;
      break;
    case 'countWrong':
      score.countTotal = (score.countTotal || 0) + 1;
      break;
    case 'training':
      delta = Math.round((data.accuracy || 0) * CLUB_WEEKLY_POINT_RULES.trainingAccuracyMult);
      score.trainingPts = (score.trainingPts || 0) + delta;
      break;
    default:
      return null;
  }
  score.points = (score.points || 0) + delta;
  recomputeCrewWeeklyTotal(club);
  const rewards = checkClubWeeklyRewards(save, club);
  ClubsRegistry.upsert(club);
  return { delta, score, rewards, club };
}

function postClubChatMessage(save, text) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  const msg = (text || '').trim().slice(0, CLUB_CHAT_MSG_MAX);
  if (!msg) return { ok: false, error: 'Message cannot be empty' };
  ensureClubHubData(ctx.club);
  const entry = {
    id: 'chat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    authorId: ctx.profile.id,
    authorName: ctx.profile.displayName,
    text: msg,
    ts: Date.now(),
    reactions: {},
  };
  ctx.club.hub.chat.push(entry);
  if (ctx.club.hub.chat.length > CLUB_CHAT_MAX) {
    ctx.club.hub.chat = ctx.club.hub.chat.slice(-CLUB_CHAT_MAX);
  }
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, message: entry, club: ctx.club };
}

function reactClubChatMessage(save, messageId, emoji) {
  if (!CLUB_CHAT_REACTIONS.includes(emoji)) return { ok: false, error: 'Invalid reaction' };
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  ensureClubHubData(ctx.club);
  const msg = ctx.club.hub.chat.find(m => m.id === messageId);
  if (!msg) return { ok: false, error: 'Message not found' };
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const pid = ctx.profile.id;
  if (msg.reactions[emoji].includes(pid)) {
    msg.reactions[emoji] = msg.reactions[emoji].filter(id => id !== pid);
  } else {
    msg.reactions[emoji].push(pid);
  }
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, message: msg, club: ctx.club };
}

function postClubAnnouncement(save, text) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (!hasClubPermission(ctx.actor.role, 'setGoals')) {
    return { ok: false, error: 'Only Leaders and Co-Leaders can post announcements' };
  }
  const body = (text || '').trim().slice(0, CLUB_ANNOUNCEMENT_MAX);
  if (!body) return { ok: false, error: 'Announcement cannot be empty' };
  ensureClubHubData(ctx.club);
  const entry = {
    id: 'ann_' + Date.now().toString(36),
    authorId: ctx.profile.id,
    authorName: ctx.profile.displayName,
    text: body,
    ts: Date.now(),
  };
  ctx.club.hub.announcements.unshift(entry);
  if (ctx.club.hub.announcements.length > 10) {
    ctx.club.hub.announcements = ctx.club.hub.announcements.slice(0, 10);
  }
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, announcement: entry, club: ctx.club };
}

function setClubWeeklyChallenge(save, { text, targetPoints }) {
  const ctx = getActorClubContext(save);
  if (!ctx.ok) return ctx;
  if (!hasClubPermission(ctx.actor.role, 'setGoals')) {
    return { ok: false, error: 'You cannot set the weekly challenge' };
  }
  ensureClubHubData(ctx.club);
  const challengeText = (text || '').trim().slice(0, CLUB_GOAL_MAX);
  const target = Math.max(100, Math.min(5000, parseInt(targetPoints, 10) || 500));
  ctx.club.weekly.challenge = {
    text: challengeText || `Earn ${target} crew points together`,
    targetPoints: target,
    setAt: Date.now(),
    setBy: ctx.profile.id,
  };
  ctx.club.goal = { text: challengeText || ctx.club.weekly.challenge.text, updatedAt: Date.now(), updatedBy: ctx.profile.id };
  ClubsRegistry.upsert(ctx.club);
  return { ok: true, club: ctx.club };
}

function formatClubChatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['S','H','D','C'];
const SUIT_SYM = { S:'♠', H:'♥', D:'♦', C:'♣' };

const TIP_SHOE = 'The shoe is the card dispenser on the table — a box that holds several decks shuffled together. The dealer pulls cards from it.';
const TIP_RUNNING_COUNT = 'Your running total for this round. Low cards (2–6) add +1, high cards (10–Ace) subtract −1, and 7–9 add 0. You update it every time a card is dealt.';
const TIP_TRUE_COUNT = 'Running count divided by decks still in the shoe. A positive number means more big cards may be left — a small edge for you. Used to decide how much to bet.';
const TIP_DECKS_LEFT = 'How many full decks are still in the shoe (not yet dealt). Used to turn running count into true count.';
const TIP_CARDS_COUNTED = 'How many cards you have tracked so far this round. Every card dealt from the shoe counts — even ones you cannot see yet.';
const TIP_KEY_COUNT = 'A starting point number for KO counting. When running count is at or below this, bet the minimum.';
const TIP_ABOVE_KEY = 'How far your running count is above the key. The higher this is, the more the game suggests you bet.';
const COUNT_DELTA_TIP = 'This shows how one card changed the count. Low cards add +1, high cards add −1, middle cards (7–9) add 0.';

function formatCountChangeLabel(delta) {
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return `Count Change: ${sign}`;
}

function formatHandRunningCountReview(start, end) {
  const change = end - start;
  const changeText = change >= 0 ? `+${change}` : `${change}`;
  const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
  return `Running count: ${fmt(start)} → ${fmt(end)} (change ${changeText} this hand)`;
}

function formatHandRunningCountReviewCompact(start, end) {
  const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const delta = end - start;
  const d = delta >= 0 ? `+${delta}` : `${delta}`;
  return `RC ${fmt(start)}→${fmt(end)} (${d})`;
}

function formatHandEndReviewCompact(roundReview, counter, lastHand) {
  const parts = [];
  if (lastHand) {
    const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
    parts.push(lastHand.countOk
      ? `Count ✓ (${fmt(lastHand.guess)} vs ${fmt(lastHand.actual)})`
      : `Count ✗ (off ${Math.abs(lastHand.guess - lastHand.actual)})`);
  }
  const decisions = roundReview?.decisions || [];
  if (decisions.length) {
    const ok = decisions.filter(d => !d.mistake).length;
    parts.push(`Strategy ${ok}/${decisions.length}`);
  }
  if (roundReview?.bet != null) {
    parts.push(`Bet $${roundReview.bet}${roundReview.suggested != null ? ` (rec $${roundReview.suggested})` : ''}`);
  }
  if (roundReview && counter) {
    parts.push(formatHandRunningCountReviewCompact(roundReview.runningCountAtHandStart, counter.runningCount));
  }
  return parts.join(' · ');
}

function infoTipButton(tipText, label = 'Explain this') {
  const safe = tipText.replace(/"/g, '&quot;');
  return `<button type="button" class="info-tip" aria-label="${label}" title="${safe}" data-tip-text="${safe}">i</button>`;
}
// ── Hi-Lo rank groups (see §3 for how tags build running/true count) ──
/** Cards 2–6: +1 when dealt — removing lows leaves a ten-rich shoe (player-favorable). */
const HI_LO_LOW_RANKS = new Set(['2','3','4','5','6']);
/** Cards 7–9: 0 — neutral removal, no meaningful shift in composition. */
const HI_LO_NEUTRAL_RANKS = new Set(['7','8','9']);
/** Face cards for hand totals (Ace handled separately in Hand.value()). */
const TEN_VALUE_RANKS = new Set(['10','J','Q','K']);
const RANK_UNLOCKS = ['Full coaching.','Guided mode.','Count hidden in play.','Challenge mode.','Expert simulation.'];
const RANK_THRESHOLDS = [[0,0,0,0],[1,25,65,70],[2,100,75,80],[3,250,82,85],[4,500,88,90]];

const DEFAULT_RULES = {
  blackjackPayout: 1.5,
  das: true,
  lateSurrender: false,
  dealerHitsSoft17: true,
};

const THEMES = {
  classic: { name: 'Classic Vegas', bodyClass: 'theme-classic' },
  neon: { name: 'Neon Nights', bodyClass: 'theme-neon' },
  atlantic: { name: 'Atlantic Boardwalk', bodyClass: 'theme-atlantic' },
  monte: { name: 'Monte Carlo', bodyClass: 'theme-monte' },
};

const CAMPAIGN_CHAPTERS = [
  {
    id: 'classic', theme: 'classic', name: 'Classic Vegas', subtitle: 'Standard rules — learn the ropes',
    bankroll: 1000, rules: { ...DEFAULT_RULES },
    goals: [
      { id: 'c-count-75', label: '75% count accuracy (20+ guesses)', type: 'countAccuracy', target: 75, minGuesses: 20, unlock: 'neon' },
      { id: 'c-dec-80', label: '80% strategy accuracy (30+ decisions)', type: 'decisionAccuracy', target: 80, minDecisions: 30, unlock: 'atlantic' },
    ],
  },
  {
    id: 'neon', theme: 'neon', name: 'Neon Nights', subtitle: '6:5 blackjack — tougher payouts',
    bankroll: 1500, rules: { ...DEFAULT_RULES, blackjackPayout: 1.2 },
    goals: [
      { id: 'n-bank-1200', label: 'Reach $1,200 bankroll', type: 'bankroll', target: 1200, unlock: 'monte' },
      { id: 'n-shoes-3', label: 'Complete 3 shoes at 70%+ count', type: 'shoeCountPct', target: 70, shoes: 3, unlock: null },
    ],
  },
  {
    id: 'atlantic', theme: 'atlantic', name: 'Atlantic Boardwalk', subtitle: 'Late surrender enabled',
    bankroll: 2000, rules: { ...DEFAULT_RULES, lateSurrender: true },
    goals: [
      { id: 'a-acc-85', label: '85% recent count accuracy (50 hands)', type: 'recentCount', target: 85, unlock: null },
    ],
  },
  {
    id: 'monte', theme: 'monte', name: 'Monte Carlo', subtitle: 'No DAS — splits are final',
    bankroll: 2500, rules: { ...DEFAULT_RULES, das: false, dealerHitsSoft17: false },
    goals: [
      { id: 'm-profit-500', label: 'Session profit +$500', type: 'sessionProfit', target: 500, unlock: null },
    ],
  },
];

const TUTORIAL_STEPS = [
  { title: 'Welcome to CountQuest', body: 'You will learn Hi-Lo counting, basic strategy, and bet sizing — the three pillars of advantage play. Take your time; each step builds on the last.', demo: null },
  {
    title: 'How to Count',
    countExplanation: true,
    demo: '5♠ → +1  |  10♥ → −1  |  8♦ → 0  |  running count +6 ÷ 3 decks = true count +2.0',
  },
  { title: 'Bet Sizing', systemBetSizing: true, demo: 'True count +3 → ~4 units ($40 at $10/unit)' },
  { title: 'Basic Strategy', body: 'Counting tells you when to bet big; basic strategy tells you how to play each hand. Use the strategy chart (header button) until plays feel automatic.', demo: '16 vs 6 → Stand (dealer likely busts)' },
  { title: 'Ready to Play', body: 'Start in Practice Range drills to isolate skills, or jump into Full Campaign. Pick any help level (Novice through Expert) in Settings whenever you want.', demo: null, final: true },
];

/**
 * Training Mode drill catalog — single source of truth for the training hub.
 * status: 'live' = playable now · 'soon' = placeholder for future implementation
 * launch: drill id passed to startSession / openSpeedDrill when status is 'live'
 */
const TRAINING_DRILLS = [
  { id: 'count-speed', category: 'Counting', name: 'Running Count Speed Drill', desc: 'Auto-dealt cards at your chosen pace — test Hi-Lo speed.', icon: '⚡', status: 'live', launch: 'count-speed' },
  { id: 'count-shoe', category: 'Counting', name: 'Count This Shoe', desc: 'Deal through a shoe and quiz your running count at the end.', icon: '🔢', status: 'live', launch: 'count-shoe' },
  { id: 'decisions', category: 'Strategy', name: 'Decision Drills', desc: 'Random hands — perfect basic strategy without count distractions.', icon: '🎯', status: 'live', launch: 'decisions' },
  { id: 'betting', category: 'Betting', name: 'Bet Sizing Drill', desc: 'See the count, pick the right bet — no hand play required.', icon: '💰', status: 'live', launch: 'betting' },
  { id: 'true-count', category: 'Counting', name: 'True Count Conversion Drill', desc: 'Running count ÷ decks left — speed math with instant feedback.', icon: '📐', status: 'live', launch: 'true-count' },
  { id: 'combined', category: 'Combined', name: 'Combined Practice', desc: 'Play real hands — keep the running count and make basic strategy decisions.', icon: '🃏', status: 'live', launch: 'combined' },
  { id: 'card-bursts', category: 'Counting', name: 'Card Burst Drill', desc: 'Count small groups of cards dealt in rapid bursts.', icon: '🎴', status: 'live', launch: 'card-bursts' },
  { id: 'decks-left', category: 'Counting', name: 'Decks Remaining Quiz', desc: 'Estimate how many decks are left in the shoe.', icon: '📊', status: 'live', launch: 'decks-left' },
  { id: 'bet-ramp', category: 'Betting', name: 'Bet Spread Practice', desc: 'True count → bet size. Ramp 1–12 units with coaching on every round.', icon: '📈', status: 'live', launch: 'bet-spread' },
  { id: 'index-plays', category: 'Strategy', name: 'Index Play Drill', desc: 'Hi-Lo index plays — deviate from basic strategy at the right true count.', icon: '🧠', status: 'live', launch: 'index-plays' },
  { id: 'dealer-mode', category: 'Combined', name: 'Dealer Mode', desc: 'Run the table — evaluate hands, pay players, and track the count under pressure.', icon: '🎰', status: 'live', launch: 'dealer-mode' },
];

/** @deprecated Use TRAINING_DRILLS filtered by status === 'live' — kept for Practice Range parity */
const PRACTICE_DRILLS = TRAINING_DRILLS.filter(d => d.status === 'live').map(d => ({
  id: d.launch || d.id,
  name: d.name,
  desc: d.desc,
  icon: d.icon,
}));

const SPEED_DRILL_MS = { slow: 1200, normal: 700, fast: 350 };
const SPEED_DRILL_CARD_OPTIONS = [20, 40, 60];

const CARD_BURST_MS = { slow: 500, normal: 300, fast: 150 };
const CARD_BURST_SIZES = [3, 4, 5];
const CARD_BURST_ROUND_OPTIONS = [5, 8, 10];

const DECKS_LEFT_SHOE_OPTIONS = [6, 8];
const DECKS_LEFT_ROUND_OPTIONS = [8, 10, 12];
const DECKS_LEFT_TOLERANCE_OPTIONS = [0.25, 0.5];

const TRAINING_HISTORY_LIMIT = 200;

function defaultTrainingHistory() {
  return { sessions: [], migrated: false };
}

/** Unified training session log — expandable for charts and richer meta later. */
function recordTrainingHistorySession(save, drillId, stats, opts = {}) {
  if (!save.trainingHistory) save.trainingHistory = defaultTrainingHistory();
  const session = {
    id: opts.id || `th-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    drillId,
    ts: opts.ts || Date.now(),
    attempts: stats.attempts ?? 1,
    accuracy: stats.accuracy ?? 0,
    avgError: stats.avgError ?? 0,
    meta: stats.meta || {},
  };
  save.trainingHistory.sessions.unshift(session);
  if (save.trainingHistory.sessions.length > TRAINING_HISTORY_LIMIT) {
    save.trainingHistory.sessions.length = TRAINING_HISTORY_LIMIT;
  }
  return session;
}

function getTrainingHistorySessions(save, drillId = null) {
  const all = save.trainingHistory?.sessions || [];
  if (!drillId || drillId === 'all') return all;
  return all.filter(s => s.drillId === drillId);
}

function trainingHistoryDrillLabel(drillId) {
  const entry = TRAINING_DRILLS.find(d => d.id === drillId || d.launch === drillId);
  return entry ? `${entry.icon} ${entry.name}` : drillId;
}

function formatTrainingHistoryWhen(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Compare recent vs earlier sessions for a simple improvement readout. */
function summarizeTrainingHistoryTrend(sessions) {
  if (!sessions?.length) {
    return { count: 0, recentAvg: null, earlierAvg: null, delta: null, improving: null, avgErrorRecent: null };
  }
  const sorted = [...sessions].sort((a, b) => a.ts - b.ts);
  const bucket = Math.min(5, Math.max(1, Math.floor(sorted.length / 2)));
  const earlier = sorted.slice(0, bucket);
  const recent = sorted.slice(-bucket);
  const avgAcc = (arr) => Math.round(arr.reduce((a, s) => a + (s.accuracy || 0), 0) / arr.length);
  const recentAvg = avgAcc(recent);
  const earlierAvg = sorted.length > bucket ? avgAcc(earlier) : null;
  const delta = earlierAvg !== null ? recentAvg - earlierAvg : null;
  const avgErrorRecent = Math.round(recent.reduce((a, s) => a + (s.avgError || 0), 0) / recent.length * 10) / 10;
  return {
    count: sorted.length,
    recentAvg,
    earlierAvg,
    delta,
    improving: delta !== null ? delta > 0 : null,
    avgErrorRecent,
  };
}

/** One-time import of legacy per-drill stores into unified history. */
function backfillTrainingHistoryFromLegacy(save) {
  if (!save.trainingHistory) save.trainingHistory = defaultTrainingHistory();
  if (save.trainingHistory.migrated) return;
  for (const s of save.speedDrill?.sessions || []) {
    recordTrainingHistorySession(save, 'count-speed', {
      attempts: 1,
      accuracy: s.withinOne ? 100 : 0,
      avgError: s.error ?? Math.abs((s.guess ?? 0) - (s.actual ?? 0)),
      meta: { cardCount: s.cardCount, speed: s.speed, legacy: true },
    }, { ts: s.ts || Date.now() });
  }
  for (const s of save.combinedPractice?.sessions || []) {
    recordTrainingHistorySession(save, 'combined', {
      attempts: s.hands || 1,
      accuracy: s.countAccuracy ?? 0,
      avgError: s.countTotal ? Math.round((s.countTotal - (s.countCorrect || 0)) / s.countTotal * 10) / 10 : 0,
      meta: {
        countAccuracy: s.countAccuracy,
        strategyAccuracy: s.strategyAccuracy,
        legacy: true,
      },
    }, { ts: s.ts || Date.now() });
  }
  save.trainingHistory.migrated = true;
}

const MISTAKE_REVIEW_LIMIT = 150;

const MISTAKE_REVIEW_CATEGORIES = {
  count: 'Counting',
  strategy: 'Basic Strategy',
  deviation: 'Index Play',
  bet: 'Bet Sizing',
  spread: 'Bet Spread',
  dealer: 'Dealer',
};

function defaultMistakeReviewLog() {
  return { entries: [] };
}

function fmtSignedCount(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Log a single training mistake for later review (newest first, capped). */
function recordMistakeReviewEntry(save, entry) {
  if (!save.mistakeReviewLog) save.mistakeReviewLog = defaultMistakeReviewLog();
  const row = {
    id: entry.id || `mr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: entry.ts || Date.now(),
    drillId: entry.drillId,
    category: entry.category || 'count',
    context: entry.context || '',
    wrong: entry.wrong ?? '—',
    correct: entry.correct ?? '—',
    detail: entry.detail || '',
    meta: entry.meta || {},
  };
  save.mistakeReviewLog.entries.unshift(row);
  if (save.mistakeReviewLog.entries.length > MISTAKE_REVIEW_LIMIT) {
    save.mistakeReviewLog.entries.length = MISTAKE_REVIEW_LIMIT;
  }
  return row;
}

function getMistakeReviewEntries(save, drillId = null) {
  const all = save.mistakeReviewLog?.entries || [];
  if (!drillId || drillId === 'all') return all;
  return all.filter(e => e.drillId === drillId);
}

function mistakeReviewCategoryLabel(category) {
  return MISTAKE_REVIEW_CATEGORIES[category] || category;
}

function summarizeMistakeReview(entries) {
  if (!entries?.length) {
    return { count: 0, recent: 0, topDrill: null, topDrillCount: 0, byCategory: {} };
  }
  const byDrill = {};
  const byCategory = {};
  const weekAgo = Date.now() - 7 * 86400000;
  let recent = 0;
  for (const e of entries) {
    byDrill[e.drillId] = (byDrill[e.drillId] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    if (e.ts >= weekAgo) recent++;
  }
  let topDrill = null;
  let topDrillCount = 0;
  for (const [id, n] of Object.entries(byDrill)) {
    if (n > topDrillCount) { topDrill = id; topDrillCount = n; }
  }
  return { count: entries.length, recent, topDrill, topDrillCount, byCategory };
}

function formatDurationMs(ms) {
  if (!ms || ms < 500) return ms ? '<1s' : '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m) return `${m}m ${s}s`;
  return `${totalSec}s`;
}

function trainingDrillCardId(drillId) {
  const entry = TRAINING_DRILLS.find(d => d.id === drillId || d.launch === drillId);
  return entry?.id || drillId;
}

function defaultDrillSessionBests() {
  return {};
}

function compareToDrillPersonalBest(summary, best) {
  if (!best) return { isNewBest: true, deltas: {}, best: null };
  const deltas = {
    accuracy: summary.accuracy - (best.accuracy || 0),
    avgError: summary.avgError != null && best.avgError != null
      ? Math.round((best.avgError - summary.avgError) * 100) / 100
      : null,
    durationMs: best.durationMs && summary.durationMs ? best.durationMs - summary.durationMs : null,
  };
  let isNewBest = summary.accuracy > (best.accuracy || 0);
  if (!isNewBest && summary.accuracy === best.accuracy
    && summary.avgError != null && best.avgError != null
    && summary.avgError < best.avgError) {
    isNewBest = true;
  }
  return { isNewBest, deltas, best };
}

function updateDrillPersonalBest(save, summary) {
  if (!save.drillSessionBests) save.drillSessionBests = {};
  const prev = save.drillSessionBests[summary.drillId];
  const comparison = compareToDrillPersonalBest(summary, prev);
  if (comparison.isNewBest) {
    save.drillSessionBests[summary.drillId] = {
      accuracy: summary.accuracy,
      avgError: summary.avgError,
      durationMs: summary.durationMs,
      correct: summary.correct,
      total: summary.total,
      ts: summary.ts,
    };
  }
  return comparison;
}

/** Normalize any drill's end-of-session stats into one summary shape. */
function buildDrillSessionSummary(drillId, data = {}) {
  const durationMs = data.durationMs || 0;
  const base = {
    drillId,
    drillLabel: trainingHistoryDrillLabel(drillId),
    durationMs,
    durationLabel: formatDurationMs(durationMs),
    ts: Date.now(),
    subtitle: data.subtitle || '',
    extras: data.extras || [],
    avgError: null,
    accuracy: 0,
    correct: 0,
    incorrect: 0,
    total: 0,
  };

  if (drillId === 'count-speed') {
    const sum = summarizeSpeedDrillRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.withinOne).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      avgError: sum.avgError,
      subtitle: data.subtitle || `${sum.total} round${sum.total === 1 ? '' : 's'} · ±1 tolerance`,
    };
  }
  if (drillId === 'true-count') {
    const sum = data.sum || summarizeTrueCountDrillRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.correct).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      avgError: sum.avgError,
      subtitle: data.subtitle || (data.meta?.difficulty ? TC_DRILL_DIFFICULTIES[data.meta.difficulty]?.label : ''),
    };
  }
  if (drillId === 'index-plays') {
    const sum = data.sum || summarizeIndexPlayRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.correct).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      subtitle: data.subtitle || (data.meta?.mode ? INDEX_PLAY_MODES[data.meta.mode]?.label : ''),
    };
  }
  if (drillId === 'bet-spread') {
    const sum = data.sum || summarizeBetSpreadRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.appropriate).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      avgError: sum.avgUnitError,
      subtitle: data.subtitle || '',
      extras: data.extras || [],
    };
  }
  if (drillId === 'combined') {
    const visit = data.visit || summarizeCombinedPracticeVisit(data.hands || []);
    return {
      ...base,
      accuracy: Math.round((visit.countAccuracy + visit.strategyAccuracy) / 2),
      correct: visit.countCorrect + visit.strategyCorrect,
      incorrect: (visit.countTotal - visit.countCorrect) + (visit.strategyTotal - visit.strategyCorrect),
      total: visit.hands,
      subtitle: `${visit.hands} hand${visit.hands === 1 ? '' : 's'} played`,
      extras: [
        `Count accuracy: ${visit.countAccuracy}% (${visit.countCorrect}/${visit.countTotal})`,
        `Strategy accuracy: ${visit.strategyAccuracy}% (${visit.strategyCorrect}/${visit.strategyTotal})`,
      ],
    };
  }
  if (drillId === 'card-bursts') {
    const sum = data.sum || summarizeCardBurstRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.withinOne).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      avgError: sum.avgError,
      subtitle: data.subtitle || `${sum.total} burst${sum.total === 1 ? '' : 's'} · ±1 tolerance`,
    };
  }
  if (drillId === 'decks-left') {
    const sum = data.sum || summarizeDecksLeftRounds(data.rounds || []);
    const correct = (data.rounds || []).filter(r => r.correct).length;
    return {
      ...base,
      accuracy: sum.accuracy,
      correct,
      incorrect: sum.total - correct,
      total: sum.total,
      avgError: sum.avgError,
      subtitle: data.subtitle || `${data.meta?.numDecks || 6}-deck shoe · ±${data.meta?.tolerance || 0.25} decks`,
    };
  }
  if (drillId === 'dealer-mode') {
    const payoutCorrect = data.payoutCorrect ?? 0;
    const payoutTotal = data.payoutTotal ?? 0;
    const payoutAcc = data.payoutAcc ?? (payoutTotal ? Math.round(100 * payoutCorrect / payoutTotal) : 0);
    return {
      ...base,
      accuracy: payoutAcc,
      correct: payoutCorrect,
      incorrect: payoutTotal - payoutCorrect,
      total: payoutTotal,
      avgError: data.avgResponseMs ?? null,
      subtitle: `${data.handsPlayed || 0} table hands · House ${data.housePL >= 0 ? '+' : ''}${(data.housePL || 0).toLocaleString()}`,
      extras: [
        data.countAcc != null ? `Count accuracy: ${data.countAcc}%` : null,
        data.dealerActionAcc != null ? `Dealer rules: ${data.dealerActionAcc}%` : null,
        data.rewardChips ? `Shift reward: +${data.rewardChips.toLocaleString()} chips` : null,
        data.rewardGems ? `Bonus: +${data.rewardGems} gem` : null,
        data.early ? 'Shift ended early — reduced reward' : null,
      ].filter(Boolean),
    };
  }
  if (drillId === 'count-shoe') {
    return {
      ...base,
      accuracy: data.accuracy ?? 0,
      correct: data.correct ?? 0,
      incorrect: data.total != null ? data.total - (data.correct || 0) : 0,
      total: data.total ?? 1,
      avgError: data.avgError ?? null,
      subtitle: data.subtitle || (data.meta?.cardsDealt ? `${data.meta.cardsDealt} cards dealt` : ''),
    };
  }
  const correct = data.correct ?? 0;
  const total = data.total ?? 0;
  const accuracy = data.accuracy ?? (total ? Math.round(100 * correct / total) : 0);
  return {
    ...base,
    accuracy,
    correct,
    incorrect: total - correct,
    total,
    avgError: total ? Math.round((total - correct) / total * 100) / 100 : null,
    subtitle: data.subtitle || '',
  };
}

function accuracyBarColor(accuracy) {
  if (accuracy >= 80) return 'from-green-600 to-emerald-400';
  if (accuracy >= 60) return 'from-amber-600 to-amber-400';
  return 'from-red-700 to-red-500';
}

function accuracyTextColor(accuracy) {
  if (accuracy >= 80) return 'text-green-400';
  if (accuracy >= 60) return 'text-amber-300';
  return 'text-red-300';
}

function renderDrillSessionSummaryHtml(summary, comparison) {
  const acc = summary.accuracy;
  const bar = accuracyBarColor(acc);
  const accCls = accuracyTextColor(acc);
  const cmp = comparison || {};
  const best = cmp.best;

  const statCell = (label, value, color = 'text-cyan-200') =>
    `<div class="rounded-lg bg-black/30 border border-white/10 p-3 text-center">
      <div class="text-[10px] uppercase tracking-wider text-emerald-400/60">${label}</div>
      <div class="font-bold text-lg ${color} mt-0.5">${value}</div>
    </div>`;

  let cmpHtml = '<p class="text-xs text-cyan-300/70 text-center">First session logged — this is your baseline!</p>';
  if (best) {
    const accDelta = cmp.deltas?.accuracy ?? 0;
    const errDelta = cmp.deltas?.avgError;
    const timeDelta = cmp.deltas?.durationMs;
    const deltaCls = (n) => (n > 0 ? 'text-green-400' : n < 0 ? 'text-red-300' : 'text-emerald-300');
    const errLine = errDelta != null && summary.avgError != null
      ? `<div>Avg error: <strong class="${deltaCls(errDelta)}">${errDelta >= 0 ? '−' : '+'}${Math.abs(errDelta)}</strong> <span class="text-emerald-500/50">(best ${best.avgError})</span></div>`
      : '';
    const timeLine = timeDelta != null
      ? `<div>Time: <strong class="${deltaCls(timeDelta)}">${timeDelta >= 0 ? '−' : '+'}${formatDurationMs(Math.abs(timeDelta))}</strong> <span class="text-emerald-500/50">(best ${formatDurationMs(best.durationMs)})</span></div>`
      : '';
    cmpHtml = `
      <div class="rounded-xl bg-black/30 border border-white/10 p-4 text-sm space-y-2">
        <p class="text-xs uppercase tracking-wider text-amber-400/80 text-center">vs Personal Best</p>
        <div class="grid gap-1.5 text-xs text-emerald-200/90">
          <div>Accuracy: <strong class="${deltaCls(accDelta)}">${accDelta >= 0 ? '+' : ''}${accDelta}%</strong> <span class="text-emerald-500/50">(best ${best.accuracy}%)</span></div>
          ${errLine}
          ${timeLine}
        </div>
        ${cmp.isNewBest ? '<p class="text-center text-green-400 font-semibold text-sm">★ New personal best!</p>' : ''}
      </div>`;
  }

  const extrasHtml = (summary.extras || []).length
    ? `<ul class="text-xs text-emerald-300/80 space-y-1">${summary.extras.map(e => `<li>• ${e}</li>`).join('')}</ul>`
    : '';

  const avgErrorCell = summary.avgError != null
    ? statCell('Avg Error', summary.avgError, 'text-amber-200')
    : statCell('Decisions', `${summary.correct} / ${summary.total}`, 'text-cyan-200');

  return `
    <div class="text-center">
      <div class="text-5xl font-bold ${accCls}">${acc}%</div>
      <div class="text-xs uppercase tracking-wider text-emerald-400/60 mt-1">Session Accuracy</div>
    </div>
    <div class="h-2.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
      <div class="h-full bg-gradient-to-r ${bar} transition-all duration-500" style="width:${Math.min(100, acc)}%"></div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${statCell('Correct', summary.correct, 'text-green-400')}
      ${statCell('Incorrect', summary.incorrect, 'text-red-300')}
      ${avgErrorCell}
      ${statCell('Time', summary.durationLabel, 'text-cyan-200')}
    </div>
    ${extrasHtml}
    ${cmpHtml}`;
}

function defaultSpeedDrillPrefs() {
  return { cardCount: 20, speed: 'normal', showCount: false };
}

function defaultSpeedDrillStats() {
  return { prefs: defaultSpeedDrillPrefs(), sessions: [] };
}

/** Aggregate speed-drill round results (current visit or saved history). */
function summarizeSpeedDrillRounds(rounds) {
  if (!rounds?.length) {
    return { total: 0, accuracy: 0, avgError: 0, best: null, worst: null };
  }
  const total = rounds.length;
  const withinOne = rounds.filter(s => s.withinOne).length;
  const accuracy = Math.round(100 * withinOne / total);
  const avgError = Math.round(rounds.reduce((a, s) => a + s.error, 0) / total * 10) / 10;
  const best = rounds.reduce((b, s) => (!b || s.error < b.error ? s : b), null);
  const worst = rounds.reduce((w, s) => (!w || s.error > w.error ? s : w), null);
  return { total, accuracy, avgError, best, worst };
}

/** Lifetime speed-drill stats from saved sessions. */
function summarizeSpeedDrillHistory(sessions) {
  return summarizeSpeedDrillRounds(sessions);
}

/** True count conversion drill — difficulty presets. */
const TC_DRILL_DIFFICULTIES = {
  whole: { label: 'Whole Numbers', decimals: 0, tolerance: 0.01, hint: 'Enter a whole number (e.g. 3 or -2)' },
  decimal: { label: 'One Decimal', decimals: 1, tolerance: 0.15, hint: 'Round to one decimal (e.g. 2.3 or -1.5)' },
  precise: { label: 'Precise', decimals: 2, tolerance: 0.08, hint: 'Round to two decimals (e.g. 1.67)' },
};
const TC_DRILL_ROUND_OPTIONS = [5, 10, 15];

/**
 * Common Hi-Lo index plays (6-deck, S17, DAS).
 * index = true count where play switches from basicAction to indexAction.
 */
const INDEX_PLAY_CATALOG = [
  {
    id: 'ins-tc3', category: 'insurance', name: 'Insurance vs Ace',
    playerRanks: ['10', '8'], dealerUp: 'A', index: 3,
    basicAction: 'no-insurance', indexAction: 'insurance',
    explainBasic: 'Below true count +3, skip insurance. The deck is not rich enough in tens to make the side bet profitable.',
    explainIndex: 'At true count +3 or higher, take insurance. Extra tens increase dealer blackjack frequency enough to make insurance +EV.',
  },
  {
    id: '16v10-0', category: 'stand', name: '16 vs 10',
    playerRanks: ['10', '6'], dealerUp: '10', index: 0,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below index 0, hit 16 vs 10 — basic strategy (fewer tens remaining).',
    explainIndex: 'At true count 0+, stand on 16 vs 10. Extra tens mean the dealer is more likely to have 17–21, and you bust more often if you hit.',
  },
  {
    id: '15v10-4', category: 'stand', name: '15 vs 10',
    playerRanks: ['10', '5'], dealerUp: '10', index: 4,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below true count +4, hit 15 vs 10 per basic strategy.',
    explainIndex: 'At true count +4+, stand on 15 vs 10. A ten-rich deck makes both busting and dealer strong hands more likely — standing loses less.',
  },
  {
    id: '12v2-3', category: 'stand', name: '12 vs 2',
    playerRanks: ['10', '2'], dealerUp: '2', index: 3,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below true count +3, hit 12 vs 2 — dealer weak card but not enough tens to stand.',
    explainIndex: 'At true count +3+, stand on 12 vs 2. With many tens left, hitting risks busting; dealer is still likely to make a hand.',
  },
  {
    id: '12v3-2', category: 'stand', name: '12 vs 3',
    playerRanks: ['10', '2'], dealerUp: '3', index: 2,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below true count +2, hit 12 vs 3 per basic strategy.',
    explainIndex: 'At true count +2+, stand on 12 vs 3. Ten-rich shoes make busting more costly than standing on your stiff 12.',
  },
  {
    id: '12v4-0', category: 'stand', name: '12 vs 4',
    playerRanks: ['8', '4'], dealerUp: '4', index: 0,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below true count 0, hit 12 vs 4 — standard basic strategy.',
    explainIndex: 'At true count 0+, stand on 12 vs 4. When the count is neutral or positive, tens make hitting 12 too dangerous.',
  },
  {
    id: '13v2--1', category: 'stand', name: '13 vs 2',
    playerRanks: ['10', '3'], dealerUp: '2', index: -1,
    basicAction: 'hit', indexAction: 'stand',
    explainBasic: 'Below true count −1, hit 13 vs 2 per basic strategy.',
    explainIndex: 'At true count −1+, stand on 13 vs 2. Even a slightly positive count means enough tens that standing beats hitting.',
  },
  {
    id: '10v10-4', category: 'double', name: '10 vs 10',
    playerRanks: ['6', '4'], dealerUp: '10', index: 4,
    basicAction: 'hit', indexAction: 'double', canDouble: true,
    explainBasic: 'Below true count +4, hit 10 vs 10 — you are likely behind a strong dealer hand.',
    explainIndex: 'At true count +4+, double 10 vs 10. Many tens mean you are more likely to draw a 10 for 20 and win double your bet.',
  },
  {
    id: '11vA-1', category: 'double', name: '11 vs Ace',
    playerRanks: ['6', '5'], dealerUp: 'A', index: 1,
    basicAction: 'hit', indexAction: 'double', canDouble: true,
    explainBasic: 'Below true count +1, hit 11 vs Ace — dealer may have blackjack or a strong hand.',
    explainIndex: 'At true count +1+, double 11 vs Ace. Extra tens help you make 21 while the dealer is still vulnerable.',
  },
  {
    id: '9v2-1', category: 'double', name: '9 vs 2',
    playerRanks: ['5', '4'], dealerUp: '2', index: 1,
    basicAction: 'hit', indexAction: 'double', canDouble: true,
    explainBasic: 'Below true count +1, hit 9 vs 2 per basic strategy.',
    explainIndex: 'At true count +1+, double 9 vs 2. A positive count means more tens to improve your 9 into a strong total.',
  },
];

const INDEX_PLAY_MODES = {
  random: { label: 'Random Mix', filter: () => true },
  insurance: { label: 'Insurance Only', filter: p => p.category === 'insurance' },
  stand: { label: 'Stand Deviations', filter: p => p.category === 'stand' },
  double: { label: 'Double Deviations', filter: p => p.category === 'double' },
};

const INDEX_PLAY_ROUND_OPTIONS = [8, 10, 12];

function defaultIndexPlayDrillPrefs() {
  return { mode: 'random', roundSize: 10 };
}

function defaultIndexPlayDrillStats() {
  return { prefs: defaultIndexPlayDrillPrefs(), sessions: [] };
}

function getIndexPlaysForMode(modeId) {
  const mode = INDEX_PLAY_MODES[modeId] || INDEX_PLAY_MODES.random;
  return INDEX_PLAY_CATALOG.filter(mode.filter);
}

function handFromRanks(ranks) {
  return new Hand(ranks.map((r, i) => createPlayingCard(r, SUITS[i % SUITS.length])));
}

function formatIndexPlayAction(action) {
  const labels = {
    hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split',
    insurance: 'Take Insurance', 'no-insurance': 'No Insurance',
  };
  return labels[action] || action;
}

function getIndexPlayCorrectAction(play, trueCount) {
  const useIndex = trueCount >= play.index;
  const action = useIndex ? play.indexAction : play.basicAction;
  const explanation = useIndex ? play.explainIndex : play.explainBasic;
  const indexFmt = play.index >= 0 ? `+${play.index}` : `${play.index}`;
  return {
    action,
    useIndex,
    explanation,
    summary: useIndex
      ? `Index ${indexFmt} reached — ${formatIndexPlayAction(action)}`
      : `Below index ${indexFmt} — ${formatIndexPlayAction(action)} (basic strategy)`,
  };
}

function generateIndexPlayProblem(modeId) {
  const pool = getIndexPlaysForMode(modeId);
  const play = pool[Math.floor(Math.random() * pool.length)];
  const r = Math.random();
  let trueCount;
  if (r < 0.35) {
    trueCount = play.index;
  } else if (r < 0.68) {
    trueCount = play.index + (0.5 + Math.floor(Math.random() * 4) * 0.5);
  } else {
    trueCount = play.index - (0.5 + Math.floor(Math.random() * 4) * 0.5);
  }
  trueCount = Math.round(trueCount * 10) / 10;
  return { play, trueCount };
}

function summarizeIndexPlayRounds(rounds) {
  if (!rounds?.length) return { total: 0, accuracy: 0, avgError: 0 };
  const total = rounds.length;
  const correct = rounds.filter(r => r.correct).length;
  return {
    total,
    accuracy: Math.round(100 * correct / total),
    avgError: Math.round((total - correct) / total * 100) / 100,
  };
}

/** Configurable Hi-Lo bet spread — 1 unit at TC≤0, +1 per TC point, capped at maxUnits. */
function betSpreadUnitsFromTrueCountWithMax(trueCount, maxUnits = 6) {
  if (trueCount <= 0) return 1;
  return Math.min(1 + Math.floor(trueCount), maxUnits);
}

const BET_SPREAD_PRESETS = {
  standard: { label: 'Standard (1–6 units)', maxUnits: 6, minUnits: 1, unitSize: 10 },
  wide: { label: 'Wide (1–12 units)', maxUnits: 12, minUnits: 1, unitSize: 10 },
  custom: { label: 'Custom spread', maxUnits: 8, minUnits: 1, unitSize: 10, custom: true },
};

const BET_SPREAD_SCENARIOS = {
  mixed: { label: 'Mixed', desc: 'Low, neutral & high counts' },
  low: { label: 'Low count', desc: 'True count −4 to −1 — stay at minimum' },
  neutral: { label: 'Neutral', desc: 'True count −1 to +1 — mostly 1 unit' },
  high: { label: 'High count', desc: 'True count +3 to +8 — ramp up' },
};

const BET_SPREAD_ROUND_OPTIONS = [8, 10, 12];
const BET_SPREAD_DEFAULT_BANKROLL = 1000;
const BET_SPREAD_TIMER_MS = 5000;
const BET_SPREAD_SAFE_BR_FRACTION = 0.02;
const BET_SPREAD_HEAT_JUMP_THRESHOLD = 4;
const BET_SPREAD_KELLY_EDGE_PER_TC = 0.005;
const BET_SPREAD_KELLY_VARIANCE = 1.3;

function defaultBetSpreadDrillPrefs() {
  return {
    preset: 'standard', scenario: 'mixed', roundSize: 10, countingSystem: 'hi-lo',
    showKelly: true, heatSim: true, timedRounds: false,
    customMinUnits: 1, customMaxUnits: 8, bankroll: BET_SPREAD_DEFAULT_BANKROLL, unitSize: 10,
  };
}

function defaultBetSpreadDrillStats() {
  return { prefs: defaultBetSpreadDrillPrefs(), sessions: [] };
}

function pickTrueCountForBetSpreadScenario(scenarioId) {
  switch (scenarioId) {
    case 'low': return Math.round((Math.random() * 3 - 4) * 10) / 10;
    case 'neutral': return Math.round((Math.random() * 2 - 1) * 10) / 10;
    case 'high': return Math.round((3 + Math.random() * 5) * 10) / 10;
    default: return Math.round((Math.random() * 14 - 4) * 10) / 10;
  }
}

function classifyBetSpreadScenario(trueCount) {
  if (trueCount <= -0.5) return 'low';
  if (trueCount >= 2.5) return 'high';
  return 'neutral';
}

function resolveBetSpreadRange(prefs) {
  const preset = BET_SPREAD_PRESETS[prefs.preset] || BET_SPREAD_PRESETS.standard;
  if (preset.custom) {
    const minU = Math.max(1, Math.min(12, Math.floor(Number(prefs.customMinUnits) || 1)));
    const maxU = Math.max(minU, Math.min(20, Math.floor(Number(prefs.customMaxUnits) || 8)));
    return { minUnits: minU, maxUnits: maxU, unitSize: prefs.unitSize || 10, label: `Custom (${minU}–${maxU} units)` };
  }
  return { minUnits: preset.minUnits, maxUnits: preset.maxUnits, unitSize: preset.unitSize, label: preset.label };
}

function estimatePlayerEdgeFraction(trueCount) {
  if (trueCount <= 1) return 0;
  return (trueCount - 1) * BET_SPREAD_KELLY_EDGE_PER_TC;
}

/** Half-Kelly suggested units (educational overlay — not the drill answer key). */
function kellyBetUnitsFromTrueCount(trueCount, bankroll, unitSize, maxUnits, minUnits = 1) {
  const edge = estimatePlayerEdgeFraction(trueCount);
  if (edge <= 0) return minUnits;
  let fraction = edge / BET_SPREAD_KELLY_VARIANCE;
  fraction /= 2;
  const amount = Math.floor(bankroll * fraction);
  const units = Math.max(minUnits, Math.min(Math.max(1, Math.round(amount / unitSize)), maxUnits));
  return units;
}

function betSpreadBankrollStress(amount, bankroll, safeFraction = BET_SPREAD_SAFE_BR_FRACTION) {
  const pct = bankroll > 0 ? amount / bankroll : 1;
  return {
    amount,
    pct: Math.round(pct * 1000) / 10,
    stressed: pct > safeFraction,
    safeLimit: Math.floor(bankroll * safeFraction),
    safePct: safeFraction * 100,
  };
}

function detectBetSpreadHeat(prevUnits, chosenUnits, threshold = BET_SPREAD_HEAT_JUMP_THRESHOLD) {
  if (prevUnits == null) return { heated: false, jump: 0 };
  const jump = Math.abs(chosenUnits - prevUnits);
  return { heated: jump >= threshold, jump };
}

function pickKoRunningCountForScenario(scenarioId, pivot) {
  switch (scenarioId) {
    case 'low': return Math.floor(pivot - 4 + Math.random() * 3);
    case 'neutral': return Math.floor(pivot - 1 + Math.random() * 2);
    case 'high': return Math.floor(pivot + 3 + Math.random() * 5);
    default: return Math.floor(pivot - 5 + Math.random() * 12);
  }
}

function generateBetSpreadProblem(scenarioId, range, opts = {}) {
  const { minUnits, maxUnits, unitSize } = range;
  const bankroll = opts.bankroll || BET_SPREAD_DEFAULT_BANKROLL;
  const numDecks = opts.numDecks || 6;
  const countingSystem = opts.countingSystem || 'hi-lo';
  const deckOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];
  const decksRemaining = deckOptions[Math.floor(Math.random() * deckOptions.length)];

  let trueCount, runningCount, pivot, abovePivot, optimalUnits;
  if (countingSystem === 'ko') {
    pivot = getKoPivot(numDecks);
    runningCount = pickKoRunningCountForScenario(scenarioId, pivot);
    trueCount = Math.round((runningCount / decksRemaining) * 10) / 10;
    abovePivot = runningCount - pivot;
    optimalUnits = betSpreadUnitsFromKoRunningCount(runningCount, pivot);
    optimalUnits = Math.max(minUnits, Math.min(optimalUnits, maxUnits));
  } else {
    trueCount = pickTrueCountForBetSpreadScenario(scenarioId);
    runningCount = Math.round(trueCount * decksRemaining);
    optimalUnits = betSpreadUnitsFromTrueCountWithMax(trueCount, maxUnits);
    optimalUnits = Math.max(minUnits, optimalUnits);
    pivot = null;
    abovePivot = null;
  }

  const bankrollCap = Math.max(Math.floor(bankroll * 0.1), unitSize);
  let optimalAmount = optimalUnits * unitSize;
  const wasCapped = optimalAmount > bankrollCap;
  optimalAmount = Math.min(optimalAmount, bankrollCap, bankroll);
  const kellyUnits = kellyBetUnitsFromTrueCount(trueCount, bankroll, unitSize, maxUnits, minUnits);
  const stress = betSpreadBankrollStress(optimalAmount, bankroll);

  return {
    countingSystem,
    trueCount,
    runningCount,
    decksRemaining,
    pivot,
    abovePivot,
    optimalUnits,
    optimalAmount,
    unitSize,
    minUnits,
    maxUnits,
    bankroll,
    wasCapped,
    kellyUnits,
    bankrollStress: stress,
    scenarioClass: classifyBetSpreadScenario(trueCount),
  };
}

function isBetSpreadChoiceExact(chosenUnits, optimalUnits) {
  return chosenUnits === optimalUnits;
}

function isBetSpreadChoiceAppropriate(chosenUnits, optimalUnits) {
  return Math.abs(chosenUnits - optimalUnits) <= 1;
}

function explainBetSpreadAnswer(problem, chosenUnits, optimalUnits, extras = {}) {
  const tc = formatTrueCountAnswer(problem.trueCount, 'decimal');
  const amt = (u) => `$${u * problem.unitSize}`;
  const parts = [];
  if (chosenUnits === optimalUnits) {
    if (problem.trueCount <= 0) {
      parts.push(`True count ${tc} has no player edge — bet 1 unit (${amt(1)}). Counting advantage comes from betting small when the deck is poor and larger when tens are rich.`);
    } else {
      parts.push(`True count ${tc} → ${optimalUnits} units (${amt(optimalUnits)}). Each +1 true count adds one unit because more high cards remain — your edge grows, so the optimal wager ramps up.`);
    }
  } else if (isBetSpreadChoiceAppropriate(chosenUnits, optimalUnits)) {
    parts.push(`Close! True count ${tc} calls for ${optimalUnits} units (${amt(optimalUnits)}). You chose ${chosenUnits} — within 1 unit is acceptable in live play, but aim for the exact ramp.`);
  } else if (chosenUnits < optimalUnits) {
    parts.push(`Too small. True count ${tc} warrants ${optimalUnits} units (${amt(optimalUnits)}) — you're leaving edge on the table.`);
  } else {
    parts.push(`Too large. True count ${tc} calls for ${optimalUnits} units (${amt(optimalUnits)}), not ${chosenUnits}. Over-betting raises risk of ruin.`);
  }
  if (extras.heat?.heated) {
    parts.push(`Heat warning: ${extras.heat.jump}-unit jump from last bet — smooth spreads avoid pit attention.`);
  }
  const chosenStress = betSpreadBankrollStress(chosenUnits * problem.unitSize, problem.bankroll);
  if (chosenStress.stressed) {
    parts.push(`Bankroll stress: $${chosenUnits * problem.unitSize} is ${chosenStress.pct}% of bankroll (safe max ~${chosenStress.safePct}% = $${chosenStress.safeLimit}).`);
  }
  if (extras.timedOut) parts.push('Timed out — practice picking your spread within 5 seconds.');
  return parts.join(' ');
}

function renderBetSpreadSessionChartHtml(rounds, maxUnits) {
  if (!rounds?.length) return '';
  const w = 300;
  const h = 100;
  const pad = 12;
  const n = rounds.length;
  const xStep = n > 1 ? (w - 2 * pad) / (n - 1) : 0;
  const yMax = Math.max(maxUnits, ...rounds.map(r => Math.max(r.chosenUnits, r.optimalUnits)), 1);
  const yScale = (u) => h - pad - (u / yMax) * (h - 2 * pad);
  const dots = rounds.map((r, i) => {
    const x = pad + i * xStep;
    return {
      x,
      yc: yScale(r.chosenUnits),
      yo: yScale(r.optimalUnits),
      ok: r.exact,
    };
  });
  let chosenLine = '';
  let optimalLine = '';
  dots.forEach((d, i) => {
    chosenLine += `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.yc.toFixed(1)}`;
    optimalLine += `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.yo.toFixed(1)}`;
  });
  const chosenDots = dots.map(d =>
    `<circle cx="${d.x}" cy="${d.yc}" r="3.5" fill="${d.ok ? '#34d399' : '#f87171'}" />`
  ).join('');
  const optimalDots = dots.map(d =>
    `<circle cx="${d.x}" cy="${d.yo}" r="2" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="2 2" />`
  ).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="w-full max-w-sm mx-auto" role="img" aria-label="Bet spread session chart">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#ffffff18" stroke-width="1"/>
    <path d="${optimalLine}" fill="none" stroke="#fbbf2488" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${chosenLine}" fill="none" stroke="#22d3ee" stroke-width="2"/>
    ${optimalDots}${chosenDots}
  </svg>`;
}

function summarizeBetSpreadRounds(rounds) {
  if (!rounds?.length) {
    return {
      total: 0, accuracy: 0, exactPct: 0, avgUnitError: 0, rampScore: null,
      avgChosenHigh: null, avgChosenLow: null, heatFlags: 0, timedMisses: 0, bankrollWarnings: 0,
    };
  }
  const total = rounds.length;
  const appropriate = rounds.filter(r => r.appropriate && !r.heatPenalty).length;
  const exact = rounds.filter(r => r.exact).length;
  const avgUnitError = Math.round(rounds.reduce((a, r) => a + Math.abs(r.chosenUnits - r.optimalUnits), 0) / total * 10) / 10;
  const low = rounds.filter(r => r.trueCount <= 0);
  const high = rounds.filter(r => r.trueCount >= 3);
  let rampScore = null;
  let avgChosenHigh = null;
  let avgChosenLow = null;
  if (low.length && high.length) {
    avgChosenLow = Math.round(low.reduce((a, r) => a + r.chosenUnits, 0) / low.length * 10) / 10;
    avgChosenHigh = Math.round(high.reduce((a, r) => a + r.chosenUnits, 0) / high.length * 10) / 10;
    rampScore = avgChosenHigh > avgChosenLow ? 100 : Math.max(0, Math.round(50 * avgChosenHigh / Math.max(avgChosenLow, 1)));
  }
  return {
    total,
    accuracy: Math.round(100 * appropriate / total),
    exactPct: Math.round(100 * exact / total),
    avgUnitError,
    rampScore,
    avgChosenHigh,
    avgChosenLow,
    heatFlags: rounds.filter(r => r.heatPenalty).length,
    timedMisses: rounds.filter(r => r.timedOut).length,
    bankrollWarnings: rounds.filter(r => r.bankrollStressed).length,
  };
}

function recordBetSpreadDrillSession(save, result) {
  if (!save.betSpreadDrill) save.betSpreadDrill = defaultBetSpreadDrillStats();
  save.betSpreadDrill.sessions.unshift({
    ts: Date.now(),
    preset: result.preset,
    scenario: result.scenario,
    accuracy: result.accuracy,
    exactPct: result.exactPct,
    rampScore: result.rampScore,
    total: result.total,
  });
  if (save.betSpreadDrill.sessions.length > 50) save.betSpreadDrill.sessions.length = 50;
  save.betSpreadDrill.prefs = {
    preset: result.preset, scenario: result.scenario, roundSize: result.roundSize,
    countingSystem: result.countingSystem, timedRounds: result.timedRounds,
    showKelly: result.showKelly, heatSim: result.heatSim,
    customMinUnits: result.customMinUnits, customMaxUnits: result.customMaxUnits,
    bankroll: result.bankroll,
  };
}

function recordIndexPlayDrillSession(save, result) {
  if (!save.indexPlayDrill) save.indexPlayDrill = defaultIndexPlayDrillStats();
  save.indexPlayDrill.sessions.unshift({
    ts: Date.now(),
    mode: result.mode,
    roundSize: result.roundSize,
    accuracy: result.accuracy,
    correct: result.correct,
    total: result.total,
  });
  if (save.indexPlayDrill.sessions.length > 50) save.indexPlayDrill.sessions.length = 50;
  save.indexPlayDrill.prefs = { mode: result.mode, roundSize: result.roundSize };
}

function generateTrueCountProblem(difficultyId) {
  const diff = TC_DRILL_DIFFICULTIES[difficultyId] ? difficultyId : 'decimal';
  let runningCount, decksRemaining;
  if (diff === 'whole') {
    decksRemaining = 1 + Math.floor(Math.random() * 6);
    const trueInt = Math.floor(Math.random() * 13) - 6;
    runningCount = trueInt * decksRemaining;
  } else if (diff === 'decimal') {
    const deckOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
    decksRemaining = deckOptions[Math.floor(Math.random() * deckOptions.length)];
    const target = (Math.floor(Math.random() * 41) - 20) / 10;
    runningCount = Math.round(target * decksRemaining);
  } else {
    const quarters = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
    decksRemaining = quarters[Math.floor(Math.random() * quarters.length)];
    runningCount = Math.floor(Math.random() * 37) - 18;
  }
  const trueCount = runningCount / decksRemaining;
  return { runningCount, decksRemaining, trueCount, difficulty: diff };
}

function formatRunningCountDisplay(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function formatTrueCountAnswer(n, difficultyId) {
  const dec = TC_DRILL_DIFFICULTIES[difficultyId]?.decimals ?? 1;
  if (dec === 0) return formatRunningCountDisplay(Math.round(n));
  const rounded = Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec);
  const text = dec === 1 ? rounded.toFixed(1) : rounded.toFixed(2);
  return rounded >= 0 ? `+${text}` : text;
}

function validateTrueCountGuessInput(raw, difficultyId) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '-' || trimmed === '+') return { ok: false, error: 'Enter your true count guess' };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: 'Enter a valid number' };
  const dec = TC_DRILL_DIFFICULTIES[difficultyId]?.decimals ?? 1;
  if (dec === 0 && !Number.isInteger(n)) {
    return { ok: false, error: TC_DRILL_DIFFICULTIES.whole.hint };
  }
  return { ok: true, value: n };
}

function isTrueCountGuessCorrect(guess, actual, difficultyId) {
  const tol = TC_DRILL_DIFFICULTIES[difficultyId]?.tolerance ?? 0.15;
  return Math.abs(guess - actual) <= tol;
}

function defaultTrueCountDrillPrefs() {
  return { difficulty: 'decimal', roundSize: 10 };
}

function defaultTrueCountDrillStats() {
  return { prefs: defaultTrueCountDrillPrefs(), sessions: [] };
}

function summarizeTrueCountDrillRounds(rounds) {
  if (!rounds?.length) return { total: 0, accuracy: 0, avgError: 0 };
  const total = rounds.length;
  const correct = rounds.filter(r => r.correct).length;
  return {
    total,
    accuracy: Math.round(100 * correct / total),
    avgError: Math.round(rounds.reduce((a, r) => a + r.error, 0) / total * 100) / 100,
  };
}

function recordTrueCountDrillRound(save, result) {
  if (!save.trueCountDrill) save.trueCountDrill = defaultTrueCountDrillStats();
  save.trueCountDrill.sessions.unshift({
    ts: Date.now(),
    difficulty: result.difficulty,
    guess: result.guess,
    actual: result.trueCount,
    error: result.error,
    correct: result.correct,
    runningCount: result.runningCount,
    decksRemaining: result.decksRemaining,
  });
  if (save.trueCountDrill.sessions.length > 100) save.trueCountDrill.sessions.length = 100;
  save.trueCountDrill.prefs = { difficulty: result.difficulty, roundSize: result.roundSize };
}

function defaultCombinedPracticeStats() {
  return { sessions: [] };
}

function summarizeCombinedPracticeVisit(hands) {
  if (!hands?.length) {
    return { hands: 0, countAccuracy: 0, strategyAccuracy: 0, countCorrect: 0, countTotal: 0, strategyCorrect: 0, strategyTotal: 0 };
  }
  const countTotal = hands.length;
  const countCorrect = hands.filter(h => h.countOk).length;
  const strategyTotal = hands.reduce((a, h) => a + h.stratTotal, 0);
  const strategyCorrect = hands.reduce((a, h) => a + h.stratCorrect, 0);
  return {
    hands: countTotal,
    countCorrect,
    countTotal,
    countAccuracy: Math.round(100 * countCorrect / countTotal),
    strategyCorrect,
    strategyTotal,
    strategyAccuracy: strategyTotal ? Math.round(100 * strategyCorrect / strategyTotal) : 100,
  };
}

function recordCombinedPracticeSession(save, result) {
  if (!save.combinedPractice) save.combinedPractice = defaultCombinedPracticeStats();
  const summary = summarizeCombinedPracticeVisit(result.hands || []);
  save.combinedPractice.sessions.unshift({
    ts: Date.now(),
    hands: summary.hands,
    countAccuracy: summary.countAccuracy,
    strategyAccuracy: summary.strategyAccuracy,
    countCorrect: summary.countCorrect,
    countTotal: summary.countTotal,
    strategyCorrect: summary.strategyCorrect,
    strategyTotal: summary.strategyTotal,
  });
  if (save.combinedPractice.sessions.length > 50) save.combinedPractice.sessions.length = 50;
}

function formatCombinedHandReview(roundReview, counter, lastHand) {
  const lines = [];
  if (lastHand) {
    const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
    lines.push(lastHand.countOk
      ? `Count: ✓ within ±1 (you ${fmt(lastHand.guess)}, actual ${fmt(lastHand.actual)})`
      : `Count: ✗ off by ${Math.abs(lastHand.guess - lastHand.actual)} (you ${fmt(lastHand.guess)}, actual ${fmt(lastHand.actual)})`);
  }
  const decisions = roundReview?.decisions || [];
  if (decisions.length) {
    const ok = decisions.filter(d => !d.mistake).length;
    lines.push(`Strategy: ${ok}/${decisions.length} correct this hand`);
    decisions.forEach((d, i) => {
      const mark = d.mistake ? '✗' : '✓';
      lines.push(`  ${mark} Play ${i + 1}: you ${d.action} · optimal ${d.advice}`);
    });
  } else {
    lines.push('Strategy: no decisions needed (e.g. instant blackjack or dealer bust).');
  }
  if (roundReview && counter) {
    lines.push(formatHandRunningCountReview(roundReview.runningCountAtHandStart, counter.runningCount));
  }
  return lines.join('\n');
}

function recordSpeedDrillSession(save, result) {
  if (!save.speedDrill) save.speedDrill = defaultSpeedDrillStats();
  const error = Math.abs(result.guess - result.actual);
  const entry = {
    ts: Date.now(),
    cardCount: result.cardCount,
    speed: result.speed,
    showCount: result.showCount,
    guess: result.guess,
    actual: result.actual,
    error,
    withinOne: error <= 1,
    exact: result.guess === result.actual,
  };
  save.speedDrill.sessions.unshift(entry);
  if (save.speedDrill.sessions.length > 50) save.speedDrill.sessions.length = 50;
  save.speedDrill.prefs = {
    cardCount: result.cardCount,
    speed: result.speed,
    showCount: result.showCount,
  };
}

function defaultRules() { return { ...DEFAULT_RULES }; }

function rulesDifferFromChart(rules) {
  return rules.blackjackPayout !== 1.5 || !rules.das || rules.lateSurrender || !rules.dealerHitsSoft17;
}

function dailyChallengeForDate(d = new Date()) {
  const key = d.toISOString().slice(0, 10);
  const seed = key.split('-').reduce((a, p) => a + parseInt(p, 10), 0);
  const types = [
    { title: 'Count Sprint', desc: 'Get 8 of 10 count quizzes correct in one session.', type: 'countStreak', target: 8, total: 10 },
    { title: 'Perfect Decisions', desc: 'Make 15 strategy decisions with 90%+ accuracy this session.', type: 'sessionDecisions', target: 90, count: 15 },
    { title: 'Green Shoe', desc: 'Finish a shoe with session profit ≥ $50.', type: 'shoeProfit', target: 50 },
    { title: 'True Count Master', desc: 'Place the recommended bet 5 times in a row.', type: 'betStreak', target: 5 },
  ];
  return { ...types[seed % types.length], date: key, id: `daily-${key}` };
}

const DAILY_CHALLENGE_REWARD = 40;
const DAILY_TRAINING_SYNERGY_BONUS = 25;

/** Daily login reward ladder — distinct from daily challenge / training goals. */
const DAILY_LOGIN_REWARD_TABLE = [
  { day: 1, chips: 100, gems: 0 },
  { day: 2, chips: 125, gems: 0 },
  { day: 3, chips: 150, gems: 0 },
  { day: 4, chips: 175, gems: 1 },
  { day: 5, chips: 200, gems: 0 },
  { day: 6, chips: 250, gems: 1 },
  { day: 7, chips: 300, gems: 2 },
];
const SOCIAL_CONNECT_CHIP_BONUS = 500;
const SOCIAL_CONNECT_GEM_BONUS = 5;

/** VIP Pass — premium retention tier (gem purchase or one-time trial). */
const VIP_PASS_COST_GEMS = 25;
const VIP_PASS_DURATION_DAYS = 30;
const VIP_TRIAL_DAYS = 3;
const VIP_CHIP_MULTIPLIER = 2;
const VIP_SYNERGY_MULTIPLIER = 2;
const VIP_TABLE_WIN_BONUS_FRACTION = 0.10;

const LOBBY_SHOP_ITEMS = [
  { id: 'chips-small', name: 'Chip Stack', desc: '2,500 chips', chips: 2500, costGems: 0, costChips: 0, free: true, freeOnce: true },
  { id: 'chips-mid', name: 'Chip Crate', desc: '10,000 chips', chips: 10000, costGems: 8 },
  { id: 'gems-pack', name: 'Gem Pouch', desc: '15 gems', gems: 15, costGems: 0, costChips: 5000 },
  { id: 'vip-pass', name: 'CountQuest Pass', desc: `${VIP_PASS_DURATION_DAYS}-day VIP`, vip: true, costGems: VIP_PASS_COST_GEMS },
];

function todayDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function defaultDailyRewards() {
  return {
    lastLoginDate: '',
    streak: 0,
    claimedToday: false,
    lastClaimedDate: '',
    totalClaims: 0,
    longestStreak: 0,
    social: {
      facebookConnected: false,
      googleConnected: false,
      facebookBonusClaimed: false,
      googleBonusClaimed: false,
    },
  };
}

function defaultVipPass() {
  return { active: false, activatedAt: '', expiresAt: '', source: '', trialUsed: false };
}

/** Roll calendar day for login streak — call on every session start. */
function ensureDailyRewardsCurrent(save, today = todayDateKey()) {
  if (!save.dailyRewards) save.dailyRewards = defaultDailyRewards();
  const dr = save.dailyRewards;
  if (dr.lastLoginDate === today) return dr;
  const yesterday = yesterdayDateKey(today);
  if (dr.lastClaimedDate === yesterday) {
    dr.streak = Math.max(1, (dr.streak || 0) + 1);
  } else if (!dr.lastClaimedDate) {
    dr.streak = 1;
  } else if (dr.lastClaimedDate !== today) {
    dr.streak = 1;
  }
  dr.lastLoginDate = today;
  dr.claimedToday = dr.lastClaimedDate === today;
  dr.longestStreak = Math.max(dr.longestStreak || 0, dr.streak || 0);
  return dr;
}

function getDailyLoginRewardForStreak(streak) {
  const day = Math.min(Math.max(streak || 1, 1), 7);
  const row = DAILY_LOGIN_REWARD_TABLE.find(r => r.day === day) || DAILY_LOGIN_REWARD_TABLE[6];
  if (streak > 7) {
    const extra = Math.min((streak - 7) * 25, 100);
    return { chips: row.chips + extra, gems: row.gems, day: streak };
  }
  return { chips: row.chips, gems: row.gems, day: streak };
}

function isVipActive(save) {
  if (!save.vipPass?.active) return false;
  const exp = save.vipPass.expiresAt;
  if (!exp) return true;
  return exp >= todayDateKey();
}

function applyVipChipBonus(save, chips) {
  return Math.round(chips * (isVipActive(save) ? VIP_CHIP_MULTIPLIER : 1));
}

function computeDailyLoginReward(save) {
  ensureDailyRewardsCurrent(save);
  const base = getDailyLoginRewardForStreak(save.dailyRewards.streak || 1);
  return {
    chips: applyVipChipBonus(save, base.chips),
    gems: base.gems,
    baseChips: base.chips,
    streak: save.dailyRewards.streak || 1,
    vipActive: isVipActive(save),
  };
}

function canClaimDailyLogin(save) {
  ensureDailyRewardsCurrent(save);
  return !save.dailyRewards.claimedToday;
}

function claimDailyLoginReward(save) {
  if (!canClaimDailyLogin(save)) return { ok: false, error: 'Already claimed today' };
  const reward = computeDailyLoginReward(save);
  addChips(save, reward.chips);
  if (reward.gems) addGems(save, reward.gems);
  const dr = save.dailyRewards;
  dr.claimedToday = true;
  dr.lastClaimedDate = todayDateKey();
  dr.totalClaims = (dr.totalClaims || 0) + 1;
  dr.longestStreak = Math.max(dr.longestStreak || 0, dr.streak || 1);
  return { ok: true, reward, streak: dr.streak };
}

function connectSocialAccount(save, provider) {
  if (!save.dailyRewards) save.dailyRewards = defaultDailyRewards();
  const s = save.dailyRewards.social;
  const isFb = provider === 'facebook';
  const connectedKey = isFb ? 'facebookConnected' : 'googleConnected';
  const bonusKey = isFb ? 'facebookBonusClaimed' : 'googleBonusClaimed';
  if (s[connectedKey]) return { ok: false, error: `Already connected to ${provider}` };
  s[connectedKey] = true;
  let bonus = null;
  if (!s[bonusKey]) {
    s[bonusKey] = true;
    addChips(save, SOCIAL_CONNECT_CHIP_BONUS);
    addGems(save, SOCIAL_CONNECT_GEM_BONUS);
    bonus = { chips: SOCIAL_CONNECT_CHIP_BONUS, gems: SOCIAL_CONNECT_GEM_BONUS };
  }
  return { ok: true, provider, bonus, firstTime: !!bonus };
}

function activateVipPass(save, source = 'gems', days = VIP_PASS_DURATION_DAYS) {
  if (!save.vipPass) save.vipPass = defaultVipPass();
  const today = todayDateKey();
  let base = new Date(today + 'T12:00:00');
  if (isVipActive(save) && save.vipPass.expiresAt) {
    base = new Date(save.vipPass.expiresAt + 'T12:00:00');
    base.setDate(base.getDate() + 1);
  }
  base.setDate(base.getDate() + days - 1);
  save.vipPass.active = true;
  if (!save.vipPass.activatedAt) save.vipPass.activatedAt = today;
  save.vipPass.expiresAt = base.toISOString().slice(0, 10);
  save.vipPass.source = source;
  return { ok: true, expiresAt: save.vipPass.expiresAt, days };
}

function purchaseVipPass(save) {
  syncWalletSave(save);
  if (save.gems < VIP_PASS_COST_GEMS) {
    return { ok: false, error: `Need ${VIP_PASS_COST_GEMS} gems (you have ${save.gems})` };
  }
  save.gems -= VIP_PASS_COST_GEMS;
  save.bankroll = save.chips;
  const result = activateVipPass(save, 'gems', VIP_PASS_DURATION_DAYS);
  result.costGems = VIP_PASS_COST_GEMS;
  return result;
}

function claimVipTrial(save) {
  if (!save.vipPass) save.vipPass = defaultVipPass();
  if (save.vipPass.trialUsed) return { ok: false, error: 'Free trial already used' };
  if (isVipActive(save)) return { ok: false, error: 'VIP Pass already active' };
  save.vipPass.trialUsed = true;
  return activateVipPass(save, 'trial', VIP_TRIAL_DAYS);
}

function vipTableWinBonus(save, payout) {
  if (!isVipActive(save)) return 0;
  return Math.round(payout * VIP_TABLE_WIN_BONUS_FRACTION);
}

function getEffectiveSynergyBonus(save) {
  const base = DAILY_TRAINING_SYNERGY_BONUS;
  return isVipActive(save) ? base * VIP_SYNERGY_MULTIPLIER : base;
}

/** External OAuth / IAP wiring — real providers when configured, simulated fallback. */
const CQ_CONFIG_KEY = 'countquest-external-config';

function loadExternalConfig() {
  try {
    const raw = localStorage.getItem(CQ_CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      oauth: {
        googleClientId: parsed.oauth?.googleClientId || '',
        facebookAppId: parsed.oauth?.facebookAppId || '',
      },
      iap: {
        stripePaymentLink: parsed.iap?.stripePaymentLink || '',
      },
    };
  } catch {
    return { oauth: { googleClientId: '', facebookAppId: '' }, iap: { stripePaymentLink: '' } };
  }
}

function saveExternalConfig(config) {
  try {
    localStorage.setItem(CQ_CONFIG_KEY, JSON.stringify(config));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Could not save config' };
  }
}

function loadExternalScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function applySocialConnectResult(save, provider, meta = {}) {
  const result = connectSocialAccount(save, provider);
  if (!result.ok) return result;
  const s = save.dailyRewards?.social;
  if (s) {
    if (provider === 'google') {
      s.googleEmail = meta.email || s.googleEmail || '';
      s.googleMode = meta.mode || 'simulated';
    } else {
      s.facebookName = meta.name || s.facebookName || '';
      s.facebookMode = meta.mode || 'simulated';
    }
  }
  return { ...result, mode: meta.mode || 'simulated', ...meta };
}

const ExternalAuth = {
  isGoogleConfigured() { return !!loadExternalConfig().oauth.googleClientId; },
  isFacebookConfigured() { return !!loadExternalConfig().oauth.facebookAppId; },

  async connectGoogle(save) {
    const cfg = loadExternalConfig();
    if (!cfg.oauth.googleClientId) {
      return applySocialConnectResult(save, 'google', { mode: 'simulated' });
    }
    try {
      await loadExternalScript('https://accounts.google.com/gsi/client', 'cq-google-gsi');
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(applySocialConnectResult(save, 'google', { mode: 'fallback', note: 'OAuth timeout' }));
        }, 25000);
        const container = document.getElementById('cq-oauth-google-btn');
        if (container) container.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: cfg.oauth.googleClientId,
          callback: (response) => {
            clearTimeout(timeout);
            let email = '';
            try {
              const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
              email = payload.email || '';
            } catch { /* ignore decode */ }
            resolve(applySocialConnectResult(save, 'google', { mode: 'oauth', email }));
          },
          auto_select: false,
        });
        if (container) {
          window.google.accounts.id.renderButton(container, { theme: 'filled_black', size: 'large', width: 280 });
        } else {
          window.google.accounts.id.prompt();
        }
      });
    } catch (err) {
      return applySocialConnectResult(save, 'google', { mode: 'fallback', error: err.message });
    }
  },

  async connectFacebook(save) {
    const cfg = loadExternalConfig();
    if (!cfg.oauth.facebookAppId) {
      return applySocialConnectResult(save, 'facebook', { mode: 'simulated' });
    }
    try {
      await loadExternalScript('https://connect.facebook.net/en_US/sdk.js', 'cq-facebook-sdk');
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(applySocialConnectResult(save, 'facebook', { mode: 'fallback', note: 'OAuth timeout' }));
        }, 25000);
        window.FB.init({ appId: cfg.oauth.facebookAppId, cookie: true, xfbml: false, version: 'v18.0' });
        window.FB.login((response) => {
          clearTimeout(timeout);
          if (response.authResponse) {
            window.FB.api('/me', { fields: 'name,email' }, (profile) => {
              resolve(applySocialConnectResult(save, 'facebook', {
                mode: 'oauth',
                name: profile?.name || '',
                email: profile?.email || '',
              }));
            });
          } else {
            resolve({ ok: false, error: 'Facebook login cancelled', mode: 'oauth' });
          }
        }, { scope: 'public_profile,email' });
      });
    } catch (err) {
      return applySocialConnectResult(save, 'facebook', { mode: 'fallback', error: err.message });
    }
  },
};

const ExternalIAP = {
  isConfigured() { return !!loadExternalConfig().iap.stripePaymentLink; },

  purchaseVip(save) {
    const cfg = loadExternalConfig();
    if (cfg.iap.stripePaymentLink) {
      try {
        const url = new URL(cfg.iap.stripePaymentLink);
        ensurePlayerId(save);
        url.searchParams.set('client_reference_id', save.playerId);
        window.open(url.toString(), '_blank', 'noopener');
        return {
          ok: true,
          mode: 'stripe',
          message: 'Complete checkout in the payment window, then return with ?vip_purchased=1',
        };
      } catch {
        return { ok: false, error: 'Invalid Stripe payment link URL' };
      }
    }
    const gemResult = purchaseVipPass(save);
    return { ...gemResult, mode: 'gems' };
  },

  handleReturnParams(save, params) {
    if (!params) return null;
    if (params.get('vip_purchased') === '1') {
      const r = activateVipPass(save, 'iap', VIP_PASS_DURATION_DAYS);
      return { ok: true, type: 'vip', ...r };
    }
    if (params.get('oauth_google') === 'success') {
      return applySocialConnectResult(save, 'google', { mode: 'oauth', email: params.get('email') || '' });
    }
    return null;
  },
};

/** Rotating daily training goals — achievable targets that build real skills. */
const DAILY_TRAINING_GOAL_TYPES = [
  {
    type: 'drillAccuracy',
    drillId: 'count-speed',
    launch: 'count-speed',
    title: 'Speed Count Sprint',
    desc: 'Complete a Running Count Speed Drill round with 80%+ accuracy (±1 counts).',
    targetAccuracy: 80,
    minAttempts: 1,
    rewardChips: 50,
    streakBonus: 10,
  },
  {
    type: 'combinedHands',
    drillId: 'combined',
    launch: 'combined',
    title: 'Combined Reps',
    desc: 'Practice 50 hands in Combined Practice today (any number of sessions).',
    targetHands: 50,
    rewardChips: 75,
    streakBonus: 15,
  },
  {
    type: 'drillAccuracy',
    drillId: 'true-count',
    launch: 'true-count',
    title: 'True Count Tune-Up',
    desc: 'Finish a True Count drill round at 75%+ accuracy (10+ problems).',
    targetAccuracy: 75,
    minAttempts: 10,
    rewardChips: 60,
    streakBonus: 12,
  },
  {
    type: 'drillAccuracy',
    drillId: 'index-plays',
    launch: 'index-plays',
    title: 'Index Sharpener',
    desc: 'Complete an Index Play drill round at 70%+ accuracy (5+ problems).',
    targetAccuracy: 70,
    minAttempts: 5,
    rewardChips: 55,
    streakBonus: 10,
  },
  {
    type: 'drillAccuracy',
    drillId: 'decisions',
    launch: 'decisions',
    title: 'Chart Check',
    desc: 'Finish a Decision Drill session at 80%+ accuracy (10 hands).',
    targetAccuracy: 80,
    minAttempts: 10,
    rewardChips: 50,
    streakBonus: 10,
  },
  {
    type: 'drillAccuracy',
    drillId: 'dealer-mode',
    launch: 'dealer-mode',
    title: 'Dealer Shift',
    desc: 'Complete a dealer shift with 80%+ payout accuracy (8+ hands).',
    targetAccuracy: 80,
    minAttempts: 8,
    rewardChips: 80,
    streakBonus: 15,
  },
];

function dailyTrainingGoalForDate(d = new Date()) {
  const key = d.toISOString().slice(0, 10);
  const seed = key.split('-').reduce((a, p) => a + parseInt(p, 10), 0) + 11;
  const goal = DAILY_TRAINING_GOAL_TYPES[seed % DAILY_TRAINING_GOAL_TYPES.length];
  return { ...goal, date: key, id: `dtg-${key}` };
}

function defaultDailyTraining() {
  return {
    lastDate: '',
    goalId: '',
    completed: false,
    progress: {},
    streak: 0,
    lastCompletedDate: '',
    totalCompleted: 0,
    lastReward: 0,
    synergyClaimed: false,
  };
}

/** Reset daily training state when the calendar day changes. */
function ensureDailyTrainingCurrent(save, goal = dailyTrainingGoalForDate()) {
  if (!save.dailyTraining) save.dailyTraining = defaultDailyTraining();
  const dt = save.dailyTraining;
  if (dt.lastDate !== goal.date) {
    dt.lastDate = goal.date;
    dt.goalId = goal.id;
    dt.completed = false;
    dt.progress = {};
    dt.synergyClaimed = false;
  }
  return dt;
}

/** Update progress toward today's training goal; returns whether the goal is now met. */
function evaluateDailyTrainingProgress(goal, progress, event, data = {}) {
  const p = { ...(progress || {}) };
  if (goal.type === 'combinedHands' && event === 'combinedHand') {
    p.hands = (p.hands || 0) + 1;
    return { progress: p, met: p.hands >= goal.targetHands };
  }
  if (goal.type === 'drillAccuracy' && event === 'drillSession') {
    if (data.drillId !== goal.drillId) return { progress: p, met: false };
    p.attempts = Math.max(p.attempts || 0, data.attempts || 0);
    p.bestAccuracy = Math.max(p.bestAccuracy || 0, data.accuracy || 0);
    const met = (data.attempts || 0) >= goal.minAttempts && (data.accuracy || 0) >= goal.targetAccuracy;
    if (met) p.sessionMet = true;
    return { progress: p, met: !!p.sessionMet };
  }
  return { progress: p, met: false };
}

function dailyTrainingProgressDisplay(goal, progress, completed) {
  if (completed) return { pct: 100, label: '✓ Completed today!', done: true };
  const p = progress || {};
  if (goal.type === 'combinedHands') {
    const cur = p.hands || 0;
    const tgt = goal.targetHands;
    return {
      pct: Math.min(100, Math.round(100 * cur / tgt)),
      label: `${cur} / ${tgt} hands`,
      done: false,
    };
  }
  if (goal.type === 'drillAccuracy') {
    if (p.sessionMet) return { pct: 100, label: 'Session goal met!', done: false };
    const best = p.bestAccuracy || 0;
    const att = p.attempts || 0;
    const need = goal.minAttempts > 1
      ? `${goal.targetAccuracy}% on ${goal.minAttempts}+ problems`
      : `${goal.targetAccuracy}% on one round`;
    return {
      pct: Math.min(99, Math.round(100 * best / goal.targetAccuracy)),
      label: att ? `Best today: ${best}% · need ${need}` : `Need ${need}`,
      done: false,
    };
  }
  return { pct: 0, label: 'Not started yet', done: false };
}

function computeDailyTrainingReward(goal, streak) {
  const base = goal.rewardChips || 50;
  const bonusPerDay = goal.streakBonus || 10;
  const streakExtra = Math.max(0, Math.min((streak || 1) - 1, 6)) * bonusPerDay;
  return base + streakExtra;
}

function yesterdayDateKey(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const ACHIEVEMENTS = [
  { id: 'first-hand', icon: '🃏', name: 'First Hand', desc: 'Play your first hand of blackjack' },
  { id: 'perfect-shoe', icon: '🔢', name: 'First Perfect Shoe Count', desc: '100% count accuracy on a shoe quiz' },
  { id: 'hands-100', icon: '💪', name: 'Survived 100 Hands', desc: 'Play 100 hands total' },
  { id: 'level-3', icon: '🎓', name: 'Mastered Level 3', desc: 'Reach Help Level 3 (Challenge mode)' },
  { id: 'streak-5', icon: '🔥', name: 'Hot Streak', desc: 'Win 5 hands in a row' },
  { id: 'streak-10', icon: '⚡', name: 'On Fire', desc: 'Win 10 hands in a row' },
  { id: 'bankroll-2k', icon: '💰', name: 'High Roller', desc: 'Reach a $2,000 bankroll' },
  { id: 'count-90', icon: '👁', name: 'Sharp Eye', desc: '90%+ lifetime count accuracy (50+ quizzes)' },
  { id: 'strategy-90', icon: '📊', name: 'Chart Master', desc: '90%+ strategy accuracy (100+ decisions)' },
  { id: 'daily-done', icon: '📅', name: 'Daily Grinder', desc: 'Complete a daily challenge' },
  { id: 'training-daily', icon: '🏋️', name: 'Training Regular', desc: 'Complete a daily training goal' },
  { id: 'training-streak-7', icon: '🔥', name: 'Training Streak', desc: 'Complete 7 daily training goals in a row' },
  { id: 'login-streak-7', icon: '📆', name: 'Dedicated Counter', desc: 'Claim 7 daily login rewards in a row' },
  { id: 'social-connected', icon: '🔗', name: 'Connected', desc: 'Link Facebook or Google for bonus rewards' },
  { id: 'vip-member', icon: '👑', name: 'VIP Counter', desc: 'Activate the VIP Pass' },
  { id: 'tutorial-done', icon: '📘', name: 'Graduate', desc: 'Complete the tutorial' },
  { id: 'all-themes', icon: '🌍', name: 'World Tour', desc: 'Unlock all casino themes' },
  { id: 'rank-master', icon: '👑', name: 'Count Master', desc: 'Reach Master rank' },
  { id: 'ko-unlocked', icon: '🥊', name: 'Knock-Out Ready', desc: 'Unlock the KO counting system' },
  { id: 'ko-session', icon: '🔄', name: 'System Switch', desc: 'Play a hand using the KO system' },
  { id: 'dealer-shift', icon: '🎰', name: 'Table Boss', desc: 'Complete a full 12-hand dealer shift' },
  { id: 'dealer-perfect', icon: '💯', name: 'Perfect Payouts', desc: '100% payout accuracy on a full dealer shift' },
];

function defaultPersonalBests() {
  return {
    longestWinStreak: 0,
    bestCountAccuracy: 0,
    bestDecisionAccuracy: 0,
    bestRecentCount: 0,
    bestBankroll: 0,
    bestSessionProfit: 0,
    perfectShoeCounts: 0,
  };
}

function migrateSave(raw) {
  if (!raw) return null;
  const s = { ...raw };
  if (!s.version || s.version < 2) {
    s.campaign = s.campaign || { chapter: 0, unlocks: ['classic'], goalsCompleted: [] };
    s.tutorial = s.tutorial || { step: 0, completed: false };
    s.daily = s.daily || { lastDate: '', challengeId: '', completed: false };
    s.sessionMode = s.sessionMode || null;
    s.sessionDrill = s.sessionDrill || null;
    s.settings = s.settings || {};
    s.settings.theme = s.settings.theme || 'classic';
    s.settings.rules = { ...defaultRules(), ...(s.settings.rules || {}) };
  }
  if (!s.version || s.version < 3) {
    s.personalBests = { ...defaultPersonalBests(), ...(s.personalBests || {}) };
    if (s.stats?.bestBankroll) s.personalBests.bestBankroll = Math.max(s.personalBests.bestBankroll, s.stats.bestBankroll);
    s.achievements = normalizeAchievements(s.achievements);
    if (!s.stats) s.stats = defaultStats();
    if (s.stats.winStreak === undefined) s.stats.winStreak = 0;
  }
  if (!s.version || s.version < 4) {
    s.countingUnlocks = Array.isArray(s.countingUnlocks) ? [...s.countingUnlocks] : ['hi-lo'];
    if (!s.countingUnlocks.includes('hi-lo')) s.countingUnlocks.unshift('hi-lo');
    s.settings = s.settings || {};
    s.settings.countingSystem = s.settings.countingSystem || 'hi-lo';
    if (!s.countingUnlocks.includes(s.settings.countingSystem)) s.settings.countingSystem = 'hi-lo';
  }
  s.settings = s.settings || {};
  if (s.settings.showCountDisplay === undefined) s.settings.showCountDisplay = true;
  if (s.settings.showCountPopups === undefined) s.settings.showCountPopups = true;
  s.uiHints = { shoeTermExplained: false, hardHandTips: 0, ...(s.uiHints || {}) };
  if (!s.speedDrill) s.speedDrill = defaultSpeedDrillStats();
  if (!s.trueCountDrill) s.trueCountDrill = defaultTrueCountDrillStats();
  if (!s.combinedPractice) s.combinedPractice = defaultCombinedPracticeStats();
  if (!s.trainingHistory) s.trainingHistory = defaultTrainingHistory();
  if (!s.mistakeReviewLog) s.mistakeReviewLog = defaultMistakeReviewLog();
  if (!s.dailyTraining) s.dailyTraining = defaultDailyTraining();
  if (!s.drillSessionBests) s.drillSessionBests = defaultDrillSessionBests();
  if (!s.indexPlayDrill) s.indexPlayDrill = defaultIndexPlayDrillStats();
  if (!s.betSpreadDrill) s.betSpreadDrill = defaultBetSpreadDrillStats();
  if (!s.version || s.version < 5) syncWalletSave(s);
  if (!s.version || s.version < 6) {
    s.club = { ...defaultClubMembership(), ...(s.club || {}) };
    ensurePlayerId(s);
  }
  if (!s.version || s.version < 7) {
    if (s.club?.role) s.club.role = normalizeClubRole(s.club.role);
    ensurePlayerId(s);
  }
  if (!s.version || s.version < 8) ensurePlayerId(s);
  if (!s.version || s.version < 9) {
    s.dailyRewards = { ...defaultDailyRewards(), ...(s.dailyRewards || {}) };
    s.dailyRewards.social = {
      ...defaultDailyRewards().social,
      ...(s.dailyRewards.social || {}),
    };
    s.vipPass = { ...defaultVipPass(), ...(s.vipPass || {}) };
    ensureDailyRewardsCurrent(s);
  }
  if (!s.version || s.version < 10) {
    for (const club of ClubsRegistry.getAll()) {
      migrateClubRecord(club);
      ClubsRegistry.upsert(club);
    }
  }
  if (!s.version || s.version < 11) {
    s.lobbyMinigames = { ...defaultLobbyMinigames(), ...(s.lobbyMinigames || {}) };
    if (!s.shopClaims) s.shopClaims = {};
  }
  if (!s.version || s.version < 13) {
    s.tournament = { ...defaultTournament(), ...(s.tournament || {}) };
  }
  if (!s.version || s.version < 14) {
    s.specialEvent = { ...defaultSpecialEventProgress(), ...(s.specialEvent || {}) };
    ensureSpecialEventProgress(s);
  }
  if (!s.version || s.version < 15) {
    s.dealerMode = { ...defaultDealerModeStats(), ...(s.dealerMode || {}) };
  }
  if (!s.version || s.version < 16) {
    s.dealerMode = { ...defaultDealerModeStats(), ...(s.dealerMode || {}) };
  }
  if (!s.version || s.version < 17) {
    s.cardBurstDrill = { ...defaultCardBurstDrillStats(), ...(s.cardBurstDrill || {}) };
    s.decksLeftDrill = { ...defaultDecksLeftDrillStats(), ...(s.decksLeftDrill || {}) };
    if (s.specialEvent) {
      s.specialEvent.dealerShifts = s.specialEvent.dealerShifts || 0;
      s.specialEvent.dealerBestAcc = s.specialEvent.dealerBestAcc || 0;
    }
  }
  if (!s.version || s.version < 18) {
    if (s.tournament) {
      s.tournament.inviteCode = s.tournament.inviteCode ?? null;
      s.tournament.pendingInvite = s.tournament.pendingInvite ?? null;
    }
  }
  backfillTrainingHistoryFromLegacy(s);
  s.version = SAVE_VERSION;
  return s;
}

function normalizeAchievements(list) {
  if (!list || !list.length) return [];
  return list.map(a => typeof a === 'string' ? { id: a, unlockedAt: '' } : a);
}

function unlockedAchievementIds(save) {
  return new Set(normalizeAchievements(save.achievements).map(a => a.id));
}

function updatePersonalBests(save, event = {}) {
  const pb = save.personalBests || (save.personalBests = defaultPersonalBests());
  const st = save.stats;
  if (event.type === 'handEnd') {
    if (event.handNetPL > 0) {
      st.winStreak = (st.winStreak || 0) + 1;
      pb.longestWinStreak = Math.max(pb.longestWinStreak, st.winStreak);
    } else if (event.handNetPL < 0) {
      st.winStreak = 0;
    }
    pb.bestBankroll = Math.max(pb.bestBankroll, st.bestBankroll || 0, save.bankroll || 0);
    if (event.sessionNetPL != null) pb.bestSessionProfit = Math.max(pb.bestSessionProfit, event.sessionNetPL);
  }
  if (st.countGuesses >= 10) pb.bestCountAccuracy = Math.max(pb.bestCountAccuracy, calculateCountAccuracyPercent(st));
  if (st.decisionsTotal >= 20) pb.bestDecisionAccuracy = Math.max(pb.bestDecisionAccuracy, calculateStrategyAccuracyPercent(st));
  if (st.recentCount?.length) pb.bestRecentCount = Math.max(pb.bestRecentCount, calculateRecentCountAccuracyPercent(st));
  if (event.type === 'perfectShoe') pb.perfectShoeCounts = (pb.perfectShoeCounts || 0) + 1;
}

function checkAchievements(save) {
  const have = unlockedAchievementIds(save);
  const st = save.stats;
  const pb = save.personalBests || defaultPersonalBests();
  const newly = [];
  const unlock = (id) => {
    if (have.has(id)) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    have.add(id);
    save.achievements.push({ id, unlockedAt: new Date().toISOString() });
    newly.push(def);
  };
  if (st.handsPlayed >= 1) unlock('first-hand');
  if (st.handsPlayed >= 100) unlock('hands-100');
  if (st.helpLevel >= 3) unlock('level-3');
  if (pb.longestWinStreak >= 5) unlock('streak-5');
  if (pb.longestWinStreak >= 10) unlock('streak-10');
  if (Math.max(pb.bestBankroll, st.bestBankroll || 0) >= 2000) unlock('bankroll-2k');
  if (st.countGuesses >= 50 && calculateCountAccuracyPercent(st) >= 90) unlock('count-90');
  if (st.decisionsTotal >= 100 && calculateStrategyAccuracyPercent(st) >= 90) unlock('strategy-90');
  if (save.daily?.completed) unlock('daily-done');
  if ((save.dailyTraining?.totalCompleted || 0) >= 1) unlock('training-daily');
  if ((save.dailyTraining?.streak || 0) >= 7) unlock('training-streak-7');
  if ((save.dailyRewards?.longestStreak || save.dailyRewards?.streak || 0) >= 7) unlock('login-streak-7');
  const social = save.dailyRewards?.social;
  if (social?.facebookConnected || social?.googleConnected) unlock('social-connected');
  if (isVipActive(save)) unlock('vip-member');
  if (save.tutorial?.completed) unlock('tutorial-done');
  if ((save.campaign?.unlocks || []).length >= 4) unlock('all-themes');
  if (st.rank >= 4) unlock('rank-master');
  if ((pb.perfectShoeCounts || 0) >= 1) unlock('perfect-shoe');
  if ((save.countingUnlocks || []).includes('ko')) unlock('ko-unlocked');
  if (save.settings?.countingSystem === 'ko' && st.handsPlayed >= 1) unlock('ko-session');
  if ((save.dealerMode?.sessionsPlayed || 0) >= 1
    && save.dealerMode?.lastSession && !save.dealerMode.lastSession.early) unlock('dealer-shift');
  if ((save.dealerMode?.bestPayoutAccuracy || 0) >= 100) unlock('dealer-perfect');
  return newly;
}

/** Unlock alternate counting systems based on player progress. */
function checkCountingUnlocks(save) {
  const unlocks = new Set(save.countingUnlocks || ['hi-lo']);
  const newly = [];
  const st = save.stats || defaultStats();
  if (!unlocks.has('ko')
    && st.helpLevel >= 2
    && st.countGuesses >= 25
    && calculateCountAccuracyPercent(st) >= 75) {
    unlocks.add('ko');
    newly.push('ko');
  }
  save.countingUnlocks = [...unlocks];
  return newly;
}

function countingSystemLabel(systemId) {
  return COUNTING_SYSTEMS[systemId]?.name || 'Hi-Lo';
}

function nextMilestone(save) {
  const st = save.stats;
  const have = unlockedAchievementIds(save);
  if (!save.tutorial?.completed) return 'Complete the Tutorial to learn Hi-Lo basics';
  if (st.handsPlayed < 25) return 'Play 25 hands to build rhythm — try Practice Range drills';
  if (st.helpLevel < 2 && st.handsPlayed >= 25) return 'Aim for Help Level 2: hide the count and quiz yourself';
  if (!(save.countingUnlocks || []).includes('ko') && st.countGuesses >= 15)
    return 'Reach Help Level 2 + 75% count accuracy (25+ quizzes) to unlock KO';
  if (st.helpLevel < 3 && calculateRecentCountAccuracyPercent(st) >= 75) return 'Push toward Help Level 3 — count hidden, shoe reports only';
  if (!have.has('hands-100') && st.handsPlayed < 100) return `${100 - st.handsPlayed} hands until "Survived 100 Hands"`;
  if (st.countGuesses < 50) return 'Take more count quizzes to sharpen accuracy tracking';
  if (calculateCountAccuracyPercent(st) < 85) return 'Target 85%+ count accuracy before raising your help level';
  if (calculateStrategyAccuracyPercent(st) < 85) return 'Run Decision Drills until strategy accuracy tops 85%';
  return 'You are in great shape — chase Daily Challenges and campaign goals';
}

// ═══════════════════════════════════════════════════════════════
