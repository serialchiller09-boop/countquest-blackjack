# CountQuest — Next Steps (wrangled goals)

**Last updated:** 2026-07-08  
**SAVE_VERSION:** 18 (do not bump unless save schema changes)

This file consolidates open work from `PROJECT_BIBLE.md`, `artifacts/Blackjack_Game_Todo_List.md`, Play Console prep, and recent native/PWA work. Completed “Next:” lines from older todo sections are **omitted** when a later section already shipped them.

---

## How to use this list

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks Play Store submission or first real user install |
| **P1** | Active product quality — do while finishing features |
| **P2** | Valuable polish / retention — after P0 or in parallel |
| **P3** | Future ideas — not required for v1 |

---

## P0 — Play Store launch (started, not finished)

Infrastructure is built (signing, AAB pipeline, privacy policy, Data safety + IARC docs). **Console submission is the gap.**

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | **Back up signing key** | ⚠️ Do once | `android/countquest-release.keystore` + `keystore.properties` — offline, encrypted |
| 2 | **Google Play Developer account** | ? | $25 one-time — prerequisite for everything below |
| 3 | **Create app draft** in Play Console | ? | Package `com.countquest.blackjack`, support email `j.pierson1990@outlook.com` |
| 4 | **Content rating (IARC)** | 📝 Doc ready | Follow `docs/PLAY_CONSOLE_CONTENT_RATING.md` — simulated gambling **Yes**, real money **No** |
| 5 | **Data safety form** | 📝 Doc ready | Follow `docs/PLAY_CONSOLE_DATA_SAFETY.md` — answer **No** data collected (v1 local-only) |
| 6 | **Store listing copy** | 📝 Drafted in chat | Short (79 chars) + full description — paste into Console; consider saving to `docs/STORE_LISTING.md` |
| 7 | **Screenshots + feature graphic** | ❌ | Phone screenshots from emulator/Pixel; 1024×500 feature graphic |
| 8 | **Upload AAB to Internal testing** | 🟡 AAB built | `npm run build:android:release` → upload `app-release.aab`; install on physical device |
| 9 | **Device QA pass** | ❌ | Native shell: safe area, splash, orientation, table layout on real phone |
| 10 | **Target audience declaration** | ❌ | 13+, not designed for children; no Families enrollment |
| 11 | **Production rollout** | ❌ | Only after Internal testing + feature freeze for `versionCode 1` |

**Recommendation:** Finish **1 → 5 → 8 → 9** before heavy feature work. Listing art (**6–7**) can happen in parallel.

---

## P1 — Active product focus (from Project Bible)

These are the **current** game goals — still valid after modular split + Capacitor.

| # | Task | Source |
|---|------|--------|
| 1 | **7-seat table layout** — spacing, mobile scroll, card positioning, empty seats | Bible §3, §6 |
| 2 | **Post-hand flow** — fewer disruptive screen transitions | Bible §6 |
| 3 | **Help level polish** — visibility and feedback per level 0–4 | Bible §2.5, §6 |
| 4 | **Mobile casino viewport** — verify `fitCasinoPlayViewport` on more devices | Recent fix; extend probing |
| 5 | **Stability pass** — game flow bugs, incremental fixes | Bible §6 |

**Rule:** Every UI change must respect all **5 help levels**.

---

## P1 — Docs & repo hygiene (straggly)

| # | Task | Why |
|---|------|-----|
| 1 | **Update `PROJECT_BIBLE.md`** | Still says single-file + Tailwind CDN; architecture is now `css/` + `js/` + bundled Tailwind + Capacitor. Dealer Mode is live. Uncommitted local edits exist. |
| 2 | **Extend `show_build_progress.py`** | Stops at “Phase 6”; add Phase A (PWA/Pages), Phase B (Capacitor), Phase C (Play Store prep) |
| 3 | **Refresh `polish_status.py`** | References SAVE_VERSION 14–17 and 59 tests — stale |
| 4 | **Save store listing copy** to repo | Short/full descriptions only exist in chat history so far |
| 5 | **Gitignore `android/.idea/`** | Untracked IDE noise |
| 6 | **Commit or drop** `artifacts/probe-*.png` | Local probe artifacts modified but not committed |

---

## P2 — Training & UX backlog (real “Next” items still open)

From todo list **Next:** lines where follow-up work was **not** shipped in a later section.

