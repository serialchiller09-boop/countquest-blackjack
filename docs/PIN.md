# Pin: stable/phone-v46

**Purpose:** Frozen Play Store v1 / Android versionCode 46 trainer. Matches the phone badge **v46**.

**This branch tip:** `9dd8185` (`play-store-v1` last commit — skip first-run overlay under Playwright).

**Merge commit on master that absorbed this work:** [`7ffb177`](https://github.com/serialchiller09-boop/countquest-blackjack/commit/7ffb177fb20b8def26653d730416895f90e658c5) (2 Sep 2026). Same tree for practical purposes.

## Sister pins

| Name | Points at | Meaning |
|---|---|---|
| `stable/phone-v46` | `9dd8185` | Use this. Phone v46 candidate. |
| `play-store-v1` | `9dd8185` | Original PR branch. |
| `snapshot/last-good-table-v65` | `108f2be` | Table chrome after v46 (toasts, soft/hard badges). |
| `casino-table-v65` | `108f2be` | Same as above. |
| `archive/sept-experiments` | `7ebf3aa` | Broken 7 Sep shell. Do not play. |
| `snapshot/broken-shell-2026-09-07` | `7ebf3aa` | Same tip as archive. |
| `master` | `7ebf3aa` (at pin time) | Left untouched. Still the broken shell. |

## What we did not do

- Did not force-push `master`.
- Did not delete Sept 6–7 commits.
- Did not rebuild or replace the APK on the phone.

## How to work from here

```bash
git fetch origin
git checkout stable/phone-v46
```

Play in the browser. Keep the installed phone APK. Do not `cap sync` over it until this branch has been clicked through.

To make Pages match later (only after you confirm this plays):

```bash
git checkout master
git reset --hard origin/stable/phone-v46
git push --force-with-lease origin master
```
