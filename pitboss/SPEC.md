# Pit Boss — Case 01: "Five Seats"
Implementation spec for Grokbot  
Status: LOCKED for prototype  
Product name: **Pit Boss**  
Mode name: **Lineup**  
Case id: `case01_five_seats`  
Version: 1.0

This is the first playable slice of the rebrand.  
Promise: five people at one blackjack table, exactly one is counting, the player keeps the count, then points.

If this slice is not fun, do not add pits, teams, or campaign. Fix this.

---

## 0. What this case is not

- Not dealer mode. Player does not pay, pitch, or resolve insurance.
- Not a trainer quiz. Count checks are optional and punished.
- Not a suspicion-meter game. No face gets a percent.
- Not "empty table," teams, cheaters, or dirty dealers. Those are later cases.
- Not a tycoon. No layout, hiring, or slot machines.

---

## 1. Success criteria

Case 01 ships when a new player can do this without a manual:

1. Watch a shoe of ~16–24 hands at one table.
2. Hold a Hi-Lo running count (with help-level support, never an answer key on faces).
3. Spend at most one Hover and one Shuffle Test.
4. Point at a seat, or realize they waited too long.
5. See a dossier that includes the **bet-vs-true-count graph**.
6. Immediately understand why they were right or wrong.

Acceptance bar: after 5 shoes, a player who can already count should beat random guessing by a wide margin. A player who cannot count should feel the graph teaching them what they missed — not feel cheated.

---

## 2. Table and shoe

Reuse CountQuest blackjack rules unless this spec overrides them.

| Rule | Value |
|---|---|
| Decks | 6 |
| Shuffle | Start of case only, unless player spends Shuffle Test |
| Cut card | 1.5 decks remaining (78 cards). When hit, deal this hand then **force the call** if none has been made |
| Dealer | Margaret "Mags" Hawthorne. Hits soft 17. Peeks blackjack. |
| BJ pays | 3:2 |
| Insurance | Offered on Ace. AI players decide per archetype. Player does not resolve it. |
| DAS | Yes |
| Surrender | No |
| Seats | 5, labeled 1–5 left to right from pit view (seat 1 = first base, seat 5 = third base) |
| Table min / unit | $25 = 1 unit |
| Table max | $500 (20 units). Nobody in Case 01 should hit this. |
| Players | 5 AI. No empty seats. |
| Player role | Pit boss on the rail. Cannot sit. Cannot bet. |

### Deal pacing

Auto-deal. Player is watching, not clicking strategy.

- Default: **1.6s per resolved hand** after chips are down (snappy).
- Player can **Pause** (time stops) and **Step** one hand.
- Player can set speed: 0.8s / 1.6s / 2.4s.
- Betting moment is held **0.6s** so chip-size change is readable.
- Do not require the player to click hit/stand for anyone.

Hands per shoe at 5 spots will land around **16–24 rounds**. That is the case length.

### Minimum observation

Player cannot Back Off or Pass until **hand 8 is complete**.  
Marks, Hover, Shuffle Test, and Peek Count are available from hand 1.

---

## 3. Hi-Lo — the player's instrument

Same as CountQuest:

- 2–6 = **+1**
- 7–9 = **0**
- 10–A = **−1**
- Running count starts at 0 after shuffle.
- True count at betting time = `round(runningCount / decksRemaining)` using standard half-up, where  
  `decksRemaining = max(0.5, cardsLeft / 52)`  
  displayed to the player only according to help level.

**Critical:** the house simulation uses the *true* count. The UI must never paint the true count onto a face or next to a chip stack.

### Peek Count (optional, costs score)

Control: "Check my count" — reuse CountQuest copy.

- Player enters running count.
- If within ±1 of truth: show "Close enough. RC = {true}."
- Else: show "Off. RC = {true}."
- Either way: flag `peekUsed = true`. This is a dossier penalty. One peek per case.

