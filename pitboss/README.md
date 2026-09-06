# Pit Boss — Case 01: Five Seats

Standalone playable slice of **Pit Boss** for CountQuest Blackjack.

You are the pit boss on the rail at Grosvenor Victoria. Mags deals. Five seats. Exactly one player is counting. Keep a Hi-Lo count, spend at most one Hover and one Shuffle Test, then point.

## How Jeff tries it

1. Open `pitboss/index.html` (GitHub Pages) or this folder locally (local file or any static server).
2. Read the briefing, tap **Take the rail**.
3. Watch bets and cards. Use **Pause** / **Step** and speed **0.8s / 1.6s / 2.4s**.
4. Optional tools: **Mark** (free), **Hover** (1), **Shuffle** (1), **Peek count** (1, costs score).
5. After hand 8: select a seat → **BACK OFF**, or **PASS TABLE** (always wrong in Case 01).
6. Read the dossier and the five-panel bet-vs-true-count graph.

## Query params

| Param | Effect |
|---|---|
| `?seed=12345` | Deterministic case (same shoe, seats, bet noise). Required for QA. |
| `?debug=1` | Overlay: true archetype per seat, live Pearson r, counter raw wanted bet. |
| `?help=0` … `?help=4` | Help level (default **1** Guided). See map below. |
| `?test=1` | Run must-pass tests; print PASS/FAIL on the page (no play session). |

Examples:

```
index.html?seed=42&help=1
index.html?seed=42&debug=1
index.html?test=1
```

### Help levels

| Level | Rail notebook | Seat UI |
|---|---|---|
| 0 Novice | RC, decks, TC | Fact chips on bet jumps/drops |
| 1 Guided (default) | RC, decks, TC | Fact chips; post-Hover note |
| 2 Intermediate | RC, decks (you compute TC) | No fact chips |
| 3 Advanced | Decks only | Nothing extra |
| 4 Expert | Blank | Nothing extra |

## Files

- `index.html` — entry page
- `css/pitboss.css` — pit view styling
- `js/case01-constants.js` — `CASE01` knobs + name pool
- `js/case01-rng.js` — mulberry32 seeded RNG
- `js/case01-archetypes.js` — bet brains
- `js/case01-engine.js` — shoe, deal, tools, call
- `js/case01-dossier.js` — score, leak, graph
- `js/case01-ui.js` — layout and loop
- `js/case01-tests.js` — must-pass suite

## Rules (locked)

6 decks, cut at 1.5 decks remaining, Mags H17, peek BJ, 3:2, DAS, no surrender, unit $25, max $500. Auto-deal. No suspicion percents on faces.

## Tests

Open `index.html?test=1` or in console after load:

```js
Case01Tests.runAll()
```

Covers: exactly one counter (50 samples), hover flattens only counter, shuffle resets RC, cannot call before 8, peek penalizes, graph has five series, replay seed, whale wrong-backoff penalty.
