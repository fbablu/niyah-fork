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
- `sessions` — owner read; client `update` restricted to `['status','completedAt','updatedAt']`;
  financial fields immutable.
- `userFollows` — `allow write: if false`; follow/unfollow go through `followUserFn`/`unfollowUserFn` CFs.
- Server-managed / admin-only: `transactions`, `groupSessions`, `groupInvites`, `revenue`,
  `rateLimits`, `walletAudits`, `userMerges`, `migrations`, `deletions`, `config/featureFlags`,
  `analytics_events`, `metrics`.

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

### Firebase Config Files

`GoogleService-Info.plist` and `google-services.json` are **gitignored**. They contain API keys that, while designed to be public (embedded in every compiled app binary), were removed from the repo for defense-in-depth.

- **Local dev**: files live in `firebase/`, injected by config plugins at build time
- **EAS cloud builds**: uploaded as file secrets (see [Development](./development.md#environment-variables))
- **Key rotation**: done in GCP Console > Credentials > Regenerate, then re-download from Firebase Console

## API Key Management

### Rotated Keys

All keys were rotated after removing config files from the repo:

- iOS API key (restricted to bundle ID `com.niyah.app`)
- Android API key (no fingerprint restriction yet -- add SHA-256 when first Android build is done)
- Browser API key (no restrictions)
- Stripe publishable key (updated in `.env`)
- Stripe secret key (updated in Firebase Secret Manager)

### Keys That Should NOT Be Rotated

- **OAuth Client IDs** -- used for Google Sign-In, different from API keys. Rotating breaks auth.

### Remaining Security Work

- **App Check enforce flip** — implementation is done; only the `APP_CHECK_ENFORCED=true` flip
  remains, gated on ≥99% verified token coverage in the Console Metrics tab (see above).
- **Android API key restriction** — add SHA-256 fingerprint when first Android build is done via EAS.
- **Delete old rotated keys** — remove deprecated keys in GCP Console after confirming stability.
- **Universal-link AASA** — host `apple-app-site-association` on `niyah.live` (see [security-deploy-checklist.md](./security-deploy-checklist.md) "What's NOT done").
- ~~Node.js runtime upgrade~~ — Done. Cloud Functions on Node.js 22.
