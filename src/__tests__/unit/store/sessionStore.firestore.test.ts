/**
 * sessionStore — Firestore Persistence Tests (DEMO_MODE=false)
 *
 * Tests the Firestore persistence layer added in the refactor:
 * - writeSession called on startSession (fire-and-forget)
 * - updateSession called on surrenderSession / completeSession
 * - recoverActiveSession: restores active sessions, auto-completes expired ones
 *
 * All firebase functions are mocked at the module level. DEMO_MODE is overridden
 * to false so cloud sync branches are exercised.
 */

// MUST be declared before imports — babel-jest hoists jest.mock() calls
jest.mock("../../../constants/config", () => ({
  ...jest.requireActual("../../../constants/config"),
  DEMO_MODE: false,
}));

jest.mock("../../../config/firebase", () => ({
  writeSession: jest.fn(() => Promise.resolve()),
  updateSession: jest.fn(() => Promise.resolve()),
  getActiveSession: jest.fn(() => Promise.resolve(null)),
  updateUserDoc: jest.fn(() => Promise.resolve()),
  // Auth-related — required by authStore transitive import
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  sendMagicLink: jest.fn(),
  signInWithEmailLink: jest.fn(),
  isEmailSignInLink: jest.fn(),
  saveUserProfile: jest.fn(),
  fetchUserProfile: jest.fn(),
  awardReferralToUser: jest.fn(),
  getWalletDoc: jest.fn(() => Promise.resolve(null)),
  subscribeToWallet: jest.fn(() => jest.fn()),
}));

