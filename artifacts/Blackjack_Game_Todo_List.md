# Blackjack Game — To-Do List

Project: **CountQuest Blackjack** (`index.html` single-page web app + Python prototype in `countquest/`)

---

## 1. Tutorial System

### 1.1 Tutorial back/next navigation — ✅ COMPLETE

**Status:** Done (2026-07-07)

**Problem:** The tutorial has five pages (`TUTORIAL_STEPS`). The Back button on page 1 did nothing. Other pages only decremented the step index. Opening Tutorial/Campaign/Daily also failed to show screens because `render()` was not called (fixed in a prior pass).

**Changes made:**
- **`tutorialBack()`** — On step 0 (page 1), calls new **`exitTutorial()`** which returns to the main menu via `goMenu()` without marking the tutorial complete.
- **`exitTutorial()`** — Clean exit with toast; progress (step index) is preserved in save data.
- **`openTutorial()`** — If tutorial was previously completed, resets to step 0 when re-opened.
- **`skipTutorial()`** — Extracted skip handler (existing “Skip Tutorial → Full Campaign” button); marks complete and starts campaign.
- **`lockTutorialNav()`** — 280ms timestamp debounce (does **not** disable buttons or block pointer events).
- **`updateTutorialNavButtons()`** — Page 1 Back label is **“← Main Menu”**; other pages show **“Back”**.
- **Event delegation** on `#screen-tutorial` so Back/Next/Skip clicks always reach handlers.
- **Fix (follow-up):** Removed `disabled` + `pointer-events: none` on nav buttons — that was leaving the Welcome-page Back button unclickable after navigation lock.
- **Keyboard** — `ArrowRight` / `PageDown` = Next; `ArrowLeft` / `PageUp` / `Escape` = Back (exit on page 1).
- **Accessibility** — `aria-label` on nav buttons, `aria-live` on progress, focus moves to step title after each transition, `tutorial-panel` step animation replay.
- **Tests** — `runTests()` assertions for 5 steps, back-on-page-1 → menu, next/back step indexing.

**Files touched:** `index.html` (HTML tutorial section, `CountQuestApp` tutorial methods, `bindUI` keyboard handler, `runTests()`)

**How to verify:**
1. Main menu → Tutorial
2. Next through all 5 pages
3. Back from page 5 → 4 → 3 → 2 → 1
4. Back on page 1 → returns to main menu
5. Optional: Skip Tutorial → starts Full Campaign

---

## 1.2 Beginner-friendly labels & count display — ✅ COMPLETE

**Status:** Done (2026-07-07)

**Problem:** Jargon and symbols confused new players — floating `+1`/`−1` deltas, `(hard)` hand tags, `(Δ …)` in hand reviews, unexplained “shoe,” and terse HUD labels.

**Changes made:**
- **Count change popup** — Replaced bare `+1` with **“Count Change: +1”** plus an **(i)** info button explaining tags in plain English (`COUNT_DELTA_TIP`).
- **Hand-end review** — Replaced `(Δ n)` with `Running count: +2 → +5 (change +3 this hand)` via `formatHandRunningCountReview()`.
- **Hand totals under cards** — New `Hand.beginnerDisplaySummary()` / `handTotalHtml()`: e.g. **“Hard 16 (Ace counts as 1)”**, **“Soft 17 (Ace counts as 11)”** — no redundant suit text (suits stay on the card faces only). First 3 hard-hand appearances get an extra one-line tip.
- **Shoe jargon** — Header **“Cards left”** (was “Shoe”); table line **“Remaining cards in deck: …”** with first-time shoe definition; shoe modal titled **“Deck Round Complete”**.
- **Count HUD** — Labels renamed (Running Count, True Count, Decks Left, Cards Tagged) with **(i)** tooltips on key tiles.
- **Settings → Display** — Toggles for **show count display** and **show count-change popups** (`settings.showCountDisplay`, `settings.showCountPopups`).

**Files touched:** `index.html`

---

## 1.4 Count quiz — no auto-advance — ✅ COMPLETE

**Status:** Done (2026-07-07)

**Problem:** After submitting a count guess, the quiz modal auto-closed after 1s (and drill quiz auto-advanced after 1.2s) before the player could read the explanation.

