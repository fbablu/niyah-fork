# STATUS — Niyah launch (canonical)

> **Single source of truth for "where the build is right now."** Read this first in a new session.
> Supersedes the old `may-26-resume.md`, `may-16-progress.md`, and the per-session summaries
> (now in [`archive/`](./archive/)). When state changes, update **this** file — don't spawn a new resume doc.
>
> **2026-06-13 (green-world redesign — on `redesign-green-world`, UNCOMMITTED; Fardeen commits):**
> A whole-app **GREEN-WORLD redesign shipped to TestFlight (builds 25–28)**. Every tab
> (dashboard/schedule/friends/profile), all 16 session screens, the money screens,
> `app/blocked.tsx`, and `app/user/[uid].tsx` were restyled to a **single brand theme**: full-bleed
> `Colors.primaryDark` (#1B4332) fields, `Colors.primary` (#2D6A4F) surfaces, `Colors.primaryLight`
> (#40916C) sheets, white text hierarchy (white / @0.7 / @0.55), proportional sizing (percent widths
> / `aspectRatio` cells, no absolute px), and translucent glass overlays. New tokens in
> `src/constants/colors.ts` (BOTH palettes identical — they layer on theme-stable brand greens):
> `glassLight/glassMid/glassDark/glassSolid/black`; `BLOB_INK "#120505"` consolidated into
> `src/constants/blobAvatar.ts` (was 21 dup literals). **Theme is now SINGLE** — the dark/light
> toggle was **removed** from Profile (founder decision 2026-06-12); `app/(tabs)/_layout.tsx`,
> `app/session/_layout.tsx`, `user/[uid]`, and `blocked` wrap their subtrees in
> `ThemeOverrideContext.Provider value="dark"` (same mechanism `app/(auth)` uses) so theme-driven
> children resolve dark on the green field. `themeStore` (`toggleTheme`/`setTheme`) is retained for a
> future light variant; the UI toggle is gone. **Motion is near-static** (founder taste): entrance
> fades ~200ms `Easing.out(cubic)`, NO springs/overshoot/spins/stagger; calendar-stamp blink and the
> customizer slingshot/hero-spring removed (plain 220ms slide); die randomize is instant + a 150ms
> opacity dip. KEPT: the platform "sleepy-eye" vertical flip (180ms) and house press-scale springs
> (`{damping:15,stiffness:220}`). All reduced-motion aware. **Profile tab rebuilt** around
> `src/components/profile/*`: **Clout** (`src/utils/clout.ts` — weights soloNone 1 / soloStake 3 /
> groupNone 4 / groupStaked 8 + `round(4·√distinctFriends)`; tiers Newcomer 0–49 / Committed 50–149 /
> Trusted 150–399 / Inner Circle 400+; `CloutCard` + `CloutInfoSheet` + `CloutWeightRow`) replaces
> the Social-Credit/Reputation card **on this tab only** (`ReputationCard` is unchanged on
> friends/user screens — Clout migration there is a future product decision); `SessionCalendar` +
> `CalendarHeader` + `CalendarStampBlob` (collectible blob stamps seeded by `sessionId`, one per
> completed session) + `SessionReceiptSheet` + `ReceiptActivitySection` (per-session app-usage by
> category, captured at completion); `BalanceSection` + `AllTimeTicker` (green up / red down all-time
> %, fail-safe hidden when ledger incomplete, `src/utils/balanceDelta.ts`); the +/- liquid-glass pill
> (deposit/withdraw chooser); `BlobMakerSheet` v2 + `BlobMakerStage`/`BlobOptionRows`/`BlobPlatform`;
> `ProfileHeader` rewritten. **`@expo/ui` (0.2.0-beta.10) is installed but its POD is EXCLUDED** via
> `package.json` `expo.autolinking.exclude` (doesn't compile vs SDK 54's `expo-modules-core`); the
> SwiftUI liquid-glass +/- pill is **hard-disabled** (`BalanceSection.tsx` `POD_INCLUDED=false`)
> after a confirmed iOS-26 render crash in builds 25/26 (missing `ExpoUI` Fabric view, no `.ips`) —
> the RN glass fallback ships; revisit at SDK 55. **Builds this cycle:** 25 (profile v2), 26 (full
> all-tabs sweep), 27 (crash fix), 28 (near-static motion + remaining old-scheme components converted
> + toggle removed). `BUILD_NUMBER` is now epoch-seconds via `scripts/build-prod.sh` (`eas.json`
> `appVersionSource: "local"`); **latest = 28**. **Gates green:** typecheck 0 errors, jest ~957/963
> (6 intentional skips), eslint 0/0. Specs: [figma-design-rules.md](./figma-design-rules.md),
> [profile-redesign-brief.md](./profile-redesign-brief.md) (Clout model + verbatim Figma comments).
> History of the overnight run: [redesign-all-tabs-progress.md](./redesign-all-tabs-progress.md).
> **Next major build = the STAKING WIZARD** ([staking-wizard-plan.md](./staking-wizard-plan.md)):
> dashboard collapses to TWO buttons (Focus = free → quick-block; Stake a session → new wizard route
> group `app/session/wizard/{people,stake,apps,schedule,review}`); reusable haptic `Dial` (people
> 1–5, dollar amount); ticket-stub invites (Phase A = share sheet over the existing
> `niyah.live/join` universal link + restyled invites screen; Phase B App Clip specced, NOT
> scheduled). The group server surface already supports it; solo needs a small reviewed
> `createSoloSession` extension (Option A) or snaps to the cadence ladder (Option B). `propose.tsx`'s
> Day/Time pickers were never wired server-side and are removed by the wizard. **Still-open money P0s
> (Fardeen-reviewed, NOT applied):** C1 withdrawal double-debit (deterministic `txnRef`), C2 recovery
> payout race (client writes status before `cloudComplete`), H1 payout `idempotencyKey`, M1
> `stakeComposition` validation — precise fixes in `deep-audit-2026-06-08.md`. **C2 is a hard
> prerequisite for force-quit/recovery testing of the wizard.**
>
> **2026-06-08 (session 2 — build-23 feedback pass, IN PROGRESS on worktree branch
> `worktree-build-23-feedback`, NOT yet on `main`; git is permission-gated this session, so Fardeen
> commits):** Triaged the walk feedback WITH Fardeen → committed to ALL 5 build-23 UX items AND all 5
> "later" tracks. **Item A (onboarding-shows-once) DONE** — `pnpm run ci` green (client jest + 91/91
> functions), UNCOMMITTED: durable local legal-acceptance marker (stops the Terms re-prompt loop even
> when `acceptLegalTerms` lags/fails) + a persisted per-uid `onboardingComplete` flag set on first
> tabs mount that stops Screen Time / "stay in the loop" re-appearing every launch. Files:
> `src/store/authStore.ts`, `app/index.tsx`, `app/(tabs)/_layout.tsx`,
> `src/__tests__/unit/store/legalAcceptance.test.ts` (8/8). **Item D (blob-maker behind an edit
> pencil) DONE** — new `BlobMakerSheet` (pencil → blob zooms to foreground, generative Shuffle, no
> shape picker, Color/Expression pickers), `ProfileHeader` rewrite, `unique` eyes nudged up;
> `ProfileHeader.test.tsx` 13/13; CI green. **Remaining build-23 (B native shield, C green-toggle,
> E positioning, item-5 nav) need hot-reload/native review — documented in
> [build-23-progress.md](./build-23-progress.md), not done blind.** Overnight (Fardeen asleep): the
> audit ladder (/vibe-security + security docs → inefficiency → dead-comment cleanup → file
> structure), each CI-gated. Safe fixes applied (notification crash guards, onSnapshot error logging, dead reputation+balance dual-writes removed; CI green) — see security-audit / code-quality-audit / deep-audit (2026-06-08) docs. IMPORTANT: the deep audit found REAL P0 money-path bugs DEFERRED for your review (NOT applied blind): C1 withdrawal double-debit (= the known-open issue below), C2 recovery payout race, H1 payout idempotency, M1 stake-composition validation — precise fixes in deep-audit-2026-06-08.md; land them with a real-money smoke test before the next submit. **W2 (engineering feasibility) DONE →
> [post-1.0x-engineering-plan.md](./post-1.0x-engineering-plan.md)**: notification allow-list =
> IMPOSSIBLE via public iOS API (+ copy-accuracy risk); zen-vs-staked nav = 100% JS-buildable;
> anti-cheat/KYC = mostly gated on the multiplier flip (App Check enforce flip free now); "meaningful
> minutes" = unmeasurable → ship an honest "slips" metric. **W1 (business-model + abuse-prevention)
> DONE (salvaged from the workflow journal) → `docs/monetization-model.md`** (recommended: pure 1.0×
> cash + non-cash affiliate "blobs" + cosmetics-only IAP; group-rake is dead; decision list inside). Detail: [build-23-progress.md](./build-23-progress.md).
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
> NOT contain them.** Build number now **auto-increments** — build with `pnpm build:prod`
> (`scripts/build-prod.sh` sets `BUILD_NUMBER=$(date +%s)`; no more manual edits; build 22 was the
> last hand-numbered upload). **Next (the needle): (1) address the latest feedback/UX notes (see
> the build-23 punch-list in `docs/nyc-tech-week.md` — onboarding-shows-once, dead notification
> buttons → push-to-stop, schedule green-toggle, profile blob-maker behind an edit pencil, global
> content-view positioning) → (2) `pnpm build:prod` → (3) device Release pin check → (4) internal
> TestFlight → (5) real-money smoke → (6) external public link → Beta App Review → QR.** See
> §Remaining-to-submit.
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

- **Branch:** `redesign-green-world`, **UNCOMMITTED** (Fardeen commits) — the whole-app green-world
  redesign + Profile v2 rebuild, on TestFlight as **builds 25–28 (latest = 28)**. Branches off
  `main` (the de-pooled v1 line; the old `wallet-ledger` working branch + side branches/worktrees
  were consolidated into `main` 2026-06-09). All money-path / legal / privacy-manifest work from the
  pre-redesign line is on `main`; this branch is **UI/UX-only** plus the new Clout/Calendar/Balance
  Profile components and constants — **no money-path or rules changes** rode the redesign.
  - **Single brand theme (this branch):** dark/light toggle removed from Profile (founder decision
    2026-06-12); subtrees wrap in `ThemeOverrideContext.Provider value="dark"`. `themeStore` retained
    for a future light variant. New tokens in `src/constants/colors.ts` + `BLOB_INK` in
    `src/constants/blobAvatar.ts`. See the dated header entry for the full component list.
  - **Profile rebuilt:** `src/components/profile/*` + **Clout** (`src/utils/clout.ts`) replaces the
    Social-Credit card **on Profile only**; `ReputationCard` unchanged on friends/user screens.
  - **`@expo/ui` POD excluded / SwiftUI pill hard-disabled** after a confirmed iOS-26 render crash in
    builds 25/26 — RN glass fallback ships; revisit at SDK 55. See the dated header + CLAUDE.md
    Gotchas.
- **Still-open money P0s (Fardeen-reviewed pass, NOT applied):** C1 withdrawal double-debit
  (deterministic `txnRef`), C2 recovery payout race, H1 payout `idempotencyKey`, M1
  `stakeComposition` validation — precise fixes in `deep-audit-2026-06-08.md`. **C2 is a hard
  prerequisite** for force-quit/recovery testing of the staking wizard. Land these with a real-money
  smoke test before the next submit.
- **Next major build = the STAKING WIZARD** — [staking-wizard-plan.md](./staking-wizard-plan.md):
  dashboard → two buttons (Focus free / Stake a session → `app/session/wizard/*`), haptic `Dial`,
  ticket-stub invites over `niyah.live/join`. Group server surface already supports it; solo needs a
  small reviewed `createSoloSession` extension or snaps to the cadence ladder. `propose.tsx` Day/Time
  pickers (never wired server-side) are removed by the wizard.
- **Landing is LIVE; prod money path = the deployed de-pooled `main` functions.** niyah.live is
  de-pooled and serves `/legal/{privacy,terms}`; the `niyah.live/stripe/return` bounce is live.
- **Gates green (this branch):** typecheck 0 errors · jest ~957/963 (6 intentional skips) · eslint
  0/0. Functions suites run via `pnpm test:functions` (Node built-in runner + `tsx`); rules via
  `pnpm test:rules` (emulator). `tsc` clean both sides.

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
7b. ~~**TestFlight internal builds 22–28**~~ — the build-22 pin fix + build-23 feedback pass + the
   **green-world redesign (25–28)** all shipped to internal TestFlight, **latest = 28** (near-static
   motion + full all-tabs sweep + Profile v2 + toggle removed). `BUILD_NUMBER` is now epoch-seconds
   via `scripts/build-prod.sh` — **build with `pnpm build:prod`** (don't hand-number). Same upload
   recipe (upload ≠ review): `set -a; source .env; set +a`, then
   `npx eas build --platform ios --profile production --local` (writes a NEW `build-<ts>.ipa` —
   submit THAT file), then `npx eas submit --platform ios --profile production --path ./build-<ts>.ipa`.
7c. **Merge `redesign-green-world` → `main` deliberately** — the redesign + Profile v2 are
   UNCOMMITTED on the branch (UI/UX-only, no money-path/rules changes). Re-merge at the end of the
   cycle; `main` is the live-payments branch.
7d. **Land the still-open money P0s before the next submit** — C1 double-debit, C2 recovery race,
   H1 payout idempotency, M1 stake-composition (precise fixes in `deep-audit-2026-06-08.md`);
   **C2 is a hard prerequisite for force-quit/recovery testing of the staking wizard.** Pair with a
   real-money smoke. The staking wizard ([staking-wizard-plan.md](./staking-wizard-plan.md)) is the
   next major build on top.
8. **Smoke + UX pass ON build 28:** the controlled real-money smoke on a **fresh clean account**
   (the freed real number works now) + Delete on a throwaway — full tickable script in
   **[smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)**. Plus the on-device checks: every tab +
   all 16 session screens + money/blocked/public-profile render correctly on the single green theme
   (no leftover light-scheme surfaces); free block shows non-forfeit shield copy / staked shows "$X
   stake"; per-category attempt counts; template save/apply; never-block exempts Spotify; sign-out
   clears selections; Profile Clout card / calendar stamps / balance ticker; the SwiftUI pill stays
   on the RN glass fallback (no iOS-26 crash). Then the animations/UX acceptance pass; iterate
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
