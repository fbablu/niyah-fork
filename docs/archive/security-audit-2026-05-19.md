# Niyah Security Audit — 2026-05-19

> **Status (2026-05-19)**: All audit findings + a second hardening wave (per vibe-coding video review) shipped on the `security` branch. New code: `plaidWebhook` (ES256 JWT verification + auto-clear stale items), Stripe webhook IP allowlist, IP-based rate limiting on 6 money-path CFs, `disableBillingOnBudgetExceeded` opt-in kill switch, Sentry source-map upload wiring, `cors: false` on all money-path CFs, displayName length caps, niyah.live universal links, requestWithdrawal tightened to 3/hr. Operator action items moved to `docs/security-deploy-checklist.md`.
>
> Scope: `groups` branch at merge time (squash-merged into `main` as part of PR #94 "Lane B + cleanup + doc audit"). Audit covers Cloud Functions, Firestore rules, client-side mobile auth/payments paths. Does NOT cover infrastructure (GCP IAM, Firebase project settings, Stripe Connect Platform config, Plaid dashboard).
>
> Next session entrypoint: open this file, start at the **Fix order** section and work top-down. Each finding has file paths + line numbers + a code diff or pseudocode you can paste.
>
> Cross-referenced against four "vibe coding security" videos (Chris/calorie-tracker, Stefan, Matt/Replit, Wesley/Arcjet). Most surface-level lessons (rate limits, no keys in client, input validation) are already covered well in Niyah. The findings below are the gaps those videos point at — RLS misconfigs that are "technically correct but the underlying data is the problem."

---

## TL;DR

| Severity | Count | Themes |
|---|---|---|
| Critical | 1 | Solo-session money minting |
| High | 4 | TOCTOU on group invite, App Check gap, Plaid/Stripe ID leak via public user doc, stripeCustomerId hijack |
| Medium | 4 | Contact enumeration, reconcile blind spot, user-stat forgery, reconcile no quarantine |
| Low | 2 | APNs always-production, withdrawal cap fail-open |
| Verify | 3 | Source maps, GCP budget caps, dep audit |

**One sentence**: an attacker with any signed-in account can create a fake `sessions/<id>` doc with arbitrary `stakeAmount` and immediately call `handleSessionComplete` to credit that amount to their wallet, because the Firestore rule constrains shape but not value, and the CF trusts the doc. Everything else is downstream of this.

---

## Critical

### C1 — Solo-session money minting via client-controlled `stakeAmount` + `endsAt` — **Phase 1 + Phase 2 SHIPPED 2026-05-19**

**Files**:
- `firebase/firestore.rules:105-131` — `sessions/{sessionId}` rule
- `functions/src/index.ts:1939-2073` — `handleSessionComplete`
- `src/store/sessionStore.ts:69-186` — client-side session start (writes session doc directly)

**The bug**:

The Firestore rule on `sessions/{sessionId}` create:

```
allow create: if request.auth != null
  && request.resource.data.userId is string
  && request.resource.data.userId == request.auth.uid
  && request.resource.data.status is string
  && request.resource.data.status == 'active'
  && request.resource.data.stakeAmount is number
  && request.resource.data.stakeAmount > 0;
```

…validates `stakeAmount > 0` but has **no upper bound** and **no check on `endsAt`, `startedAt`, `duration`, or `cadence`**.

`handleSessionComplete` then reads:

```typescript
const stakeAmount: number = sessionData.stakeAmount;    // line 2008
const payout = stakeAmount;                              // line 2014
txn.update(walletRef, { balance: updatedBalance });      // line 2020
```

…and credits `currentBalance + stakeAmount` to `wallets/{uid}`. There is **no server-side stake debit at session START** for solo sessions (only group sessions debit via `createGroupSession`/`respondToGroupInvite`).

**Attack chain**:

1. Sign in as any user. Direct Firestore write to `sessions/<newId>`:
   ```json
   { "userId": "<my uid>", "status": "active", "stakeAmount": 99999999, "endsAt": <Timestamp 1970>, "startedAt": <Timestamp now>, "cadence": "hour", "potentialPayout": 99999999 }
   ```
   Passes Firestore rule (status=active ✓, userId=mine ✓, stakeAmount > 0 ✓).

2. Call `handleSessionComplete(<newId>)`. CF reads session: `status=active` ✓, `userId=mine` ✓, `endsAt` in past (10s grace) ✓, `stakeAmount=99999999`. Credits **$999,999.99** to wallet.

3. Rate-limited to 5/hr (`RATE_LIMITS.handleSessionComplete`). Daily client stake cap ($25/day in `sessionStore.ts:89`) is bypassed — it's only enforced in the client code, not in the CF.

4. `reconcileWalletBalances` won't catch it. It sums transactions and the +$999,999.99 payout txn matches the balance delta. Silent.

**Cash-out path**:

- `requestWithdrawal` (CF) reads balance from `wallets/{uid}` — sees minted balance.
- `assertWithdrawalEligibility` gates on `completedSessions >= 5` AND `distinctPartners >= 2`. The mint chain produces 5 completed sessions trivially, but `distinctPartners` requires 2 real group-session partners. So attacker needs to either (a) recruit 2 friends to do real group sessions with them, or (b) compromise 2 accounts.
- Once eligibility passes, withdraw at $25k/day cap.

**Even without cash-out**, wallet integrity is destroyed and `walletAudits` will eventually flag it once you add proper auditing — but only AFTER funds may have left.

**Maps to Video 1 (Chris)**: "RLS technically correct but the underlying data you're storing is the problem." `stakeAmount` is a financial field on a user-writable table. Same shape as his "rate limits stored on the user table" bug.

**Fix — Phase 1 (surgical, smallest diff)**:

In `functions/src/index.ts`, inside the `handleSessionComplete` transaction (around line 2007), replace the client-supplied stake with one reconstructed from a server-side cadence table:

```typescript
// At top of functions/src/index.ts, add server-authoritative cadence table.
// Mirrors src/constants/config.ts CADENCES — keep these in sync.
const CADENCES_SERVER: Record<string, { stake: number; duration: number }> = {
  minute: { stake: 100, duration: 60_000 },
  hour:   { stake: 500, duration: 3_600_000 },
  focus:  { stake: 2500, duration: 1_500_000 }, // adjust to match real config
  // ... whatever solo cadences are valid
};

// In the handleSessionComplete transaction, around line 2007:
const cadence = sessionData.cadence;
const expected = CADENCES_SERVER[cadence];
if (!expected) throw new Error("Unknown cadence");
const stakeAmount = expected.stake;             // <-- ignore session.stakeAmount

const startedAt = sessionData.startedAt?.toDate?.()
  ? sessionData.startedAt.toDate()
  : new Date(sessionData.startedAt);
const computedEndsAt = startedAt.getTime() + expected.duration;
const claimedEndsAt = endsAt.getTime();
if (Math.abs(claimedEndsAt - computedEndsAt) > 60_000) {
  throw new Error("Session endsAt does not match cadence");
}
```

Apply the same `cadence`-reconstruction in `handleSessionForfeit` (line 2150) — that path also reads `sessionData.stakeAmount` for the forgiveness refund.

**Fix — Phase 2 (proper architecture, do this before App Store live)** — **SHIPPED 2026-05-19**:

1. ✅ `createSoloSession` CF added (`functions/src/index.ts`): takes `{ cadence, sessionId, useShortTimer }`, derives stake from `CADENCES_SERVER`, debits wallet + writes session doc inside one Firestore transaction. Idempotent on the client-supplied sessionId so retries on transient failure don't double-debit. App Check enforced via `APP_CHECK_ENFORCED` flag. Daily-stake-cap enforced server-side. Wallet-frozen check rejects with 400.

2. ✅ Firestore rule on `sessions/{sessionId}` create flipped to `false`. Client write path goes through CF only.

3. ✅ `sessionStore.startSession` is now async; calls `cloudCreateSoloSession` in production and uses server-returned `startedAtMs`/`endsAtMs` as canonical. DEMO_MODE preserves the legacy local-only flow. `app/session/confirm.tsx` updated to `await`.

4. ✅ `assertDailyStakeCap` invoked at start of `createSoloSession`.

Phase 1 stopped the bleed. Phase 2 closes the design hole — attackers can no longer fabricate a session doc to claim a payout.

---

## High

### H1 — Plaid access tokens + Stripe IDs readable by any signed-in user — **SHIPPED 2026-05-19** (run `migrateSensitiveFieldsToPrivate` post-deploy)

**Files**:
- `firebase/firestore.rules:16` — `users/{uid}` `allow read: if request.auth != null`
- `functions/src/index.ts:1568` — `plaidAccessToken` written to `users/{uid}` plaintext
- `functions/src/index.ts:1565-1578` — also `stripeAccountId`, `plaidItemId`, `plaidAccountId`

**The bug**: Firestore rules are document-level. `users/{uid}` is readable by ANY authenticated user (intentional for public profiles + partner lookup). But the SAME doc stores:
- `plaidAccessToken` — long-lived API token granting access to the user's bank data
- `plaidItemId`, `plaidAccountId`
- `stripeAccountId` — Stripe Connect connected account ID
- `stripeCustomerId`
- `legalFirstName`, `legalLastName` (PII)
- `fcmTokens` — FCM tokens for the user's devices

Any signed-in user can `getDoc(users/<victim>)` and read all of these fields.

**Exploitability**:

- **Plaid access_token alone**: requires Plaid client credentials (`PLAID_CLIENT_ID` + `PLAID_SECRET`) to use, which aren't in the bundle — so a random attacker can't directly call Plaid. BUT this is defense-in-depth violation: if Plaid credentials ever leak via a separate compromise (employee laptop, ex-employee, backup leak), the tokens are sitting there for instant abuse. Standard hardening is: **tokens belong in Secret Manager or encrypted-at-rest**, not in user-readable docs.

- **Stripe Connect account ID**: harvestable for social-engineering attacks against Stripe support, or for targeted phishing.

- **PII (`legalFirstName`/`legalLastName`)**: GDPR/CCPA exposure. Niyah is US-only for now but legal names being public to logged-in users is broader than necessary.

- **FCM tokens**: can be used to send arbitrary pushes if Niyah's FCM server key ever leaks (same DiD violation).

**Fix — SHIPPED 2026-05-19**:

- New rules in `firebase/firestore.rules`:
  - `userPrivate/{uid}` — owner read, server-only write.
  - `userPushTokens/{uid}` — neither client read nor write.
- Helpers in `functions/src/index.ts`:
  - `SENSITIVE_USER_FIELDS` constant lists the fields moved out of `users/{uid}` (stripeAccountId/Status/CustomerId/KycProvidedAt, plaidAccessToken/ItemId/AccountId, legalFirstName/LastName).
  - `readUserWithPrivate(uid)` returns a merged view (userPrivate wins over users) so existing CF logic keeps working through the transition window.
  - `writeUserPrivate(uid, privateFields, publicFields?)` writes sensitive fields to `userPrivate/{uid}` and `FieldValue.delete()`s the same keys from `users/{uid}` in one batch. Non-sensitive fields like `linkedBank` go through the second arg and stay on the public user doc.
- CFs migrated to use the helpers: `createPaymentIntent`, `createConnectAccount`, `createAccountLink`, `getConnectAccountStatus`, `linkBankAccount`, `unlinkBankInternal`, `replaceBankAccount`, `requestWithdrawal`, `distributeGroupPayouts`, `stripeWebhook` (account.updated branch).
- `fetchUserProfile` in `src/config/firebase.ts` now reads users + userPrivate in parallel and merges them, so client `buildUser` consumers (`stripeAccountStatus`, `legalFirstName`, etc.) keep getting the values they need without each call site knowing about the split.
- FCM tokens: new `registerPushToken` / `removePushToken` CFs write to `userPushTokens/{uid}` only; `sendPushToUser` reads from `userPushTokens` first, falls back to legacy `users.fcmTokens` until migration completes; `src/config/notifications.ts` now calls the CFs instead of doing direct arrayUnion/arrayRemove on `users/{uid}`.
- Migration: admin-only `migrateSensitiveFieldsToPrivate` CF copies all `SENSITIVE_USER_FIELDS` and `fcmTokens` off the public user doc in 500-doc batches, returns a `nextCursor` for resumption. Idempotent — re-running after success is a no-op.

### H2 — `stripeCustomerId` not in blocked-keys list → payment-method enumeration — **SHIPPED 2026-05-19**

**Files**:
- `firebase/firestore.rules:30-40` — `users/{uid}` update rule blocked-keys list

**The bug**: The blocked-keys list on `users/{uid}` update covers `stripeAccountId` but NOT `stripeCustomerId`:

```
.hasAny([
  'legalAcceptanceVersion', 'legalAcceptedAt',
  'stripeAccountId', 'stripeAccountStatus', 'stripeKycProvidedAt',  // ← Customer ID missing
  'legalFirstName', 'legalLastName',
  'linkedBank', 'plaidAccessToken', 'plaidItemId', 'plaidAccountId',
  ...
]);
```

Any user can `updateDoc(users/me, { stripeCustomerId: <victim's customer id> })`.

**Attack**:

1. Read `users/<victim>` (public-readable per H1) → get `victim.stripeCustomerId`.
2. Write `users/me.stripeCustomerId = victim.stripeCustomerId` (passes rule).
3. Call `createPaymentIntent(amount)`. CF reads `userData.stripeCustomerId` (line 682), creates a PI on the victim's customer with metadata `firebaseUid: me, type: deposit`.
4. PaymentSheet on the attacker's device loads payment methods on `victim.stripeCustomerId` — exposing the victim's saved card last-4s, brand, billing zip.
5. Attacker can also potentially confirm the PI with the victim's saved card (depends on Stripe's `customer_session` setup — if `allow_redisplay` is `always` for the saved cards, this is a charge-without-consent vector).