**Changes made:**
- Rebuilt `#modal-count-quiz` with **form** + **feedback** sections.
- On submit: show result + plain-English explanation; **hide** Submit; **show** **“Got it — Next”** (`#btn-count-quiz-continue`).
- Removed all `setTimeout` auto-close from `submitRunningCountQuiz()` and `submitDrillCountQuiz()`.
- `dismissCountQuiz()` — player must click **Got it — Next** (or Skip for now) to continue; drill flow then shows shoe analysis.
- `resetCountQuizModal()` — resets state whenever the quiz opens.

**Files touched:** `index.html` (`submitRunningCountQuiz`, `submitDrillCountQuiz`, `showPostHandModals`, `bindUI`)

---

## 1.3 Full-width immersive layout — ✅ COMPLETE

**Status:** Done (2026-07-07)

**Problem:** On desktop the game felt like a narrow sidebar on the right half of the screen. A permanent stats panel (`#stats-sidebar` with `lg:translate-x-0`) stayed open while header, main, and action bar reserved 320px via `lg:mr-80`. The main play area was further capped at `max-w-3xl` (~768px).

**Root cause:** Intentional two-panel split (stats + game) that never collapsed on large screens, squeezing the felt table into the remaining column.

**Changes made:**
- **Removed split-panel layout** — Dropped `lg:mr-80` from `#app-header`, `#app-main`, and `#action-bar`; dropped `lg:translate-x-0` from `#stats-sidebar`.
- **Collapsible stats overlay** — Stats panel is a slide-in overlay on all breakpoints; added `#stats-backdrop` dim layer, `body.stats-open` scroll lock, Escape/backdrop click to close.
- **Stats access** — `#btn-toggle-stats` in game header (all sizes); `#btn-menu-stats` on main menu; close button always visible.
- **Wider game canvas** — `.app-main` max-width 72rem (6xl); `#screen-table` max-w-5xl; `.game-table-wrap` max 56rem centered; bet/hand-end screens use `game-screen` + max-w-4xl/5xl.
- **Casino atmosphere** — Full-viewport radial gradient on `body` (`min-height: 100dvh`); felt table shadow/padding tuned for tablet+.
- **CSS fallbacks** — Removed `@media (min-width: 1024px)` rules that forced sidebar open + right margin when Tailwind CDN is slow/offline.
- **Tests** — `runTests()` layout assertions; `run_web_tests.py::test_full_width_layout_no_split_panel`.

**Files touched:** `index.html`, `scripts/run_web_tests.py`

**How to verify:**
1. Hard refresh (`Ctrl+Shift+R`) at `http://localhost:8765/index.html`
2. Start Practice Range → bet/table screens should span the full window (table centered, not right-aligned)
3. Resize desktop / tablet / mobile — layout stays centered; action bar full width
4. Open Stats from header or menu — overlay slides in with dim backdrop; close via ✕, backdrop, or Escape
5. Run `python scripts/run_web_tests.py` (37 tests) or open `?test` in browser

**Notes:** Menu/tutorial/campaign screens stay intentionally narrow (`max-w-lg`/`max-w-xl`) for readability; only in-game bet/table/hand-end use the wide casino layout. Animations (deal, chip fly, count popup, modals) unchanged.

---

## Workflow & Developer Tooling

### Terminal UI — Rich + Textual

**Status:** Installed (2026-07-07)

**Packages:**
```bash
pip install rich textual
```
Pinned in `requirements.txt` (`rich>=15.0.0`, `textual>=8.2.0`).

**How we use them going forward:**
- **Rich** — Default output for all task work: styled header, progress spinner/bar while working, summary table at the end. Helpers in `scripts/task_output.py` (`TaskReporter`).
- **Textual** — Full-screen terminal UI apps when we build or extend the Python CLI blackjack experience (`countquest/`).

**Task output convention (use on every to-do item):**
1. **Header** — `TaskReporter.header()` with task ID, title, and one-line goal
2. **Progress** — `TaskReporter.progress()` with labeled steps while investigating / editing / testing
3. **Summary table** — `TaskReporter.summary()` listing area, what changed, and status (DONE / FAILED)

**Quick commands:**
| Command | Purpose |
|---------|---------|
| `python scripts/task_output.py` | Demo Rich task report (tutorial back button fix, task 1.1) |
| `python scripts/show_todo_table.py` | Print critical tasks from this to-do list as a colored Rich table |
| `python scripts/show_todo_table.py --test` | Run Rich/Textual import + to-do parse tests |
| `python scripts/run_web_tests.py` | Web logic + HTML structure tests (37 tests) |

