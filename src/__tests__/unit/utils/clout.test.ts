import {
  CLOUT_TIERS,
  CLOUT_WEIGHTS,
  computeCloutScore,
  deriveCloutCounters,
  getCloutProgress,
  getCloutTier,
  type CloutCounters,
} from "../../../utils/clout";
import type { Session } from "../../../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeCounters = (overrides: Partial<CloutCounters>): CloutCounters => ({
  soloNone: 0,
  soloStake: 0,
  groupNone: 0,
  groupStaked: 0,
  distinctFriends: 0,
  ...overrides,
});

const makeSession = (overrides: Partial<Session>): Session => ({
  id: "s1",
  cadence: "focus",
  stakeAmount: 0,
  potentialPayout: 0,
  startedAt: new Date("2026-06-01T10:00:00Z"),
  endsAt: new Date("2026-06-01T11:00:00Z"),
  status: "completed",
  ...overrides,
});

/** Firestore GroupSessionDoc shape: participants keyed by uid. */
const makeGroupDoc = (overrides: Record<string, unknown>) => ({
  id: "g1",
  proposerId: "me",
  status: "completed",
  cadence: "hour",
  stakePerParticipant: 500,
  customStake: false,
  duration: 3_600_000,
  participantIds: ["me", "friend-a", "friend-b"],
  participants: {
    me: { name: "Me", accepted: true, online: true, completed: true },
    "friend-a": { name: "A", accepted: true, online: true, completed: true },
    "friend-b": { name: "B", accepted: true, online: true, surrendered: true },
  },
  poolTotal: 1500,
  createdAt: new Date("2026-06-01T09:00:00Z"),
  updatedAt: new Date("2026-06-01T10:00:00Z"),
  ...overrides,
});

/** Legacy in-memory GroupSession shape: participants array, user-POV status. */
const makeLegacyGroup = (overrides: Record<string, unknown>) => ({
  id: "g-legacy",
  cadence: "hour",
  stakePerParticipant: 500,
  poolTotal: 1000,
  startedAt: new Date("2026-05-01T09:00:00Z"),
  endsAt: new Date("2026-05-01T10:00:00Z"),
  status: "completed",
  completedAt: new Date("2026-05-01T10:00:00Z"),
  participants: [
    { userId: "me", name: "Me", stakeAmount: 500, completed: true },
    { userId: "friend-c", name: "C", stakeAmount: 500, completed: true },
  ],
  ...overrides,
});

// ─── computeCloutScore ───────────────────────────────────────────────────────

describe("computeCloutScore", () => {
  it("matches the brief's worked example: 20/10/6/4 + 5 friends = 115", () => {
    // 20·1 + 10·3 + 6·4 + 4·8 + round(4·√5) = 20+30+24+32+9
    expect(
      computeCloutScore(
        makeCounters({
          soloNone: 20,
          soloStake: 10,
          groupNone: 6,
          groupStaked: 4,
          distinctFriends: 5,
        }),
      ),
    ).toBe(115);
  });

  it("stays in sync with CLOUT_WEIGHTS (single source of the knobs)", () => {
    const c = makeCounters({
      soloNone: 7,
      soloStake: 3,
      groupNone: 2,
      groupStaked: 1,
      distinctFriends: 3,
    });
    const expected =
      CLOUT_WEIGHTS.soloNone * 7 +
      CLOUT_WEIGHTS.soloStake * 3 +
      CLOUT_WEIGHTS.groupNone * 2 +
      CLOUT_WEIGHTS.groupStaked * 1 +
      Math.round(CLOUT_WEIGHTS.friendBonusFactor * Math.sqrt(3));
    expect(computeCloutScore(c)).toBe(expected);
  });

  it("pins the shipped weights (soloStake vs groupNone is the open knob)", () => {
    expect(CLOUT_WEIGHTS).toEqual({
      soloNone: 1,
      soloStake: 3,
      groupNone: 4,
      groupStaked: 8,
      friendBonusFactor: 4,
    });
  });

  it("rounds the sqrt friend bonus (1→4, 2→6, 3→7, 4→8, 9→12)", () => {
    const bonusFor = (n: number) =>
      computeCloutScore(makeCounters({ distinctFriends: n }));
    expect(bonusFor(0)).toBe(0);
    expect(bonusFor(1)).toBe(4); // 4·1
    expect(bonusFor(2)).toBe(6); // 4·1.414… = 5.66 → 6
    expect(bonusFor(3)).toBe(7); // 4·1.732… = 6.93 → 7
    expect(bonusFor(4)).toBe(8); // 4·2
    expect(bonusFor(9)).toBe(12); // 4·3
  });

  it("never returns NaN: junk counters collapse to 0", () => {
    expect(
      computeCloutScore({
        soloNone: NaN,
        soloStake: -3,
        groupNone: Infinity,
        groupStaked: 2.9, // floors to 2
        distinctFriends: -1,
      }),
    ).toBe(16); // only groupStaked: 2·8
  });
});