Help levels may show RC/TC on a **personal rail widget** (the player's notebook). They must not label seats.

---

## 4. Help levels (map to existing 0–4)

| Level | Rail widget | Seat UI | Tests |
|---|---|---|---|
| 0 Novice | Shows RC, decks left, TC | After each hand, a neutral fact chip on any seat whose bet changed by ≥2 units: "bet jumped" / "bet dropped" — never "matches count" | Tooltips on Hover / Shuffle |
| 1 Guided | Shows RC, decks left, TC | Fact chips only. After Hover, a note "spread flattened" or "no change" | Same |
| 2 Intermediate | Shows RC and decks left. Player computes TC | No fact chips | Tools unlabeled beyond name |
| 3 Advanced | Decks left only | Nothing | Nothing extra |
| 4 Expert | Blank. Player counts cards and decks | Nothing | Nothing extra |

Never: "87% counter", colored guilty aura, or arrow to the answer.

---

## 5. Case generation

On start:

1. Shuffle a 6-deck shoe. Seed = `Date.now()` unless `?seed=` is passed (required for QA).
2. Assign archetypes to seats:
   - Exactly one `COUNTER`
   - Exactly one `LUCKY_TOURIST`
   - Exactly one `MARTINGALE`
   - Remaining two drawn without replacement from `{CHATTER, WHALE_LITE, FLAT_BETTOR}`
3. If `WHALE_LITE` is in the pit, briefing mentions them by **buy-in and clothes**, not by the word whale if that makes the seat obvious. See briefing.
4. Deal first cards only after briefing is dismissed.

Display names: pick from a 20-name pool, no repeats at the table. Do not reuse "Mags" as a player.

---

## 6. Seat data model

```js
Seat = {
  id: 1..5,
  name: string,
  archetype: enum,
  buyInUnits: int,
  stackUnits: int,
  nextBetUnits: int,
  history: [{
    hand: int,
    tcAtBet: int,          // true count when they put chips out
    rcAtBet: int,
    betUnits: int,
    outcome: "win"|"lose"|"push"|"bj"|"bust",
    indexDeviation: bool,  // true if play departed basic in an AP-looking way
    insured: bool
  }],
  flags: {
    hoveredHandsRemaining: 0,
    flattenedByHover: false,
    reactedToShuffle: false,
    camouflageSpent: false
  }
}
```

Log every hand for the graph. If you do not log `tcAtBet` and `betUnits`, the reveal is dead.

---

## 7. Archetypes — exact bet brains

All bets snap to whole units. Stack cannot go below 0; if a seat busts out, they buy in again for half original buy-in (keeps five bodies at the table).

Basic strategy is shared. Only `COUNTER` may take index deviations, and only a tiny set (below).

### 7.1 COUNTER  — the target

**Buy-in:** 40 units ($1,000).

**Spread (the hard tell):**

```
tc = tcAtBet
if (seat.flags.hoveredHandsRemaining > 0) {
  bet = 1
} else if (tc <= 0) {
  bet = 1
} else {
  bet = clamp(1 + tc, 1, 6)
}

// Cover: 18% of hands where raw bet >= 3, shave one unit
if (bet >= 3 && rand() < 0.18) bet -= 1

// Camouflage error, once, in hands 3–10, only if tc <= 0
if (!camouflageSpent && hand in [3,10] && tc <= 0 && rand() < 0.35) {
  bet = 2
  camouflageSpent = true
}
```

**Play:**
- Perfect basic strategy.
- Index deviations allowed only:
  - Insurance at TC ≥ +3
  - Stand 16 vs 10 at TC ≥ 0
  - Stand 15 vs 10 at TC ≥ +4
- These are **soft tells**. Use them. Do not spray more deviations in Case 01.

**Behavior:**
- Does not drink alcohol (soda glass on the rail).
- Tips 1 unit on a blackjack only when TC ≥ +2 (looks like a winner being generous; still a cluster tell).
- Watches other hands. Idle anim: eyes on discard tray 30% of betting windows.
- First hand after any shuffle (start or Shuffle Test): always 1 unit.
- On Shuffle Test while TC was ≥ +2: slump anim + next 2 bets forced to 1. Set `reactedToShuffle = true`.

**Insurance:** Take only at TC ≥ +3.

### 7.2 LUCKY_TOURIST  — the main decoy

**Buy-in:** 24 units.

**Brain:** streak, not count.

```
base = 2
if (winsInARow >= 2) desired = pick(4,5,6)
else if (lastBet >= 4 && lastOutcome == "lose") desired = 2
else desired = 2
// 10% spice
if (rand() < 0.10) desired = pick(1,3)
bet = desired
```

**Play:** basic with 15% random noise (hit/stand only, never weird doubles).  
**Insurance:** never.  
**Behavior:** drinks, celebrates wins, talks. Does **not** flatten on Hover. Does **not** slump after Shuffle Test.  
**Why they fool people:** a heater during a plus shoe looks like a spread if the player only watches winners.

### 7.3 MARTINGALE

**Buy-in:** 32 units.

```
if (lastOutcome == "lose") bet = min(lastBet * 2, 8)
else bet = 1
```

**Play:** basic with 25% noise. Hits 16 vs 10 too often.  
**Insurance:** random 15%.  
**Behavior:** sighs on losses, jams chips after a loss. Hover does nothing. Shuffle Test does nothing to bet logic.  
**Why they fool people:** the doubles look like a sudden max bet. Plot them against TC and the line is garbage. That is the lesson.

### 7.4 CHATTER

**Buy-in:** 20 units.

```
bet = (rand() < 0.12) ? 3 : 2
```

**Play:** "I have a system" — basic with 20% noise.  
**Insurance:** often (40%), because they bought the myth.  
**Behavior:** talks to Mags, tips 1 unit every 4–6 hands regardless of count, looks at a paper "chart." Hover: they talk *more*. Shuffle: they cheer.  
**Soft-tell trap:** serious posture. Zero hard tell.

### 7.5 WHALE_LITE

**Buy-in:** 80 units. Gold-trim chips or a visible marker so the boss can recognize high action.

```
bet = weightedPick({4:0.35, 6:0.35, 8:0.20, 10:0.10})
```

Never bets 1. Ignores count.  
**Play:** sloppy. Hits 18 sometimes (8%).  
**Insurance:** 25% random.  
**Behavior:** drinks whiskey, bored, phones allowed. Hover: glances at you, keeps betting large. Shuffle: shrugs.  
**Backoff penalty:** if innocent and backed off, extra heat. See dossier.

### 7.6 FLAT_BETTOR

**Buy-in:** 16 units.

```
bet = 2   // always
```

**Play:** true basic. Quiet.  
**Insurance:** never.  
**Behavior:** the control group. Exists so "quiet and focused" is not a free win.

---

## 8. Player actions

### 8.1 Mark (free, unlimited)

Toggle a seat pin: empty / warm / cold.  
Pins are the player's memory. They do nothing mechanically. Persist until call.

### 8.2 Hover — 1 per case

Player stands behind one seat.

- Duration: the next **3 complete hands**, then auto-ends.
- Visual: boss silhouette behind that chair, Mags glances up.
- Mechanical effect: only `COUNTER` flattens (see 7.1).
- Others: no bet-logic change. Chatter talks more (flavor).
- Notebook (help ≤ 1 only): after the 3 hands, one line  
  - COUNTER: "Spread flattened under the eye."  
  - else: "No change in sizing."
- Cannot Hover and Shuffle on the same hand. Queue the second action to the next betting window.

### 8.3 Shuffle Test — 1 per case

Player tells Mags to shuffle now.

- Immediate shuffle. RC = 0. New cut card at 1.5 decks.
- Case does **not** reset. History stays. You are burning penetration on purpose.
- COUNTER: first post-shuffle bet = 1. If pre-shuffle TC ≥ +2, slump + 2-hand flatten.
- Innocents: no bet-logic change. Tourist may complain in flavor text.
- After a Shuffle Test, minimum-observation lock does not reset. Player may call as soon as the first post-shuffle hand ends if hand index ≥ 8.

Use this as a probe, not a reset button.

### 8.4 Peek Count — 1 per case

Described in §3. Does not pause the table unless the player is already paused.

### 8.5 The Call — Back Off seat N, or Pass

Available after hand 8.

**Back Off**
- Table freezes mid-next-betting-window.
- Mags: "Sir/ma'am — blackjack is closed for you tonight."
- Target stands up. Dossier.

**Pass**
- "Table's clean." Dossier. Always wrong in Case 01 (there is always one counter). Include Pass anyway so the control is learned before Empty Table cases exist. Dossier should say the move exists, and that this shoe was not empty.

No second guess. Commit is the sport.

---

## 9. Briefing (copy, Case 01)

Title: **Five Seats**  
Dealer: Mags · Pit: Grosvenor Victoria · Swing shift

> Keep the count. Watch the spreads. One of them is working the shoe.  
> You get one hover and one shuffle. After eight hands you can point.  
> If you wait for the cut card, they already got paid.

If a WHALE_LITE is seated:

> Seat {n} bought in heavy. If you back off the wrong high-action guest, the shift manager will hear about it.

Do not say "exactly seat 3 is suspicious." Do not name the archetype.

Mags line when the player first hovers:

> "I'll keep dealing. You see something, you say."

---

## 10. Dossier math

Compute after the call. Show integers. No hidden multipliers the player cannot feel.

### 10.1 Correlation (also drives the graph)

For each seat, Pearson `r` between the series `tcAtBet` and `betUnits` across all hands the seat played **before the call**.

- Require ≥ 6 hands or `r` is displayed as "n/a".
- Clamp display to 2 decimals.

Expected bands (QA, not UI):

| Archetype | typical r |
|---|---|
| COUNTER | +0.55 to +0.90 |
| LUCKY_TOURIST | −0.25 to +0.45 (can spike if heater aligned) |
| MARTINGALE | −0.30 to +0.30 |
| CHATTER | −0.20 to +0.25 |
| WHALE_LITE | −0.20 to +0.20 |
| FLAT_BETTOR | ~0 (flat line) |

If a generated COUNTER shoe lands `r < 0.45`, **reroll the shoe** at generation time (max 8 rerolls), because the hard tell failed to appear. The player should be able to see the shape if they counted.

### 10.2 Leak

`extraUnitsExtracted` = sum over hands 1..callHand of `max(0, counterBetUnits - 1)`  
`leakCash` = extraUnitsExtracted * 25

This is not EV. It is a readable proxy: units they put out above minimum.

If the player calls on hand H, only hands `<= H` count.

### 10.3 Score

```
score = 0

if (call == BACKOFF && target == COUNTER) {
  score += 100
  if (callHand in 8..12) score += 30
  else if (callHand in 13..18) score += 15
  else score += 0
  if (cutCardReached) score -= 10
} else if (call == BACKOFF && target != COUNTER) {
  score += 0
  score -= 40                        // burned a civilian
  if (target == WHALE_LITE) score -= 25
} else if (call == PASS) {
  score += 0
  score -= 20                        // they walked
}

score -= min(30, floor(extraUnitsExtracted / 2))   // hesitation tax, correct or not
if (peekUsed) score -= 15
if (shuffleUsed && tcAtShuffle < 1) score -= 8
if (shuffleUsed && tcAtShuffle >= 2 && target == COUNTER && call == BACKOFF)
  score += 5
if (hoverUsed && hoveredSeat == COUNTER && call == BACKOFF && target == COUNTER)
  score += 5

score = clamp(score, 0, 150)
```

Ranks:

| Score | Rank | Shift manager line |
|---|---|---|
| 120–150 | Clean pick | "Quiet. Fast. That's the job." |
| 90–119 | Caught them | "They're off the felt. Next time sooner." |
| 60–89 | Messy | "Right seat or not, that was loud." |
| 30–59 | Whiff | "You pointed at a tourist." / "You watched them get paid." |
| 0–29 | Heat | "Go count a shoe in the back before you work my rail." |

Pick the whiff line from whether they backed off wrong vs passed vs were late.

### 10.4 Report card rows (reuse Dealer Report Card energy)

Show:

1. Call: Seat N (Name) — COUNTER / INNOCENT / PASS
2. Truth: Seat M (Name) was counting. Cover: modest 1–6 Hi-Lo
3. Rank + score
4. Leak: $X in extra units before the call
5. Tools: Hover on seat A (flattened / no change). Shuffle at TC=k (slumped / no reaction). Peek: yes/no
6. Civilian burn: yes/no
7. The graph
8. One teachable sentence from the truth table below

Teachable sentences (pick one that matches):

- Correct, early: "The spread followed the true count. The heater at seat {tourist} was just a heater."
- Correct, after hover: "They flattened when you stood behind them. Tourists don't do that."
- Correct, after shuffle at plus: "They hated the shuffle. That's an advantage player, not a streak."
- Wrong tourist: "Seat {n} raised into a winning streak, not into tens. Look at the graph."
- Wrong martingale: "That spread was doubling a loss. It does not care what left the shoe."
- Wrong whale: "Big is not the same as correlated. And now the shift manager knows your name."
- Wrong chatter: "Charts and tokes are costume. Watch the chips against the count."
- Pass: "Somebody here was buying extra tens. Pass is a tool. Not tonight."
- Peek used: add "You checked the book. Learn to live without it."

---

## 11. Bet-vs-true-count graph

This is the signature reveal. Ship it in v1. Do not replace with a pie chart.

### Layout

- X axis: **True count at bet** from −6 to +8, integer ticks.
- Y axis: **Bet units** from 0 to 10.
- One panel per seat, 5 small multiples, same scales. Seat the player pointed at is outlined.
- Each hand is a dot at `(tcAtBet, betUnits)`.
- Draw a thin line connecting hands in time order so a spread-up / spread-down is visible.
- Overlay a faint **reference staircase**: the raw COUNTER policy without cover  
  `y = 1 for x<=0, else min(6, 1+x)`  
  Same faint line on every panel so correlation is obvious.
- Color:
  - After reveal only: COUNTER dots = house gold
  - Accused-but-innocent = warning red
  - Others = muted
- Title per panel: `Seat {n} · {Name} · r = {0.00}`  
  After reveal, append archetype in small caps: `COUNTER` / `STREAK` / `MARTINGALE` / `CHATTER` / `WHALE` / `FLAT`
- Footer under the five panels:

> Same shoe. Same true count. Only one seat paid for tens.

### Interaction

- Hover a dot: `Hand 14 · TC +3 · 4 units · win`
- Button: **Show my marks** — pins warm/cold as a small glyph on the panel.
- Button: **Export case seed** — copies `seed=...` so Grokbot and QA can replay.

Reuse CountQuest "Session graph — chosen vs optimal units" styling if it exists. This graph is that idea pointed at *people* instead of the player.

---

## 12. UI layout (pit view)

Suggested, not sacred:

```
[ Briefing / clock: Hand 14 · Cut in ~2 decks ]

Seat1    Seat2    Seat3    Seat4    Seat5
chips    chips    chips    chips    chips
pin      pin      pin      pin      pin

           [ Mags ] [ shoe ] [ discard ]

Notebook: RC  __   (help-dependent)
[ Hover ]  [ Shuffle ]  [ Peek count ]   [ Pause ]
[ BACK OFF selected seat ]   [ PASS TABLE ]
```

Selected seat = last clicked. Back Off disabled until a seat is selected and hand ≥ 8.

Do not put RC on the felt. Notebook only.

During Hover, a label on that seat: **ON YOU** (help ≤ 1) or just the silhouette (help ≥ 2).

---

## 13. Audio / flavor (minimum)

- Chip clack on bet changes ≥ +2 units — makes spreads audible.
- Mags deals at a steady cadence. When you Hover, cadence unchanged.
- Shuffle Test: full riffle, RC widget snaps to 0 (if visible).
- Back Off: short silence, then chair scrape.
- No sirens. No "YOU GOT THEM" choir. The dossier is the fanfare.

---

## 14. Integration with current CountQuest

| Existing | Case 01 use |
|---|---|
| Hi-Lo values, RC/TC | Identical |
| Help 0–4 | Mapped in §4 |
| Mags Hawthorne | Dealer NPC |
| Grosvenor Victoria | Table skin |
| Dealer Report Card | Dossier layout ancestor |
| Session graph | Ancestor of the five-panel reveal |
| Check My Count | Peek Count, now scored |
| Training drills | Linked from dossier: "Sharpen count" → existing Running Count Speed Drill |
| Campaign / crews / shop | Do not block this slice. Entry point: Play → **Pit Boss — Five Seats** |

Main menu add:

- **Pit Boss** (new, primary)
- Training (existing)
- Dealer Shift (existing, demoted — keep working)

Do not delete Dealer Mode. Just stop leading with it.

---

## 15. QA seeds and tests

Implement `?seed=INT` and a debug overlay behind `?debug=1`:

- true archetype per seat
- live r so far
- next bet the COUNTER wants before cover

**Must-pass tests**

1. `exactly_one_counter` — 200 generated cases, always 1 COUNTER.
2. `counter_correlation` — 200 cases, COUNTER r ≥ 0.45 after 16 hands with no hover (reroll logic works).
3. `tourist_can_align` — at least 10% of cases tourist r > 0.25, so decoys are real.
4. `hover_flattens_only_counter` — Hover seat X for 3 hands; only COUNTER's mean bet drops by ≥ 1 unit when TC would have been ≥ +2.
5. `shuffle_resets_rc` — RC widget and sim both 0 after Shuffle Test.
6. `cannot_call_before_8`
7. `peek_penalizes`
8. `graph_has_five_series`
9. `whale_wrong_backoff_penalty` — score is ≥ 25 lower than backing off FLAT by mistake, all else equal.
10. `replay_seed` — same seed + same player actions (no peek randomness consumed differently) reproduces bets. Action RNG must be seeded from case seed + hand index + seat, not `Math.random()` unseeded.

**Balance knob file**  
Put constants in one object so we can tune without a hunt:

```js
CASE01 = {
  decks: 6,
  cutDecks: 1.5,
  minCallHand: 8,
  counterCap: 6,
  counterCoverChance: 0.18,
  hoverHands: 3,
  unitCash: 25,
  rerollIfCounterRBelow: 0.45,
  maxRerolls: 8
}
```

---

## 16. Definition of done for Grokbot

- [ ] Play → Pit Boss → Five Seats launches a full shoe
- [ ] Five named seats, one hidden COUNTER, guaranteed tourist + martingale
- [ ] Auto-deal, pause/step/speed
- [ ] Marks, one Hover, one Shuffle Test, one Peek, Back Off / Pass
- [ ] No suspicion percents on faces
- [ ] Dossier with score, leak, tools, teachable sentence
- [ ] Five-panel bet-vs-TC graph with r and reference staircase
- [ ] Seed replay + debug overlay
- [ ] Help levels 0–4 honored
- [ ] Training drills still reachable from dossier
- [ ] Constants isolated

Out of scope until Case 01 feels good:

- Second table
- Teams / Wongers / empty table
- Dealer collusion
- Campaign meta
- Monetization on this mode
- Voice / 3D pit

---

## 17. Tuning notes for after first playable

If players always wait until hand 20: raise late-call tax or make plus counts appear earlier (bias a few low cards into the first two decks — **do not** do this in v1; measure first).

If players always nail seat 1 by "who is quiet": add more FLAT_BETTOR noise and make COUNTER tip on +2 blackjacks so quiet is not the tell.

If the graph is the only way people win: good. That means the loop teaches. Then start hiding the graph until after the call — which this spec already does.

If COUNTER is unreadable: cover chance is too high or cap is 6 on a shoe that never reaches +3. Check penetration and consider cap 5 with more aggressive 1→3 jumps at TC +2.

---

End of spec. Build this slice. Do not invent a sixth system on top of it.
