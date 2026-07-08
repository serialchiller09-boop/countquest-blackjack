# CountQuest Blackjack — Project Bible

## Current State & Next Focus (as of 2026-07-07)

### Current State
- We are in the middle of redesigning the main play screen into a traditional 7-seat no-scroll casino blackjack table.
- Recent attempts using Grok Build’s autonomous `/goal` mode have introduced visible bugs in the interface and created unstable test scripts.
- Core systems (HelpSystem, CardCounter, BasicStrategy, persistence) remain functional, but the UI is currently in a messy/inconsistent state.
- The autonomous workflow is not delivering reliable results at this stage.

### Next Focus
- **Pause heavy autonomous `/goal` runs** for now.
- Return to smaller, more frequent, and controlled prompts with Grok Build (similar to the earlier style).
- Prioritize **fixing the current bugs** in the table layout and making the UI stable and usable again.
- Focus on getting a clean, scroll-free 7-seat table working before trying to push for more autonomy.
- Keep the Project Bible updated as the single source of truth.
- Re-evaluate the automation approach once the core table UI is in a stable state.

**Status**: Living Document — Update this file whenever major decisions, architecture changes, or new patterns are established.  
**Last Updated**: 2026-07-07  
**Purpose**: Single source of truth for vision, architecture, decisions, automation workflows, and development guidelines.

---

## 1. Project Vision & Core Goals

CountQuest Blackjack is an educational, progressively challenging blackjack game whose primary purpose is to teach real card counting (starting with Hi-Lo) while remaining genuinely fun and addictive to play.

**Core Principles**:
- Mathematically accurate (Hi-Lo, true count, basic strategy, index deviations when enabled).
- Progressive help system (5 levels) that fades as the player improves.
- Balance deep education with engaging gameplay (Mini Clip 8 Ball Pool style polish).
- Support both Player Mode and future Dealer Mode.
- “Quest Through the Casinos” visual theme (deep green felt, gold accents, glowing cyan for count/insight elements).
- Keep everything in a single self-contained `index.html` file for as long as practical.

---

## 2. Current Architecture Overview

- Single-file web app (`index.html` + Tailwind CDN + vanilla JS).
- Core preserved systems: Shoe, CardCounter (Hi-Lo + True Count), HelpSystem (5 levels), BasicStrategy engine, stats, ranks, and localStorage persistence.
- Current main pain point: Table organization and scrolling on the main play screen.

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

---

## 3. UI/UX & Theming Guidelines

**Primary Theme**: Quest Through the Casinos  
- Deep green felt, gold accents, glowing cyan for count/insight elements.

**Current Priority**: Redesign the main play screen into a single no-scroll view showing a traditional 7-seat casino blackjack table.

---

## 4. Development & Automation Workflow

High-level planning happens in this conversation. Prompts are generated here and handed off to Grok Build using `/goal`.

### 4.1 Testing & Verification Strategy

Grok Build has repeatedly spent excessive time on complex Playwright test scripts instead of delivering features.

**Guideline**: When the main goal is UI or feature work, explicitly tell Grok Build to **minimize or temporarily ignore** heavy browser-based testing. Only focus on testing infrastructure when that is the primary task.

---

## 5. Decision Log

| Date       | Decision                                      | Rationale                                              | Status      |
|------------|-----------------------------------------------|--------------------------------------------------------|-------------|
| 2026-07-07 | Use 7-seat traditional table layout           | Improves visibility and prepares for Dealer Mode       | In Progress |
| 2026-07-07 | Keep single-file `index.html` structure       | Simplifies development and distribution                | Confirmed   |
| 2026-07-07 | Make prompts more aggressive about testing    | Grok Build frequently over-invests in flaky test code  | Active      |
| 2026-07-07 | Add Testing & Verification Strategy section   | Recurring pattern needs to be documented               | Added       |

---

## 6. Roadmap & Current Priorities

**Now**: Deliver scroll-free 7-seat table layout + apply theming while respecting help levels.

**Next**: Stabilize testing approach, then begin wiring index deviations into live play.

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
- Single-file structure
- Respect all 5 help levels
- Incremental work with checkpoints