Even without (5), exposing payment methods is GLBA/PCI-adjacent disclosure.

**Fix**:

Add `stripeCustomerId` to the blocked-keys list:

```
.hasAny([
  'legalAcceptanceVersion', 'legalAcceptedAt',
  'stripeAccountId', 'stripeAccountStatus', 'stripeKycProvidedAt',
  'stripeCustomerId',                                          // ← add this
  ...
]);
```

Also add to the `create` rule's blocked-keys list (line 45-52). Better long-term: include in the H1 migration so `stripeCustomerId` lives on `userPrivate/{uid}` and clients can't write it at all.

### H3 — `respondToGroupInvite` TOCTOU: double-debit on concurrent accept — **SHIPPED 2026-05-19**

**Files**:
- `functions/src/index.ts:3556-3673`

**The bug**: Invite status read (lines 3558-3575) is OUTSIDE the wallet transaction at 3595:

```typescript
const inviteSnap = await inviteRef.get();              // outside txn
if (inviteData.status !== "pending") return ...;       // outside txn
// ...
await db.runTransaction(async (txn) => {               // wallet txn
  const walletSnap = await txn.get(walletRef);
  if (currentBalance < inviteData.stake) throw ...;
  txn.update(walletRef, { balance: current - stake });
});
await inviteRef.update({ status: "accepted" });        // outside txn
```

