// startGroupSession is the legacy DEMO-only local path (it throws in live mode —
// "use proposeSession instead"), so force DEMO to exercise it. The cloud group
// flow (proposeSession + CFs) is covered by groupSessionStore.parsing.test.ts.
// MUST precede imports — babel-jest hoists jest.mock().
jest.mock("../../../constants/config", () => ({
  ...jest.requireActual("../../../constants/config"),
  DEMO_MODE: true,
  USE_SHORT_TIMERS: true,
}));

import { useGroupSessionStore } from "../../../store/groupSessionStore";
import { useWalletStore } from "../../../store/walletStore";
import { useAuthStore } from "../../../store/authStore";
import { CADENCES, INITIAL_BALANCE } from "../../../constants/config";
import type { GroupSession, UserReputation } from "../../../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeReputation = (
  overrides: Partial<UserReputation> = {},
): UserReputation => ({
  score: 50,
  level: "sapling",
  paymentsCompleted: 0,
  paymentsMissed: 0,
  totalOwedPaid: 0,
  totalOwedMissed: 0,
  lastUpdated: new Date(),
  referralCount: 0,
  ...overrides,
});

const P_A = {
  userId: "user-a",
  name: "Alice",
  reputation: makeReputation(),
};
const P_B = {
  userId: "user-b",
  name: "Bob",
  reputation: makeReputation(),
};
const P_C = { userId: "user-c", name: "Charlie", reputation: makeReputation() };

