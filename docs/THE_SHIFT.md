# The Shift — CountQuest first playable

## What this is

**The Shift** is the product. You walk onto a living blackjack table mid-shoe. Other people are already playing. The casino keeps going whether you bet or watch. Card counting is a secret skill you keep in your head — not a HUD, not a lesson plan.

Feel: *"this table is getting interesting"* — not *"complete Level 7"*.

## Keep / delete

**Keep (engine):** shoe, hands, Hi-Lo running count, basic strategy tables, and Mags as a dealer brain later. Those are the craft.

**Delete as the product:** lobby chrome, drills-as-game, VIP ladders, tournaments-as-home, gems/ranks/spin, always-on count HUD, tutorial popups, XP, first-run dialogs. The trainer stack can still exist on `index.html` for now; it is no longer the front door.

## How to open

Open **`shift.html`** (or GitHub Pages `/shift.html`).

Do not open `index.html` expecting The Shift — that is the old trainer shell.

## First playable loop

1. Arrive at a 6-deck table already ~40–55% into the shoe.
2. Seat next to recurring NPCs (Dana, Cole, Irene). Dealer is Ray.
3. Watch hands go by, or drop a small bet (10 / 25 / 50) and play Hit / Stand.
4. Keep a mental Hi-Lo running count. Optional **Glance** peeks RC for ~1.2s — never a permanent counter, never "correct strategy".
5. Ambient table talk (someone leaves, cut card coming, a hot streak) appears as quiet log lines — not checklist tutorials.
6. After ~4 minutes or ~12 hands: **Shift over**. Quiet recap, then one job question — enter the running count. That quiz is the work, not a lesson.

## Living floor events

Mid-shift the table moves without tutorials: someone colors up and leaves an empty chair, then later Irene/Dana returns or a new face (Marco, Tess, …) sits; once per shift Ray goes off and another dealer takes over while the **same shoe and count continue**; when the cut hits, shuffle is just a table beat (“New shoe.”) and the count resets because the shoe does — no lecture. Glance stays a 1.2s peek only.

## Non-goals for v1

No double/split/insurance UI. No Mags HUD. No bankroll meta-progression. No overlay on `js/07-game-engine.js`.

## Next (later)

Mags as dealer personality / brain. Deeper ambient cast. Bet sizing from true count without naming it. Still no trainer lobby as the game.
