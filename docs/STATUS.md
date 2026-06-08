# STATUS — Niyah launch (canonical)

> **Single source of truth for "where the build is right now."** Read this first in a new session.
> Supersedes the old `may-26-resume.md`, `may-16-progress.md`, and the per-session summaries
> (now in [`archive/`](./archive/)). When state changes, update **this** file — don't spawn a new resume doc.
>
> Last updated: **2026-06-08** — everything below is **merged to `main` and pushed**
> (`origin/main` == `main` == `b821f22`), and **all GitHub Actions are green** (CI ✅, Deploy
> Landing Page ✅, CodeQL ✅). On top of the build-22 pass: the **Screen Time permission preview**
> (`src/components/onboarding/ScreenTimePermissionPreview.tsx` — Opal-style tappable mock of the
> iOS auth sheet replaces the green "Connect" button on `screentime-setup`), plus a **CI/tooling
> rescue** (see [tooling-gotchas.md](./tooling-gotchas.md)): CI now installs pnpm via
> `npm install -g pnpm@11.5.2` (the `pnpm/action-setup@v4` self-installer is broken), Node 22 in
> CI, `expo-router`/`react-native-screens` deduped, and `landing-pg` builds sharp via
> `allowBuilds` in `pnpm-workspace.yaml`. `main` is ruleset-protected; Fardeen pushes directly via
> the **Repository-admin bypass**. **`buildNumber` still 22 — no new binary cut since
> `build-1780863322889.ipa`, and that IPA predates the Screen Time preview + CI work, so it does
> NOT contain them.** **Next (the needle): cut a fresh build (bump to 23 if 22 was already
> uploaded) → device Release pin check → internal TestFlight → smoke → public QR.** A build-23 UX
> punch-list (onboarding-shows-once, dead notification buttons → push-to-stop, schedule
> green-toggle, profile blob-maker behind edit pencil, global content-view positioning) is
> captured in `docs/nyc-tech-week.md`. See §Remaining-to-submit.
> Prior: **2026-06-07** — the full build-21 feedback pass is now **COMMITTED** (8 slices,
> `d39f7b9`→`c8f37e1`): the SSL all-four-GTS-roots **pin fix** (the prod-outage fix), SlideToConfirm
> on money CTAs, shield free-vs-staked copy + session context, per-category blocked-attempt counts,
> block-list templates + never-block, Focus tab removed, single-ring timer, solo-picker carousel,
> friends de-nest, schedule conflict fixes + block progress, legal bottom sheet + acceptance retry,
> dark-pinned onboarding + solid tree, blob variance. buildNumber → **22**. Client CI **828 pass**.
> **iOS-only as of 2026-06-07:** the Firebase Android app config, `google-services.json`,
> `withGoogleServicesJson` plugin, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, and Android docs are
> removed (code done) — **2 console steps still pending** to actually kill the orphaned Android API
> key (Firebase → Remove app; GCP → delete the auto-created Android key) — see [security.md](./security.md).
> Only **uncommitted** work = the iOS-only scrub + the honest security-record correction (11 files,
> ready to commit). **Next: commit → build 22 → device Release pin check → internal TestFlight →
> smoke → public QR.** See §Remaining-to-submit.
> Prior: **2026-06-06 night** — build-21 field test surfaced a **prod outage**: the SSL
> pin set (WE2 intermediate) no longer matched Google's served chain on `cloudfunctions.net`,
> killing EVERY Cloud Function call (deposits, delete-account, legal acceptance → the
> Terms-re-prompt). Fixed (all four GTS roots pinned) + the full build-21 UX feedback pass
> implemented (then uncommitted, ~2,000 lines / 49 files; committed 2026-06-07 — see above).
> See §Remaining-to-submit.
> Prior: 2026-06-06 PM — slices committed (head `edc4139`+), account cleanup DONE,
> functions+rules deployed to prod, PII migration run, APNs keys uploaded, funnel events added,
> build 21 built + uploaded to internal TestFlight.
> Prior: 2026-06-06 AM — overnight polish loop + Blob Maker onboarding landed (uncommitted).
> Prior: 2026-06-01 — submit-readiness audited 2026-05-31 (see
> [submit-and-ai-plan.md](./submit-and-ai-plan.md)); 2026-05-30 PM — PR #7 merged to `main`,
> pre-deploy pre-flight green, smoke pending.
>
> **2026-06-06 deltas (supersede the "Right now" branch bullet below):**
> - **Branch reality check (2026-06-07):** `wallet-ledger` is **83 commits ahead of `main`**
>   (TestFlight build 19→22 line, schedule templates, build-22 feedback pass, iOS-only scrub) and
>   **19 commits ahead of `origin/wallet-ledger`** (unpushed) plus **11 uncommitted paths** (the
>   iOS-only scrub + security-record correction). The "0 divergence" statement below is stale (was
>   true 2026-06-01). Merge to `main` deliberately — `main` is the live-payments branch.
> - **Overnight polish loop (2026-06-05, UNCOMMITTED):** skeletons everywhere, UI-thread Reanimated
>   migrations (Timer ring, dashboard), local retention reminders (streak-at-risk + scheduled-block,
>   notifee + per-day dedup), granular Zustand selectors on all 4 tabs, procedural "unique" blobs.
>   Final 3-agent review: 0 blockers. Commit slices 1–7 in
>   [overnight-2026-06-05/progress.md](./overnight-2026-06-05/progress.md).
> - **Blob Maker onboarding (2026-06-05 PM → 06-06, UNCOMMITTED):** new `(auth)/blob-maker` screen
>   (shuffle-to-morph blob on a podium, between profile-setup → intake), `MorphingBlob` (UI-thread
>   path morphing), `shapeSeed` account-bound blob identity (`uid:nonce` — visual fingerprint, NOT
>   a credential), `completeProfile` now seeds `shapePreset:"unique"`. Commit slices 8–10 in the
>   same progress log.
> - **`firestore.rules` grew a `users.blobAvatar` validation clause** (known keys / string types /
>   size caps, diff-gated for legacy docs) — **rides the already-pending rules deploy**; backward
>   compatible with the shipping client. `/vibe-security` on the diff: no Critical/High. NEW
>   `pnpm test:rules` (13/13, emulator; needs Java 21+ → `JAVA_HOME=$(brew --prefix openjdk)`).
>   New dev-only deps: `firebase`, `@firebase/rules-unit-testing` (not bundled).
> - **Test counts:** client Jest **812 pass / 0 fail** · functions 91/91 (node:test) · rules 13/13.
> - **Known follow-up (pre-existing, Medium):** users update rule has no doc-wide `hasOnly()` key
>   whitelist — owner can write arbitrary non-denylisted fields. Do as a separate reviewed rules
>   pass before public launch.
>
> **2026-06-01 deltas (audit close-out):**
> - **APNs `.p8`** (Apple Team `4R55F73KCP`) → Firebase Console → Cloud Messaging is an **explicit submit
>   step** (§Remaining-to-submit 5). Defer option: `EXPO_PUBLIC_DISABLE_PHONE_AUTH=true` (Google/Apple-only).
> - **`migrateSensitiveFieldsToPrivate` run-status: NOT yet run** against prod. Backfills/scrubs
>   email+phone off the public `users/*` docs; active users self-migrate on the 2.0.0 legal re-prompt,
>   but run it after the functions deploy for full closure (paginate via `nextCursor`).
> - **Screen-capture protection** (`src/hooks/useScreenProtection.ts:33`) **stays OFF for the submit
>   build** (demo / investor screen-share workaround) — **tracked post-event flip** to `true` after the
>   tech-week events; verify screen-share isn't broken before flipping.
> - **Engagement-gate definition still needs finalizing** (criteria, not mechanism — see Post-submit
>   dormant flips). Does NOT block submit: only the $5 forgiveness bonus is gated in v1.
> - **AI work (Phase-0 capture + `ml/`) is PARALLEL — NOT a submit blocker.** Built 2026-06-01: schema +
>   flag (`AI_DATA_CAPTURE_ENABLED`, default on) + surrender-reason chips + session time-of-day capture;
>   the `ml/` NumPyro prototype is offline + in `.easignore`. See [submit-and-ai-plan.md](./submit-and-ai-plan.md)
>   Parts 3–4 and the rules caveat in [session-2026-06-01-heavy-work.md](./session-2026-06-01-heavy-work.md).

