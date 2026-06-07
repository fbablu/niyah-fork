# Security

> Security measures, key management, and protection layers.
> **Operator runbook (what to click/run to activate each protection): [security-deploy-checklist.md](./security-deploy-checklist.md).**
> See also: [Development](./development.md) | [Architecture](./architecture.md) | [STATUS](./STATUS.md)

## Overview

The repo is **public** (school requirement). Security cannot depend on hiding code. All secrets are managed via environment variables, Firebase Secret Manager, or cloud provider configuration.

## Completed Security Work

### Server-Side Validation (Cloud Functions)

The ~40 callable Cloud Functions validate:

- Firebase Auth token (`context.auth.uid`)
- Request parameters (types, ranges, required fields)
- Rate limiting on sensitive operations (deposits, withdrawals, session actions)
- Amount bounds and balance checks
- **App Check token** on money-path functions when enforced (see below)

### Firestore Security Rules

Hardened rules in `firebase/firestore.rules`. Key collections (default-deny for anything unmatched):

- `users` — **any signed-in user can read** any user doc; owner-write is gated by an
  `affectedKeys().hasAny([...])` **denylist** for protected fields (KYC, Stripe IDs, phone, email,
  merge state, `legalAccepted*`, `ageAttested18`). Those fields are **client-immutable** — only the
  admin SDK (Cloud Functions) can write them. Sensitive PII (Plaid/Stripe tokens, KYC names,
  `fcmTokens`) lives in separate `userPrivate` / `userPushTokens` collections, owner-read only.
- `wallets` — owner **read**; client may **`create` a zero-balance wallet only**
  (`balance == 0 && pendingBalance == 0`); all balance mutations are **admin-SDK only**. So
  "edit the client to add money" is an operator/insider threat, not a user threat.
- `sessions` — owner read; client `update` restricted to
  `['status','completedAt','updatedAt','violationCount']`; financial fields (stakeAmount,
  potentialPayout, endsAt, cadence) immutable; create is server-only (`createSoloSession`).
- `userFollows` — `allow write: if false`; follow/unfollow go through `followUserFn`/`unfollowUserFn` CFs.
- Server-managed **writes** (admin-SDK only; reads vary): fully sealed (no client read or
  write) — `revenue`, `rateLimits`, `walletAudits`, `userMerges`, `migrations`, `deletions`,
  `config/serverFlags`; owner/participant-read, write-denied — `transactions`, `groupSessions`,
  `groupInvites`; **public-read**, write-denied — `config/featureFlags`, `metrics`;
  `analytics_events` is shape-locked client-`create` only (no read).

**Deploy**: `firebase deploy --only firestore:rules`

### Firebase App Check

**Wired end-to-end, not a gap.** Client attestation via `src/config/appCheck.ts` (App Attest /
DeviceCheck on iOS, reCAPTCHA Enterprise on web). Server enforcement via the `assertAppCheck` helper
in `functions/src/index.ts`, gated by the `APP_CHECK_ENFORCED` env flag. The money-path functions
(`createPlaidLinkToken`, `linkBankAccount`, `unlinkBankAccount`, `replaceBankAccount`,
`requestWithdrawal`, `createGroupSession`, `requestAccountMerge`) **hard-enforce when the flag is on**.

> ⚠️ **Keep `APP_CHECK_ENFORCED=false`** until Firebase Console → App Check → **Metrics** shows
> ≥ 99% verified production traffic, or real users lock out. The flip is in
> [security-deploy-checklist.md](./security-deploy-checklist.md) Phase 2.

### Client-Side Protections

- **SSL Pinning** (`src/config/sslPinning.ts`) -- pins CA-level public keys for Cloud Functions endpoint. Safety valve expires 2027-01-01 (degrades to normal TLS, never bricks). No-op in `__DEV__` and on web.
- **Screen Protection** (`src/hooks/useScreenProtection.ts`) -- prevents screenshots, screen recording, and blurs app switcher preview. Uses `expo-screen-capture` with graceful fallback if unavailable.
- Both modules use lazy `require()` with try/catch for graceful failure.

### 2026-05-30 `/vibe-security` audit (wallet-ledger)

Full money/auth/rules sweep + 3 adversarial verification rounds. All findings fixed (see
[STATUS.md](./STATUS.md) "Audit findings"). Headline items:

- **Bucket ledger now enforced everywhere money moves** (`balance == Σbuckets`): bucket-aware
  `requestWithdrawal` (gates on `computeWithdrawable`, draws buckets down, restores on every abort
  path); promo → `bonus` bucket; `deleteAccount` refunds `deposited`-to-card only and pays/holds
  withdrawable house money; group cancel/timeout refunds + account merge move buckets in lockstep.
- **Group refunds idempotent** (deterministic `group_refund_<sid>_<uid>` doc id) + `cancelGroupSession`
  rejects terminal sessions — closes a double-refund cash leak.
- **`getCallerIp`** now returns the rightmost **public** IP (infra-appended, unspoofable) instead of
  the client-controlled leftmost XFF entry — hardens the per-IP money-path rate limiter.
- **`acceptLegalTerms`** version is allowlisted; **`analytics_events`** rules add a field allowlist +
  name size cap.
- New `functions/src/wallet.test.ts` pins the gate↔debit and deletion-conservation contracts.

## Environment Variables & Secrets

### Client-Side (`.env`)

