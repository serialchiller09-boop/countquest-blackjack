# CountQuest Blackjack — Project Bible

**Status**: Living Document  
**Last Updated**: 2026-07-08  
**SAVE_VERSION**: 18 (bump only when save schema changes)  
**Purpose**: Vision, architecture, decisions, and development guidelines.

**Also see:** `docs/NEXT_STEPS.md` for the wrangled priority list.

---

## Current Focus vs Future Ideas

### Current Focus (Active Development)
- Refining the **7-seat casino table layout** (spacing, mobile behavior, scroll reduction, card positioning).
- Fixing UI bugs and improving game flow / post-hand transitions.
- **Play Store path:** Internal testing → device QA → Production when v1-ready.
- Incremental updates with tests (`python scripts/run_web_tests.py`).

### Future Ideas (Brainstorming / Long-term)
- Pit Boss + Heat / pressure system (early shuffles).
- Play as the Pit Boss — identify the counter among 7 players.
- Post-shoe mistake timeline and richer teaching feedback.
- Additional counting systems (Hi-Opt, Omega II, etc.).
- Challenge modes and flavorful rank titles.
- Casino audio (ambiance, card sounds).
- Real online crews (backend) — today clubs are local-only.
- Unity migration (long-term only).

---

## 1. Project Vision & Core Goals

CountQuest Blackjack is an educational, progressively challenging blackjack game that teaches real card counting (Hi-Lo first) while staying fun and addictive.

**Core Principles**:
- Mathematically accurate (Hi-Lo, true count, basic strategy, index deviations when enabled).
- Progressive help system (5 levels) that fades as the player improves.
- 8 Ball Pool–style lobby polish with deep training under the hood.
- Player mode + **Dealer Mode** (live in training drills).
- “Quest Through the Casinos” theme — deep green felt, gold accents, cyan count elements.

---

## 2. Current Architecture Overview

### Web shell (source)
- `index.html` — HTML shell and screen markup
- `css/tailwind.css` — bundled Tailwind (built via `scripts/build_tailwind.py`)
- `css/app.css` — game layout and casino table styles
- `js/*.js` — modular vanilla JS (`00-capacitor-bridge.js` … `09-tests.js`)
- `manifest.webmanifest`, `sw.js`, `privacy.html`

### Distribution
| Target | Mechanism |
|--------|-----------|
| **GitHub Pages** | `dist/` staged by `scripts/stage_dist.py`; workflow `.github/workflows/pages.yml` |
| **PWA** | Service worker `cq-pwa-v3`, icons, offline shell |
| **Android** | Capacitor 8 → `android/`; release AAB via `npm run build:android:release` |
| **iOS** | Capacitor scaffold at `ios/` (requires macOS/Xcode to build) |

### Core preserved systems
Shoe, CardCounter (Hi-Lo + True Count), HelpSystem (5 levels), BasicStrategy, stats, ranks, `localStorage` persistence (`SAVE_VERSION` 18).

### Native bridge
`js/00-capacitor-bridge.js` — sets `window.__CQ_NATIVE`, safe-area class, StatusBar/SplashScreen; skips service worker registration on native.

### Main pain point
Table organization, spacing, and scrolling on the casino play screen — especially mobile (`fitCasinoPlayViewport`, `mobile_probe.py`).

---

## 2.5 Progressive Help System

| Level | Name       | Count Visibility                  | Hints & Feedback                          | Post-Hand Feedback               |
|-------|------------|-----------------------------------|-------------------------------------------|----------------------------------|
| 0     | Novice     | Always visible + per-card flashes | Exact advice + strategy always shown      | Full detailed breakdown          |
| 1     | Guided     | Running Count visible             | Bet range + hints on mistakes             | Clear explanation of decisions   |
| 2     | Practice   | Hidden during play                | Strategy only on mistakes                 | RC quiz + strategy review        |
| 3     | Challenge  | Hidden during play                | Only on explicit request                  | Full shoe summary                |
| 4     | Expert     | Hidden during play                | None during play                          | Analytics only at session end    |

**Rule**: Every UI change must respect all 5 help levels.

---

## 3. UI/UX & Theming

**Theme:** Quest Through the Casinos  
**Priority:** 7-seat table — mobile viewport fit, reduced scroll, card/seat positioning.

**Casino shell:** `#screen-casino-play` fixed between header and action bar; `syncCasinoShellMetrics()` + `fitCasinoPlayViewport()` scale when content overflows.

---

## 4. Development & Automation Workflow

### Key commands
```bash
python scripts/run_web_tests.py      # 74+ structure/logic tests
python scripts/stage_dist.py         # Build dist/ for Pages + Capacitor
npm run cap:sync                     # Stage + cap sync
npm run build:android:release        # Signed Play Store AAB
python scripts/mobile_probe.py       # Phone viewport + casino overflow gate
python scripts/show_build_progress.py
```

### Testing strategy
- Default gate: `run_web_tests.py`
- Layout probes: `mobile_probe.py`, `live_mobile_probe.py` (optional `CQ_LAYOUT_PROBE=1`)
- Minimize heavy browser test investment during pure UI tweaks unless regressions are suspected.

---

## 5. Decision Log

| Date       | Decision                                           | Status        |
|------------|----------------------------------------------------|---------------|
| 2026-07-07 | 7-seat traditional table layout                    | In Progress   |
| 2026-07-07 | Modular `js/` + bundled Tailwind (not CDN)         | Confirmed     |
| 2026-07-08 | Capacitor 8 Android/iOS wrap                       | Complete      |
| 2026-07-08 | Play Store release signing + AAB pipeline            | Complete      |
| 2026-07-08 | Privacy policy + Play Console prep docs            | Complete      |
| 2026-07-08 | Pit Boss / Heat system                             | Future Idea   |
| 2026-07-08 | Post-shoe mistake timeline                         | Future Idea   |

---

## 6. Roadmap & Current Priorities

**Now:**
1. Play Console Internal testing + device QA
2. Table/mobile layout polish
3. Post-hand flow smoothing

**Shipped (6-phase + platform):** Plan 21 lobby, dual currency, daily rewards, clubs, 10+ drills, VIP, tournaments — see `scripts/show_build_progress.py`.

**Play Store:** Docs in `docs/PLAY_CONSOLE_*.md`, `docs/STORE_LISTING.md`.

---

## 7. Future Features (Brainstorming)

See prior sections in git history for Pit Boss, teaching timelines, challenge modes, rank titles, and audio — unchanged in intent, deferred until post-v1.

---

## 8. How to Update This Document

Edit when architecture or decisions change. Update **Last Updated** date and Decision Log. Do not bump **SAVE_VERSION** here unless the save schema changed.

---

## 9. Prompt Template

```markdown
/goal Implement [feature] preserving HelpSystem and SAVE_VERSION 18.

Relevant: PROJECT_BIBLE §2.5, docs/NEXT_STEPS.md

Requirements:
- Respect all 5 help levels
- Run run_web_tests.py
- Match existing js/css patterns
```