Two concurrent calls on the same invite (10/hr rate limit means 2 in the same second from two devices easily fits):
1. Both read invite, both see `status=pending`.
2. Both enter wallet transaction.
3. Both debit wallet for the same invite stake. **User pays 2× stake for 1 invite.**
4. Both set `status=accepted` (idempotent on Firestore).

Self-funds-loss only. No privilege escalation. But user loses real money on a UI double-tap or network retry.

**Fix**: Pull invite read + status check + update INSIDE the wallet transaction:

```typescript
const inviteRef = db.collection("groupInvites").doc(inviteId);
const sessionRef = db.collection("groupSessions").doc(/* derived */);
const walletRef = db.collection("wallets").doc(uid);
const stakeTxnRef = db.collection("transactions").doc();

const result = await db.runTransaction(async (txn) => {
  const inviteSnap = await txn.get(inviteRef);
  if (!inviteSnap.exists) throw new Error("Invite not found");
  const inviteData = inviteSnap.data()!;
  if (inviteData.toUserId !== uid) throw new Error("Not your invite");
  if (inviteData.status !== "pending") throw new Error("Already responded");

  if (accept) {
    const walletSnap = await txn.get(walletRef);
    const currentBalance: number = walletSnap.data()?.balance ?? 0;
    if (currentBalance < inviteData.stake) {
      throw new Error("Insufficient balance to stake");
    }
    txn.update(walletRef, { balance: currentBalance - inviteData.stake });
    txn.update(inviteRef, { status: "accepted", respondedAt: serverTimestamp() });
    txn.set(stakeTxnRef, { ... });
  } else {
    txn.update(inviteRef, { status: "declined", respondedAt: serverTimestamp() });
  }
  return inviteData;
});

// Session participant + push notifications happen OUTSIDE the txn (idempotent).
```

