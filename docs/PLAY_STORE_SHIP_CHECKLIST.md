# Play Store ship checklist (v1)

App: CountQuest Blackjack (com.countquest.blackjack)
Support: j.pierson1990@outlook.com
Privacy: https://serialchiller09-boop.github.io/countquest-blackjack/privacy.html
Website: https://serialchiller09-boop.github.io/countquest-blackjack/
This PR stamp: v46, versionCode 46, versionName 1.0.29 (alignment script matches stamp, versionCode, and ?v= only).
SAVE_VERSION: do not bump (schema unchanged).

v1 is an educational Hi-Lo trainer. Simulated chips/gems only. No real-money wagering. No Google Play Billing. Gems-only VIP. 13+, not for children. Data safety: no data collected.

Work Console steps in order. Detailed answers live in the existing PLAY_CONSOLE docs. Do not invent new questionnaire text.

## Jeff must do before Console (blockers)

1. Back up the Android signing key file android/countquest-release.keystore and android/keystore.properties to encrypted offline storage. Losing it permanently blocks updates. Do not commit passwords; they are not in this repo.
2. Google Play Developer account: twenty-five USD one-time at play.google.com/console.
3. Build a signed Android App Bundle using the project release script documented in PLAY_CONSOLE_INTERNAL_TESTING.md.

## Console: create the app (first time)

Follow Step 1 in docs/PLAY_CONSOLE_INTERNAL_TESTING.md.
- App name: CountQuest Blackjack
- Language: English (United States)
- Type: Game, Free
- Application ID must stay com.countquest.blackjack

## Console: App content (required for testing)

1. Privacy policy URL: https://serialchiller09-boop.github.io/countquest-blackjack/privacy.html
2. App access: all functionality available without special access.
3. Ads: No.
4. IARC content rating: follow docs/PLAY_CONSOLE_CONTENT_RATING.md. Game; simulated gambling Yes; real-money gambling No; no Play Billing.
5. Target audience: aged 13 and over. Not designed to appeal to children. Do not enroll in Families.
6. Data safety: follow docs/PLAY_CONSOLE_DATA_SAFETY.md. Does the app collect data? No. Preview must show No data collected.
7. Store listing copy: docs/STORE_LISTING.md. Contact email j.pierson1990@outlook.com.
8. In-app purchases: No (v1 gems-only VIP).

## Console: Store listing art

1. Feature graphic 1024x500: upload artifacts/store/feature-graphic.png (SVG source alongside).
2. Phone screenshots (at least 2) from a real device or emulator. Specs: artifacts/store/STORE_ASSETS.md. Do not fake device photos.
3. Hi-res icon: icons/icon-512.png if Console asks separately.
4. Short and full description plus What is new: paste from docs/STORE_LISTING.md.
5. Category: Games, Casino or Card. Contains ads: No.

## Console: Internal testing upload

Follow docs/PLAY_CONSOLE_INTERNAL_TESTING.md Steps 3-5.

1. Testing, Internal testing, Create new release.
2. Upload the signed AAB from the release script.
3. Release name: 1.0.29 (46) matching versionName and versionCode after this PR.
4. Release notes: What is new from docs/STORE_LISTING.md.
5. Save, Review, Start rollout to Internal testing.
6. Testers tab: add Jeff Google account, open opt-in link on the phone.

Device QA from that doc: splash/icon, lobby, Practice Range, one hand, Privacy Policy link, rotate, reopen persist, airplane-mode core play. Confirm Settings does not show OAuth/Stripe unless the URL has dev=1.

## After Internal testing

Closed testing for friends/family. Open testing for public beta. Production only after feature freeze, real screenshots, and IARC certificate applied.

Each new binary: bump versionCode and the vN HTML stamp plus cache busters together (scripts/check_version_alignment.py).

## Do not do for v1

- Do not add Google Play Billing or Stripe checkout for store users.
- Do not add real-money wagering or cash prizes.
- Do not declare data collection for the default local-only build.
- Do not target children or Families.
- Do not invent or commit keystore passwords.

When any of those change, revisit Data safety and IARC before the next upload.
