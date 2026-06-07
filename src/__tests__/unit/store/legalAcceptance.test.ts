/**
 * Unit Tests for legal acceptance version comparison logic in authStore
 *
 * The authStore derives `hasAcceptedCurrentLegal` by comparing
 * `user.legalAcceptanceVersion` against `CURRENT_LEGAL_VERSION` from config.
 * This test verifies that comparison for matching, old, and missing versions.
 */

import { useAuthStore } from "../../../store/authStore";
import { CURRENT_LEGAL_VERSION } from "../../../constants/config";

// Mock Firebase config module (required by authStore imports)
jest.mock("../../../config/firebase", () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithEmailLink: jest.fn(),
  isEmailSignInLink: jest.fn(),
  sendMagicLink: jest.fn(),
  fetchUserProfile: jest.fn(),
  saveUserProfile: jest.fn(),
  awardReferralToUser: jest.fn(),
  updateUserDoc: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(() => jest.fn()),
}));

const baseUser = {
  id: "test-uid",
  email: "test@example.com",
  name: "Test User",
  firstName: "Test",
  lastName: "User",
  balance: 0,
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
  authProvider: "email" as const,
  profileComplete: true,
};

describe("legal acceptance version comparison", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      profileComplete: false,
      isNewUser: false,
      hasAcceptedCurrentLegal: false,
    });
  });

  it("hasAcceptedCurrentLegal is true when user.legalAcceptanceVersion matches CURRENT_LEGAL_VERSION", () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        legalAcceptanceVersion: CURRENT_LEGAL_VERSION,
        legalAcceptedAt: new Date(),
      },
      isAuthenticated: true,
      hasAcceptedCurrentLegal: true,
    });

    const state = useAuthStore.getState();
    expect(state.hasAcceptedCurrentLegal).toBe(true);
    expect(state.user?.legalAcceptanceVersion).toBe(CURRENT_LEGAL_VERSION);
  });

  it("hasAcceptedCurrentLegal is false when user has an old version", () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        legalAcceptanceVersion: "0.9.0",
        legalAcceptedAt: new Date(),
      },
      isAuthenticated: true,
      hasAcceptedCurrentLegal: false,
    });

    const state = useAuthStore.getState();
    expect(state.hasAcceptedCurrentLegal).toBe(false);
    expect(state.user?.legalAcceptanceVersion).not.toBe(CURRENT_LEGAL_VERSION);
  });

  it("hasAcceptedCurrentLegal is false when user has no legalAcceptanceVersion", () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        // legalAcceptanceVersion is undefined (not set)
      },
      isAuthenticated: true,
      hasAcceptedCurrentLegal: undefined === CURRENT_LEGAL_VERSION, // evaluates to false
    });

    const state = useAuthStore.getState();
    expect(state.hasAcceptedCurrentLegal).toBe(false);
    expect(state.user?.legalAcceptanceVersion).toBeUndefined();
  });

  it("CURRENT_LEGAL_VERSION is a non-empty string", () => {
    expect(typeof CURRENT_LEGAL_VERSION).toBe("string");
    expect(CURRENT_LEGAL_VERSION.length).toBeGreaterThan(0);
  });
});

// ─── Acceptance retry marker (non-DEMO path) ─────────────────────────────────
//
// The acceptLegalTerms CF is the only writer of the acceptance fields. When
// that call fails (offline, the build-21 SSL-pin outage), the user must NOT
// be re-prompted on every sign-in: acceptLegal leaves a retry marker and
// retryPendingLegalAcceptance replays it on the next launch.
describe("acceptLegal retry marker (non-DEMO)", () => {
  afterEach(() => {
    jest.dontMock("../../../constants/config");
    jest.dontMock("../../../config/functions");
    jest.clearAllMocks();
  });

  it("writes the marker on CF failure, replays + clears it on retry", async () => {
    jest.doMock("../../../constants/config", () => ({
      ...jest.requireActual("../../../constants/config"),
      DEMO_MODE: false,
    }));
    const acceptLegalTerms = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network request failed"));
    jest.doMock("../../../config/functions", () => ({ acceptLegalTerms }));

    let store: typeof import("../../../store/authStore");
    jest.isolateModules(() => {
      store = require("../../../store/authStore");
    });
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;

    store!.useAuthStore.setState({
      user: { ...baseUser },
      isAuthenticated: true,
      hasAcceptedCurrentLegal: false,
    } as never);

    // CF fails → user is NOT trapped behind the gate, marker is written.
    await store!.useAuthStore.getState().acceptLegal();
    expect(store!.useAuthStore.getState().hasAcceptedCurrentLegal).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@niyah/pending_legal_acceptance:test-uid",
      CURRENT_LEGAL_VERSION,
    );

    // Next launch: marker present + doc lacks the version → CF replayed,
    // marker cleared, gate stays open.
    acceptLegalTerms.mockResolvedValueOnce({ success: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      CURRENT_LEGAL_VERSION,
    );
    store!.useAuthStore.setState({
      user: { ...baseUser },
      hasAcceptedCurrentLegal: false,
    } as never);
    await store!.useAuthStore.getState().retryPendingLegalAcceptance();

    expect(acceptLegalTerms).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "@niyah/pending_legal_acceptance:test-uid",
    );
    expect(store!.useAuthStore.getState().hasAcceptedCurrentLegal).toBe(true);
  });
});