## Right now

- **Branch:** `wallet-ledger` == `main` == `origin/main` == `41dfb43` — the de-pooled v1, **fully
  merged** (PR #7 squash-merged the landing de-pool; **0 commits divergence** either way). The whole
  money path + `firestore.rules` + indexes + the landing de-pool are on `main`. All de-pool / legal
  / money-path-hardening / privacy-manifest work is **committed**. (4 stale worktree branches still
  exist — `fix/appstore-copy`, `chore/dead-code`, `chore/docs`, `feat/ux-onboarding` — clean up
  post-deploy.)
  - **Legal-UX polish (committed):** acceptance overlay redesigned; legal gate fires right after
    sign-in (before profile setup); the permission-denied on accept fixed; `acceptLegalTerms` CF
    made idempotent. Detail in the **Legal** bullet below. The CF change needs the functions deploy
    to fully persist a new user's acceptance.
  - **Money-path security hardening (committed):** `/vibe-security` run → all findings fixed across
    3 adversarial verification rounds. The bucket ledger (`balance == Σbuckets`) is now enforced
    **everywhere money moves**: withdrawal is bucket-aware; promo → `bonus`; delete refunds
    `deposited`-to-card only (+ pays/holds withdrawable house money, records forfeits, guards
    frozen/drifted wallets); group cancel/timeout refunds + account merge move buckets in lockstep;
    group refunds are now **idempotent**. Detail in **Audit findings** below. **Needs the functions
    + rules deploy to take effect.**
- **Merged + pushed to `main`; landing is LIVE; functions NOT yet deployed.** niyah.live is
  de-pooled and serves `/legal/{privacy,terms}` (PR #7 → main → GitHub Pages); the
  `niyah.live/stripe/return` bounce is live. The **prod money path is still the OLD `launch`
  functions** — the new bucket ledger is on `main` but ships at the **next** deploy.
- **Pre-deploy QA in progress (2026-05-30 PM).** Pre-flight is **all green** (next subsection); the
  controlled post-deploy run is **[smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)**.
- **Tests green:** ~742 client (Jest) + **52/52 functions** (`wallet.test.ts` — 14
  bucket/withdrawal/deletion contract tests + `security`/`withdraw-earned`). Functions suites run
  via `pnpm test:functions` (Node built-in runner + `tsx`) and are **gated in CI** (`ci` script
  + `.github/workflows/ci.yml`). `tsc` clean both sides, eslint 0 errors.
- **Deployed previously:** the `launch` security/payments work (rules + functions deploy ran;
  migration 16 processed / 9 migrated). The `wallet-ledger` changes are **not** part of that — they
  ship at the next deploy.

### Pre-flight — verified 2026-05-30 PM (all green)

Read-only checks cleared before the live `firebase deploy`:

- **Secret Manager (project `niyah-b972d`)** — all 5 present: `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `ADMIN_API_KEY` (declared via
  `defineSecret`, attached to each fn's `secrets:[]`).
- **Firestore `config/serverFlags`** — `promoCents` 0/absent, `billingKillSwitchEnabled` off. This
  doc is the **source of truth** for promo + kill-switch (`061fd5a`: resolved Firestore → env →
  safe default). ⚠️ `functions/.env.production` is **not** auto-loaded by Firebase dotenv (it loads
  `.env` / `.env.<projectId>` / `.env.<alias>`; the only alias is `default`→`niyah-b972d`), so it is
  **not** the load-bearing pin for `FINALS_PROMO_CENTS` — the Firestore doc + the code defaults
  (`promo→0`, `kill-switch→false`, `PLAID_ENV→production`) govern.
- **Stripe webhook** (`stripeWebhook`, us-central1) — endpoint registered; handles
  `payment_intent.succeeded` + `account.updated` (a `payment_intent.failed` subscription is
  unhandled/benign — credit only ever happens on success). The `whsec` match isn't pre-readable;
  it's confirmed by the smoke deposit → **200** delivery.
- **Plaid** — env = **production** (code default; `PLAID_ENV` unset). Webhook wired **per-Item** via
  `/link/token/create` `webhook:` (`index.ts:1972`) → `plaidWebhook`; nothing to set in the Plaid
  dashboard.
- **Deploy command** (Fardeen runs): `cd functions && npm install` (deps already in sync) →
  `firebase deploy --only functions,firestore:rules,firestore:indexes`. **Live + irreversible.**

### What `wallet-ledger` contains (the v1 submission binary)

Pilot scope is **locked**: ship a clean **de-pooled commitment-contract** binary. All earn-more /
bucket-multiplier machinery ships **dormant behind flags** (enforcement OFF) — the pilot behaves
like stickK (complete → get your exact stake back, `SOLO_COMPLETION_MULTIPLIER = 1`).

- **Server money-path** (`functions/src/wallet.ts` + `index.ts`): 4 wallet buckets
  (`deposited` / `earned` / `bonus` / `credit`), bucket-routed writers, txn taxonomy
  (`+bonus/credit/refund/forgiveness`). Group **de-pooled** (`calculateGroupSessionPayouts`: each
  completer gets their own stake back, forfeit → house, no redistribution). Settlement untangled
  (group payout = wallet credit like solo; the single cash-out transfer happens at withdrawal).
  Geo-gate: withdrawal refuses **FL + HI** (`WITHDRAWAL_EXCLUDED_STATES`). Dormant flags
  `SOLO_PAYOUT_MULTIPLIER` (default 1.0), clamped `[1.0, 2.0]`.
- **Client de-pool:** `payoutAlgorithm` own-stake-back, `calculateTransfers → []`,
  `SOLO_COMPLETION_MULTIPLIER = 1.0`. Settlement screens de-pooled (`surrender.tsx`,
  `complete.tsx`); the "Pay your partner via Venmo" flow removed; Venmo/Zelle/`photoURL` dead code
  purged client + server.
- **18+ self-attestation:** explicit "I am 18+" checkbox in `LegalAcceptanceOverlay` (Continue
  gated on it **and** ToS-accept). `ageAttested18` written server-side by `acceptLegalTerms`,
  client-immutable via `firestore.rules` denylist, hydrated in `authStore`. **No DOB stored** —
  Stripe KYC verifies real age at money-out.
- **Legal:** in-app `LegalContentView` rewritten de-pooled; `CURRENT_LEGAL_VERSION` 1.0.0 → **2.0.0**
  (re-prompts every user, backfills `ageAttested18`). Hosted ToS/Privacy as Next.js routes in
  `landing-pg/app/legal/{privacy,terms}/page.tsx` → `niyah.live/legal/{privacy,terms}`
  (build-verified; auto-deploys on merge to `main`). Governing law = **Delaware**.
  - **Acceptance UX (2026-05-30):** `LegalAcceptanceOverlay` is now a centered card with a 4-bullet
    plain-words summary + clean "Read full Terms / Privacy" links (`LEGAL_TERMS_URL` /
    `LEGAL_PRIVACY_URL` → hosted pages) instead of the full text inline. Acceptance now fires **right
    after sign-in, before profile-setup** — all sign-in paths (`auth-entry` Google/Apple,
    `verify-phone`) route through `/`, and `app/index.tsx` gates **legal → profile → tabs**. The dead
    client-side direct write of the legal fields (always blocked by the rules denylist →
    `permission-denied`) was removed from `authStore.acceptLegal`; `acceptLegalTerms` CF is the sole
    writer and is now **idempotent** (`.update` → `.set(merge)`) so it persists even before the
    profile doc exists. **Needs the functions deploy to take effect for new users** — until then a
    fresh account shows the right order but re-prompts once on next launch. Hosted-legal links 404
    until `landing-pg` is deployed.
- **Language sweep:** all user-facing "bet/wager/gamble/win"/overstated-payout copy replaced with
  stake/commitment/goal/complete/Earned (onboarding carousel, `select`, `complete`, `waiting-room`;
  crypto art dropped). See [legal.md](./legal.md) for the terminology rule.
- **iOS privacy manifest:** `app.config.js` `ios.privacyManifests` (NSPrivacyTracking false, 4
  accessed-API reason types, 10 collected data types). `NSPhotoLibraryUsageDescription` removed.

## Remaining to submit

These are the steps between here and an App Store build. **Fardeen runs all git/deploy/outward
actions** — Claude supplies messages only.

1. ~~**Merge** `wallet-ledger` → `main`~~ — **DONE.** Fully merged at `41dfb43` (PR #7; 0 divergence).
   _(Stale: `wallet-ledger` is now 70+ commits ahead again — re-merge deliberately at the end.)_
2. ~~**Verify hosted legal live**~~ — **DONE.** `niyah.live/legal/{privacy,terms}` live (Pages).
3. ~~**Account cleanup**~~ — **DONE 2026-06-06.** Real phone number freed (`cMtHvQ` auth record
   deleted, Firestore drift fixture kept frozen); `apY32` gmail test acct fully purged
   (`functions/scripts/cleanup-test-accounts.js`).
4. ~~**Deploy**~~ — **DONE 2026-06-06.** 43 functions updated + 2 created
   (`createScheduledStakedSession`, `unfreezeWallet` — **45 total**), rules (incl. new
   `users.blobAvatar` clause) + indexes released. Post-deploy `verify-lane-a.js`: deposits ✅
   (zero double-credits); PII migration run (11 docs moved). Residual: 9 docs carry **empty**
   email/phone fields (migration only moves non-empty strings; verifier flags presence) — scrub
   with `functions/scripts/scrub-empty-contact-fields.js` (dry-run → `--apply`) then re-verify ✅.
5. ~~**APNs Auth Key**~~ — **DONE 2026-06-06.** Dev `M2F5339KYF` + Prod `BM42K87CP9` (.p8) uploaded
   to FCM (Team `4R55F73KCP`). Phone auth fully usable in live builds — the
   `EXPO_PUBLIC_DISABLE_PHONE_AUTH` fallback is moot.
6. **Funnel events (pre-QR analytics gate)** — ~~code~~ **DONE 2026-06-06** (uncommitted):
   `screentime_granted/denied`, `deposit_failed` (reason-tagged incl. `cancelled`),
   `invite_opened` + `invite_redeemed`, `onboarding_step_reached` (route-level in
   `(auth)/_layout`). Pre-auth events are rules-denied by design (ASC installs =
   top-of-funnel). One shot at clean first-touch data — these MUST be in the QR build.
7. ~~TestFlight internal build 21~~ — **DONE 2026-06-06** (uploaded, installed, field-tested) —
   **but build 21 has the SSL-pin outage**: its pinned WE2 intermediate no longer matches
   Google's served cert chain, so every CF call dies as "Network request failed" (deposit,
   withdraw, delete-account, acceptLegalTerms → the Terms re-prompt loop). **Superseded by
   build 22.**
7b. **TestFlight internal build 22** (carries the pin fix + the full build-21 feedback pass;
   `app.config.js` already bumped to `buildNumber: "22"`). Same recipe (upload ≠ review):
   `set -a; source .env; set +a`, then
   `npx eas build --platform ios --profile production --local` (writes a NEW `build-<ts>.ipa` —
   submit THAT file), then
   `npx eas submit --platform ios --profile production --path ./build-<ts>.ipa`.
   Optional but recommended first: `npx expo run:ios --device --configuration Release` — the
   only pre-TestFlight way to exercise the REAL pinning (it's skipped in all dev builds, which
   is why the outage was invisible locally). Add Funds → slide $1 → PaymentSheet opens →
   cancel = pin fix proven, no charge.
8. **Smoke + UX pass ON build 22:** the controlled real-money smoke on a **fresh clean
   account** (the freed real number works now) + Delete on a throwaway — full tickable
   script in **[smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)** (it was blocked at
   step 1 by the pin outage). Plus the new on-device checks: free block shows non-forfeit
   shield copy / staked shows "$X stake"; per-category attempt counts; template save/apply;
   never-block exempts Spotify; sign-out clears selections; 4 tabs; carousel; schedule
   Work-day-OFF → Morning adds. Then the animations/UX acceptance pass; iterate (23, 24…)
   review-free until happy.
9. **Final submit (only after 8 passes)** — App Review notes ready on request: Stripe (not IAP)
   because deposits/stakes/withdrawals are the user's own funds; commitment-contract (not
   gambling), Productivity category. Also: ASC App Privacy **Publish** (10 data types,
   Linked=true / Tracking=false), account-deletion + support URLs, `support@niyah.live`.
10. **External TestFlight public QR (tech-week track):** ASC → TestFlight → **external group** →
    **public link** → **Beta App Review** (~24–48h, lighter than App Store) on the passing build.
    The join URL → the sticker QR. The App Store submit (step 9) is a separate, slower track on
    the same binary.

> **Tech-week track (NYC 6/1–6/7):** the dual goal (external TestFlight public QR **and** App Store
> submit), the critical path, the five lanes, and the **live-money-with-strangers** risk +
> mitigations (no effective deposit gate, withdrawal-idempotency double-debit edge, billing
> kill-switch) live in **[techweek-2026-06-launch.md](./techweek-2026-06-launch.md)**. A
> `EXPO_PUBLIC_DEMO_MODE=true` build is the day-1 fallback if the live build is still in Beta review.

> **Strategic note (from the trip sessions):** a real-money app has high first-pass rejection risk.
> Realistic near-term deliverable is a **TestFlight build + deck + cohort metrics**; submit to public
> App Store when the review can be babysat. Do **not** hand out "deposit $5 / earn $5" promo cards
> before the engagement gate is live (it's the anti-fraud lever).

## Audit findings (2026-05-30 — money/auth sweep)

A 4-agent docs-vs-code sweep ran 2026-05-30. The auth surface + core money path are **solid**
(every money/user-mutation CF verifies the ID token; deposit crediting is idempotent via a
deterministic txn doc-id, race-safe vs the webhook; stake/`endsAt` re-derived server-side from the
cadence table; Stripe webhook verifies sig + IP; rules lock wallet/txn/group/server-owned-user
fields to admin-SDK-only). Findings:

**Fixed this session (pre-submit, client-only, no deploy):**
- **Solo `completeSession` race → dropped payout (was a money-loss BLOCKER).** `sessionStore.ts`
  `completeSession` wrote `status:"completed"` to Firestore unconditionally, then fired
  `cloudComplete`. The CF rejects if status ≠ active (`index.ts` handleSessionComplete:3066), so the
  client write usually won the race and the payout transaction never ran — user completes, stake
  never returns. `surrenderSession` was already fixed for this; complete was not. Now gated behind
  `DEMO_MODE` (CF is sole status writer), mirroring surrender. Test flipped to pin the new contract.
  **Needs device re-test of solo complete → payout once deployed.**

**Pre-submit decisions / checks (Fardeen — not code bugs):**
- ~~**Confirm `FINALS_PROMO_CENTS=0`**~~ — **DONE (2026-05-30).** Code default is **0**, and the
  Firestore **`config/serverFlags.promoCents`** (the real source of truth since `061fd5a`: Firestore
  → env → default) is **0/absent** — confirmed at pre-flight. (`functions/.env.production` also sets
  `FINALS_PROMO_CENTS=0`, but it is **not** auto-loaded by Firebase dotenv, so it's belt-only — the
  Firestore doc + code default govern.) The promo is safe even if re-enabled: it credits the gated
  `bonus` bucket and bucket-aware withdrawal won't release it before the engagement gate. The
  original "$5 of house money withdrawable per qualifying user" risk is closed.
- **Consider `SCREEN_PROTECTION_ENABLED=true`** (`src/hooks/useScreenProtection.ts:33`, currently
  `false` as a demo workaround) for the 6 sensitive payment screens (deposit/withdraw/bank-setup/
  verify-identity/stripe-onboarding/profile). It blanks during AirPlay/mirroring — verify it won't
  break investor screen-share demos before flipping.
- **`acceptLegal` advances the local 18+/ToS gate even if the `acceptLegalTerms` CF fails**
  (best-effort, re-prompts next launch). Decide whether to block deposit/stake until the server
  durably records acceptance (legal-state hardening for an 18+ money app).

**Money-path bugs — FIXED 2026-05-30 (`/vibe-security` + 3 adversarial verification rounds):**
- ✅ `maybeAwardFinalsPromo` now credits `bonusBalance` in lockstep with `balance` (invariant holds).
- ✅ **`requestWithdrawal` is bucket-aware** — gates on `computeWithdrawable(buckets, gateMet)`, draws
  buckets down on debit via `withdrawDrawOrder`, and one `restoreWithdrawalReservation` helper puts
  buckets back across all 6 abort paths. The previously-dead `computeWithdrawable`/draw-order helpers
  are now wired. This also gated the **live $5 first-surrender forgiveness** bonus (was withdrawable
  with no gate).
- ✅ `deleteAccount` refund basis is now the `deposited` bucket only (`cardRefundableCents`); gate-met
  withdrawable bonus is paid via the ACH/hold path; all forfeits recorded; added a frozen/drift guard
  (holds full balance for manual review, still deletes for App Store compliance) + an up-front split
  record so legs survive a mid-deletion crash.
- ✅ **Group cancel/timeout refunds** restore `depositedBalance` in lockstep AND are **idempotent**
  (deterministic `group_refund_<sid>_<uid>` doc id); `cancelGroupSession` now rejects already-
  `cancelled` sessions. Closes a double-refund cash leak. ✅ **Account merge** moves all 4 buckets in
  lockstep (no lockout of merged-in funds).
- ⏳ **STILL OPEN:** withdrawal idempotency key buckets by minute → two genuine same-amount
  withdrawals in one minute double-debit the wallet but fire one Stripe transfer. Mitigated by 3/hr
  rate limit; **not** addressed this session. The ACH-payout + held-earnings email TODOs in
  `deleteAccount` remain (unreachable in deposit-only v1).

> **Group-refund bucket note:** cancel/timeout refunds (and `recordGroupSessionPayout`) restore stake
> to `depositedBalance` regardless of source bucket — the documented pilot convention (no
> bonus/earned-funded group stakes pre-promo). When the group multiplier/promo land, split source.

## Post-submit dormant flips (NOT before submit)

The earn-more multiplier + "$5/$5" promo are **core but sequenced post-approval** — flipped
**server-side** (env flags + CFs, no client resubmit), then a fast-follow copy update. The 1.0×
binary ships now; the gate is the enabler.

**Non-negotiable before flipping any bonus/earned $ to withdrawable on live keys:**

- **Backfill + reconcile** bucket invariant MUST run first (maps txn-log → `deposited`/`earned`;
  unexplained residual is **flagged/frozen for manual review**, never auto-bucketed to `credit`).
  ⚠️ `reconcileWalletBalances` currently checks `balance` vs **transaction-sum**, NOT vs **Σbuckets** —
  extending it to also freeze on bucket drift is the right defense-in-depth, but would false-freeze
  un-backfilled legacy wallets, so **gate that change on the backfill being confirmed complete**.
- **Engagement gate — MECHANISM BUILT, CRITERIA is Fardeen's call.** Bucket-aware withdrawal is LIVE
  and currently derives `gateMet` from `getWithdrawalEligibilityStats` = **≥5 completed sessions AND
  ≥2 distinct partners** (the old finals-promo gate). ⚠️ This **conflicts with the plan to drop the
  distinct-partners requirement** (it kills solo users). Today it only affects bonus/earned
  withdrawal — deposits are always withdrawable, and the only gated $ in v1.0 is the $5 forgiveness
  bonus — but finalize the definition: proposed account age ≥ 5 days, ≥ 3 completed sessions,
  ≥ ~8–12 focus-hrs, ≥ 120-min min session, **no** distinct-partners. Change in one place: the
  `gateMet` computation (now in `requestWithdrawal`, `deleteAccount`, and `maybeAwardFinalsPromo`).
  The old `assertWithdrawalEligibility` (returns `{ok:true}`) is now superseded by this bucket gate.
- **Surplus cap** built — `min(1× net deposits, $50)` — before any multiplier > 1.

✅ **Built this session (2026-05-30):** bucket-aware `requestWithdrawal`; `deleteAccount` bucket
rewrite (refund `deposited` to card / pay-or-hold withdrawable `earned`+`bonus` / forfeit-and-record
non-withdrawable bonus + always-forfeit `credit`); group cancel/timeout + merge bucket consistency.
**Still to build (behind flags):** soft `deactivate`/pause path (App Store 5.1.1(v) keeps hard-delete
irreversible, so restore-on-return needs a separate path); client withdrawable-balance UI; the
backfill + reconcile-Σbuckets job above. Then finalize the gate criteria → backfill → flip flags.

Group payout currently credits `depositedBalance` (pilot assumption: no bonus/earned-funded group
stakes pre-promo). When the group multiplier/promo land, split surplus → `earnedBalance`.

## Operator notes / guardrails

- **`STRIPE_SECRET_KEY` is LIVE (`sk_live_`)** — real refunds/charges/transfers fire.
- **Keep `APP_CHECK_ENFORCED=false`** until Firebase Console → App Check → Metrics ≥ 99% verified,
  or users lock out.
- **Run `/vibe-security`** on auth/payments/rules diffs before commit; fix Critical + High first.
- **No** bet/wager/gamble/win/pool language (use stake/commitment/goal/complete/Earned). No VAIL /
  Dr. White references. No deploy/merge-to-main/outward action without Fardeen's explicit go.
- **Drifted test account `cMtHvQkJJZOgU6pgYARj8nN5Wpf1` stays frozen** ($200 ledger drift, auto-frozen
  nightly ~12 days; real money safe in Stripe, the freeze is *protecting* funds). **Don't reuse for
  clean tests** and don't delete the freeze flag — it's the canonical backfill test case. Forensic:
  read-only `functions/scripts/diagnose-wallet.js` (zero writes).

## Pointers

- Roadmap / phases: [roadmap.md](./roadmap.md)
- Money path detail: [payments.md](./payments.md) · Legal posture: [legal.md](./legal.md)
- Security posture: [security.md](./security.md) · Operator runbook: [security-deploy-checklist.md](./security-deploy-checklist.md)
- **Tooling/CI/build/git gotchas (read before touching CI or builds): [tooling-gotchas.md](./tooling-gotchas.md)**
- Historical session/resume/progress docs: [`archive/`](./archive/)
