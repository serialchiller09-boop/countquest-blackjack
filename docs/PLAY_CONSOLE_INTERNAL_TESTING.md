# Play Console — Internal Testing Upload Guide

**AAB path (after build):**

```
android/app/build/outputs/bundle/release/app-release.aab
```

**Build command:**

```bash
npm run build:android:release
```

---

## Prerequisites

- [ ] Google Play Developer account ($25, one-time)
- [ ] Keystore backed up: `android/countquest-release.keystore` + `android/keystore.properties`
- [ ] `android/local.properties` with `sdk.dir=` (local only, gitignored)
- [ ] Fresh signed AAB built successfully

---

## Step 1 — Create the app (first time only)

1. Open [Google Play Console](https://play.google.com/console)
2. **Create app**
3. App name: **CountQuest Blackjack**
4. Default language: **English (United States)**
5. App or game: **Game**
6. Free or paid: **Free**
7. Declarations: accept policies

---

## Step 2 — Complete required app content (can be draft)

Do these before or right after first upload — Internal testing still needs basics:

| Item | Doc / value |
|------|-------------|
| Privacy policy | `https://serialchiller09-boop.github.io/countquest-blackjack/privacy.html` |
| App access | All functionality available without special access |
| Ads | No |
| Content rating | `docs/PLAY_CONSOLE_CONTENT_RATING.md` |
| Target audience | 13+, not for children |
| Data safety | `docs/PLAY_CONSOLE_DATA_SAFETY.md` |
| Store listing | `docs/STORE_LISTING.md` (short + full description) |

---

## Step 3 — Upload to Internal testing

1. Play Console → your app → **Testing** → **Internal testing**
2. **Create new release**
3. **Upload** → select `app-release.aab`
4. Release name: `1.0.0 (1)` (matches `versionName` / `versionCode` in `android/app/build.gradle`)
5. Release notes: paste “What’s new” from `docs/STORE_LISTING.md`
6. **Save** → **Review release** → **Start rollout to Internal testing**

---

## Step 4 — Add yourself as tester

1. **Testing** → **Internal testing** → **Testers** tab
2. Create an email list → add your Google account email
3. Copy the **opt-in link** → open on your phone → accept → install from Play Store

---

## Step 5 — Device QA checklist

On a physical Android phone:

- [ ] App installs from Play (not sideload APK)
- [ ] Splash screen + icon look correct
- [ ] Lobby loads; chips/gems visible
- [ ] Start Practice Range → bet screen fits without horizontal scroll
- [ ] Play a hand → action bar works; no layout blowout
- [ ] Settings → **Privacy Policy** opens
- [ ] Rotate portrait/landscape — table rescales
- [ ] Force-close and reopen — progress persists
- [ ] Airplane mode — core play still works (offline)

---

## Step 6 — Promote when ready

| Track | When |
|-------|------|
| **Closed testing** | Wider friend/family group |
| **Open testing** | Public beta, still pre-production |
| **Production** | v1.0 feature freeze + final screenshots |

Each new binary requires bumping `versionCode` in `android/app/build.gradle`, rebuilding, and uploading a new AAB.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Upload rejects signing | Ensure `keystore.properties` matches the keystore used for first upload |
| “App not available” for tester | Wait 15–30 min after rollout; confirm opt-in link used |
| Wrong package | Must be `com.countquest.blackjack` |
| Build fails locally | Run `npm run build:android:release`; check `android/local.properties` and JDK |

---

## Related docs

- `docs/PLAY_CONSOLE_DATA_SAFETY.md`
- `docs/PLAY_CONSOLE_CONTENT_RATING.md`
- `docs/STORE_LISTING.md`
- `docs/NEXT_STEPS.md`