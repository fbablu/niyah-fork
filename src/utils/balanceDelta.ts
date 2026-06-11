import type { Transaction } from "../types";

export interface AllTimeDelta {
  direction: "up" | "down";
  /** Signed ratio of net vs total deposits, e.g. 0.125 = +12.5% */
  pct: number;
}

/**
 * Derives the all-time up/down balance ticker from the transaction list.
 *
 * net = balance + withdrawals - deposits: what the user's commitments have
 * earned (payouts/bonuses) or cost (forfeits) on top of the money they put in.
 *
 * Fail-safe: walletStore.hydrate() restores only the BALANCE from Firestore —
 * the transaction list starts empty on each launch and only accumulates
 * entries created this app session, so a partial list would understate
 * deposits and fabricate a delta. We therefore require the ledger to be
 * self-consistent (signed sum of all transactions === current balance, true
 * in DEMO mode and whenever a complete all-time list is supplied) and return
 * null otherwise — hiding the ticker beats lying with it.
 */
export const deriveAllTimeDelta = (
  balanceCents: number,
  transactions: Transaction[],
): AllTimeDelta | null => {
  if (transactions.length === 0) return null;

  let deposits = 0;
  let withdrawals = 0;
  let signedSum = 0;
  for (const tx of transactions) {
    if (tx.type === "deposit") deposits += Math.abs(tx.amount);
    else if (tx.type === "withdrawal") withdrawals += Math.abs(tx.amount);
    signedSum += tx.amount;
  }

  // No deposit base → percentage is undefined.
  if (deposits <= 0) return null;
  // Ledger doesn't reconcile to the balance → list is truncated/partial.
  if (signedSum !== balanceCents) return null;

  const net = balanceCents + withdrawals - deposits;
  if (net === 0) return null; // flat → omit

  const pct = net / deposits;
  // Would render as "0.0%" after one-decimal rounding — treat as flat.
  if (Math.abs(pct) < 0.0005) return null;

  return { direction: net > 0 ? "up" : "down", pct };
};
