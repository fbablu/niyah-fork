/**
 * Pure wallet-bucket helpers — no Firestore, no side effects — so they are
 * unit-testable in isolation (see wallet.test.ts). They exist to preserve the
 * ledger invariant everywhere money moves:
 *
 *   balance === depositedBalance + earnedBalance + bonusBalance + creditBalance
 *
 * Buckets partition the balance by source so withdrawal/deletion can treat
 * funds differently:
 *
 *   deposited  card money — always withdrawable; refunds to the source card
 *   earned     completion surplus / winnings — withdrawable after the gate
 *   bonus      promo + forgiveness giveaways — withdrawable after the gate; stakeable
 *   credit     dev/manual/test credit — NEVER withdrawable, never refundable
 *
 * `withdrawableBalance` is always DERIVED, never stored.
 */

export type BucketName = "deposited" | "earned" | "bonus" | "credit";

export interface Buckets {
  deposited: number;
  earned: number;
  bonus: number;
  credit: number;
}

/**
 * Which buckets funded a stake, so settle/refund can return principal to its
 * source. `credit` is intentionally absent — credit money is never stakeable.
 */
export interface StakeComposition {
  deposited: number;
  earned: number;
  bonus: number;
}

export const ZERO_COMPOSITION: StakeComposition = Object.freeze({
  deposited: 0,
  earned: 0,
  bonus: 0,
});

/** Coerce a possibly-missing/garbage numeric field to a finite number. */
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Read the four buckets off a raw wallet doc, defaulting missing fields to 0. */
export function readBuckets(data: Record<string, unknown> | undefined): Buckets {
  return {
    deposited: n(data?.depositedBalance),
    earned: n(data?.earnedBalance),
    bonus: n(data?.bonusBalance),
    credit: n(data?.creditBalance),
  };
}

/** Sum of the four buckets — must equal `balance` (the ledger invariant). */
export function sumBuckets(b: Buckets): number {
  return b.deposited + b.earned + b.bonus + b.credit;
}

/**
 * Read buckets, lazily initializing an un-bucketed legacy wallet by treating
 * its whole balance as `deposited`. The one-time backfill job does the careful
 * earned/credit classification and runs BEFORE bucket enforcement is enabled;
 * this is only a runtime safety net so the invariant can never break for a
 * wallet that money moves through before backfill. Frozen/drifted wallets never
 * reach this (the stake/withdraw paths refuse while frozen).
 */
export function readBucketsOrInit(
  data: Record<string, unknown> | undefined,
  balance: number,
): Buckets {
  const b = readBuckets(data);
  if (sumBuckets(b) === 0 && balance > 0) {
    return { deposited: balance, earned: 0, bonus: 0, credit: 0 };
  }
  return b;
}

/**
 * Withdrawable cents: deposits always; earned + bonus only once the engagement
 * gate is met; credit never.
 */
export function computeWithdrawable(b: Buckets, gateMet: boolean): number {
  return b.deposited + (gateMet ? b.earned + b.bonus : 0);
}

/**
 * Cents refundable to the original payment **card** on account deletion: ONLY
 * the deposited (card-principal) bucket. earned/bonus are house-funded grants
 * (winnings / promo / forgiveness) that never originated from a card and must
 * never be refunded to one — refunding them mints free money out of the
 * platform. credit is never withdrawable or refundable. earned is paid out via
 * ACH / 30-day hold by the caller, not here.
 */
export function cardRefundableCents(b: Buckets): number {
  return Math.max(0, b.deposited);
}

/**
 * Draw `amount` from buckets in `order`, returning how much came from each and
 * any shortfall that could not be covered. Buckets not named in `order` are
 * untouchable (omit "credit" to keep it undrawable). Pure — does not mutate `b`.
 */
export function drawDown(
  b: Buckets,
  amount: number,
  order: BucketName[],
): { drawn: Buckets; shortfall: number } {
  const drawn: Buckets = { deposited: 0, earned: 0, bonus: 0, credit: 0 };
  let remaining = Math.max(0, amount);
  for (const bucket of order) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, b[bucket]));
    drawn[bucket] = take;
    remaining -= take;
  }
  return { drawn, shortfall: remaining };
}

/** Stakes draw the user's own money first, then promo, then winnings. */
export const STAKE_DRAW_ORDER: BucketName[] = ["deposited", "bonus", "earned"];
/** Withdrawals pull deposits first, then earned, then bonus (never credit). */
export const WITHDRAW_DRAW_ORDER: BucketName[] = ["deposited", "earned", "bonus"];