jest.mock("../../../config/functions", () => ({
  handleSessionComplete: jest.fn(() =>
    Promise.resolve({ newBalance: 5000, payout: 500 }),
  ),
  handleSessionForfeit: jest.fn(() => Promise.resolve({ success: true })),
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

import { useSessionStore } from "../../../store/sessionStore";
import { useWalletStore } from "../../../store/walletStore";
import { useAuthStore } from "../../../store/authStore";
import { CADENCES, INITIAL_BALANCE } from "../../../constants/config";
import {
  writeSession,
  updateSession,
  getActiveSession,
} from "../../../config/firebase";
import { handleSessionComplete } from "../../../config/functions";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: "firestore-test-user",
  email: "test@example.com",
  name: "Test User",
  balance: INITIAL_BALANCE,
  currentStreak: 0,
  longestStreak: 0,
  totalSessions: 0,
  completedSessions: 0,
  totalEarnings: 0,
  createdAt: new Date(),
  reputation: {
    score: 50,
    level: "sapling" as const,
    paymentsCompleted: 0,
    paymentsMissed: 0,
    totalOwedPaid: 0,
    totalOwedMissed: 0,
    lastUpdated: new Date(),
    referralCount: 0,
  },
  ...overrides,
});

/** Wait for fire-and-forget promises to settle */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("sessionStore — Firestore persistence (DEMO_MODE=false)", () => {
  beforeEach(() => {
    useSessionStore.setState({
      currentSession: null,
      sessionHistory: [],
      isBlocking: false,
    });
    useWalletStore.setState({
      balance: INITIAL_BALANCE,
      transactions: [],
      pendingWithdrawal: 0,
      isHydrated: true,
    });
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });

    jest.clearAllMocks();
  });

  // ─── createSoloSession (startSession) ─────────────────────────────────────
  // C1 Phase 2: client no longer writes session docs directly in prod —
  // createSoloSession CF debits the wallet and writes the doc atomically.
  // writeSession is only invoked in DEMO_MODE (this test runs with DEMO_MODE=false).

  describe("startSession — createSoloSession", () => {
    it("calls createSoloSession with cadence and sessionId on start", async () => {
      await useSessionStore.getState().startSession("daily");

      const session = useSessionStore.getState().currentSession;
      expect(session).not.toBeNull();

      const { createSoloSession } = jest.requireMock(
        "../../../config/functions",
      ) as { createSoloSession: jest.Mock };
      expect(createSoloSession).toHaveBeenCalledTimes(1);
      expect(createSoloSession).toHaveBeenCalledWith(
        "daily",
        expect.any(String),
        expect.any(Boolean),
      );
      // writeSession path is DEMO-only — must NOT fire in prod mode.
      expect(writeSession).not.toHaveBeenCalled();
    });

    it("rejects startSession when createSoloSession fails", async () => {
      const { createSoloSession } = jest.requireMock(
        "../../../config/functions",
      ) as { createSoloSession: jest.Mock };
      createSoloSession.mockRejectedValueOnce(
        new Error("Insufficient balance"),
      );

      await expect(
        useSessionStore.getState().startSession("daily"),
      ).rejects.toThrow("Insufficient balance");

      // No local session left half-started after a CF rejection.
      const state = useSessionStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.isBlocking).toBe(false);
    });
  });

  // ─── updateSession (surrenderSession) ─────────────────────────────────────

  describe("surrenderSession — cloudForfeit owns status update", () => {
    // In non-DEMO mode the client skips updateSession on surrender and lets
    // cloudForfeit's transaction set status server-side. Writing client-side
    // raced the CF read and triggered "Session is not active (current status:
    // surrendered)" 400s. See sessionStore.surrenderSession.
    it("does not call updateSession when surrendering in prod mode", async () => {
      await useSessionStore.getState().startSession("daily");
      useSessionStore.getState().surrenderSession();
      await flush();

      // The writeSession call on startSession is OK; we only assert that no
      // surrendered-status update was written from the client.
      const surrenderCalls = (updateSession as jest.Mock).mock.calls.filter(
        ([, payload]) => payload?.status === "surrendered",
      );
      expect(surrenderCalls).toHaveLength(0);
    });
  });

  // ─── updateSession (completeSession) ──────────────────────────────────────

  describe("completeSession — updateSession", () => {
    it("calls updateSession with 'completed' status and payout", async () => {
      await useSessionStore.getState().startSession("daily");
      const session = useSessionStore.getState().currentSession!;

      useSessionStore.getState().completeSession();
      await flush();

      expect(updateSession).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          status: "completed",
          completedAt: expect.any(Date),
        }),
      );
    });
  });

  // ─── recoverActiveSession ─────────────────────────────────────────────────

  describe("recoverActiveSession", () => {
    it("restores a still-active session from Firestore", async () => {
      const futureEnd = new Date(Date.now() + 60_000); // 60s from now
      jest.mocked(getActiveSession).mockResolvedValueOnce({
        id: "recovered-session-1",
        cadence: "daily",
        stakeAmount: 500,
        potentialPayout: 500,
        startedAt: new Date(Date.now() - 30_000),
        endsAt: futureEnd,
        status: "active",
      });

      await useSessionStore.getState().recoverActiveSession("user-123");

      const state = useSessionStore.getState();
      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession!.id).toBe("recovered-session-1");
      expect(state.currentSession!.status).toBe("active");
      expect(state.isBlocking).toBe(true);
    });

    it("auto-completes an expired session", async () => {
      const pastEnd = new Date(Date.now() - 10_000); // Expired 10s ago
      jest.mocked(getActiveSession).mockResolvedValueOnce({
        id: "expired-session-1",
        cadence: "daily",
        stakeAmount: 500,
        potentialPayout: 500,
        startedAt: new Date(Date.now() - 120_000),
        endsAt: pastEnd,
        status: "active",
      });

      const balanceBefore = useWalletStore.getState().balance;

      await useSessionStore.getState().recoverActiveSession("user-123");
      await flush();

      // Wallet credited with payout
      expect(useWalletStore.getState().balance).toBe(balanceBefore + 500);

      // Session added to history as completed
      const state = useSessionStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.sessionHistory).toHaveLength(1);
      expect(state.sessionHistory[0].status).toBe("completed");
      expect(state.sessionHistory[0].actualPayout).toBe(500);

      // Firestore updated (actualPayout written by Cloud Function, not client)
      expect(updateSession).toHaveBeenCalledWith(
        "expired-session-1",
        expect.objectContaining({
          status: "completed",
        }),
      );

      // Cloud function called for non-demo mode
      expect(handleSessionComplete).toHaveBeenCalledWith(
        "expired-session-1",
        500,
      );
    });

    it("no-ops when a session is already in memory", async () => {
      // Put a session in memory first
      await useSessionStore.getState().startSession("daily");
      jest.clearAllMocks();

      await useSessionStore.getState().recoverActiveSession("user-123");

      expect(getActiveSession).not.toHaveBeenCalled();
    });

    it("no-ops when Firestore returns null (no active session)", async () => {
      jest.mocked(getActiveSession).mockResolvedValueOnce(null);

      await useSessionStore.getState().recoverActiveSession("user-123");

      const state = useSessionStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.sessionHistory).toHaveLength(0);
    });

    it("handles Firestore error gracefully without crashing", async () => {
      jest
        .mocked(getActiveSession)
        .mockRejectedValueOnce(new Error("Firestore unavailable"));

      await useSessionStore.getState().recoverActiveSession("user-123");

      // No crash, state unchanged
      const state = useSessionStore.getState();
      expect(state.currentSession).toBeNull();
      expect(state.sessionHistory).toHaveLength(0);
    });

    it("updates auth stats when auto-completing expired session", async () => {
      const pastEnd = new Date(Date.now() - 5_000);
      jest.mocked(getActiveSession).mockResolvedValueOnce({
        id: "expired-session-2",
        cadence: "weekly",
        stakeAmount: 2500,
        potentialPayout: 2500,
        startedAt: new Date(Date.now() - 120_000),
        endsAt: pastEnd,
        status: "active",
      });

      await useSessionStore.getState().recoverActiveSession("user-123");

      // Auth stats should be updated
      const user = useAuthStore.getState().user;
      expect(user?.currentStreak).toBe(1);
      expect(user?.totalSessions).toBe(1);
      expect(user?.completedSessions).toBe(1);
    });
  });
});
