import {
  calculatePayouts,
  calculateTransfers,
  optimisticGroupPayouts,
  type ParticipantResult,
  type ParticipantPayout,
} from "../../../utils/payoutAlgorithm";
import { SOLO_COMPLETION_MULTIPLIER } from "../../../constants/config";
import type {
  GroupSessionDoc,
  GroupSessionParticipant,
  SessionParticipant,
  UserReputation,
} from "../../../types";

const makeParticipant = (
  userId: string,
  name: string,
  stakeAmount: number,
): Pick<SessionParticipant, "userId" | "name" | "stakeAmount"> => ({
  userId,
  name,
  stakeAmount,
});

// In the dormant pilot the multiplier is 1.0 → a completer gets exactly their
// own stake back. Compute expectations from the constant (with the same
// Math.round as production) so these tests still pin the contract if the
// post-submit, capped multiplier is ever raised above 1.0.
const ownStakeBack = (stake: number) =>
  Math.round(stake * SOLO_COMPLETION_MULTIPLIER);

// ─── calculatePayouts ────────────────────────────────────────────────────────
//
// De-pooled: every completer gets their OWN stake back (× the dormant
// multiplier); a non-completer forfeits to the house and that stake is NEVER
// redistributed to other participants. Mirrors the authoritative server
// settlement in functions/src/security.ts `calculateGroupSessionPayouts`.

describe("calculatePayouts", () => {
  it("completer gets own stake back; surrenderer's forfeit goes to the house, not the completer", () => {
    const results: ParticipantResult[] = [
      { userId: "a", completed: true },
      { userId: "b", completed: false },
    ];
    const payouts = calculatePayouts(500, results);

    expect(payouts).toHaveLength(2);
    // De-pool: A gets exactly their OWN 500 back — NOT 1000. B's forfeited 500
    // goes to the house. This is the core regression guard against re-pooling.
    expect(payouts.find((p) => p.userId === "a")?.payout).toBe(500);
    expect(payouts.find((p) => p.userId === "b")?.payout).toBe(0);
  });

  it("two of three complete: each completer gets their own stake, no share of the forfeit", () => {
    const results: ParticipantResult[] = [
      { userId: "a", completed: true },
      { userId: "b", completed: true },
      { userId: "c", completed: false },
    ];
    const payouts = calculatePayouts(2500, results);
    expect(payouts).toHaveLength(3);
    // Each completer gets their own 2500 back — NOT floor(7500/2)=3750.
    expect(payouts.find((p) => p.userId === "a")?.payout).toBe(2500);
    expect(payouts.find((p) => p.userId === "b")?.payout).toBe(2500);
    expect(payouts.find((p) => p.userId === "c")?.payout).toBe(0);
  });

  it("solo complete returns own stake back (dormant 1.0 multiplier)", () => {
    const payouts = calculatePayouts(1000, [{ userId: "a", completed: true }]);
    expect(payouts).toHaveLength(1);
    expect(payouts[0].payout).toBe(ownStakeBack(1000));
    // Pilot ships dormant: 1.0× → exactly the stake, no surplus.
    expect(payouts[0].payout).toBe(1000);
  });

  it("solo surrender returns 0 payout", () => {
    const payouts = calculatePayouts(1000, [{ userId: "a", completed: false }]);
    expect(payouts).toHaveLength(1);
    expect(payouts[0].payout).toBe(0);
  });

  it("all complete: everyone gets their own stake back (net 0)", () => {
    const payouts = calculatePayouts(500, [
      { userId: "a", completed: true },
      { userId: "b", completed: true },
    ]);
    expect(payouts.map((p) => p.payout)).toEqual([500, 500]);
  });

  it("all surrender: everyone gets 0 (all stakes forfeit to the house)", () => {
    const payouts = calculatePayouts(500, [
      { userId: "a", completed: false },
      { userId: "b", completed: false },
    ]);
    expect(payouts.map((p) => p.payout)).toEqual([0, 0]);
  });

  it("applies the completion multiplier uniformly to every completer", () => {
    // Pins the multiplier wiring (round(stake × multiplier)) without hard-coding
    // a value — survives a deliberate, capped post-submit multiplier bump.
    const stake = 333;
    const payouts = calculatePayouts(stake, [
      { userId: "a", completed: true },
      { userId: "b", completed: true },
      { userId: "c", completed: false },
    ]);
    expect(payouts.find((p) => p.userId === "a")?.payout).toBe(
      ownStakeBack(stake),
    );
    expect(payouts.find((p) => p.userId === "b")?.payout).toBe(
      ownStakeBack(stake),
    );
    expect(payouts.find((p) => p.userId === "c")?.payout).toBe(0);
  });

  it("a completer is never paid more than their own stake × multiplier (de-pool invariant)", () => {
    // However many others surrender, a completer's payout is bounded by their
    // own stake × multiplier — forfeits never inflate it.
    const stake = 700;
    const cap = ownStakeBack(stake);
    const payouts = calculatePayouts(stake, [
      { userId: "a", completed: true },
      { userId: "b", completed: false },
      { userId: "c", completed: false },
      { userId: "d", completed: false },
    ]);
    payouts.forEach((p) => expect(p.payout).toBeLessThanOrEqual(cap));
    // A gets exactly their own stake — not the three forfeited stakes.
    expect(payouts.find((p) => p.userId === "a")?.payout).toBe(cap);
  });

  it("preserves userId in output", () => {
    const results: ParticipantResult[] = [
      { userId: "user-abc", completed: true },
      { userId: "user-xyz", completed: false },
    ];
    const payouts = calculatePayouts(500, results);
    expect(payouts.map((p) => p.userId)).toContain("user-abc");
    expect(payouts.map((p) => p.userId)).toContain("user-xyz");
  });

  it("returns empty array for empty results", () => {
    expect(calculatePayouts(500, [])).toEqual([]);
  });
});