/**
 * Bucket draw order for a withdrawal, honoring the engagement gate: deposits
 * are always withdrawable; earned + bonus only once the gate is met; credit
 * never. This MIRRORS `computeWithdrawable` exactly — drawing `amount` in this
 * order can never pull more than `computeWithdrawable(b, gateMet)` covers, so
 * the eligibility check and the actual debit can never disagree (which would
 * let gated house money leak out, or strand a legitimate withdrawal).
 */
export function withdrawDrawOrder(gateMet: boolean): BucketName[] {
  return gateMet ? WITHDRAW_DRAW_ORDER : ["deposited"];
}

/** The withdrawable subset of a draw result, as a stake composition. */
export function toComposition(drawn: Buckets): StakeComposition {
  return { deposited: drawn.deposited, earned: drawn.earned, bonus: drawn.bonus };
}

/** Read a stored stake composition off a doc, defaulting to zero. */
export function readComposition(
  data: Record<string, unknown> | undefined,
): StakeComposition {
  return {
    deposited: n(data?.deposited),
    earned: n(data?.earned),
    bonus: n(data?.bonus),
  };
}

export function sumComposition(c: StakeComposition): number {
  return c.deposited + c.earned + c.bonus;
}

// ─── daily withdrawal cap ────────────────────────────────────────────────────

/**
 * UTC calendar-day key, e.g. "2026-06-02". The daily withdrawal cap resets at
 * 00:00 UTC — same convention as DAILY_STAKE_CAP. A calendar-day counter (vs a
 * rolling 24h window) is what lets the cap be enforced atomically with a single
 * counter field on the wallet doc.
 */
export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export interface DailyWithdrawalState {
  /** Cents already withdrawn today (0 if the stored counter is from a prior day). */
  priorToday: number;
  /** Running total once this withdrawal commits (what we write back). */
  newTotal: number;
  /** True if priorToday + amount exceeds the cap — caller must refuse. */
  exceedsCap: boolean;
  /** UTC day this counter is tagged with. */
  dayKey: string;
}

/**
 * Pure daily-withdrawal-cap accounting. `storedDate`/`storedTotal` are the
 * `dailyWithdrawalDate`/`dailyWithdrawalTotal` fields on wallets/{uid}.
 *
 * A stored counter from a previous UTC day (or missing) is treated as 0 — the
 * cap resets at UTC midnight. That same reset also harmlessly absorbs a stale or
 * negative leftover from a rare cross-midnight decrement (see
 * restoreWithdrawalReservation), so the counter can never wrongly block a new
 * day's withdrawals. Within a day, the in-transaction increment and the restore
 * decrement are each paired 1:1 with the wallet's balance mutation, so the
 * counter can never drift from the actual committed withdrawals.
 */
export function computeDailyWithdrawalState(
  storedDate: unknown,
  storedTotal: unknown,
  amount: number,
  capCents: number,
  nowMs: number,
): DailyWithdrawalState {
  const dayKey = utcDayKey(nowMs);
  const priorToday =
    storedDate === dayKey && typeof storedTotal === "number" && storedTotal > 0
      ? storedTotal
      : 0;
  const newTotal = priorToday + amount;
  return { priorToday, newTotal, exceedsCap: newTotal > capCents, dayKey };
}

// ─── daily stake cap ─────────────────────────────────────────────────────────

export interface DailyStakeState {
  /** Cents already staked today (0 if the stored counter is from a prior day). */
  priorToday: number;
  /** Running total once this stake commits (what we write back). */
  newTotal: number;
  /** True if priorToday + amount exceeds the cap — caller must refuse. */
  exceedsCap: boolean;
  /** UTC day this counter is tagged with. */
  dayKey: string;
}

/**
 * Pure daily-STAKE-cap accounting. `storedDate`/`storedTotal` are the
 * `dailyStakeDate`/`dailyStakeTotal` fields on wallets/{uid}. Twin of
 * computeDailyWithdrawalState — same atomic-counter shape, applied to staking.
 *
 * Counting via a single per-wallet counter (read + written inside the same
 * transaction as the debit) replaces the old query-of-two-collections approach,
 * which (a) double-counted solo/scheduled stakes — they write BOTH a stake txn
 * AND a sessions/{id} doc — and (b) was racy — a collection query inside a txn
 * can't see a concurrent, not-yet-committed sibling stake. The counter is
 * increment-only and cumulative for the UTC day (refunds do NOT decrement it,
 * matching the prior "cumulative staked today" semantics); a stored counter
 * from a prior day (or missing) resets to 0.
 */
