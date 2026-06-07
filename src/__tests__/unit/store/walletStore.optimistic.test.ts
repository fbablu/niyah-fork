/**
 * walletStore — optimistic-deposit balance guard (DEMO_MODE=false)
 *
 * Pins the fix for the "vanishing balance" symptom: after an optimistic
 * deposit() credits the balance locally, a lagging subscribeToWallet snapshot
 * carrying the OLD (pre-credit) server balance must NOT stomp the balance back
 * down. Once a snapshot catches up to the credited amount — or the guard window
 * elapses, or the user intentionally debits — snapshots are trusted again.
 */

// MUST precede imports — babel-jest hoists jest.mock(). Pin DEMO_MODE=false so
// the subscribe/guard path runs (it's a no-op in DEMO).
jest.mock("../../../constants/config", () => ({
  ...jest.requireActual("../../../constants/config"),
  DEMO_MODE: false,
}));

let capturedCallback:
  | ((data: { balance: number; pendingBalance: number } | null) => void)
  | null = null;

jest.mock("../../../config/firebase", () => ({
  getWalletDoc: jest.fn(() => Promise.resolve(null)),
  subscribeToWallet: jest.fn((_uid: string, cb: typeof capturedCallback) => {
    capturedCallback = cb;
    return jest.fn();
  }),
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
  updateUserDoc: jest.fn(() => Promise.resolve()),
  writeSession: jest.fn(() => Promise.resolve()),
  updateSession: jest.fn(() => Promise.resolve()),
  getActiveSession: jest.fn(() => Promise.resolve(null)),
}));

import { useWalletStore } from "../../../store/walletStore";

const snapshot = (balance: number, pendingBalance = 0) =>
  capturedCallback?.({ balance, pendingBalance });

describe("walletStore — optimistic-deposit guard (DEMO_MODE=false)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    capturedCallback = null;
    useWalletStore.getState().unsubscribeWallet(); // also clears any armed floor
    useWalletStore.setState({
      balance: 0,
      transactions: [],
      pendingWithdrawal: 0,
      isHydrated: false,
    });
    useWalletStore.getState().subscribeToWalletUpdates("user-1");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ignores a lagging lower snapshot right after an optimistic deposit", () => {
    useWalletStore.getState().deposit(2000, 5000); // server says 5000
    expect(useWalletStore.getState().balance).toBe(5000);

    snapshot(3000); // stale pre-credit snapshot
    expect(useWalletStore.getState().balance).toBe(5000); // not stomped

    // pendingWithdrawal still tracks the snapshot.
    snapshot(3000, 750);
    expect(useWalletStore.getState().pendingWithdrawal).toBe(750);
  });

  it("accepts a snapshot once it reaches the credited balance, then trusts snapshots again", () => {
    useWalletStore.getState().deposit(2000, 5000);

    snapshot(5000); // server caught up → guard drops
    expect(useWalletStore.getState().balance).toBe(5000);

    // A genuinely lower later snapshot (e.g. a stake/withdraw elsewhere) lands.
    snapshot(4000);
    expect(useWalletStore.getState().balance).toBe(4000);
  });

  it("accepts a higher snapshot immediately (e.g. a payout landed)", () => {
    useWalletStore.getState().deposit(2000, 5000);

    snapshot(6000);
    expect(useWalletStore.getState().balance).toBe(6000);
  });

  it("stops guarding after the window elapses", () => {
    useWalletStore.getState().deposit(2000, 5000);

    jest.advanceTimersByTime(31_000); // past OPTIMISTIC_DEPOSIT_GUARD_MS
    snapshot(3000);
    expect(useWalletStore.getState().balance).toBe(3000);
  });

  it("clears the guard on a withdraw so a lower snapshot lands", () => {
    useWalletStore.getState().deposit(2000, 5000);
    useWalletStore.getState().withdraw(1000); // balance → 4000, guard cleared
    expect(useWalletStore.getState().balance).toBe(4000);

    snapshot(3500); // would be ignored if the guard were still armed
    expect(useWalletStore.getState().balance).toBe(3500);
  });

  it("clears the guard on a stake deduction so a lower snapshot lands", () => {
    useWalletStore.getState().deposit(2000, 5000);
    useWalletStore.getState().deductStake(1000, "session-1"); // → 4000, guard cleared
    expect(useWalletStore.getState().balance).toBe(4000);

    snapshot(3500); // reflects the stake server-side; must land
    expect(useWalletStore.getState().balance).toBe(3500);
  });

  it("guards a purely optimistic deposit (no syncedBalance) — DEMO / forfeit-refund path", () => {
    // deposit() without a server balance (DEMO mode, forfeit refunds) increments
    // locally; the floor must still protect it from a lagging pre-credit snapshot.
    useWalletStore.setState({ balance: 1000 });
    useWalletStore.getState().deposit(2000); // → 3000, floor armed at 3000
    expect(useWalletStore.getState().balance).toBe(3000);

    snapshot(1000); // stale pre-deposit snapshot
    expect(useWalletStore.getState().balance).toBe(3000); // not stomped
  });
});
