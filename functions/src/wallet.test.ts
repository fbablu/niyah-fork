/**
 * Wallet-bucket security contracts. These pin the invariants the money path
 * relies on so a regression in withdrawal gating or deletion refunds fails CI
 * before it can leak house money:
 *
 *   - computeWithdrawable: deposits always; earned + bonus only after the
 *     engagement gate; credit never.
 *   - withdrawDrawOrder MUST mirror computeWithdrawable — the eligibility check
 *     and the actual bucket debit can never disagree (a drift would let gated
 *     house money cash out, or strand a legit withdrawal).
 *   - cardRefundableCents: account deletion refunds ONLY deposited principal to
 *     a card — never the house-funded bonus/credit buckets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  readBuckets,
  readBucketsOrInit,
  sumBuckets,
  computeWithdrawable,
  withdrawDrawOrder,
  cardRefundableCents,
  drawDown,
  type Buckets,
} from "./wallet";

const buckets = (
  deposited: number,
  earned: number,
  bonus: number,
  credit: number,
): Buckets => ({ deposited, earned, bonus, credit });

// ── computeWithdrawable ──────────────────────────────────────────────────────
test("withdrawable: deposits are always withdrawable, gate or not", () => {
  const b = buckets(2000, 0, 0, 0);
  assert.equal(computeWithdrawable(b, false), 2000);
  assert.equal(computeWithdrawable(b, true), 2000);
});

test("withdrawable: earned + bonus locked until the engagement gate is met", () => {
  const b = buckets(1000, 500, 500, 0);
  assert.equal(computeWithdrawable(b, false), 1000); // deposits only
  assert.equal(computeWithdrawable(b, true), 2000); // + earned + bonus
});

test("withdrawable: credit is never withdrawable", () => {
  const b = buckets(0, 0, 0, 9999);
  assert.equal(computeWithdrawable(b, false), 0);
  assert.equal(computeWithdrawable(b, true), 0);
});

test("withdrawable: pure promo/forgiveness wallet is $0 before the gate", () => {
  // The finals-promo / first-surrender-forgiveness leak this fix closes: $5 of
  // house money in `bonus` with no deposits must NOT be cashable before the
  // user has real engagement.
  const b = buckets(0, 0, 500, 0);
  assert.equal(computeWithdrawable(b, false), 0);
  assert.equal(computeWithdrawable(b, true), 500);
});

// ── gate vs debit agreement (the contract that must never drift) ─────────────
// withdrawDrawOrder must mirror computeWithdrawable exactly: drawing the
// withdrawable amount leaves zero shortfall, one cent more shortfalls, and a
// withdrawal never touches the credit bucket.
function assertGateDebitAgree(b: Buckets, gateMet: boolean): void {
  const w = computeWithdrawable(b, gateMet);
  const order = withdrawDrawOrder(gateMet);
  assert.equal(
    drawDown(b, w, order).shortfall,
    0,
    "drawing exactly the withdrawable amount must not shortfall",
  );
  assert.ok(
    drawDown(b, w + 1, order).shortfall > 0,
    "one cent beyond withdrawable must shortfall",
  );
  assert.equal(
    drawDown(b, w, order).drawn.credit,
    0,
    "a withdrawal must never draw from credit",
  );
}

test("gate/debit agree: deposits-only when gate not met", () => {
  assertGateDebitAgree(buckets(1000, 500, 500, 100), false);
});
test("gate/debit agree: all of earned+bonus unlock when gate met", () => {
  assertGateDebitAgree(buckets(1000, 500, 500, 100), true);
});
test("gate/debit agree: empty wallet, both gate states", () => {
  assertGateDebitAgree(buckets(0, 0, 0, 0), true);
  assertGateDebitAgree(buckets(0, 0, 0, 0), false);
});
test("gate/debit agree: credit-only wallet draws nothing", () => {
  assertGateDebitAgree(buckets(0, 0, 0, 1000), true);
});

test("withdraw draw order spends deposits, then earned, then bonus", () => {
  const { drawn } = drawDown(buckets(1000, 1000, 1000, 0), 1500, withdrawDrawOrder(true));
  assert.equal(drawn.deposited, 1000);
  assert.equal(drawn.earned, 500);
  assert.equal(drawn.bonus, 0);
});

// ── cardRefundableCents (account deletion) ───────────────────────────────────
test("delete refund: only the deposited bucket is card-refundable", () => {
  // deposited $10, earned $3, bonus $5 (promo/forgiveness), credit $2.
  assert.equal(cardRefundableCents(buckets(1000, 300, 500, 200)), 1000);
});

test("delete refund: a house-money-only wallet refunds $0 to a card", () => {
  // The deleteAccount leak this fix closes: bonus + credit are not card money
  // and must never be refunded to a card (that would mint free cash).
  assert.equal(cardRefundableCents(buckets(0, 0, 500, 1000)), 0);
});

test("delete refund: legacy un-bucketed wallet treats balance as deposited", () => {
  // v1.0 wallets carry only card deposits, so an un-bucketed balance is all
  // card-refundable principal.
  assert.equal(cardRefundableCents(readBucketsOrInit({}, 2500)), 2500);
});

// ── account deletion conserves every cent ────────────────────────────────────
// Mirrors deleteAccount's split: card refund = deposited; withdrawable payout =
// gate-met (earned + bonus); forfeited = the non-withdrawable remainder + credit.
// The contract: refund + payout + forfeited == balance, for any wallet and gate
// state — deletion never creates money and never destroys a cent without a home.
test("delete split accounts for every cent (refund + payout + forfeit == balance)", () => {
  const fixtures = [
    buckets(1000, 300, 500, 200),
    buckets(0, 0, 500, 0), // pure forgiveness bonus
    buckets(2500, 0, 0, 0), // pure deposits
    buckets(0, 400, 0, 100), // winnings + credit, no deposits
    buckets(0, 0, 0, 0), // empty
  ];
  for (const gateMet of [true, false]) {
    for (const b of fixtures) {
      const balance = sumBuckets(b);
      const refund = cardRefundableCents(b);
      const payout = gateMet ? b.earned + b.bonus : 0;
      const forfeited =
        (gateMet ? 0 : b.earned + b.bonus) + b.credit;
      assert.equal(
        refund + payout + forfeited,
        balance,
        `every cent accounted for (gateMet=${gateMet})`,
      );
      // The payout is exactly the withdrawable house money (computeWithdrawable
      // minus the card-refunded deposits) — deletion and withdrawal agree.
      assert.equal(payout, computeWithdrawable(b, gateMet) - b.deposited);
    }
  }
});

// ── ledger invariant after a promo credit ────────────────────────────────────
test("promo credit to bonus keeps balance == sum(buckets)", () => {
  // Mirrors maybeAwardFinalsPromo: credit balance AND bonus together so the
  // ledger invariant holds (the old path bumped only balance -> silent drift).
  const promo = 500;
  const after = {
    balance: 2000 + promo,
    depositedBalance: 2000,
    earnedBalance: 0,
    bonusBalance: 0 + promo,
    creditBalance: 0,
  };
  assert.equal(after.balance, sumBuckets(readBuckets(after)));
});
