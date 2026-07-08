# Play Console — Content Rating (IARC) Answers

**App:** CountQuest Blackjack (`com.countquest.blackjack`)  
**Last updated:** 2026-07-08  
**Applies to:** Android v1 — **simulated casino training**, no real-money gambling

Complete this in **Play Console → App content → Content rating** (IARC questionnaire).

---

## Recommendation (summary)

| Topic | Answer |
|-------|--------|
| **App type** | Game |
| **Real-money gambling** | **No** |
| **Simulated gambling** | **Yes** (blackjack with fictional chips/gems) |
| **Online interaction with strangers** | **No** (v1 — local-only crews, no live server chat) |
| **Expected rating band** | **Teen / 13+** (or regional equivalent — e.g. PEGI 12–16) |

CountQuest is an **educational card-counting trainer** with casino-themed visuals and simulated table play. It is **not** real-money gambling. Do **not** target children under 13.

---

## Before you start

Have ready:

- **Support email:** j.pierson1990@outlook.com  
- **Privacy policy:** https://serialchiller09-boop.github.io/countquest-blackjack/privacy.html  
- **Category:** Games (Casino or Card subcategory if offered)

---

## Step 1 — App details & category

| Question | Answer | Notes |
|----------|--------|-------|
| **Email address** | j.pierson1990@outlook.com | |
| **App category** | **Game** | |
| **Game subcategory** (if asked) | **Casino** or **Card** | Educational trainer; casino theme is central |
| **Does the app contain a web browser or general web access?** | **No** | Capacitor WebView loads bundled assets only |
| **Is the app primarily a news or educational reference app?** | **No** | Gameplay-first with training modes |

---

## Violence

| Question | Answer |
|----------|--------|
| Depictions of realistic violence or injury | **No** |
| Depictions of cartoon or fantasy violence | **No** |
| Blood | **No** |
| Guns or other weapons as central gameplay | **No** |

---

## Sexuality & nudity

| Question | Answer |
|----------|--------|
| Sexual content or nudity | **No** |
| Suggestive themes | **No** |
| Dating or sexual relationship focus | **No** |

---

## Language

| Question | Answer | Notes |
|----------|--------|-------|
| Profanity or crude language **in app content** | **No** | Built-in UI/strings contain no profanity |
| User-generated text visible to others **over the internet** | **No** | v1 crew chat is **local-only** (no live server syncing messages between devices) |

If a future version adds **real online multiplayer chat**, revisit this section — unmoderated UGC often raises the rating.

---

## Controlled substances

| Question | Answer |
|----------|--------|
| Alcohol, tobacco, or drug use depicted | **No** |
| Promotion or sale of alcohol, tobacco, or drugs | **No** |

(Casino theme only — no drinking/smoking depictions in gameplay.)

---

## Gambling (most important for CountQuest)

| Question | Answer | Notes |
|----------|--------|-------|
| **Real-money gambling** (wager real currency) | **No** | |
| **Real-money payouts or cash prizes** | **No** | |
| **Simulated gambling** (casino-style games with fictional currency) | **Yes** | Blackjack tables, tournaments, chips, bankroll |
| Virtual currency **purchased with real money** (Play Billing / IAP) | **No** | v1: VIP uses in-game **gems** only; no Play Billing |
| Virtual currency **exchangeable for real money** | **No** | |
| Sports betting | **No** |
| Lotteries or sweepstakes | **No** |
| Loot boxes or randomized paid items | **No** |

**Short explanation if a free-text field appears:**

> CountQuest is an educational Hi-Lo card-counting trainer. Players use simulated chips and gems only. There is no real-money wagering, no cash prizes, and no withdrawal of virtual currency for real money.

---

## User interaction & online content

| Question | Answer | Notes |
|----------|--------|-------|
| **Online multiplayer** with other players over the internet | **No** | v1: single-player + local AI seats |
| **Voice chat, text chat, or messaging with other players online** | **No** | Crew chat is stored on-device; no live server relay |
| **Sharing of user location** | **No** | |
| **Sharing of personal information with other users** | **No** | |
| **User-generated content shared publicly online** | **No** | |
| **Moderated or unmoderated forums** | **No** | |
| **Digital goods** purchased with real money | **No** | v1 launch |

**Counting Crews (v1):** invite codes and crew hub are local/demo features on the device — not internet-connected social play. Answer **No** to online interaction unless you ship a real backend.

---

## Fear / horror

| Question | Answer |
|----------|--------|
| Horror themes intended to scare | **No** |
| Intense fear or anxiety (non-horror) | **No** |

---

## Ads & commercial content

| Question | Answer |
|----------|--------|
| Contains ads | **No** |
| Product placement or branded marketing to children | **No** |
| Promotes real-world gambling services | **No** |

---

## Miscellaneous (common IARC follow-ups)

| Question | Answer |
|----------|--------|
| Discrimination or hate speech in app content | **No** |
| Illegal activities portrayed positively | **No** |
| Medical or health treatment claims | **No** |
| Shares precise user location | **No** |
| Unrestricted web access | **No** |

---

## Target audience (Play Console — often adjacent to rating)

| Question | Recommended answer |
|----------|-------------------|
| **Target age group** | **Aged 13 and over** (or 16+ if you want extra margin for simulated gambling) |
| **Is the app designed to appeal to children?** | **No** |
| **Play Console “Target audience and content” includes children under 13?** | **No** |
| **Families / Designed for Families** | **Do not enroll** for v1 |

Simulated casino content is a poor fit for under-13 programs even when educational.

---

## Expected rating outcome

Exact labels vary by region (IARC maps to ESRB, PEGI, USK, etc.). For **simulated gambling** without real money, expect roughly:

| System | Typical range |
|--------|----------------|
| **ESRB (US)** | Teen (13+) |
| **PEGI (EU)** | 12 or 16 (simulated gambling often triggers 12+) |
| **ACB (AU)** | M or PG depending on gambling descriptor |
| **Google Play badge** | **Teen** or **Mature** — accept what IARC assigns |

You do not pick the final label; IARC calculates it from your answers. **Simulated gambling = Yes** is the main driver — answer honestly.

---

## When to update this questionnaire

Re-submit before release if you add:

| Change | Revisit |
|--------|---------|
| Real-money IAP / Play Billing | Gambling + Digital goods sections |
| Stripe VIP enabled for all Android users | Purchases + gambling-adjacent questions |
| Live online crew chat or multiplayer server | User interaction + UGC + Language |
| Real OAuth social login for all users | User info sharing (may overlap Data safety) |
| Ads or rewarded video | Ads section |
| Loot boxes or paid random rewards | Gambling / purchases |

---

## Submission checklist

- [ ] Category: **Game**
- [ ] Simulated gambling: **Yes**
- [ ] Real-money gambling: **No**
- [ ] Online chat with strangers: **No** (v1)
- [ ] Violence / Sex / Drugs: **No**
- [ ] Ads: **No**
- [ ] Target audience: **13+**, not aimed at children
- [ ] IARC certificate downloaded and applied in Play Console
- [ ] Store listing text mentions **simulated** chips (matches questionnaire)

---

## Store listing alignment

Your description should stay consistent with IARC answers:

- Say **“simulated chips and gems”** and **“not real-money gambling.”**
- Avoid “win real money,” “cash out,” or “bet real currency.”
- Position as **educational card-counting training**.

See `privacy.html` and Play Store listing drafts for wording that matches these declarations.