Read by `app.config.js` at build time. Values are `EXPO_PUBLIC_*` prefixed (embedded in JS bundle -- these are NOT secrets, just config that shouldn't be hardcoded in source).

See [Development > Environment Variables](./development.md#environment-variables) for the full list.

### Server-Side (Firebase Secret Manager)

True secrets that never touch client code:

- `STRIPE_SECRET_KEY` (**LIVE `sk_live_`**) / `STRIPE_WEBHOOK_SECRET` — `firebase functions:secrets:set ...`
- `PLAID_CLIENT_ID` / `PLAID_SECRET` — Plaid production credentials
- `ADMIN_API_KEY` — guards admin-only HTTP CFs (e.g. `migrateSensitiveFieldsToPrivate`, `mergeDuplicateUsers`); 32+ chars, constant-time compared
- `GCLOUD_PROJECT` / `GCP_PROJECT` — auto-set runtime env vars, **not** Secret Manager entries

### Server-Side Operational Flags (`config/serverFlags`)

Non-secret money-path knobs that must survive losing the local `functions/.env.production`
**and** be toggleable without a redeploy live in the Firestore **`config/serverFlags`** doc —
**server-only** (rules `allow read, write: if false`; admin-SDK / console writes only; NOT
client-readable, unlike `config/featureFlags`). Functions resolve each flag **Firestore →
`process.env` → safe code default** (`getServerConfig` / `resolve*` in `index.ts`, ~60s cache).

- `billingKillSwitchEnabled` (bool) — arms the budget kill-switch. **Critical:** the env/code
  default is `false` (disarmed), so a lost env file would silently un-protect; set this in the doc
  to keep it durably armed.
- `promoCents` (number) — promo grant; default `0` (OFF, safe).

Set/toggle via Firebase Console → Firestore → `config/serverFlags`. `FIRST_SURRENDER_FORGIVENESS_CENTS`
is still env-only (safe-on-loss default `500`); migrate it the same way if console-toggling is wanted.

### Firebase Config Files

`GoogleService-Info.plist` (iOS) is **gitignored**. It contains API keys that, while designed to be public (embedded in every compiled app binary), were removed from the repo for defense-in-depth. (The Android `google-services.json` is gone — iOS-only since 2026-06-07.)

- **Local dev**: files live in `firebase/`, injected by config plugins at build time
- **EAS cloud builds**: uploaded as file secrets (see [Development](./development.md#environment-variables))
- **Key rotation**: done in GCP Console > Credentials > Regenerate, then re-download from Firebase Console

## API Key Management

### Firebase client keys — actual status (corrected 2026-06-07)

> Prior versions of this doc claimed "all keys were rotated." That was **wrong**:
> a `/vibe-security` audit verified the Firebase client keys in old public history
> commits (`592a324`, `406e285`) are **byte-identical to the current live keys**
> builds 19–22 ship with. They were never rotated. This is bounded (client keys
> ship in every binary and the repo is public by design — data access is gated by
> rules + Auth + App Check, never key secrecy), but it must be recorded honestly.

**Niyah is iOS-only (2026-06-07).** The Firebase **Android** app + its API key
(`AIzaSyCi-…EQ0`) were the worst exposure — live + unrestricted in public history.
The codebase side is **done** (Android app config, `google-services.json`,
`withGoogleServicesJson` plugin, and the Android client ID are all removed). Two
**console steps remain** to actually kill the key: (1) Firebase Console →
**Remove this app** (niyah-android), (2) GCP → APIs & Services → Credentials →
**delete** the orphaned "Android key (auto created by Firebase)". Until step 2 the
public-history key still works — removing the Firebase app alone does NOT delete the
GCP key. No rotation needed once deleted.

| Key | Restriction state | Action |
| --- | --- | --- |
| iOS API key | bundle-ID restriction **claimed but unverified** (a bare REST call should be re-tested) | confirm `com.niyah.app` app restriction is actually set |
| Android API key | **code removed; key delete PENDING** (2 console steps above) | delete in GCP Credentials → then inert |
| Browser API key | no restriction | add HTTP-referrer restriction (web is auth continuation only) |
| Stripe publishable / secret | n/a (publishable is non-secret; secret in Secret Manager) | — |

Residual abuse vector is now only the iOS key (ships in every binary, bundle-ID
restricted) — Identity Toolkit REST abuse (SMS-OTP pumping, enumeration) is further
gated by **email-enumeration protection** + a **lower phone-SMS daily quota** (both
in [security-deploy-checklist.md](./security-deploy-checklist.md) Phase 2) and, durably,
the App Check flip once metrics clear ≥99%.

### Keys That Should NOT Be Rotated

- **OAuth Client IDs** -- used for Google Sign-In, different from API keys. Rotating breaks auth.

### Remaining Security Work

- **Delete the Android client key** — code/config removal done (iOS-only); finish the 2 console
  steps above (remove Firebase Android app + delete the GCP key). Then there's no Android key to
  manage anymore.
- **Verify the iOS key bundle-ID restriction is actually applied** (doc previously asserted it
  without proof).
- **Enable email-enumeration protection + lower phone-SMS daily quota** — pull these forward from
  the deploy checklist; they gate the Identity Toolkit abuse path.
- **App Check enforce flip** — implementation is done; only the `APP_CHECK_ENFORCED=true` flip
  remains, gated on ≥99% verified token coverage in the Console Metrics tab (see above).
- **Universal-link AASA** — host `apple-app-site-association` on `niyah.live` (see [security-deploy-checklist.md](./security-deploy-checklist.md) "What's NOT done").
- ~~Node.js runtime upgrade~~ — Done. Cloud Functions on Node.js 22.
