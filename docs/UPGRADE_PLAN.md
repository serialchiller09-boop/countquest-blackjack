# CountQuest — Master Upgrade Plan

**Created:** 2026-07-12 · **Build target:** v41+  
Track every open upgrade. Mark `[x]` when done; link PR/commit in Notes.

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks ship or user-visible breakage |
| **P1** | Active product quality |
| **P2** | Polish / retention |
| **P3** | Future / nice-to-have |

---

## P0 — Critical / ship blockers

| # | Task | Status | Owner / notes |
|---|------|--------|---------------|
| P0-1 | Device proof: badge v41+, cards in rail, full table | [ ] | User phone; uninstall old APK first; emulator v41 |
| P0-2 | Capacitor deploy: `stage_dist` → `cap sync` → AAB every release | [ ] | `scripts/stage_dist.py`, `capacitor.config.json` |
| P0-3 | PWA SW caches `casino-felt-table.css` | [x] | v41: `sw.js` cq-pwa-v8 |
| P0-4 | Play Console: app draft, IARC, Data safety | [ ] | `docs/PLAY_CONSOLE_*.md` |
| P0-5 | Internal testing AAB upload + device QA checklist | [ ] | `docs/PLAY_CONSOLE_INTERNAL_TESTING.md` |
| P0-6 | Keystore backup (offline, encrypted) | [ ] | `android/countquest-release.keystore` |
| P0-7 | Store screenshots + 1024×500 feature graphic | [ ] | `docs/STORE_LISTING.md` |
| P0-8 | Target audience 13+, not for children | [ ] | Play Console |
| P0-9 | Version alignment check in CI | [x] | `scripts/check_version_alignment.py` |

---

## P1 — Table & play UX

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1-1 | 7-seat layout polish (spacing, arc, AI cards) | [x] | v41 narrow-seat CSS |
| P1-2 | Small-phone layout (360×640) without heavy scale | [~] | `full_practice_short` QA; tuning ongoing |
| P1-3 | Menu overlap — device confirmation | [~] | QA passes; real safe-area TBD |
| P1-4 | Chip clutter — hide decorative rack (full + solo) | [x] | v41 CSS |
| P1-5 | Campaign quick hand flow (low help levels) | [x] | v41 `shouldAutoFlowHands` |
| P1-6 | Defer shoe modal during auto-flow | [x] | v41 `showPostHandModals` toast |
| P1-7 | Content trim (less copy, smaller type) | [x] | v41 table lobby trim |
| P1-8 | Dealer Mode mobile card QA | [x] | `diag_dealer_mode.py` |
| P1-9 | Practice L2 + full table QA path | [x] | `practice_l2_full` flow |
| P1-10 | Help levels 0–4 polish per screen | [ ] | `js/05-help-system.js` |

---

## P1 — Testing & CI

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1-11 | `npm run test:table` in GitHub Actions | [x] | `.github/workflows/tests.yml` |
| P1-12 | `diag_hand2.py` in table QA suite | [x] | hand-2 regression |
| P1-13 | Practice-path Playwright flow | [x] | `practice_l2_full` |
| P1-14 | Native WebView screenshot probe | [ ] | TABLE_QA Phase 4 |
| P1-15 | Orientation / landscape tests | [ ] | |
| P1-16 | Build badge visible on lobby (web) | [x] | v41 `#lobby-build-stamp` |
| P1-17 | Fast vs full QA split (PR vs release) | [ ] | TABLE_QA Phase 4 |

---

## P1 — Docs & deploy hygiene

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1-18 | Refresh PROJECT_BIBLE (SW version, test count) | [ ] | |
| P1-19 | Commit or gitignore `artifacts/probe-*.png` | [ ] | |
| P1-20 | TABLE_QA definition-of-done human checks | [ ] | `docs/TABLE_QA_PLAN.md` |

---

## P2 — Gameplay & features (incomplete)

| # | Task | Status |
|---|------|--------|
| P2-1 | Drill summary: sparklines, mistake highlights, pace | [ ] |
| P2-2 | Mistake review: drill-from-mistake, spaced rep, CSV | [ ] |
| P2-3 | Combined practice: bet sizing, hand targets, TC quiz | [ ] |
| P2-4 | Speed drill: KO variant, streak goals | [ ] |
| P2-5 | Daily training: weekly calendar, goal picker | [ ] |
| P2-6 | Daily rewards: weekly calendar UI | [ ] |
| P2-7 | VIP: exclusive tables, cosmetic themes | [ ] |
| P2-8 | Monetization: Play Billing vs gems-only decision | [ ] |
| P2-9 | Real OAuth + backend accounts | [ ] |
| P2-10 | Online crews sync | [ ] |
| P2-11 | iOS build smoke test | [ ] |

---

## P2 — Mobile & polish

| # | Task | Status |
|---|------|--------|
| P2-12 | Extended viewport matrix probing | [ ] |
| P2-13 | Review scale floor (0.58 min) for tap targets | [ ] |
| P2-14 | Casino ambiance / richer audio | [ ] |
| P2-15 | Privacy policy via Capacitor Browser | [ ] |

---

## P3 — Future

| # | Task |
|---|------|
| P3-1 | Pit Boss / Heat / teaching timeline |
| P3-2 | Hi-Opt, Omega II counting systems |
| P3-3 | Challenge modes (full-shoe count, speed tiers) |
| P3-4 | Training history CSV + in-app sparklines |
| P3-5 | Flavorful rank titles |
| P3-6 | Unity migration (long-term) |

---

## Execution waves

### Wave 1 (this session) — v41
- [x] UPGRADE_PLAN.md
- [x] SW + version CI + table QA expansion
- [x] Campaign auto-flow + shoe defer + solo chip hide
- [x] Lobby build stamp
- [x] Version bump v41 + build.gradle + cache busters
- [x] `diag_dealer_mode.py` + `practice_l2_full` + CI `test:table`

### Wave 2 — ship
- Play Console P0 items, device QA, screenshots
- User confirms v41 on phone

### Wave 3 — polish
- 7-seat layout, dealer mode QA, help levels, content trim pass

### Wave 4 — features
- Training analytics, daily calendar, VIP tables, monetization decision

---

## Verify after each wave

```bash
python scripts/check_version_alignment.py
npm run test:table
npm run cap:sync
```

Device: yellow badge = shipped version; Full (7 seats) → deal → cards in dark rail.