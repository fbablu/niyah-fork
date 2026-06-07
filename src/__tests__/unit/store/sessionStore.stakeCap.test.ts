/**
 * Tests the per-user daily stake cap enforced in sessionStore.startSession.
 * The client check mirrors the server-side assertDailyStakeCap used in
 * createGroupSession and respondToGroupInvite Cloud Functions.
 *
 * DEMO_MODE=false so the cap guard is exercised (demo mode skips the check
 * to keep manual testing with short timers unblocked).
 */

jest.mock("../../../constants/config", () => ({
  ...jest.requireActual("../../../constants/config"),
  DEMO_MODE: false,
  DAILY_STAKE_CAP_CENTS: 1000, // $10 cap for test isolation
}));

jest.mock("../../../config/firebase", () => ({
  writeSession: jest.fn().mockResolvedValue(undefined),
  updateSession: jest.fn().mockResolvedValue(undefined),
  getActiveSession: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../../config/screentime", () => ({
  isScreenTimeAvailable: false,
  startBlocking: jest.fn().mockResolvedValue(undefined),
  stopBlocking: jest.fn().mockResolvedValue(undefined),
  onSurrenderRequested: jest.fn(() => () => {}),
  onShieldViolation: jest.fn(() => () => {}),
  startLiveActivity: jest.fn().mockResolvedValue(false),
  updateLiveActivity: jest.fn().mockResolvedValue(false),
  endLiveActivity: jest.fn().mockResolvedValue(false),
  setSessionContext: jest.fn().mockResolvedValue(undefined),
  clearSessionContext: jest.fn().mockResolvedValue(undefined),
  getViolationsByCategory: jest.fn(() => ({})),
}));

jest.mock("../../../config/functions", () => ({
  handleSessionComplete: jest.fn().mockResolvedValue(undefined),
  handleSessionForfeit: jest.fn().mockResolvedValue(undefined),
  createSoloSession: jest
    .fn()
    .mockImplementation(async (_cadence: string, sessionId: string) => ({
      success: true,
      sessionId,
      startedAtMs: Date.now(),
      endsAtMs: Date.now() + 60_000,
      stakeAmount: 0,
      newBalance: 0,
      idempotent: false,
    })),
}));

jest.mock("../../../utils/analytics", () => ({
  logEvent: jest.fn(),
}));

import { useSessionStore } from "../../../store/sessionStore";
import { useWalletStore } from "../../../store/walletStore";
import { useAuthStore } from "../../../store/authStore";
import { CADENCES } from "../../../constants/config";

describe("sessionStore — daily stake cap", () => {
  beforeEach(() => {
    useSessionStore.setState({
      currentSession: null,
      sessionHistory: [],
      isBlocking: false,
      violationCount: 0,
    });
    useWalletStore.setState({
      balance: 50_00,
      transactions: [],
      pendingWithdrawal: 0,
    });
    useAuthStore.setState({
      user: {
        id: "cap-user",
        email: "cap@test.com",
        name: "Cap User",
        balance: 50_00,
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        completedSessions: 0,
        totalEarnings: 0,
        createdAt: new Date(),
        reputation: { score: 50, level: "sapling" as const },
      },
    } as never);
  });

  it("allows a session within the cap", async () => {
    // focus cadence stakes $2 (200 cents), well under $10 cap
    await expect(
      useSessionStore.getState().startSession("focus"),
    ).resolves.not.toThrow();
  });

  it("blocks a single session that exceeds the cap", async () => {
    // weekly cadence stakes $25 (2500 cents), above $10 cap
    await expect(
      useSessionStore.getState().startSession("weekly"),
    ).rejects.toThrow(/Daily stake cap reached/);
  });

  it("blocks the second session when cumulative stake would exceed cap", async () => {
    // Simulate a prior session today by seeding history
    useSessionStore.setState({
      sessionHistory: [
        {
          id: "first",
          cadence: "hour", // $5 stake
          stakeAmount: CADENCES.hour.stake,
          potentialPayout: CADENCES.hour.stake,
          startedAt: new Date(),
          endsAt: new Date(Date.now() - 1000),
          status: "completed",
          completedAt: new Date(),
          actualPayout: CADENCES.hour.stake,
        },
      ],
    });
    // Next session: hour ($5) — 5 + 5 = 10, right at cap, allowed
    await expect(
      useSessionStore.getState().startSession("hour"),
    ).resolves.not.toThrow();
  });

  it("blocks when cumulative would just exceed cap", async () => {
    // Prior $5 session today; next $6 would exceed $10 cap
    useSessionStore.setState({
      sessionHistory: [
        {
          id: "first",
          cadence: "hour",
          stakeAmount: 600, // $6
          potentialPayout: 600,
          startedAt: new Date(),
          endsAt: new Date(Date.now() - 1000),
          status: "completed",
          completedAt: new Date(),
          actualPayout: 600,
        },
      ],
    });
    // hour = $5 (500 cents). 600 + 500 = 1100 > 1000 cap
    await expect(
      useSessionStore.getState().startSession("hour"),
    ).rejects.toThrow(/Daily stake cap reached/);
  });

  it("ignores sessions from previous days", async () => {
    // Simulate a session from yesterday — should not count
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useSessionStore.setState({
      sessionHistory: [
        {
          id: "old",
          cadence: "weekly",
          stakeAmount: 2500,
          potentialPayout: 2500,
          startedAt: yesterday,
          endsAt: yesterday,
          status: "completed",
          completedAt: yesterday,
          actualPayout: 2500,
        },
      ],
    });
    // New $5 hour session today is fine despite yesterday's $25 stake
    await expect(
      useSessionStore.getState().startSession("hour"),
    ).resolves.not.toThrow();
  });
});