| # | Task | Area |
|---|------|------|
| 1 | Drill summary: **sparkline trends**, mistake highlights, pace analytics | Training |
| 2 | **Weekly training calendar**, goal picker, streak recovery | Daily goals |
| 3 | Mistake review: **drill-from-mistake**, spaced repetition, clear/archive, **CSV export** | Training |
| 4 | Combined practice: **bet sizing in hands**, hand targets, true-count quiz variant | Drills |
| 5 | Speed drill: **KO variant**, streak goals | Counting |
| 6 | Daily rewards: **weekly login calendar UI**, streak recovery item | Retention |
| 7 | VIP: **exclusive tables**, **cosmetic themes** (IAP wiring exists; tables/themes don’t) | Monetization |
| 8 | **Casino audio** — cards, ambiance, tension (Bible §7.5) | Polish |

---

## P2 — Platform & distribution

| # | Task | Notes |
|---|------|-------|
| 1 | **Hide developer OAuth/Stripe panel** for Play release | Or document as dev-only; Stripe on Android may violate Play policy for digital goods |
| 2 | **Decide v1 monetization** | Gems-only VIP (simple) vs Google Play Billing (required for real-money VIP) |
| 3 | **iOS build** | Capacitor `ios/` scaffold exists; needs macOS + Xcode smoke test |
| 4 | **PWA / Pages deploy verify** | `privacy.html` live after push; run `live_mobile_probe.py` on production URL |
| 5 | **Optional:** `@capacitor/browser` for Privacy Policy link on native | Relative `privacy.html` works in bundle; external mailto already fine |

---

## P3 — Future ideas (Bible §7 — not v1)

| Idea | Section |
|------|---------|
| Pit Boss + **Heat / pressure** system (early shuffles) | §7.1 |
| **Play as Pit Boss** — spot the counter among 7 players | §7.1 |
| **Post-shoe mistake timeline** (visual drift map) | §7.2 |
| Real-time **mistake explanations** | §7.2 |
| Challenge modes (full shoe without losing count, speed tiers, penetration estimates) | §7.3 |
| Flavorful **rank titles** (Heat Seeker, Shoe Reader, etc.) | §7.4 |
| More counting systems (**Hi-Opt, Omega II**, full KO in play) | Bible Future |
| **Real online crews** — backend, sync chat, not localStorage-only | Clubs |
| **Real OAuth** + accounts | Social |
| **Unity migration** (long-term) | Bible Future |

---

## Already done (don’t re-list as open)

| Milestone | Commit / state |
|-----------|----------------|
| Modular web shell (`index.html` + `css/` + `js/`) | Done |
| Bundled Tailwind (no CDN) | `367f81f` |
| PWA + GitHub Pages + `sw.js` | Phase A |
| Capacitor Android/iOS scaffold | `1aca783` |
| Branded icons + splash | `54e8ba6` |
| Release signing + AAB pipeline | `a814672` |
| Privacy policy + in-app link | `5c80394`, `6adbefc` |
| Data safety + IARC answer docs | `8c7132e`, `ae8de55` |
| Mobile casino shell width fix | `f3cdfd3` |
| Plan 21 lobby, clubs economy, tournaments, VIP, 10+ drills, dealer mode | Todo §2–7 ✅ |
| 74+ web tests | `run_web_tests.py` |

---

## Suggested order (next 2–4 weeks)

```
Week A — Ship-ready
  ├── Back up keystore
  ├── Play Console: account, IARC, Data safety, Internal testing upload
  ├── Device QA on Pixel / emulator
  └── Screenshots + feature graphic

Week B — Parallel tracks
  ├── Track 1: Table layout + mobile polish (P1 product)
  └── Track 2: Update Bible + build progress scripts (P1 hygiene)

Week C — v1.0 decision
  ├── Fix release blockers from Internal testing
  ├── Bump versionCode if needed
  └── Production rollout OR continue features on Internal track

Backlog — Pick 1–2 P2 items per sprint (drill analytics, VIP tables, audio, etc.)
```

---

## Quick commands

```bash
# Health check
python scripts/run_web_tests.py
python scripts/show_build_progress.py

# Android release bundle
npm run build:android:release

# Mobile probes
python scripts/mobile_probe.py
python scripts/live_mobile_probe.py

# Play prep docs
# docs/PLAY_CONSOLE_DATA_SAFETY.md
# docs/PLAY_CONSOLE_CONTENT_RATING.md
# privacy.html → GitHub Pages
```

---

## Open questions (decide when ready)

1. **v1 scope:** ship current feature set, or slip for VIP tables / audio / timeline?
2. **Monetization:** gems-only for Play v1?
3. **Target age:** 13+ or 16+ in Console (simulated gambling)?
4. **iOS:** pursue after Android live, or defer?

---

*Update this file when items complete or priorities shift. Bump “Last updated” only; SAVE_VERSION stays 18 unless schema changes.*