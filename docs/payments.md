# Payments & Payouts

> Stripe/Plaid integration, payout structure, and the wallet ledger.
> Reflects the **de-pooled commitment-contract** model on `wallet-ledger`.
> See also: [STATUS](./STATUS.md) | [Features](./features.md) | [Roadmap](./roadmap.md) | [Legal](./legal.md)

> **Core model — no pools.** Every participant (solo *and* group) stakes their **own** money.
> A completer gets their **own** stake back (× a house-funded multiplier, currently **1.0× / dormant**);
> a non-completer forfeits their **own** stake **to the house**. Stakes are **never** pooled, shared,
> or redistributed between users, and there are **no peer-to-peer (Venmo) payments**. This is what
> removes the gambling-classification + money-transmission risk — see [legal.md](./legal.md).

## Stripe Integration

### Client

- `@stripe/stripe-react-native` -- PaymentSheet for deposits
- Publishable key via `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var

### Cloud Functions (~40 exports; money-path subset)

| Function                  | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `createPaymentIntent`     | Create Stripe PaymentIntent for deposits          |
| `verifyAndCreditDeposit`  | Verify payment succeeded, credit user's wallet    |
| `createConnectAccount`    | Create Stripe Connect Express account for payouts |
| `createAccountLink`       | Generate onboarding URL for Stripe Connect KYC    |
| `getConnectAccountStatus` | Check if Connect account is verified              |
| `requestWithdrawal`       | Initiate Stripe payout to Connect account (60s-bucket idempotency) |
| `handleSessionComplete`   | Process completion, credit wallet (bucket-routed) |
| `handleSessionForfeit`    | Process surrender, forfeit own stake to house     |
| `distributeGroupPayouts`  | De-pooled group settlement (own-stake-back, forfeit→house) |
| `createPlaidLinkToken` / `linkBankAccount` / `unlinkBankAccount` / `replaceBankAccount` | Plaid bank lifecycle |
| `getWithdrawalEligibility` | Engagement-gate check (currently neutered → `{ok:true}`) |
| `reconcileWalletBalances` | Nightly drift guard (`0 4 * * *`)                 |
| `stripeWebhook` / `plaidWebhook` | Verify + handle processor webhook events   |

### Screens

- `app/session/deposit.tsx` -- deposit funds via Stripe PaymentSheet
- `app/session/withdraw.tsx` -- withdraw to connected bank account
- `app/session/stripe-onboarding.tsx` -- Stripe Connect KYC flow

### Current State (May 2026)

- **Live keys** (Stripe `sk_live_` + Plaid production) in Firebase Secret Manager. Real money moves.
- Cloud Function calls bypassed only when `DEMO_MODE=true` (demo builds skip CFs + use virtual balances).
- `createAccountLink` redirect URLs are hardcoded `https://niyah.live?stripe=refresh|return`.
- App Check is wired + flag-gated (`APP_CHECK_ENFORCED`); money paths enforce when on. See [security.md](./security.md).

## Bank Management

Two-stage flow: Plaid Link for bank discovery + Stripe Connect for payout rail. Both server-mediated; no bank credentials touch the client.

### Linking flow (today)

1. Client calls `createPlaidLinkToken` → Plaid hosted Link opens natively.
2. On success, client posts `{ publicToken, accountId }` to `linkBankAccount`.
3. Server exchanges public_token, creates Stripe external account, stores `plaidAccessToken` + `plaidItemId` + `linkedBank` (`institutionName` / `bankName` / `mask` / `linkedAt`) under `users/{uid}`.

### Replace / unlink (shipped)

| CF | Behavior |
| --- | --- |
| `unlinkBankAccount` | Detach the Stripe external account, clear `users/{uid}.linkedBank`, `plaidAccessToken`, `plaidItemId`, `plaidAccountId`. Idempotent — safe to call on already-unlinked users. Sentry breadcrumb per step. |
| `replaceBankAccount` | Single-transaction unlink + new Plaid Link result. Old token is revoked **only after** the new external account validates, so a failed replace falls back to the prior bank. |

Profile UI gets a `Manage Bank` action sheet: Replace / Remove. Remove confirms then calls `unlinkBankAccount`.

## Solo Payout Structure

**Ships at 1.0× (dormant).** Complete → get your exact stake back; surrender → forfeit it to the house.

| Cadence | Stake | Payout on Complete    | On Forfeit      |
| ------- | ----- | --------------------- | --------------- |
| Daily   | $5    | $5 (stake returned)   | $0 (forfeit)    |
| Weekly  | $25   | $25 (stake returned)  | $0              |
| Monthly | $100  | $100 (stake returned) | $0              |

