/**
 * Unit tests for deriveAllTimeDelta — the all-time balance ticker math.
 *
 * Contract: net = balance + withdrawals - deposits, pct = net / deposits.
 * Fail-safe: walletStore only hydrates the balance from Firestore (the
 * transaction list starts empty each launch), so any list whose signed sum
 * does not reconcile to the balance is treated as truncated → null (no
 * ticker). Hiding beats lying.
 */

import { deriveAllTimeDelta } from "../../../utils/balanceDelta";
import type { Transaction } from "../../../types";

let txId = 0;
const tx = (type: Transaction["type"], amount: number): Transaction => ({
  id: `tx-${++txId}`,
  type,
  amount,
  description: type,
  createdAt: new Date(),
});

describe("deriveAllTimeDelta", () => {
  it("reports up when payouts exceed forfeits (net positive)", () => {
    // deposit $100, stake $20, payout $25 → balance $105, net +$5 on $100
    const txns = [tx("deposit", 10000), tx("stake", -2000), tx("payout", 2500)];
    const delta = deriveAllTimeDelta(10500, txns);
    expect(delta).toEqual({ direction: "up", pct: 0.05 });
  });

  it("reports down after a forfeited stake (net negative)", () => {
    // deposit $100, stake $20 forfeited (forfeit txn amount is 0 by contract)
    const txns = [tx("deposit", 10000), tx("stake", -2000), tx("forfeit", 0)];
    const delta = deriveAllTimeDelta(8000, txns);
    expect(delta).toEqual({ direction: "down", pct: -0.2 });
  });

  it("adds withdrawals back so cashing out is not counted as a loss", () => {
    // deposit $100, withdraw $40, stake $10, payout $15 → net +$5 on $100
    const txns = [
      tx("deposit", 10000),
      tx("withdrawal", -4000),
      tx("stake", -1000),
      tx("payout", 1500),
    ];
    expect(deriveAllTimeDelta(6500, txns)).toEqual({
      direction: "up",
      pct: 0.05,
    });
  });

  it("returns null when there are no deposits (pct undefined)", () => {
    expect(deriveAllTimeDelta(500, [tx("bonus", 500)])).toBeNull();
  });

  it("returns null for an empty transaction list", () => {
    expect(deriveAllTimeDelta(12345, [])).toBeNull();
  });

  it("returns null when flat (balance exactly equals deposits)", () => {
    expect(deriveAllTimeDelta(5000, [tx("deposit", 5000)])).toBeNull();
  });

  it("fail-safe: returns null when the ledger does not reconcile to the balance (truncated list)", () => {
    // Hydrated server balance of $100 but only this session's $20 deposit is
    // in the local list — deposits are unreliable, so no ticker.
    expect(deriveAllTimeDelta(10000, [tx("deposit", 2000)])).toBeNull();
  });

  it("returns null when the pct would round to 0.0%", () => {
    // net +1¢ on $10,000 deposited → 0.0001% → would display as "+0.0%"
    const txns = [
      tx("deposit", 1000000),
      tx("stake", -1000),
      tx("payout", 1001),
    ];
    expect(deriveAllTimeDelta(1000001, txns)).toBeNull();
  });
});
