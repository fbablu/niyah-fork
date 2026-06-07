# Smoke Test — de-pooled money path (2026-05-30)

> Controlled post-deploy smoke test, **not** open-ended bug-hunting. Every `sk_live_` action
> moves real money and is irreversible. Logic is already green on 52/52 functions tests; this
> validates the **live wiring** tests can't: Stripe charges/refunds/Connect payouts, webhook
> delivery, Plaid prod, Firestore rules on the real backend, client→function wiring.
>
> Run **after** `firebase deploy --only functions,firestore:rules,firestore:indexes`.

## Guardrails

- Tiny real `$`. Your **own** account — **NOT** the frozen `cMtHvQkJJZOgU6pgYARj8nN5Wpf1`.
- `APP_CHECK_ENFORCED=false` (don't flip). Promo `0`, kill-switch disarmed (confirmed in Firestore `config/serverFlags`).
- Exhaustive edge cases belong in the **emulator + Stripe test mode**, not here.

## Mechanics recap (verified in `functions/src`)

Invariant **`balance == depositedBalance + earnedBalance + bonusBalance + creditBalance`** holds after every step.

| Op | Effect (cents) | Source |
|----|----------------|--------|
| Deposit | `creditCardDeposit` (idempotent doc `deposit_<pi>`) → `deposited += amt`, `balance += amt`. Called from callable (sync) **and** webhook (ACH backstop) | index.ts:1192, 1358, 4463 |
| Stake | `drawDown([deposited,bonus,earned])` → `stakeComposition` on session; `balance -= stake` | index.ts:2987 |
| Complete | principal back to **source** buckets × `SOLO_PAYOUT_MULTIPLIER` (1.0 → surplus 0); surplus→`earned` | index.ts:3150 |
| Surrender | already debited at stake; **first-surrender** forgiveness `min(stake, $5)` → **`bonus`**; revenue = `stake − forgiveness` | index.ts:3326 |
| Withdraw | `gateMet`=`≥5 completed AND ≥2 distinct partners`; not met → **`deposited` only**; needs active Connect acct; geo-gate **FL+HI** | index.ts:3658 |
| Delete | `cardRefundableCents` = **`deposited` only** → card refund; gated bonus/earned forfeited+recorded (or ACH/hold if gate-met) | index.ts (deleteAccount) |

**v1 is 1.0× (stickK):** complete returns the **exact** stake, `earned` stays `0`. Any `earned > 0` ⇒ multiplier wrongly on.

## Prereq — Stripe Connect onboarding on Account A

Withdrawal refuses without an active payout account. Finish Express/KYC →
`account.updated` webhook delivers **200** → `stripeAccountStatus` flips `active`.
If it never flips active, the withdraw step `400`s.

---

## Account A — money-path run

Fresh account, not frozen. All amounts cents.

| # | Action | balance | deposited | earned | bonus | Stripe / webhook | Watch / red flag | ✓ |
|---|--------|--------:|----------:|-------:|------:|------------------|------------------|---|
| 1 | Deposit **$10** | 0→1000 | 0→1000 | 0 | 0 | PI $10 succeeds → `payment_intent.succeeded` **200**; one txn `deposit_<pi>` | balance 2000 / two credits = **double-credit**; 400 delivery = **whsec mismatch** | ☐ |
| 2a | Stake **$4** | 1000→600 | 1000→600 | 0 | 0 | none (internal) | balance unchanged = client didn't reach CF | ☐ |
| 2b | Complete | 600→**1000** | 600→**1000** | **0** | 0 | none | **`earned>0`** = multiplier on; stake not returned = complete-race regressed | ☐ |
| 3 | Withdraw **$3** | 1000→700 | 1000→700 | 0 | 0 | Connect transfer/payout **$3**; txn `withdrawal` −300 `processing` | no Stripe payout but balance dropped = money stranded | ☐ |
| 4a | Stake **$7** | 700→0 | 700→0 | 0 | 0 | none | — | ☐ |
| 4b | Surrender (1st) | 0→**500** | 0 | 0 | 0→**500** | none | forgiveness ≠ 500 or `bonus` not credited | ☐ |
| 4c | ↳ house revenue | — | — | — | — | — | `revenue/` doc **+200** ($7−$5); txn `first_surrender_forgiven_<uid>` forgiveness +500; `forfeit` txn (amt 0); 2nd forgiveness must be impossible | ☐ |
| 5 | Withdraw **$5** attempt | 500 (no change) | 0 | 0 | 500 | **400** "unlocks after 5 sessions / 2+ friends" | if it pays out → **gate broken, house money leaked** | ☐ |

End state A: `balance 500`, all in **`bonus`** (gated). The $7 stake split → $5 back as bonus, $2 to house. Withdraw pulled real card money ($3) out via Connect.

> **Why stake $7 (not $5) at step 4:** a **$5** first surrender forgives the full $5 → revenue $0 → balance looks unchanged (reads as broken). Staking >$5 forces a real forfeit you can watch.

---

## Account B — delete refund split (throwaway)

| Action | balance | deposited | Stripe | Watch | ✓ |
|--------|--------:|----------:|--------|-------|---|
| Deposit **$5** | 0→500 | 0→500 | PI $5 → `succeeded` 200 | one `deposit_<pi>` | ☐ |
| Delete account | 500→0 | 500→0 | **Refund $5** to original card (PI) | `cardRefundableCents` = `deposited` only; account gone (App Store 5.1.1(v) hard-delete). If `deposited`=0 and `bonus`>0, gate-unmet bonus is **forfeited+recorded**, never card-refunded | ☐ |

---

## Watch in 4 places, every step

1. **In-app wallet** — balance + bucket breakdown.
2. **Firestore** — `wallets/<uid>` (`balance`/`depositedBalance`/`earnedBalance`/`bonusBalance`/`creditBalance`), `transactions/`, `revenue/`.
3. **Stripe** — Payments / Connect (transfers, payouts) / Refunds.
4. **Webhook deliveries** — Stripe → expect **200**; Firebase logs for `plaidWebhook` when you link the bank.

## Global red flags (stop if any)

- Invariant breaks (`balance ≠ Σbuckets`).
- Stripe webhook **400 / signature error** → `STRIPE_WEBHOOK_SECRET` ≠ dashboard `whsec_`.
- `earned > 0` anywhere in v1 (multiplier dormant).
- bonus/earned withdrawable before the gate.
- Deposit shows two txn docs or doubles balance (idempotency broken).
- Withdrawal from a **FL/HI** state address succeeds (geo-gate `WITHDRAWAL_EXCLUDED_STATES`).

## Sign-off

- [ ] Account A steps 1–5 pass
- [ ] Account B delete refunds `$5` to card
- [ ] All Stripe webhook deliveries `200`
- [ ] `plaidWebhook` logged on bank link
- [ ] No invariant break, no `earned>0`, gate held at step 5
- [ ] Smoke amounts reconciled in Stripe dashboard (deposits, the $3 payout, the $5 refund)

> Pass → proceed to `pnpm build:production` → binary smoke → submit. Fail → capture the
> Firestore doc + Stripe event + webhook delivery id, do **not** continue the run.