export function computeDailyStakeState(
  storedDate: unknown,
  storedTotal: unknown,
  amount: number,
  capCents: number,
  nowMs: number,
): DailyStakeState {
  const dayKey = utcDayKey(nowMs);
  const priorToday =
    storedDate === dayKey && typeof storedTotal === "number" && storedTotal > 0
      ? storedTotal
      : 0;
  const newTotal = priorToday + amount;
  return { priorToday, newTotal, exceedsCap: newTotal > capCents, dayKey };
}

// ─── Wallet freeze recovery ─────────────────────────────────────────────────

export interface UnfreezeDecision {
  /** Whether the freeze flag should be cleared. */
  unfreeze: boolean;
  /** storedBalance - Σtransactions (0 = drift resolved). */
  delta: number;
}

/**
 * Decide whether an admin unfreeze request should clear a wallet's freeze.
 * A wallet auto-freezes when stored balance != Σtransactions (any drift).
 * Default policy: only clear the freeze once the drift is gone (delta === 0).
 * `force` lets an operator override AFTER reviewing the walletAudits doc and
 * crediting/refunding by hand. Pure so the policy is unit-pinned and matches
 * reconcileWalletBalances' drift definition exactly.
 */
export function shouldUnfreezeWallet(
  storedBalance: number,
  summedFromTransactions: number,
  force: boolean,
): UnfreezeDecision {
  const delta = storedBalance - summedFromTransactions;
  return { unfreeze: delta === 0 || force, delta };
}

// ─── Scheduled staked session helpers ────────────────────────────────────────
//
// Auto-staking on a recurring schedule moves money while the user is away, so
// every amount is server-clamped — the client (the device that fires the
// scheduled trigger) is never trusted for a stake size or a reward multiplier.

/** Lowest / highest a scheduled block may auto-stake (cents). */
export const SCHEDULED_STAKE_MIN_CENTS = 200; // $2
export const SCHEDULED_STAKE_MAX_CENTS = 2500; // $25
/** Hard ceiling on house-funded completion surplus per scheduled session. */
export const SCHEDULED_SURPLUS_CAP_CENTS = 5000; // $50

/**
 * Clamp a (client-supplied) scheduled stake to the safe range. Rounds to whole
 * cents. Pure so the bound is unit-pinned and can never be bypassed by a
 * tampered client frame.
 */
export function clampScheduledStake(
  requestedCents: number,
  minCents: number = SCHEDULED_STAKE_MIN_CENTS,
  maxCents: number = SCHEDULED_STAKE_MAX_CENTS,
): number {
  if (!Number.isFinite(requestedCents)) return minCents;
  return Math.max(minCents, Math.min(maxCents, Math.round(requestedCents)));
}

/**
 * Clamp the house-funded completion reward multiplier to [1.0, 1.1]. 1.0 =
 * stake returned, no surplus (the dormant default). Anything outside the band
 * is clamped so a misconfiguration or tampered field can never mint a runaway
 * payout — the >1× portion is house money routed to the gated `earned` bucket.
 */
export function clampRewardMultiplier(
  multiplier: number,
  minMult: number = 1.0,
  maxMult: number = 1.1,
): number {
  if (!Number.isFinite(multiplier)) return minMult;
  return Math.max(minMult, Math.min(maxMult, multiplier));
}

/**
 * House-funded surplus (cents) to grant on a scheduled-session completion,
 * ABOVE the returned principal. Two independent caps, whichever is smaller:
 *   1. the multiplier: round(principal × (mult − 1))
 *   2. the surplus cap: min($50, net deposits) — a user with no real-money
 *      deposits (promo-only) earns nothing, and nobody earns more than $50 of
 *      house money from a single scheduled completion.
 * Pure. (The cumulative-across-sessions cap belongs to the dormant-flip
 * backfill + engagement gate, per STATUS.md — not enforced here.)
 */
export function cappedRewardSurplus(
  principalCents: number,
  multiplier: number,
  netDepositsCents: number,
  surplusCapCents: number = SCHEDULED_SURPLUS_CAP_CENTS,
): number {
  const byMultiplier = Math.max(
    0,
    Math.round(principalCents * (multiplier - 1.0)),
  );
  const byDeposits = Math.max(0, Math.min(surplusCapCents, netDepositsCents));
  return Math.min(byMultiplier, byDeposits);
}

/**
 * Deterministic session doc id for an auto-staked scheduled block, keyed by
 * (uid, templateId, UTC calendar day). Makes the auto-stake idempotent: a retry
 * or a double-fire on the same day reads the existing session and never
 * double-debits. One scheduled stake per template per UTC day.
 */
export function scheduledSessionDocId(
  uid: string,
  templateId: string,
  nowMs: number,
): string {
  return `scheduled_${uid}_${templateId}_${utcDayKey(nowMs)}`;
}
