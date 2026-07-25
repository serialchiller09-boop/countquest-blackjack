# CountQuest Table QA Plan

## Open issues (user-reported)

| ID | Issue | Root cause | Status |
|----|-------|------------|--------|
| T-1 | Full 7-seat mode: player cards invisible | Cards were rendered inside a ~44px seat column; stacked/clipped | **v38**: `#casino-player-rail` between dealer and seat arc |
| T-2 | ☰ menu overlaps header currency / other UI | Fixed `top-right` ignored header height | **v38**: `top: calc(var(--cq-header-h) + 0.3rem)` + header padding |
| T-3 | Practice forced solo layout | `startSession` / constructor overwrote `tableLayout` | **v37+**: respect saved layout |
| T-4 | Premature "fixed" claims | Diagnostics only checked DOM, not paint/size/separation | **v38**: `run_table_qa_suite.py` |

## Execution phases

### Phase 1 — Structural layout (v38)
- Move `#player-hands` into `#casino-player-rail` (not inside `#casino-seat-human`)
- Full mode: large cards in rail; 7 seat circles unchanged below
- Solo mode: rail uses readable card sizes

### Phase 2 — QA harness
- `scripts/run_table_qa_suite.py` — orchestrates:
  - Solo + full Playwright flows (390×844, 360×640)
  - Card separation, paint, min width ≥48px
  - Menu overlap vs chips/gems
  - JS unit tests (`?runTests=1`)
  - `stability_verify.py`
- Artifacts: `artifacts/table-qa/`

### Phase 3 — Verify before ship
```bash
npm run test:table
npm run cap:sync
```
User confirms **build badge** on device before calling fixed.

### Phase 4 — Follow-ups
- [x] Hand-2 deal button regression (`diag_hand2.py` in `npm run test:table`)
- [x] Dealer Mode card probe (`diag_dealer_mode.py` in suite)
- [x] Practice L2 + full table flow (`practice_l2_full`)
- [ ] Native Android WebView screenshot probe
- [ ] Split QA suite into fast (PR) vs full (release)

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test:table` | Full table QA suite |
| `python scripts/diag_full_cards_real.py` | Card visibility only |
| `python scripts/diag_hand2.py` | Hand-2 deal regression |
| `python scripts/stability_verify.py` | Load + deal smoke |

## Definition of done (full 7-seat)

- [ ] Build badge matches shipped version (emulator + user phone)
- [ ] Settings → Full (7 seats) persists through practice + campaign
- [x] Two player cards visible, separated, ≥48px wide on 360×640 (automated)
- [x] ☰ does not overlap chips/gems (automated)
- [x] Decorative chip rack hidden on full + solo (automated)
- [x] Hand-2 auto-deal regression (automated)
- [ ] `npm run test:table` exits 0 on CI + device screenshot proof