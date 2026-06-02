/**
 * Wallet freeze-recovery policy — unit tests for `shouldUnfreezeWallet`, the
 * pure decision behind the admin `unfreezeWallet` Cloud Function. The drift
 * definition (storedBalance - Σtransactions) mirrors reconcileWalletBalances,
 * so a regression in one without the other would surface here.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { shouldUnfreezeWallet } from "./wallet";

test("unfreezes when drift is resolved (delta === 0)", () => {
  const r = shouldUnfreezeWallet(5000, 5000, false);
  assert.equal(r.unfreeze, true);
  assert.equal(r.delta, 0);
});

test("refuses to unfreeze while positive drift remains (no force)", () => {
  const r = shouldUnfreezeWallet(5200, 5000, false);
  assert.equal(r.unfreeze, false);
  assert.equal(r.delta, 200);
});

test("refuses to unfreeze on negative drift too (no force)", () => {
  const r = shouldUnfreezeWallet(4800, 5000, false);
  assert.equal(r.unfreeze, false);
  assert.equal(r.delta, -200);
});

test("force overrides an unresolved drift", () => {
  const r = shouldUnfreezeWallet(5200, 5000, true);
  assert.equal(r.unfreeze, true);
  assert.equal(r.delta, 200);
});

test("force on an already-resolved wallet still unfreezes", () => {
  const r = shouldUnfreezeWallet(0, 0, true);
  assert.equal(r.unfreeze, true);
  assert.equal(r.delta, 0);
});

test("drift matches the historical leftover-txn case: stored - summed", () => {
  // The drift that froze the $13 dev account: a leftover negative withdrawal
  // txn (or a missing positive) leaves stored != summed until it's voided.
  const stored = 1300; // $13 balance
  const summed = 1100; // log off by $2
  const r = shouldUnfreezeWallet(stored, summed, false);
  assert.equal(r.delta, 200);
  assert.equal(r.unfreeze, false);
});