// ─── calculateTransfers ──────────────────────────────────────────────────────
//
// De-pooled sessions never move money between players: a completer keeps their
// own stake, a non-completer forfeits to the house. So there are NO inter-player
// transfers — calculateTransfers always returns []. These tests guard against a
// regression that reintroduces peer-to-peer settlement (a wager pool).

describe("calculateTransfers", () => {
  it("returns [] for a completer + surrenderer (forfeit goes to the house)", () => {
    const participants = [
      makeParticipant("a", "Alice", 500),
      makeParticipant("b", "Bob", 500),
    ];
    const payouts: ParticipantPayout[] = [
      { userId: "a", payout: 500 },
      { userId: "b", payout: 0 },
    ];
    expect(calculateTransfers(participants, payouts)).toEqual([]);
  });

  it("returns [] when everyone completes", () => {
    const participants = [
      makeParticipant("a", "Alice", 500),
      makeParticipant("b", "Bob", 500),
      makeParticipant("c", "Charlie", 500),
    ];
    const payouts: ParticipantPayout[] = [
      { userId: "a", payout: 500 },
      { userId: "b", payout: 500 },
      { userId: "c", payout: 500 },
    ];
    expect(calculateTransfers(participants, payouts)).toEqual([]);
  });

  it("returns [] when everyone surrenders", () => {
    const participants = [
      makeParticipant("a", "Alice", 500),
      makeParticipant("b", "Bob", 500),
    ];
    const payouts: ParticipantPayout[] = [
      { userId: "a", payout: 0 },
      { userId: "b", payout: 0 },
    ];
    expect(calculateTransfers(participants, payouts)).toEqual([]);
  });

  it("returns [] for a single participant", () => {
    expect(
      calculateTransfers(
        [makeParticipant("a", "Alice", 500)],
        [{ userId: "a", payout: 500 }],
      ),
    ).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(calculateTransfers([], [])).toEqual([]);
  });
});

// ─── optimisticGroupPayouts ──────────────────────────────────────────────────
//
// Drives the live in-session leaderboard preview. De-pooled: each participant's
// projection is their OWN stake back (× the dormant multiplier) while still in
// the run — it does NOT grow when someone else surrenders. Cross-validated
// against `calculatePayouts` so the UI never promises a cent the server won't
// settle.

const DEFAULT_REP: UserReputation = {
  score: 50,
  level: "sapling",
  paymentsCompleted: 0,
  paymentsMissed: 0,
  totalOwedPaid: 0,
  totalOwedMissed: 0,
  lastUpdated: new Date(),
};

const participant = (
  override: Partial<GroupSessionParticipant> & { name: string },
): GroupSessionParticipant => ({
  accepted: true,
  online: true,
  reputation: DEFAULT_REP,
  ...override,
});

const session = (
  stakePerParticipant: number,
  participants: Record<string, GroupSessionParticipant>,
): Pick<GroupSessionDoc, "stakePerParticipant" | "participants"> => ({
  stakePerParticipant,
  participants,
});

