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
  computeDailyStakeState,
  clampScheduledStake,
  clampRewardMultiplier,
  cappedRewardSurplus,
  scheduledSessionDocId,
  SCHEDULED_STAKE_MIN_CENTS,
  SCHEDULED_STAKE_MAX_CENTS,
  SCHEDULED_SURPLUS_CAP_CENTS,
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

// ── scheduled staked session: stake clamp ────────────────────────────────────
// Auto-staking runs while the user is away, so the stake size is NEVER trusted
// from the client — it's clamped to [$2, $25] server-side.
test("clampScheduledStake bounds a stake to [$2, $25]", () => {
  assert.equal(clampScheduledStake(50), SCHEDULED_STAKE_MIN_CENTS); // below floor → $2
  assert.equal(clampScheduledStake(0), SCHEDULED_STAKE_MIN_CENTS);
  assert.equal(clampScheduledStake(-1000), SCHEDULED_STAKE_MIN_CENTS); // negative → floor
  assert.equal(clampScheduledStake(99999), SCHEDULED_STAKE_MAX_CENTS); // above cap → $25
  assert.equal(clampScheduledStake(500), 500); // in range, untouched
  assert.equal(clampScheduledStake(SCHEDULED_STAKE_MIN_CENTS), 200);
  assert.equal(clampScheduledStake(SCHEDULED_STAKE_MAX_CENTS), 2500);
  assert.equal(clampScheduledStake(250.7), 251); // rounds to whole cents
  // Non-finite garbage → the safe floor ($2, least money at risk), never max.
  assert.equal(clampScheduledStake(Number.NaN), SCHEDULED_STAKE_MIN_CENTS);
  assert.equal(clampScheduledStake(Infinity), SCHEDULED_STAKE_MIN_CENTS);
});

// ── scheduled staked session: reward multiplier clamp ────────────────────────
test("clampRewardMultiplier bounds the reward to [1.0, 1.1]", () => {
  assert.equal(clampRewardMultiplier(0.5), 1.0); // can't ever reduce principal
  assert.equal(clampRewardMultiplier(1.0), 1.0);
  assert.equal(clampRewardMultiplier(1.05), 1.05);
  assert.equal(clampRewardMultiplier(1.1), 1.1);
  assert.equal(clampRewardMultiplier(2.0), 1.1); // runaway → capped at 1.1
  assert.equal(clampRewardMultiplier(Number.NaN), 1.0); // garbage → no surplus
});

// ── scheduled staked session: capped house-funded surplus ────────────────────
test("cappedRewardSurplus: 1.0x grants zero surplus", () => {
  assert.equal(cappedRewardSurplus(2500, 1.0, 100000), 0);
});

test("cappedRewardSurplus: bounded by the multiplier (10% of principal)", () => {
  // $25 stake, 1.1x, plenty of deposits → +$2.50 surplus.
  assert.equal(cappedRewardSurplus(2500, 1.1, 100000), 250);
  // $2 stake, 1.1x → +$0.20.
  assert.equal(cappedRewardSurplus(200, 1.1, 100000), 20);
});

test("cappedRewardSurplus: a promo-only wallet (no net deposits) earns nothing", () => {
  // Skin-in-the-game rule: no real-money deposits → no house reward.
  assert.equal(cappedRewardSurplus(2500, 1.1, 0), 0);
});

test("cappedRewardSurplus: never exceeds the $50 surplus cap", () => {
  // Contrived huge principal + deposits: still capped at $50.
  assert.equal(
    cappedRewardSurplus(1_000_000, 1.1, 1_000_000),
    SCHEDULED_SURPLUS_CAP_CENTS,
  );
});

test("cappedRewardSurplus: net-deposits brake binds below the multiplier reward", () => {
  // principal $25 @1.1x would be $2.50, but only $1 of net deposits → $1 cap.
  assert.equal(cappedRewardSurplus(2500, 1.1, 100), 100);
});

// ── scheduled staked session: idempotency doc id ─────────────────────────────
test("scheduledSessionDocId is stable within a UTC day, distinct across days", () => {
  const uid = "user123";
  const tid = "tmpl_morning";
  const t1 = Date.parse("2026-06-03T00:00:01Z");
  const t2 = Date.parse("2026-06-03T23:59:59Z");
  const t3 = Date.parse("2026-06-04T00:00:01Z");
  assert.equal(scheduledSessionDocId(uid, tid, t1), scheduledSessionDocId(uid, tid, t2));
  assert.notEqual(scheduledSessionDocId(uid, tid, t1), scheduledSessionDocId(uid, tid, t3));
  assert.equal(scheduledSessionDocId(uid, tid, t1), "scheduled_user123_tmpl_morning_2026-06-03");
  // Different user or template → different key (no cross-contamination).
  assert.notEqual(
    scheduledSessionDocId(uid, tid, t1),
    scheduledSessionDocId("other", tid, t1),
  );
  assert.notEqual(
    scheduledSessionDocId(uid, tid, t1),
    scheduledSessionDocId(uid, "tmpl_evening", t1),
  );
});

// ── daily stake cap (atomic per-wallet counter) ──────────────────────────────
// Replaces the old query-of-two-collections cap, which double-counted solo/
// scheduled stakes (txn + session doc) and was racy. The counter counts each
// stake once and the in-txn read/write makes the cap atomic.
const STAKE_CAP = 2500; // $25
const STAKE_DAY = Date.parse("2026-06-03T12:00:00Z"); // → "2026-06-03"

test("daily stake: first stake of the day counts from 0", () => {
  const s = computeDailyStakeState(undefined, undefined, 1000, STAKE_CAP, STAKE_DAY);
  assert.equal(s.priorToday, 0);
  assert.equal(s.newTotal, 1000);
  assert.equal(s.exceedsCap, false);
  assert.equal(s.dayKey, "2026-06-03");
});

test("daily stake: accumulates within the same UTC day (no double-count)", () => {
  const s = computeDailyStakeState("2026-06-03", 2000, 400, STAKE_CAP, STAKE_DAY);
  assert.equal(s.priorToday, 2000);
  assert.equal(s.newTotal, 2400);
  assert.equal(s.exceedsCap, false);
});

test("daily stake: exactly at the cap is allowed; one cent over is refused", () => {
  assert.equal(
    computeDailyStakeState("2026-06-03", 2000, 500, STAKE_CAP, STAKE_DAY).exceedsCap,
    false, // 2000 + 500 == 2500 == cap
  );
  assert.equal(
    computeDailyStakeState("2026-06-03", 2000, 501, STAKE_CAP, STAKE_DAY).exceedsCap,
    true, // 2501 > cap
  );
});

test("daily stake: a counter from a prior UTC day resets to 0", () => {
  const s = computeDailyStakeState("2026-06-02", 2500, 1000, STAKE_CAP, STAKE_DAY);
  assert.equal(s.priorToday, 0); // yesterday's total ignored
  assert.equal(s.newTotal, 1000);
  assert.equal(s.exceedsCap, false);
});

test("daily stake: garbage / negative stored total is treated as 0", () => {
  assert.equal(
    computeDailyStakeState("2026-06-03", -5, 1000, STAKE_CAP, STAKE_DAY).priorToday,
    0,
  );
  assert.equal(
    computeDailyStakeState("2026-06-03", "oops", 1000, STAKE_CAP, STAKE_DAY).priorToday,
    0,
  );
});