**Notes:** The web game (`index.html`) is unchanged by these tools — they improve developer/terminal output only. Future section 2 items can add a Textual-based practice dashboard or Rich-enhanced test reports.

---

## 2. Training Features

### 2.0 Training Mode hub — ✅ FOUNDATION COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Main menu **[5] Training Mode** opens a drill catalog screen (`screen-training`). All drills live in one expandable `TRAINING_DRILLS` registry (category, status, launch id). Live drills route through `launchTrainingDrill()`; placeholders show **Soon** badge and stay disabled.

**Files:** `index.html`, `scripts/show_training_menu.py`

**Verify:** `python scripts/show_training_menu.py` · Main menu → [5] Training Mode

---

### 2.2 True Count Conversion Drill — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Training Mode → **True Count Conversion Drill**. Shows running count + decks remaining; player inputs true count (RC ÷ decks); instant feedback; difficulties: Whole Numbers / One Decimal / Precise; 5–15 problems per round; session + lifetime accuracy.

**Files:** `index.html`, `scripts/run_true_count_drill_build.py`

**Verify:** `python scripts/run_true_count_drill_build.py`

---

### 2.6 Bet Spread Practice — ✅ COMPLETE (full feature set)

**Status:** Done (2026-07-07) — includes all suggested improvements

**What it does:** Training Mode → **Bet Spread Practice**. Hi-Lo or KO spread; standard/wide/custom range; ½-Kelly overlay; heat simulation; 2% bankroll warnings; optional 5s timed rounds; session SVG graph; ramp + history tracking.

**Files:** `index.html`, `scripts/run_bet_spread_build.py`

**Verify:** `python scripts/run_bet_spread_build.py` · Training Mode → 📈 Bet Spread Practice

---

### 2.5 Index Play Drill (Strategy Deviations) — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Training Mode → **Index Play Drill**. Shows hand + true count; player picks correct deviation (or basic strategy play). 10 Hi-Lo indices; modes: Random, Insurance Only, Stand, Double; instant feedback with explanations; session + training history.

**Files:** `index.html`, `scripts/run_index_play_drill_build.py`

**Verify:** `python scripts/run_index_play_drill_build.py` · Training Mode → 🧠 Index Play Drill

---

### 2.4 Training Progress Tracking — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Unified `save.trainingHistory` logs every drill session (accuracy, attempts, avg error, timestamp). Training Mode → **📈 Training History** shows past sessions, per-drill filters, and a simple recent-vs-earlier improvement readout. Legacy speed/combined sessions backfill on first load.

**Files:** `index.html`, `scripts/show_training_history.py`

**Verify:** `python scripts/show_training_history.py` · Training Mode → 📈 Training History

---

### 2.7 Drill Session Summary Screen — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Unified `screen-drill-session-summary` after every training drill. Shows accuracy %, correct/incorrect counts, avg error (counting drills), elapsed time, progress bar, and comparison vs `save.drillSessionBests` personal best. All 8 live drills hooked; bet spread includes session chart.

**Files:** `index.html`, `scripts/show_drill_session_summary.py`

**Verify:** `python scripts/show_drill_session_summary.py` · complete any drill session

**Next:** Sparkline trends, mistake highlights, pace analytics (see build summary).

---

### 2.6 Daily Training Goals — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Rotating daily training goals (speed count 80%+, 50 combined hands, true count 75%+, etc.) tracked in `save.dailyTraining`. Completing a goal awards bonus chips and builds a streak; finishing both the daily challenge and training goal same day grants a synergy bonus. Visible on Daily Challenge screen and Training Mode hub.

**Files:** `index.html`, `scripts/show_daily_training_goals.py`

**Verify:** `python scripts/show_daily_training_goals.py` · Daily Challenge [4] or Training Mode [5]

**Next:** Weekly training calendar, goal picker, streak recovery (see build summary).

---

### 2.5 Mistake Review Log — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Every live training drill logs individual mistakes to `save.mistakeReviewLog` (wrong vs correct, context, detail). Training Mode → **📋 Review Mistakes** shows recent errors with per-drill filters and a summary panel — learn from past count, strategy, bet, deviation, and spread errors.

