/**
 * Unit tests for the legal-acceptance + onboarding-once logic in authStore.
 *
 * - `hasAcceptedCurrentLegal` compares `user.legalAcceptanceVersion` against
 *   `CURRENT_LEGAL_VERSION`, OR honors a locally-recorded acceptance marker so a
 *   lagging/failed CF write never re-prompts Terms on the next launch.
 * - `markOnboardingComplete` records a uid-scoped flag so the Screen Time /
 *   notification setup screens show once (build-23 feedback).
 *
 * The whole file runs with DEMO_MODE forced OFF so the real (non-DEMO) marker
 * path is exercised; the acceptLegalTerms CF is mocked.
 */

// Force the non-DEMO code path; mock the CF (the only writer of the fields).
jest.mock("../../../constants/config", () => ({
  ...jest.requireActual("../../../constants/config"),
  DEMO_MODE: false,
}));
const mockAcceptLegalTerms = jest.fn();
jest.mock("../../../config/functions", () => ({
  ...jest.requireActual("../../../config/functions"),
  acceptLegalTerms: (...args: unknown[]) => mockAcceptLegalTerms(...args),
}));

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

import { useAuthStore } from "../../../store/authStore";
import { CURRENT_LEGAL_VERSION } from "../../../constants/config";

const AsyncStorage =
  require("@react-native-async-storage/async-storage").default;

const PENDING_KEY = "@niyah/pending_legal_acceptance:test-uid";
const ONBOARDING_KEY = "@niyah/onboarding_complete:test-uid";

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
      onboardingComplete: false,
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

// ─── Acceptance durable marker (non-DEMO path) ───────────────────────────────
//
// The client records acceptance locally the instant the user accepts, so a
// lagging/failed CF write (offline, the build-21 SSL-pin outage, or a legacy CF
// that doesn't persist) never re-prompts Terms on the next launch. The marker
// is cleared ONLY once a launch reads the doc carrying the current version —
// never on a bare CF "success".
describe("acceptLegal durable marker (non-DEMO)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAcceptLegalTerms.mockReset();
    useAuthStore.setState({
      user: { ...baseUser },
      isAuthenticated: true,
      hasAcceptedCurrentLegal: false,
    } as never);
  });

  it("writes the marker even when the CF succeeds (durable until the doc confirms)", async () => {
    mockAcceptLegalTerms.mockResolvedValue({ success: true });

    await useAuthStore.getState().acceptLegal();

    expect(mockAcceptLegalTerms).toHaveBeenCalledWith(CURRENT_LEGAL_VERSION);
    // Marker is recorded up-front regardless of CF outcome, and NOT cleared on
    // a bare success — only a later doc-confirm clears it.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PENDING_KEY,
      CURRENT_LEGAL_VERSION,
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(useAuthStore.getState().hasAcceptedCurrentLegal).toBe(true);
  });

  it("on CF failure keeps the marker; replay keeps it until the doc carries the version", async () => {
    mockAcceptLegalTerms.mockRejectedValueOnce(
      new Error("Network request failed"),
    );

    // CF fails → user is NOT trapped behind the gate, marker is written.
    await useAuthStore.getState().acceptLegal();
    expect(useAuthStore.getState().hasAcceptedCurrentLegal).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PENDING_KEY,
      CURRENT_LEGAL_VERSION,
    );

    // Next launch: marker present, doc STILL lacks the version → CF replayed,
    // gate open, but the marker is NOT cleared on a bare success.
    mockAcceptLegalTerms.mockResolvedValueOnce({ success: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      CURRENT_LEGAL_VERSION,
    );
    (AsyncStorage.removeItem as jest.Mock).mockClear();
    useAuthStore.setState({
      user: { ...baseUser },
      hasAcceptedCurrentLegal: false,
    } as never);
    await useAuthStore.getState().retryPendingLegalAcceptance();

    expect(mockAcceptLegalTerms).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(useAuthStore.getState().hasAcceptedCurrentLegal).toBe(true);

    // A later launch where the doc now carries the version → marker cleared,
    // no further CF replay.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      CURRENT_LEGAL_VERSION,
    );
    useAuthStore.setState({
      user: { ...baseUser, legalAcceptanceVersion: CURRENT_LEGAL_VERSION },
      hasAcceptedCurrentLegal: true,
    } as never);
    await useAuthStore.getState().retryPendingLegalAcceptance();

    expect(mockAcceptLegalTerms).toHaveBeenCalledTimes(2); // no extra replay
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PENDING_KEY);
  });
});

// ─── Onboarding-complete milestone ───────────────────────────────────────────
//
// Reaching the tabs records a uid-scoped flag so the Screen Time / notification
// setup screens (and any spurious legal re-prompt) don't re-appear on later
// launches (build-23 feedback: onboarding shows once).
describe("markOnboardingComplete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets the flag in state + persists it per-uid, and is idempotent", async () => {
    useAuthStore.setState({
      user: { ...baseUser },
      onboardingComplete: false,
    } as never);

    await useAuthStore.getState().markOnboardingComplete();
    expect(useAuthStore.getState().onboardingComplete).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_KEY, "1");

    // Second call no-ops (no duplicate write).
    (AsyncStorage.setItem as jest.Mock).mockClear();
    await useAuthStore.getState().markOnboardingComplete();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("no-ops when unauthenticated", async () => {
    useAuthStore.setState({
      user: null,
      onboardingComplete: false,
    } as never);

    await useAuthStore.getState().markOnboardingComplete();
    expect(useAuthStore.getState().onboardingComplete).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