The session-cancel-on-decline-below-2-participants logic stays where it is — it operates on the session doc, not the invite doc, and is idempotent.

### H4 — Missing App Check on deposit + complete/forfeit + group state paths — **SHIPPED 2026-05-19** (flag still off until token coverage ≥99%)

**Files**:
- `functions/src/index.ts:645` — `createPaymentIntent` no `enforceAppCheck`
- `functions/src/index.ts:742` — `verifyAndCreditDeposit` no `enforceAppCheck`
- `functions/src/index.ts:1949` — `handleSessionComplete` no `enforceAppCheck`
- `functions/src/index.ts:2096` — `handleSessionForfeit` no `enforceAppCheck`
- `functions/src/index.ts:2624` — `distributeGroupPayouts` no `enforceAppCheck`
- `functions/src/index.ts:3529` — `respondToGroupInvite` no `enforceAppCheck`
- `functions/src/index.ts:3883` — `startGroupSession` no `enforceAppCheck`
- `functions/src/index.ts:3993` — `reportSessionStatus` no `enforceAppCheck`

**The bug**: `APP_CHECK_ENFORCED` env flag is wired on only 7 CFs (`createPlaidLinkToken`, `linkBankAccount`, `unlinkBankAccount`, `replaceBankAccount`, `requestWithdrawal`, `createGroupSession`, `requestAccountMerge`). Other money paths log a soft-warning but don't reject.

Once C1 is fixed (so `handleSessionComplete` stops being trivially exploitable), App Check on it becomes load-bearing: a stolen Firebase ID token without App Check attestation can still call the CF from a non-Niyah binary.