const resetStores = () => {
  useGroupSessionStore.setState({
    activeGroupSession: null,
    groupSessionHistory: [],
  });
  useWalletStore.setState({
    balance: INITIAL_BALANCE,
    transactions: [],
    pendingWithdrawal: 0,
  });
  useAuthStore.setState({
    user: {
      id: "user-a",
      email: "alice@test.com",
      name: "Alice",
      balance: INITIAL_BALANCE,
      currentStreak: 0,
      longestStreak: 0,
      totalSessions: 0,
      completedSessions: 0,
      totalEarnings: 0,
      createdAt: new Date(),
      reputation: makeReputation(),
    },
    isAuthenticated: true,
    isLoading: false,
  });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("groupSessionStore", () => {
  beforeEach(resetStores);

  // ── startGroupSession ─────────────────────────────────────────────────────

  describe("startGroupSession", () => {
    it("creates an active session with correct fields", () => {
      const before = Date.now();
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      const after = Date.now();

      const s = useGroupSessionStore.getState().activeGroupSession!;
      expect(s).not.toBeNull();
      expect(s.cadence).toBe("daily");
      expect(s.status).toBe("active");
      expect(s.stakePerParticipant).toBe(CADENCES.daily.stake);
      expect(s.startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(s.startedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it("sets stakeAmount on every participant from cadence config", () => {
      useGroupSessionStore.getState().startGroupSession("weekly", [P_A, P_B]);
      const { participants } =
        useGroupSessionStore.getState().activeGroupSession!;
      participants.forEach((p) =>
        expect(p.stakeAmount).toBe(CADENCES.weekly.stake),
      );
    });

    it("computes poolTotal as stake × participant count", () => {
      useGroupSessionStore
        .getState()
        .startGroupSession("daily", [P_A, P_B, P_C]);
      expect(
        useGroupSessionStore.getState().activeGroupSession!.poolTotal,
      ).toBe(CADENCES.daily.stake * 3);
    });

    it("deducts stake from wallet (current user only)", () => {
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      expect(useWalletStore.getState().balance).toBe(
        INITIAL_BALANCE - CADENCES.daily.stake,
      );
    });

    it("adds a stake transaction to wallet history", () => {
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      const txs = useWalletStore.getState().transactions;
      expect(txs.some((t) => t.type === "stake")).toBe(true);
    });

    it("includes all participants with correct userIds", () => {
      useGroupSessionStore
        .getState()
        .startGroupSession("daily", [P_A, P_B, P_C]);
      const ids = useGroupSessionStore
        .getState()
        .activeGroupSession!.participants.map((p) => p.userId);
      expect(ids).toContain("user-a");
      expect(ids).toContain("user-b");
      expect(ids).toContain("user-c");
    });

    it("generates unique session ids across calls", () => {
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      const id1 = useGroupSessionStore.getState().activeGroupSession!.id;

      useGroupSessionStore.setState({ activeGroupSession: null });
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      const id2 = useGroupSessionStore.getState().activeGroupSession!.id;

      expect(id1).not.toBe(id2);
    });
  });

  // ── completeGroupSession ──────────────────────────────────────────────────

  describe("completeGroupSession", () => {
    const start = () =>
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);

    it("returns undefined when no active session", () => {
      expect(
        useGroupSessionStore.getState().completeGroupSession([]),
      ).toBeUndefined();
    });

    it("clears activeGroupSession and moves to history", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: true },
      ]);

      expect(useGroupSessionStore.getState().activeGroupSession).toBeNull();
      expect(useGroupSessionStore.getState().groupSessionHistory).toHaveLength(
        1,
      );
    });

    it("prepends to history (most recent first)", () => {
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      const firstId = useGroupSessionStore.getState().groupSessionHistory[0].id;

      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      const newestId =
        useGroupSessionStore.getState().groupSessionHistory[0].id;

      expect(newestId).not.toBe(firstId);
      expect(useGroupSessionStore.getState().groupSessionHistory).toHaveLength(
        2,
      );
    });

    it("returns the completed session", () => {
      start();
      const result = useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      expect(result).toBeDefined();
      expect(result!.status).toBe("completed");
    });

    it("status is 'completed' when current user completed", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: false },
      ]);
      expect(
        useGroupSessionStore.getState().groupSessionHistory[0].status,
      ).toBe("completed");
    });

    it("status is 'surrendered' when current user failed", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: false },
        { userId: "user-b", completed: true },
      ]);
      expect(
        useGroupSessionStore.getState().groupSessionHistory[0].status,
      ).toBe("surrendered");
    });

    it("sets completed flags on participants from results", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: false },
      ]);
      const { participants } =
        useGroupSessionStore.getState().groupSessionHistory[0];
      expect(participants.find((p) => p.userId === "user-a")?.completed).toBe(
        true,
      );
      expect(participants.find((p) => p.userId === "user-b")?.completed).toBe(
        false,
      );
    });

    it("attaches screenTime to participants when provided", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true, screenTime: 12000 },
        { userId: "user-b", completed: true, screenTime: 5000 },
      ]);
      const { participants } =
        useGroupSessionStore.getState().groupSessionHistory[0];
      expect(participants.find((p) => p.userId === "user-a")?.screenTime).toBe(
        12000,
      );
      expect(participants.find((p) => p.userId === "user-b")?.screenTime).toBe(
        5000,
      );
    });

    it("participants missing from results default to completed: false", () => {
      start();
      // Only provide result for user-a
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      const { participants } =
        useGroupSessionStore.getState().groupSessionHistory[0];
      expect(participants.find((p) => p.userId === "user-b")?.completed).toBe(
        false,
      );
    });

    it("credits own stake back to wallet when current user completed", () => {
      start();
      const balanceAfterStake = useWalletStore.getState().balance;
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: false },
      ]);
      // De-pooled: user-a gets their OWN stake back — NOT the pool. user-b's
      // forfeited stake goes to the house, never redistributed to user-a.
      expect(useWalletStore.getState().balance).toBe(
        balanceAfterStake + CADENCES.daily.stake,
      );
    });

    it("records forfeit (no extra balance deduction) when current user failed", () => {
      start();
      const balanceAfterStake = useWalletStore.getState().balance;
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: false },
        { userId: "user-b", completed: true },
      ]);
      // Stake was already lost on start; forfeit just records the event
      expect(useWalletStore.getState().balance).toBe(balanceAfterStake);
      expect(
        useWalletStore
          .getState()
          .transactions.some((t) => t.type === "forfeit"),
      ).toBe(true);
    });

    it("increments currentStreak on completion", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: true },
      ]);
      expect(useAuthStore.getState().user!.currentStreak).toBe(1);
    });

    it("resets currentStreak to 0 on failure", () => {
      useAuthStore.getState().updateUser({ currentStreak: 5 });
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: false }]);
      expect(useAuthStore.getState().user!.currentStreak).toBe(0);
    });

    it("updates longestStreak when new streak surpasses it", () => {
      useAuthStore
        .getState()
        .updateUser({ currentStreak: 4, longestStreak: 4 });
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      expect(useAuthStore.getState().user!.longestStreak).toBe(5);
    });

    it("does not lower longestStreak on surrender", () => {
      useAuthStore.getState().updateUser({ longestStreak: 10 });
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: false }]);
      expect(useAuthStore.getState().user!.longestStreak).toBe(10);
    });

    it("increments totalSessions on both completion and failure", () => {
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: false }]);
      expect(useAuthStore.getState().user!.totalSessions).toBe(1);

      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      expect(useAuthStore.getState().user!.totalSessions).toBe(2);
    });

    it("only increments completedSessions on successful completion", () => {
      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: false }]);
      expect(useAuthStore.getState().user!.completedSessions).toBe(0);

      start();
      useGroupSessionStore
        .getState()
        .completeGroupSession([{ userId: "user-a", completed: true }]);
      expect(useAuthStore.getState().user!.completedSessions).toBe(1);
    });

    it("attaches payout to each participant", () => {
      start();
      useGroupSessionStore.getState().completeGroupSession([
        { userId: "user-a", completed: true },
        { userId: "user-b", completed: true },
      ]);
      const { participants } =
        useGroupSessionStore.getState().groupSessionHistory[0];
      participants.forEach((p) => expect(p.payout).toBeDefined());
    });

    it("does not crash when no auth user is logged in", () => {
      useAuthStore.setState({ user: null });
      start();
      expect(() =>
        useGroupSessionStore
          .getState()
          .completeGroupSession([{ userId: "user-a", completed: true }]),
      ).not.toThrow();
    });
  });

  // ── getTimeRemaining ──────────────────────────────────────────────────────

  describe("getTimeRemaining", () => {
    it("returns 0 when no active session", () => {
      expect(useGroupSessionStore.getState().getTimeRemaining()).toBe(0);
    });

    it("returns a positive value during an active session", () => {
      useGroupSessionStore.getState().startGroupSession("daily", [P_A, P_B]);
      expect(
        useGroupSessionStore.getState().getTimeRemaining(),
      ).toBeGreaterThan(0);
    });

    it("never returns a negative value for an expired session", () => {
      useGroupSessionStore.setState({
        activeGroupSession: {
          id: "past",
          cadence: "daily",
          stakePerParticipant: 500,
          poolTotal: 1000,
          startedAt: new Date(Date.now() - 20000),
          endsAt: new Date(Date.now() - 5000), // already ended
          status: "active",
          participants: [],
        },
      });
      expect(useGroupSessionStore.getState().getTimeRemaining()).toBe(0);
    });
  });
});