// ─── Tiers ───────────────────────────────────────────────────────────────────

describe("getCloutTier / CLOUT_TIERS", () => {
  it("tiers are contiguous from 0 with an unbounded top", () => {
    expect(CLOUT_TIERS[0].min).toBe(0);
    expect(CLOUT_TIERS[CLOUT_TIERS.length - 1].max).toBeNull();
    for (let i = 1; i < CLOUT_TIERS.length; i++) {
      expect(CLOUT_TIERS[i].min).toBe((CLOUT_TIERS[i - 1].max as number) + 1);
    }
  });

  it.each([
    [0, "newcomer"],
    [49, "newcomer"],
    [50, "committed"],
    [149, "committed"],
    [150, "trusted"],
    [399, "trusted"],
    [400, "innerCircle"],
    [10_000, "innerCircle"],
  ])("score %i → %s", (score, key) => {
    expect(getCloutTier(score as number).key).toBe(key);
  });

  it("clamps junk scores to Newcomer", () => {
    expect(getCloutTier(-50).key).toBe("newcomer");
    expect(getCloutTier(NaN).key).toBe("newcomer");
  });
});

describe("getCloutProgress", () => {
  it("reports 0..1 progress within the current tier", () => {
    expect(getCloutProgress(0)).toBe(0);
    expect(getCloutProgress(25)).toBeCloseTo(0.5); // Newcomer span 0–49 (50)
    expect(getCloutProgress(49)).toBeCloseTo(0.98);
    expect(getCloutProgress(50)).toBe(0); // fresh into Committed
    expect(getCloutProgress(100)).toBeCloseTo(0.5); // Committed span 100
    expect(getCloutProgress(150)).toBe(0); // fresh into Trusted
  });

  it("pins Inner Circle to 1 and never returns NaN", () => {
    expect(getCloutProgress(400)).toBe(1);
    expect(getCloutProgress(99_999)).toBe(1);
    expect(getCloutProgress(NaN)).toBe(0);
    expect(getCloutProgress(-10)).toBe(0);
  });
});

// ─── deriveCloutCounters ─────────────────────────────────────────────────────