describe("optimisticGroupPayouts", () => {
  it("solo focused → projects own stake back", () => {
    const rows = optimisticGroupPayouts(
      session(2000, { me: participant({ name: "Me" }) }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "me",
      estimatedPayout: ownStakeBack(2000),
      share: 1,
      status: "focused",
    });
  });

  it("solo completed → keeps the own-stake projection", () => {
    const rows = optimisticGroupPayouts(
      session(2000, { me: participant({ name: "Me", completed: true }) }),
    );
    expect(rows[0]).toMatchObject({
      estimatedPayout: ownStakeBack(2000),
      status: "completed",
    });
  });

  it("solo surrendered → 0 payout, 0 share, surrendered status", () => {
    const rows = optimisticGroupPayouts(
      session(2000, { me: participant({ name: "Me", surrendered: true }) }),
    );
    expect(rows[0]).toMatchObject({
      estimatedPayout: 0,
      share: 0,
      status: "surrendered",
    });
  });

  it("group all focused → each projects their own stake (no pool split)", () => {
    const rows = optimisticGroupPayouts(
      session(1000, {
        a: participant({ name: "A" }),
        b: participant({ name: "B" }),
        c: participant({ name: "C" }),
      }),
    );
    rows.forEach((r) => {
      expect(r.estimatedPayout).toBe(ownStakeBack(1000));
      expect(r.share).toBe(1);
      expect(r.status).toBe("focused");
    });
  });

  it("group with one surrender → survivors keep their OWN stake (not inflated), surrenderer zeros out", () => {
    // The discriminating de-pool case: under the old pool model survivors would
    // jump to 1500 (3000/2). De-pooled, they stay at their own 1000.
    const rows = optimisticGroupPayouts(
      session(1000, {
        a: participant({ name: "A" }),
        b: participant({ name: "B" }),
        c: participant({ name: "C", surrendered: true }),
      }),
    );
    const byUid = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byUid.a.estimatedPayout).toBe(1000);
    expect(byUid.b.estimatedPayout).toBe(1000);
    expect(byUid.c.estimatedPayout).toBe(0);
    expect(byUid.c.status).toBe("surrendered");
    expect(byUid.c.share).toBe(0);
  });

  it("regression: a surrender does NOT raise survivors' projection", () => {
    // The whole point of de-pooling — caving no longer hands your stake to the
    // people still focused. Survivors' projection is unchanged.
    const before = optimisticGroupPayouts(
      session(1000, {
        a: participant({ name: "A" }),
        b: participant({ name: "B" }),
        c: participant({ name: "C" }),
      }),
    ).find((r) => r.userId === "a")!.estimatedPayout;

    const after = optimisticGroupPayouts(
      session(1000, {
        a: participant({ name: "A" }),
        b: participant({ name: "B" }),
        c: participant({ name: "C", surrendered: true }),
      }),
    ).find((r) => r.userId === "a")!.estimatedPayout;

    expect(after).toBe(before);
  });

  it("group all surrendered → everyone zeroed (all stakes forfeit to the house)", () => {
    const rows = optimisticGroupPayouts(
      session(1000, {
        a: participant({ name: "A", surrendered: true }),
        b: participant({ name: "B", surrendered: true }),
      }),
    );
    rows.forEach((r) => {
      expect(r.estimatedPayout).toBe(0);
      expect(r.share).toBe(0);
      expect(r.status).toBe("surrendered");
    });
  });

  it("a participant's projection never exceeds their own stake × multiplier", () => {
    // Property test: no matter who surrenders, nobody's projection exceeds their
    // own stake × multiplier — forfeits never inflate it.
    const stake = 1000;
    const cap = ownStakeBack(stake);
    const scenarios: Array<Partial<GroupSessionParticipant>[]> = [
      [{}, {}, {}, {}],
      [{ surrendered: true }, {}, {}, {}],
      [{ surrendered: true }, { surrendered: true }, {}, {}],
      [{ completed: true }, {}, { surrendered: true }, {}],
    ];
    for (const scenario of scenarios) {
      const participants: Record<string, GroupSessionParticipant> = {};
      scenario.forEach((p, i) => {
        participants[`p${i}`] = participant({ name: `P${i}`, ...p });
      });
      const rows = optimisticGroupPayouts(session(stake, participants));
      rows.forEach((r) => expect(r.estimatedPayout).toBeLessThanOrEqual(cap));
    }
  });

  it("matches calculatePayouts on the all-completed case", () => {
    // Cross-validate: the optimistic preview must equal the settlement math, or
    // the UI promises something the server won't deliver.
    const stake = 1000;
    const ids = ["a", "b", "c", "d"];
    const optimistic = optimisticGroupPayouts(
      session(
        stake,
        Object.fromEntries(
          ids.map((id) => [id, participant({ name: id, completed: true })]),
        ),
      ),
    );
    const settled = calculatePayouts(
      stake,
      ids.map((id) => ({ userId: id, completed: true })),
    );
    optimistic.forEach((r) => {
      const expected = settled.find((s) => s.userId === r.userId)?.payout;
      expect(r.estimatedPayout).toBe(expected);
    });
  });
});
