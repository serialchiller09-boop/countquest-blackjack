# CountQuest Blackjack — Project Bible

## Current State & Next Focus (as of 2026-07-08)

### Current State
- **Modular web app**: `index.html` shell + `css/app.css` + ten ordered `js/` modules (`01-constants.js` … `09-tests.js`).
- **7-seat casino table** is scroll-free at 1280×720; human (YOU) seat card alignment matches AI seat layout.
- **Core systems** solid: HelpSystem (5 levels), Hi-Lo/KO counting, basic strategy, index deviations in live play, localStorage persistence (SAVE_VERSION 18).
- **CI green**: 68 web tests, CountQuest package tests, 365 embedded browser assertions.
- **Meta-game** (clubs, tournaments, daily rewards, VIP) is local-only — no backend.

### Next Focus
- **Dealer Mode polish** — tighten payout flow and table UX under the same 7-seat layout rules.
- **Optional build step** — bundle modules back to a single file for offline `file://` distribution if needed.
- **Backend later** — only when moving clubs/tournaments off localStorage.

**Status**: Living Document — Update this file whenever major decisions, architecture changes, or new patterns are established.  
**Last Updated**: 2026-07-08  
**Purpose**: Single source of truth for vision, architecture, decisions, automation workflows, and development guidelines.

---

## 1. Project Vision & Core Goals

CountQuest Blackjack is an educational, progressively challenging blackjack game whose primary purpose is to teach real card counting (starting with Hi-Lo) while remaining genuinely fun and addictive to play.

**Core Principles**:
- Mathematically accurate (Hi-Lo, true count, basic strategy, index deviations when enabled).
- Progressive help system (5 levels) that fades as the player improves.
- Balance deep education with engaging gameplay (Mini Clip 8 Ball Pool style polish).
- Support both Player Mode and Dealer Mode.
- “Quest Through the Casinos” visual theme (deep green felt, gold accents, glowing cyan for count/insight elements).
- Modular source layout (`index.html` + `css/` + `js/`) with ordered script tags preserving global API for tests.

---

## 2. Current Architecture Overview

| Layer | Path | Role |
|-------|------|------|
| Shell | `index.html` | HTML, Tailwind CDN, test bootstrap, module script tags |
| Styles | `css/app.css` | Quest Through the Casinos theme, 7-seat table layout |
| Constants | `js/01-constants.js` | SAVE_VERSION, lobby, themes, achievements, migrations |
| Core | `js/02-core-types.js` | Hand, Shoe, card helpers |
| Counting | `js/03-counting.js` | Hi-Lo/KO, bet spread |
| Strategy | `js/04-strategy.js` | Basic strategy + live index deviations |
| Help | `js/05-help-system.js` | 5-level coaching |
| Storage | `js/06-stats-storage.js`, `js/06b-validation.js` | Save/load, validation |
| Engine | `js/07-game-engine.js` | CountQuestApp |
| Tests | `js/09-tests.js` | `runTests()` + bootstrap |

**Tooling**: `scripts/load_project_source.py` concatenates shell + css + js for structure tests. `scripts/split_index.py` can re-split a monolith.

---

## 2.5 Progressive Help System (Detailed Specification)

| Level | Name       | Count Visibility                     | Hints & Feedback                     | Post-Hand Feedback              | Educational Goal                     |
|-------|------------|--------------------------------------|--------------------------------------|---------------------------------|--------------------------------------|
| 0     | Novice     | Always visible + per-card flashes    | Exact advice + strategy always shown | Full detailed breakdown         | Build foundations                    |
| 1     | Guided     | Running Count visible                | Bet range + hints on mistakes        | Clear explanation of decisions  | Active participation                 |
| 2     | Practice   | Hidden during play                   | Strategy only on mistakes            | RC quiz + strategy review       | Force recall                         |
| 3     | Challenge  | Hidden during play                   | Only on explicit request             | Full shoe summary               | Independent decision making          |
| 4     | Expert     | Hidden during play                   | None during play                     | Analytics only at session end   | Realistic simulation / mastery test  |

**Rule**: Every UI change must respect and adapt to all 5 help levels.

**Index deviations in live play** (Hi-Lo, Settings → “Hi-Lo index deviations”):
- `advise()` and `adviseInsurance()` apply catalog indices when true count is known.
- Strategy bar shows `INDEX →` prefix when an index play applies.
- Levels 0–1 get proactive hints at index spots; mistakes log to Review Mistakes.

---

## 3. UI/UX & Theming Guidelines

**Primary Theme**: Quest Through the Casinos  
- Deep green felt, gold accents, glowing cyan for count/insight elements.

**Table layout**: Single no-scroll 7-seat casino view. Human seat (Seat 4) uses gold highlight; cards/totals/bet follow the same grid rules as AI seats.

---

## 4. Development & Automation Workflow

High-level planning happens in this conversation. Implementation uses controlled, small prompts.

### 4.1 Testing & Verification Strategy

| Command | Purpose |
|---------|---------|
| `python scripts/run_web_tests.py` | Structure + logic parity (68 tests) |
| `python -m unittest discover -s countquest/tests` | Python package tests |
| `CQ_BROWSER_TESTS=1 python scripts/run_browser_tests.py` | Embedded `runTests()` (365 assertions) |
| `python scripts/split_720_probe.py` | 1280×720 layout / no-scroll regression |
| `python scripts/browser_smoke.py` | Quick Playwright play-through |

Serve from project root so `/css/app.css` and `/js/*.js` resolve.

---

## 5. Decision Log

| Date       | Decision                                      | Rationale                                              | Status      |
|------------|-----------------------------------------------|--------------------------------------------------------|-------------|
| 2026-07-07 | Use 7-seat traditional table layout           | Improves visibility and prepares for Dealer Mode       | Complete    |
| 2026-07-08 | Split into css/ + js/ modules                 | Maintainability; tests use `load_project_source.py`    | Complete    |
| 2026-07-08 | Wire index deviations into live play          | Settings toggle + strategy hints + mistake logging     | Complete    |
| 2026-07-08 | Human seat alignment fix                      | Match AI card row layout; keep gold highlight           | Complete    |

---

## 6. Roadmap & Current Priorities

**Done**: Scroll-free 7-seat table, modular split, live index deviations, CI, tournament invites.

**Next**: Dealer Mode polish, optional bundle script, backend when needed.

---

## 7. How to Update This Document

Edit this file directly when decisions are made. Update the “Last Updated” date and add entries to the Decision Log.

---

## 8. Prompt Template Library

### Template 1: General Feature Implementation
```markdown
/goal Implement the following feature while preserving existing systems.

Feature: [Describe]

Relevant Bible sections: [List sections]

Requirements:
- Work in css/ and js/ modules (or index.html shell only when needed)
- Respect all 5 help levels
- Incremental work with checkpoints
- Run run_web_tests.py before finishing
```