describe("deriveCloutCounters", () => {
  const empty = { soloHistory: [], groupHistory: [], uid: "me" };

  it("splits solo sessions: only completed count; stake>0 → soloStake", () => {
    const counters = deriveCloutCounters({
      ...empty,
      soloHistory: [
        makeSession({ id: "a", stakeAmount: 500 }), // completed, staked
        makeSession({ id: "b", stakeAmount: 0 }), // completed, unstaked
        makeSession({ id: "c", stakeAmount: 500, status: "surrendered" }),
        makeSession({ id: "d", stakeAmount: 500, status: "active" }),
      ],
    });
    expect(counters.soloStake).toBe(1);
    expect(counters.soloNone).toBe(1);
    expect(counters.groupNone).toBe(0);
    expect(counters.groupStaked).toBe(0);
  });

  it("tolerates a legacy solo doc missing stakeAmount → soloNone", () => {
    const legacy = makeSession({ id: "old" });
    delete (legacy as Partial<Session>).stakeAmount;
    const counters = deriveCloutCounters({ ...empty, soloHistory: [legacy] });
    expect(counters.soloNone).toBe(1);
    expect(counters.soloStake).toBe(0);
  });

  it("GroupSessionDoc: staked + ≥2 people + I completed → groupStaked, friends counted", () => {
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [makeGroupDoc({})],
    });
    expect(counters.groupStaked).toBe(1);
    expect(counters.groupNone).toBe(0);
    // friend-b surrendered but is still a distinct other participant
    expect(counters.distinctFriends).toBe(2);
  });

  it("unstaked group doc → groupNone; staked solo-only doc → groupNone (needs ≥2)", () => {
    const unstaked = makeGroupDoc({ id: "g2", stakePerParticipant: 0 });
    const lonelyStaked = makeGroupDoc({
      id: "g3",
      participantIds: ["me"],
      participants: {
        me: { name: "Me", accepted: true, online: true, completed: true },
      },
    });
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [unstaked, lonelyStaked],
    });
    expect(counters.groupNone).toBe(2);
    expect(counters.groupStaked).toBe(0);
  });

  it("group docs where I did NOT complete earn nothing — no friends either", () => {
    const surrendered = makeGroupDoc({
      participants: {
        me: { name: "Me", accepted: true, online: true, surrendered: true },
        "friend-a": {
          name: "A",
          accepted: true,
          online: true,
          completed: true,
        },
        "friend-b": {
          name: "B",
          accepted: true,
          online: true,
          completed: true,
        },
      },
    });
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [surrendered],
    });
    expect(counters).toEqual(makeCounters({}));
  });

  it("legacy GroupSession (participants array, user-POV status) is supported", () => {
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [makeLegacyGroup({})],
    });
    expect(counters.groupStaked).toBe(1);
    expect(counters.distinctFriends).toBe(1); // friend-c
  });

  it("legacy doc missing my participant row falls back to its user-POV status", () => {
    const noMyRow = makeLegacyGroup({
      id: "g-drifted",
      participants: [
        { userId: "friend-d", name: "D", stakeAmount: 500, completed: true },
        { userId: "friend-e", name: "E", stakeAmount: 500, completed: false },
      ],
    });
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [noMyRow],
    });
    expect(counters.groupStaked).toBe(1); // status "completed" = MY perspective
    expect(counters.distinctFriends).toBe(2);
  });

  it("deduplicates friends across sessions and both doc shapes", () => {
    const docA = makeGroupDoc({
      id: "gA",
      participantIds: ["me", "friend-a"],
      participants: {
        me: { name: "Me", accepted: true, online: true, completed: true },
        "friend-a": {
          name: "A",
          accepted: true,
          online: true,
          completed: true,
        },
      },
    });
    const legacyWithSameFriend = makeLegacyGroup({
      id: "gB",
      participants: [
        { userId: "me", name: "Me", stakeAmount: 500, completed: true },
        { userId: "friend-a", name: "A", stakeAmount: 500, completed: true },
      ],
    });
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [docA, legacyWithSameFriend],
    });
    expect(counters.groupStaked).toBe(2);
    expect(counters.distinctFriends).toBe(1);
  });

  it("never throws on junk group entries", () => {
    const counters = deriveCloutCounters({
      ...empty,
      groupHistory: [null, 42, "junk", {}, { participants: "bogus" }, []],
    });
    expect(counters).toEqual(makeCounters({}));
  });

  it("fallback floor: empty histories + fallbackCompletedSessions count as soloNone", () => {
    const counters = deriveCloutCounters({
      ...empty,
      fallbackCompletedSessions: 7,
    });
    expect(counters).toEqual(makeCounters({ soloNone: 7 }));
    expect(computeCloutScore(counters)).toBe(7);
  });

  it("fallback is ignored once any history exists, and junk fallback reads as 0", () => {
    const withHistory = deriveCloutCounters({
      ...empty,
      soloHistory: [makeSession({ stakeAmount: 500 })],
      fallbackCompletedSessions: 7,
    });
    expect(withHistory).toEqual(makeCounters({ soloStake: 1 }));

    expect(
      deriveCloutCounters({ ...empty, fallbackCompletedSessions: NaN }),
    ).toEqual(makeCounters({}));
    expect(
      deriveCloutCounters({ ...empty, fallbackCompletedSessions: -3 }),
    ).toEqual(makeCounters({}));
  });

  it("derived counters always produce a finite score (no NaN end-to-end)", () => {
    const counters = deriveCloutCounters({
      soloHistory: [makeSession({ stakeAmount: NaN })],
      groupHistory: [makeGroupDoc({ stakePerParticipant: undefined })],
      uid: "me",
    });
    expect(Number.isFinite(computeCloutScore(counters))).toBe(true);
    // NaN stake reads as unstaked on both paths
    expect(counters.soloNone).toBe(1);
    expect(counters.groupNone).toBe(1);
  });
});