**Fix**: extend the same `enforceAppCheck: APP_CHECK_ENFORCED` pattern to every money-path CF:

```typescript
// Before:
uid = await verifyAuth(req);

// After:
uid = await verifyAuth(req, { enforceAppCheck: APP_CHECK_ENFORCED });
```

…and update the `catch` block to distinguish 403 (App Check) from 401 (auth) like the existing enforced CFs do. The env flag stays off until production token coverage is ≥99% per `[[project_app_check_rollout]]`, so this is safe to ship without flipping the flag — but it sets up the gate for when you flip.

Apply to: `createPaymentIntent`, `verifyAndCreditDeposit`, `handleSessionComplete`, `handleSessionForfeit`, `distributeGroupPayouts`, `respondToGroupInvite`, `startGroupSession`, `reportSessionStatus`, `cancelGroupSession`, `reportShieldViolation`.

---

## Medium

### M1 — User-stat fields forgeable (`completedSessions`, `reputation`, etc.) → withdrawal-eligibility bypass + profile manipulation — **SHIPPED 2026-05-19** (except `fcmTokens`, still client-writable; needs `registerPushToken` CF before locking)

**Files**:
- `firebase/firestore.rules:28-40` — `users/{uid}` update blocked-keys list
- `functions/src/index.ts:283-309` — `getWithdrawalEligibilityStats` reads `completedSessions` from user doc

**The bug**: The blocked-keys list does NOT include any of:
- `completedSessions`, `totalSessions`, `currentStreak`, `longestStreak`, `totalEarnings`
- `reputation` (and nested `reputation.score`, `reputation.level`)
- `referredByUid`, `fcmTokens` (less critical — see notes)

So a user can `updateDoc(users/me, { completedSessions: 999, reputation: { score: 100, level: "oak" } })`.

**Exploitability**:

1. **Withdrawal eligibility bypass**: `assertWithdrawalEligibility` reads `userSnap.data()?.completedSessions` (line 291). User forges that to ≥5, skipping the actual "5 completed sessions" gate. Still requires `distinctPartners >= 2` (which comes from group session participation — server-controlled), so this alone doesn't unlock withdrawal — but it shortcuts one of the two gates. Combined with C1's $$$ minting and one real friend pair, it's the final unlock.

2. **Reputation forgery**: `reputation.level = "oak"` displayed on public profiles is now claimable without earning. Social-proof manipulation.

3. **Vanity stat inflation**: `currentStreak: 365` looks impressive to potential partners.

**Fix**: Lock down via blocked-keys list. These fields should ONLY be written by Cloud Functions (admin SDK).

```
.hasAny([
  ...existing keys...,
  'completedSessions', 'totalSessions', 'currentStreak',
  'longestStreak', 'totalEarnings',
  'reputation',
  'referredByUid', 'referralAwardedAt',
  'stripeCustomerId',                                  // also H2
  'fcmTokens',                                         // see note
]);
```

Note on `fcmTokens`: client-side push registration code writes this from the device. If you lock the field, the client write path needs to move to a `registerPushToken` CF. Probably worth doing anyway — current pattern lets a malicious user add another user's FCM token (read victim's, write to own doc's `fcmTokens`) and receive their pushes, though push content isn't sensitive enough for this to matter most days.

Same applies to the `create` rule's blocked-keys list at line 45.

### M2 — `findContactsOnNiyah` phone→name enumeration — **SHIPPED 2026-05-19** (1/day, attacker ceiling now 500 confirmations/day)

**Files**:
- `functions/src/index.ts:3150-3246`

**The bug**: Cap is 500 contacts/request × 3 requests/day = 1500 phone→name confirmations per attacker per day. Response includes `name` and `reputation`. Combined with H1 (public user doc reads), an attacker with a phone list can:
1. Use `findContactsOnNiyah` to confirm Niyah membership in batches of 500.
2. For each confirmed uid, read `users/{uid}` directly for richer data.

Tradeoff: contact discovery is a core UX. Most fixes hurt the feature.

**Options**:
- Drop to 1 request/day with 500 cap = 500/day. Probably fine.
- Return only `{ uid }`; require a separate `lookupUserProfile(uid)` CF that's rate-limited per (caller, target) pair to reveal name.
- For sets > 50 contacts in one call, return aggregate count only ("12 of your contacts are on Niyah") — forces attacker to bisect smaller sets to confirm specific numbers.

Lowest-friction fix: drop rate limit to 1/day.

### M3 — `reconcileWalletBalances` reads all wallets unbatched, capped at 2000 — **SHIPPED 2026-05-19**

**Files**:
- `functions/src/index.ts:5247-5293`

**The bug**: Nightly reconcile uses `db.collection("wallets").limit(2000).get()`. Past 2000 users, the audit silently stops auditing the rest. No alert if you cross the threshold.

