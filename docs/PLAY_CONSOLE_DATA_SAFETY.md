# Play Console — Data Safety Answers

**App:** CountQuest Blackjack (`com.countquest.blackjack`)  
**Last updated:** 2026-07-08  
**Applies to:** Android v1 launch with **local-only** storage (default build)

Use this when completing **Play Console → App content → Data safety**.

---

## Recommendation (summary)

Answer **No** to data collection for the default Play Store build.

CountQuest stores game progress, stats, settings, and crew data **only on the device** (`localStorage`). The app has no developer backend, no analytics SDKs, and does not transmit save data off-device. OAuth and Stripe exist only as optional developer-configured settings — not the default consumer experience.

**Expected public label:** “No data collected”

---

## Step 1 — Data collection and security

| Question | Answer |
|----------|--------|
| **Does your app collect or share any of the required user data types?** | **No** |

Google’s guidance: data processed **only on-device** and **not transmitted** to the developer or third parties does not need to be disclosed in Data safety.

---

## Security practices

| Question | Answer |
|----------|--------|
| **Is all user data encrypted in transit?** | **Not applicable** — no user data is transmitted off-device |
| **Do you provide a way for users to request data deletion?** | **Yes** — in-app **Reset Progress**, Android **Clear app data**, or **uninstall** |
| **Independent security review** | **No** |
| **Families Policy commitment** | **No** (unless explicitly targeting children — not recommended for simulated casino content) |

---

## Step 2 — Data types

**None selected.** All data-type checkboxes remain unchecked when collection is **No**.

Do **not** declare App activity, Personal info, Financial info, etc. for the default local-only build.

---

## Related Play Console fields

| Field | Value |
|-------|--------|
| **Privacy policy URL** | https://serialchiller09-boop.github.io/countquest-blackjack/privacy.html |
| **Developer / support email** | j.pierson1990@outlook.com |
| **Ads** | No |
| **In-app purchases (Play Billing)** | No — if v1 ships with gems-only VIP and no real-money checkout |
| **Target audience** | Not primarily children (simulated casino / card-counting trainer) |

---

## Justification (for your records or Google follow-up)

> CountQuest Blackjack stores game progress, statistics, preferences, and optional social-connect flags locally on the device using app storage (`localStorage`). The app does not operate a backend account system, does not use analytics or advertising SDKs, and does not transmit save data to the developer. Users may export stats manually via an in-app JSON export. Data can be removed by resetting progress, clearing app storage, or uninstalling the app.

---

## Footnotes

### Android backup (`allowBackup="true"`)

The manifest allows Android’s automatic backup. That is **OS-level user backup**, not developer collection. Local-only apps typically still answer **No** to developer data collection.

### Internet permission

`INTERNET` is declared for the Capacitor WebView shell and optional future flows. Core single-player gameplay does not upload personal data in the default build.

### Developer-only OAuth / Stripe panel

Settings includes an optional **OAuth & IAP (developer)** panel. If end users cannot configure real Google/Facebook OAuth or Stripe in the shipped build, Data safety remains **No**. Update this document and the Play Console form before enabling those features for all users.

---

## When to update these answers

Revisit Data safety before any release that adds:

| Feature | Data safety impact |
|---------|-------------------|
| Real Google/Facebook sign-in for all users | Declare **Personal info** (email/name); may be shared with auth provider |
| Google Play Billing for VIP or purchases | Declare per Play purchase rules |
| Analytics (Firebase, etc.) | Declare **App activity** / diagnostics |
| Developer backend + accounts | Declare account and profile data you store |
| Real multiplayer server | Declare identifiers / user-generated content transmitted off-device |

---

## Submission checklist

- [ ] Data collection: **No**
- [ ] Data types: **none**
- [ ] Deletion method: **Reset Progress / clear app data / uninstall**
- [ ] Privacy policy URL pasted in Store settings
- [ ] Support email: **j.pierson1990@outlook.com**
- [ ] Preview shows **“No data collected”**

---

## Store listing copy (reference)

Short and full descriptions are not part of Data safety but are often completed in the same session. Privacy policy and support contact should match `privacy.html`.