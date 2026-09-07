# Pin: stable/phone-v46 — WRONG ERA FOR THE PHONE

The phone APK is **versionName 1.0.26**, not this branch.

This branch is Play Store v1 / lobby v46 (`9dd8185` + pin docs). Keep it as a later snapshot. Do not treat it as the working phone twin.

## Where 1.0.26 actually sits

`1.0.26` was never committed. Committed Android versions:

- `1.0` — 8 Jul (`a814672`)
- **`1.0.27` / versionCode 43** — 25 Jul ([`53ee170`](https://github.com/serialchiller09-boop/countquest-blackjack/commit/53ee1701afb41c0ebbf2d69e640dc1305006bad0)) ← closest
- `1.0.28` — 11 Aug v44
- `1.0.29` — 11 Aug v45 and later, including this v46 pack

Closest tree to the phone:

```bash
git fetch origin
git checkout -b stable/phone-1.0.26 53ee1701afb41c0ebbf2d69e640dc1305006bad0
```

Last commit before that sync: `8486234` (9 Jul, solo 1-seat toggle; gradle still `1.0`).