**Files:** `index.html`, `scripts/show_mistake_review.py`

**Verify:** `python scripts/show_mistake_review.py` · Training Mode → 📋 Review Mistakes

**Next:** Drill-from-mistake, spaced repetition, clear/archive, CSV export (see build summary).

---

### 2.3 Combined Practice Mode — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Training Mode → **Combined Practice**. Deals real blackjack hands at minimum bet; running count hidden during play; Hit/Stand/Double/Split with strategy coaching on mistakes; post-hand count quiz (±1) plus strategy review; session and lifetime stats for count + strategy accuracy.

**Files:** `index.html`, `scripts/run_combined_practice_build.py`

**Verify:** `python scripts/run_combined_practice_build.py` · Training Mode → 🃏 Combined Practice

**Next:** Bet sizing in combined hands, hand targets, true-count quiz variant (see build summary).

---

### 2.1 Running Count Speed Drill — ✅ CORE COMPLETE

**Status:** Done (2026-07-07) — core loop functional

**What it does:** Practice Range → **Running Count Speed Drill**. Cards auto-deal at chosen speed; player keeps Hi-Lo running count; quiz at end with instant feedback; stats panel tracks accuracy, avg error, best/worst sessions.

**Settings:** 20 / 40 / 60 cards · Slow / Normal / Fast · show/hide count (training wheels)

**Files:** `index.html`, `scripts/run_speed_drill_build.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/run_speed_drill_build.py` · Practice Range → ⚡ Speed Drill

**Next:** Card bursts, KO variant, streak goals, Textual CLI mirror (see build summary).

---

## 3. Economy & Social

### 3.1 Dual currency + table costs — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Two currencies — **Chips** (soft, earned easily) and **Gems** (hard, premium). Visible bankroll on main menu and in-game header. **Table Lobby** (main menu [6]) offers four tiers — Beginner, Casual, High Roller, Pro — with chip entry fees, rank/help gates, and per-tier bet limits. Joining deducts entry from the player; house matches ante (pot = 2× entry). Ending a winning table session pays **1.8× entry** (~10% rake). Pro tier also costs 1 gem.

**Files:** `index.html`, `scripts/show_dual_currency_tables.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_dual_currency_tables.py` · Main menu [6] Play Tables · `python scripts/run_web_tests.py`

**Next:** Daily Rewards (login streaks, chip/gem drops) or club bankroll / crew tables.

---

### 3.2 Counting Crews (Clubs) — ✅ FOUNDATION COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Main menu **[7] Counting Crews** — create a club (name, description, public/private), search public clubs, join (max **50** members), and view a **member list** (owner, rank, help level). Club registry in `localStorage` (`countquest-clubs-v1`); membership in `save.club` (SAVE_VERSION 6). Demo crews seeded on first visit.

**Files:** `index.html`, `scripts/show_clubs.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_clubs.py` · Main menu [7] Counting Crews · `python scripts/run_web_tests.py`

**Next:** Goal progress tracking, club bankroll, invites (see build summary).

---

### 3.3 Club hierarchy (Leader / Co-Leader / Officer / Member) — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Four-tier crew hierarchy with permission matrix. **Leader** has full control (promote/demote, kick, edit info, set goals, transfer leadership). **Co-Leader** edits info/goals and manages officers/members. **Officer** kicks members only. **Member** is view-only. Leader tools on member rows (▲▼✕👑) and **Edit Crew Info & Goal** form. Crew goals displayed on hub. SAVE_VERSION 7.

**Files:** `index.html`, `scripts/show_club_hierarchy.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_club_hierarchy.py` · [7] Counting Crews · `python scripts/run_web_tests.py`

**Next:** Shared crew bankroll, top-3 weekly payouts, invite codes.

---

### 3.4 Club Hub + Weekly Championship — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** In-crew **[7] Counting Crews** opens the **Club Hub** — announcements, weekly championship progress bar, internal leaderboard (🥇🥈🥉), crew chat with reactions, member list with weekly stats & leader tools. Points from hands (+5), wins (+8), count quizzes (+15), drill accuracy (0.5×%). Crew milestones at 250/500/1000 pts award chips (+ gem). Leader/Co-Leader edit crew, set weekly challenge, post announcements.

**Files:** `index.html`, `scripts/show_club_hub.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_club_hub.py` · Join/create crew → Club Hub · `python scripts/run_web_tests.py`

