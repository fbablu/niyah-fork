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