**Fix**: Paginate by document ID with a continuation cursor:

```typescript
const batchSize = 500;
let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
while (true) {
  let q = db.collection("wallets").orderBy(FieldPath.documentId()).limit(batchSize);
  if (lastDoc) q = q.startAfter(lastDoc);
  const snap = await q.get();
  if (snap.empty) break;
  for (const doc of snap.docs) {
    await reconcileOne(doc); // existing per-wallet logic
  }
  lastDoc = snap.docs[snap.docs.length - 1];
}
```

Add a Sentry alert when `processed` < expected user count.

### M4 — `reconcileWalletBalances` flags drift but doesn't quarantine — **SHIPPED 2026-05-19**

**Files**:
- `functions/src/index.ts:5274-5293` — drift detection writes `walletAudits` only
- `functions/src/index.ts:2317-2598` — `requestWithdrawal` reads balance without checking for drift flag

**The bug**: When drift is detected, the wallet still accepts withdrawals. After C1 is exploited, the attacker can cash out before tomorrow's reconcile fires (nightly schedule), and even if reconcile catches it, there's no automatic block.

**Fix**: Add `frozen: true` to `wallets/{uid}` when drift > threshold, and check it in `requestWithdrawal`:

```typescript
// In reconcileWalletBalances, when delta !== 0:
await walletDoc.ref.update({ frozen: true, frozenReason: "balance_drift", frozenAt: serverTimestamp() });

// In requestWithdrawal, before any balance read:
if (walletSnap.data()?.frozen === true) {
  sendError(res, 403, "Wallet frozen for review — contact support");
  return;
}
```

Operator review unfreezes via console after determining root cause.

---

## Low

### L1 — `aps-environment: "production"` for all builds — **SHIPPED 2026-05-19**

**Files**:
- `app.config.js:50`

Means dev-client + TestFlight + App Store all use production APNs. Production push won't route to sandbox APNs. Fine for shipping but means pre-prod testing of push features can't use sandbox sandboxing. Env-gate via `process.env.EXPO_PUBLIC_APNS_ENV` if you want sandbox builds for dev-only.

### L2 — Daily withdrawal cap fails open — **SHIPPED 2026-05-19**

**Files**:
- `functions/src/index.ts:2401-2404`

```typescript
} catch (limitErr) {
  console.error("Daily limit check failed:", limitErr);
  // Fail open for now — rate limiting still protects against abuse
}
```

Per-call rate limit (10/hr) caps absolute damage, but the $25k/day aggregate gate is the real guardrail against a compromised account. Flip to fail-closed:

```typescript
} catch (limitErr) {
  console.error("Daily limit check failed:", limitErr);
  sendError(res, 503, "Withdrawal temporarily unavailable — try again shortly");
  return;
}
```

---

## Verify (not deeply audited)

### V1 — Source maps in production iOS bundle — **REVIEWED 2026-05-19**