**Next:** Shared crew bankroll integrated with chip economy (see build summary).

---

### 3.5 Daily Login Rewards + Social Connect — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Distinct **daily login reward** track in `save.dailyRewards` — 7-day escalating chip/gem ladder, login streaks, auto-claim modal on menu visit, full **Daily Rewards** screen (main menu **[8]**). One-time **Facebook** and **Google** connect bonuses (simulated locally — no OAuth). Login panel also on Daily Challenge screen [4]. Synergy with daily challenge/training unchanged but VIP doubles synergy. SAVE_VERSION 9.

**Files:** `index.html`, `scripts/show_daily_rewards.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_daily_rewards.py` · Main menu [8] Daily Rewards · auto popup on first visit

**Next:** Weekly login calendar UI, streak recovery item, real OAuth if backend added.

---

## 5. VIP Pass & Integration Polish — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** **VIP Pass** in `save.vipPass` — 3-day free trial (once), 25-gem / 30-day purchase, extend while active. Perks: **2× daily login chips**, **2× daily synergy bonus**, **+10% table win payouts**, VIP badge on menu. Integrated into `settleTableSession`, `claimDailyLoginReward`, `checkDailyRewardsSynergy`. Master progress reporter: `scripts/show_build_progress.py`.

**Files:** `index.html`, `scripts/show_vip_pass.py`, `scripts/show_build_progress.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_vip_pass.py` · `python scripts/show_build_progress.py` · Daily Rewards [8] → VIP section

**Next:** IAP wiring, VIP-exclusive tables, cosmetic themes.

---

## 4. Club Economy & External Services — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:**
- **Shared crew bankroll** — `club.bankroll` chips/gems pool; members contribute; Leaders/Co-Leaders distribute
- **Weekly top-3 payouts** — automatic at ISO week rollover: 🥇 500+2💎 · 🥈 300+1💎 · 🥉 150🪙 (crew bankroll first, house top-up)
- **Invite codes** — 6-character codes on create; join public/private crews via browse panel; leader regenerate
- **OAuth wiring** — `ExternalAuth` loads Google GIS / Facebook SDK when client IDs saved in Settings
- **IAP wiring** — `ExternalIAP` opens Stripe payment link; return URL `?vip_purchased=1` activates VIP; gem fallback when unconfigured

**Files:** `index.html`, `scripts/show_club_economy.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_club_economy.py` · [7] Counting Crews · Settings → OAuth & IAP

**SAVE_VERSION:** 10

---

## 6. Plan 21 — 8 Ball Pool-Style Lobby — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:** Full **8BP-style home screen** replacing the narrow menu list. **Top nav:** prominent Clubs, Training Aids, Free Rewards (badge), Leaderboards, Shop. **Profile ring** with player level, **Chips + Gems** pills, **CountQuest Pass** banner with countdown timer. **Big colorful Play buttons:** 1v1 Tables, Tournaments, Special Event, Training Drills, With Friends. **Bottom minigame row:** Surprise Training Box, Spin & Win, Scratch & Win, Lucky Count Shot (daily free plays). Shop modal, leaderboards modal (crew weekly + personal stats). SAVE_VERSION 11.

**Files:** `index.html`, `scripts/show_plan21_lobby.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_plan21_lobby.py` · Open `index.html` — lobby is home

**Next (Plan 21 continuation):** Tournament brackets UI, friend invite deep links — see §7.

---

## 7. Plan 21 Next — Tournaments & Invite Links — ✅ COMPLETE

**Status:** Done (2026-07-07)

**What it does:**
- **8-player Pro Tournament** — single-elimination bracket UI (`screen-tournament`), Pro tier entry (5000 chips + 1 gem), 5-hand duel matches with isolated match bankroll vs AI target score
- **Prize pool** — 🥇 25K+3💎 · 🥈 10K+1💎 · 🥉 5K semifinalists; AI vs AI rounds simulate automatically
- **Friend invite deep links** — `?join=CODE` auto-joins crew on load; club hub copies full shareable URL via `buildClubInviteUrl`

**Files:** `index.html`, `scripts/show_tournament.py`, `scripts/run_web_tests.py`

**Verify:** `python scripts/show_tournament.py` · Lobby → Tournaments · `index.html?join=INVITE`

**SAVE_VERSION:** 13