The earn-more multiplier is **built but dormant** behind flags: client `SOLO_COMPLETION_MULTIPLIER = 1`,
server `SOLO_PAYOUT_MULTIPLIER` (env, default `1.0`, clamped `[1.0, 2.0]`). When flipped post-approval,
`surplus = max(0, round(principalCents × (mult − 1)))` routes to the `earned` bucket — but **only**
after the engagement gate + surplus cap (`min(1× net deposits, $50)`) are live. Sequencing: [STATUS.md](./STATUS.md).

## Wallet Ledger (buckets)

The wallet is **four buckets**, every credit routed to one at write time:

| Bucket | Source | Withdrawable? | Real-$ cost |
| --- | --- | --- | --- |
| `depositedCents` | card | **anytime** (exempt from gate) | refund-only |
| `earnedCents` | house/contract surplus | after engagement gate | yes (intended) |
| `bonusCents` | promo (real-$ giveaway) | after gate; stakeable | yes (intended) |
| `creditCents` | dev/manual/test | **NEVER** withdrawable/refundable; always forfeited | never |

`withdrawableCents = depositedCents + (gate-met ? earnedCents + bonusCents : 0)`. `creditCents` is
never in the sum, so console/manual money can't pull from Stripe. Pure bucket helpers live in
`functions/src/wallet.ts` (drawDown / composition / withdrawable / lazy-init). Solo/group stakes draw
down `deposited → bonus → earned`; on settle, staked **principal returns to its source bucket** and
only the surplus → `earned`. Full design + the post-submit enablement order: [STATUS.md](./STATUS.md).

### Drift detection

Nightly scheduled CF `reconcileWalletBalances` (`0 4 * * * America/New_York`): for each wallet, sum
`transactions` where `userId == uid`, compare to stored balance, write any mismatch to
`walletAudits/{uid}_{date}` (`expected`/`actual`/`delta`/`lastTransactionId`) and **freeze** the
wallet (`requestWithdrawal` refuses while frozen). Logs via `console.error` (no Sentry binding in
`functions/` yet). Real funds live in Stripe — the freeze protects, it doesn't lose money.

### Idempotency on transfers

`stripe.transfers.create` calls (and `deleteAccount` refunds) pass idempotency keys. The withdrawal
key is `withdrawal:${uid}:${amount}:${method}:${idemBucket}` where
`idemBucket = floor(Date.now() / 60_000)` (60-second bucket). Solo settlement credits the wallet via
a Firestore transaction (no per-payout `stripe.transfers.create`); the single cash-out transfer
happens at withdrawal. Verified by `functions/src/withdraw-earned.test.ts`.

## Group Settlement (de-pooled)

There is **no pool**. `distributeGroupPayouts` / `calculateGroupSessionPayouts`: each completer gets
their **own** stake back, each forfeiter's stake goes **to the house** — never to another player. No
greedy transfer netting, no peer-to-peer transfers (`calculateTransfers → []`). Group payout credits
the wallet like solo; the single cash-out transfer is at withdrawal.

> The old screen-time-weighted **pool split** + Venmo honor-settlement + Stripe-escrow-phases design
> is **removed**. Do not reintroduce pool redistribution — it re-creates the gambling/money-transmission
> risk the de-pool eliminated. A handicap/cap-target equity model is parked in [group-equity.md](./group-equity.md)
> (superseded; revisit only if group competition returns).

### Group Session Firestore Schema

Authoritative shape in `src/types/index.ts` (`GroupSessionDoc`):

```
groupSessions/{sessionId}
  id, proposerId
  status: "pending" | "ready" | "active" | "completed" | "cancelled"
  cadence, stakePerParticipant, customStake: boolean, duration (ms), poolTotal
  participantIds: string[]                         // for security rules
  participants: { [uid]: GroupSessionParticipant } // { name, profileImage, reputation,
                                                   //   accepted, online, completed?, surrendered? }
  startedAt?, endsAt?, completedAt?, autoTimeoutAt?
  payouts?: { [uid]: number }
  createdAt, updatedAt

groupInvites/{inviteId}
  sessionId, fromUserId, fromUserName, fromUserImage?
  toUserId, stake, cadence, duration
  status: "pending" | "accepted" | "declined" | "expired"
  createdAt, respondedAt?
```

> Completion lives on `participants[uid].completed` (no separate `results` map). `poolTotal` is a
> bookkeeping sum of individual stakes, **not** a redistributable pot.