Expo + Hermes ships bytecode bundles (`main.jsbundle.hbc`) in the `.ipa`, not raw JS, so source maps are not present in production binaries by default. `metro.config.js` does not enable source-map embedding. Sentry source map upload runs in the EAS build hook (`sentry-expo`'s `postPublish`) and uploads to Sentry only.

To double-check after the next archive:
```bash
unzip -l ios/build/ipa/Niyah.ipa | grep -i map
```
Expect: only `.dSYM` files (Apple native debug symbols, normal). No `*.bundle.map` or `*.js.map` entries.


`npx expo run:ios --device` and EAS builds. Need to confirm:
- Source maps are NOT bundled into the .ipa (`metro.config.js` defaults are usually fine, but worth verifying).
- Sentry uploads source maps to its server (and only Sentry) via `sentry-expo` post-build hook.

Run `unzip -l ios/build/ipa/Niyah.ipa | grep -i map` after a production build to confirm.

### V2 — GCP/Firebase budget caps — **DOCUMENTED 2026-05-19** (action item, not code)

Niyah's Cloud Functions are usage-billed. A bug that loops on Firestore reads, or a Stripe webhook replay storm, could spike spend. Per Video 1 (Chris), this is the single highest-impact ops control:

- Set a Firebase budget alert at $X/month with email + Slack notification.
- Consider the [Cloud Billing "auto-disable" trick](https://cloud.google.com/billing/docs/how-to/notify) — a Pub/Sub topic + Cloud Function that disables billing when a hard cap is hit. This kills the project (bad for users) but bounds financial exposure to a known number. Niyah probably can't afford to auto-disable in production, but at minimum set alerts.

**Recommended baseline** (set in GCP Console → Billing → Budgets & Alerts):
- Budget name: `niyah-prod-monthly`
- Amount: `$300/mo` (covers normal load — adjust as Phase 4 ramp arrives)
- Alert thresholds: 50%, 90%, 100% of budget. Email + Pub/Sub to a `billing-alerts` topic.
- Optional kill-switch CF: subscribe to that topic, disable billing when actual >= 200% of budget. Niyah is dev-stage so the project being momentarily disabled is preferable to runaway spend. Re-enable manually after triage.

Action item (not code): create budget + alerts in GCP before App Store launch.

### V3 — Dependency audit — **RAN 2026-05-19**

Per Video 4 (Wesley): "minimize dependencies." Hasn't been run as part of this audit. Run:

```bash
pnpm audit                  # known CVEs in dep tree
pnpm dedupe --check         # duplicate transitive deps
pnpm outdated               # stale deps
```

Especially watch for stale `@react-native-firebase/*` (security patches land regularly) and `stripe` Node SDK.

**2026-05-19 scan results** (`pnpm audit` mobile, `npm audit` functions):

- Mobile: 2 low, 2 moderate, 6 high.
  - High: `xmldom` (5 advisories via `@bacons/apple-targets > @bacons/xcode > @expo/*`) — build-time only.
  - High: `node-tar` (`eas-cli > tar`) — CLI tool only.
  - Moderate: `yaml` (`eas-cli`), `postcss` (`expo > @expo/metro-config`) — build-time.
  - Low: `diff` (`eas-cli`), `@tootallnate/once` (`jest-expo > jest-environment-jsdom`) — test-time.
- Functions: 9 low, all transitive through `firebase-admin > @google-cloud/firestore > google-gax > retry-request > teeny-request`.

None of the high-severity findings reach production runtime — every path is build-time tooling, CLI, or test harness. No immediate runtime exposure. Track upstream fixes when refreshing `eas-cli` / `@bacons/apple-targets` next.

---

## Video cross-reference

| Video lesson | Niyah state |
|---|---|
| Video 1 (Chris) — RLS misconfig: financial field on user-writable table | **C1**: `sessions.stakeAmount` is the bug. **M1**: same shape with `completedSessions`/`reputation`. |
| Video 1 — rate limits stored on user-writable table | Niyah uses a separate `rateLimits/` collection (no client writes). ✓ |
| Video 1, V3, V4 — backend rate limits | ✓ per-user Firestore-backed limiter on every CF |
| Video 1, V3, V4 — sensitive APIs from frontend | ✓ all Stripe/Plaid calls via CFs |
| Video 1, V3, V4 — API keys in client bundle | ✓ only `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (publishable, correct) |
| Video 1 — budget caps / billing alerts | **V2**: verify GCP budget alerts |
| Video 4 — bot detection | App Check (once `APP_CHECK_ENFORCED=true`). **H4**: extend coverage. |
| Video 3, V4 — input validation | ✓ type-checked at every CF entry |
| Video 4 — sensitive info collection | **M2**: `findContactsOnNiyah` over-reveals. **H1**: PII on public user doc. |
| Video 4 — dependencies minimization | **V3**: not audited |
| Video 3 — security headers | N/A for native mobile; CFs return JSON |
| Video 3 — file upload | N/A (no user uploads) |
| Video 3 — secure cookies | N/A (mobile, no cookies) |

---

## Fix order

Order is by exploitability × blast radius × deploy complexity, NOT severity alone. C1 is critical AND simple; H1 is also critical but requires data migration.

1. **C1 Phase 1** (1 hour): Add `CADENCES_SERVER` table to functions, reconstruct `stakeAmount` from cadence + validate `endsAt` window in `handleSessionComplete` AND `handleSessionForfeit`. Stops the bleed. Ship same-day.
2. **H2 + M1** (30 min): Add missing keys to `firestore.rules` blocked list (`stripeCustomerId`, `completedSessions`, `reputation`, etc.). One file change, deploy rules. Stops payment-method enumeration and stat forgery.
3. **H3** (30 min): Wrap `respondToGroupInvite` invite read + wallet debit in one transaction. One CF, deploy.
4. **H4** (15 min): Add `enforceAppCheck: APP_CHECK_ENFORCED` to remaining money-path CFs. One-line per CF.
5. **L2** (5 min): Flip daily-withdrawal-cap to fail-closed.
6. **M3 + M4** (1 hour): Paginate reconcile + auto-quarantine drift.
7. **M2** (10 min): Drop `findContactsOnNiyah` to 1/day.
8. **C1 Phase 2** (~half day): Move solo session start to a CF, lock `sessions/{id}` create rule. Requires client-side change to `sessionStore.startSession`.
9. **H1** (1-2 days): Split `users/{uid}` into public + private collections. Migration CF + repointed reads everywhere. Schedule this; it's the biggest diff but the highest defense-in-depth ROI.
10. **L1** (5 min): Env-gate APNs environment.
11. **V1, V2, V3** (1 hour): Verify source maps stripped, GCP budgets set, deps clean.

**Pre-App-Store-live blocker list**: 1, 2, 3, 4, 5 (≈2 hours of work). Everything else can ship in a follow-up release if needed, but H1 should not be deferred past first paying users.

---

## Test checklist (one per fix)

Add these as integration tests in `functions/src/security.test.ts` (or `index.test.ts`):

- [ ] **C1**: Test that a session doc with `stakeAmount: 99999999` and valid cadence returns the cadence's stake on complete (not the doc's stake).
- [ ] **C1**: Test that a session doc with `endsAt` set to 1970 throws `"endsAt does not match cadence"`.
- [ ] **C1**: Test that a session doc with unknown cadence throws `"Unknown cadence"`.
- [ ] **H1**: Once migration done, test that a non-owner cannot read `userPrivate/{victim}`.
- [ ] **H2**: Test that Firestore rule blocks updating `stripeCustomerId` from client.
- [ ] **H3**: Test that two concurrent `respondToGroupInvite` calls with same inviteId result in exactly ONE wallet debit (use `Promise.all` with two CF invocations).
- [ ] **H4**: Test that money-path CFs reject when `APP_CHECK_ENFORCED=true` and no `X-Firebase-AppCheck` header is present.
- [ ] **M1**: Test that Firestore rule blocks updating `completedSessions`, `reputation`, `totalEarnings` from client.
- [ ] **M2**: Test that `findContactsOnNiyah` 4th call in 24h returns 429.
- [ ] **M3**: Test reconcile with 2500 wallet docs processes all of them (not just first 2000).
- [ ] **M4**: Test that `requestWithdrawal` returns 403 when wallet has `frozen: true`.
- [ ] **L2**: Test that withdrawal cap check throwing causes 503 (not silent fail-open).

---

## Follow-ups created by 2026-05-19 fix wave — **CLOSED**

- ✅ **Reputation persistence**: `bumpReputationServerSide` helper added to `functions/src/index.ts`. Called from `handleSessionComplete` (kind=`completed`), `handleSessionForfeit` (kind=`missed`), and `reportSessionStatus` (per action). Increments `paymentsCompleted` / `paymentsMissed`, recomputes score from the same formula the client used, derives level, and writes via admin SDK. Client `updateReputation` writes still silently fail at the Firestore rule layer; server is now authoritative.
- ✅ **`fcmTokens` locked**: new `registerPushToken` / `removePushToken` CFs validate the token shape and write to the server-only `userPushTokens/{uid}` collection. `src/config/notifications.ts` calls the CFs instead of arrayUnion'ing the public user doc. `sendPushToUser` reads from `userPushTokens` first; legacy fallback to `users.fcmTokens` retired once `migrateSensitiveFieldsToPrivate` runs.

**Remaining operator action items** (not code):
- Run `migrateSensitiveFieldsToPrivate` (admin CF) post-deploy to drain Plaid/Stripe IDs + `fcmTokens` off the public `users/{uid}` doc for existing users.
- Set GCP budget alerts per V2 above.
- Decide fate of accidental `functions/pnpm-lock.yaml`: delete (keep functions on npm) or commit it (migrate functions to pnpm).

---

## Out of scope for this audit

- Authentication flow correctness (Google/Apple/Phone/Email) — not audited.
- Account merge (`requestAccountMerge` / `mergeDuplicateUsers`) — briefly reviewed; `decideAccountMerge` looked correct, admin key path uses constant-time compare. Worth a deeper pass once H1 lands.
- Stripe Connect KYC payload (`parseKycPayload`) — looked solid (18+ check, state regex, postal regex). No issues found.
- Plaid integration beyond access-token storage.
- Push notification content security.
- Cloud Function cold-start race conditions beyond what's noted.
- Mobile-side certificate pinning (`react-native-ssl-public-key-pinning` is a dep but pinning wiring not reviewed).
- iOS Screen Time / FamilyControls extension security boundaries.

---

## Appendix: Files touched if you fix everything

```
firebase/firestore.rules                    # H1, H2, M1, C1 Phase 2
functions/src/index.ts                      # C1, H3, H4, L2, M3, M4, M2
functions/src/security.ts                   # (no changes needed)
src/store/sessionStore.ts                   # C1 Phase 2 (replace writeSession with CF call)
src/config/firebase.ts                      # H1 reads, C1 Phase 2 (remove writeSession path)
src/config/functions.ts                     # H1 reads if userPrivate added; C1 Phase 2 createSoloSession wrapper
app.config.js                               # L1
docs/security-audit-2026-05-19.md           # this file (update as fixes ship)
```
