import { create } from "zustand";
import { Session, CadenceType, SurrenderReason } from "../types";
import {
  CADENCES,
  DEMO_MODE,
  USE_SHORT_TIMERS,
  DAILY_STAKE_CAP_CENTS,
  AI_DATA_CAPTURE_ENABLED,
} from "../constants/config";
import { useAuthStore } from "./authStore";
import { useWalletStore } from "./walletStore";
import {
  handleSessionComplete as cloudComplete,
  handleSessionForfeit as cloudForfeit,
  createSoloSession as cloudCreateSoloSession,
} from "../config/functions";
import {
  writeSession,
  updateSession,
  getActiveSession,
} from "../config/firebase";
import {
  startBlocking,
  stopBlocking,
  onSurrenderRequested,
  onShieldViolation,
  startLiveActivity,
  endLiveActivity,
  setSessionContext,
  clearSessionContext,
  getViolationsByCategory,
} from "../config/screentime";
import {
  scheduleSessionEndNotification,
  cancelSessionEndNotification,
} from "../config/notifications";
import { generateId } from "../utils/id";
import { logger } from "../utils/logger";
import { logEvent } from "../utils/analytics";

// Module-level flag to prevent race between recoverActiveSession and startSession
let _isRecovering = false;
// Cleanup function for violation listener
let _unsubViolation: (() => void) | null = null;

/** Flatten the shield's per-category attempt counts ("social" → 3) into
 *  camelCase analytics props (violationsSocial: 3). Zero counts omitted.
 *  Counts persist until the NEXT startBlocking, so reading at session end
 *  (even after stopBlocking) is safe. */
const violationCategoryProps = (): Record<string, number> => {
  const props: Record<string, number> = {};
  for (const [key, n] of Object.entries(getViolationsByCategory())) {
    if (n > 0) props[`violations${key[0].toUpperCase()}${key.slice(1)}`] = n;
  }
  return props;
};

/** Raw per-category counts for the session-receipt history capture (zero and
 *  malformed entries dropped; null when nothing was blocked-and-attempted).
 *  Read at session end, BEFORE stopBlocking — tallies persist until the NEXT
 *  startBlocking, so this is the last safe read for THIS session. Analytics +
 *  receipt display only; never touches stake/status/balance. Local history
 *  only — `blockedByCategory` is not in the sessions update allowlist
 *  (firebase/firestore.rules), so no Firestore write is attempted. */
const captureBlockedByCategory = (): Record<string, number> | null => {
  const counts: Record<string, number> = {};
  for (const [key, n] of Object.entries(getViolationsByCategory())) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      counts[key] = Math.floor(n);
    }
  }
  return Object.keys(counts).length > 0 ? counts : null;
};

interface SessionState {
  currentSession: Session | null;
  sessionHistory: Session[];
  isBlocking: boolean;
  violationCount: number;
  /**
   * Cents refunded from the server via first-surrender forgiveness on the
   * most recent surrender. Read by the Complete screen to show a badge.
   * Reset to null at the start of every new session.
   */
  lastForgivenCents: number | null;

  startSession: (cadence: CadenceType) => Promise<void>;
  /** `reason`/`note` are AI Phase-0 capture (analytics only; no money effect). */
  surrenderSession: (reason?: SurrenderReason, note?: string) => void;
  completeSession: () => void;
  getTimeRemaining: () => number;
  /** Recover an active session from Firestore after app restart. */
  recoverActiveSession: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessionHistory: [],
  isBlocking: false,
  violationCount: 0,
  lastForgivenCents: null,

  startSession: async (cadence: CadenceType) => {
    const { currentSession, sessionHistory } = get();
    if (currentSession || _isRecovering) {
      throw new Error(
        "A session is already active. Complete or surrender it first.",
      );
    }

    const config = CADENCES[cadence];
    const duration = USE_SHORT_TIMERS ? config.demoDuration : config.duration;

    // Daily stake cap (mirrored in Cloud Functions). Sums stakes from solo
    // sessions started today in local history; group session stakes enforced
    // server-side by createGroupSession / respondToGroupInvite CFs. Server
    // also enforces this in createSoloSession — local check is for fast UX
    // feedback so the user doesn't round-trip just to see "cap reached".
    if (!DEMO_MODE) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const stakedToday = sessionHistory
        .filter((s) => s.startedAt.getTime() >= startOfDay.getTime())
        .reduce((sum, s) => sum + s.stakeAmount, 0);
      if (stakedToday + config.stake > DAILY_STAKE_CAP_CENTS) {
        const remaining = Math.max(0, DAILY_STAKE_CAP_CENTS - stakedToday);
        throw new Error(
          `Daily stake cap reached. Remaining today: $${(remaining / 100).toFixed(2)}. Cap resets at midnight.`,
        );
      }
    }

    const sessionId = generateId();
    let startedAtMs = Date.now();
    let endsAtMs = startedAtMs + duration;

    // Production path: server creates the session doc and debits the wallet
    // atomically via createSoloSession CF. Returns canonical startedAt/endsAt
    // so the client clock can't drift from server. DEMO_MODE preserves the
    // legacy local-only flow (no money on the line; offline-friendly).
    if (!DEMO_MODE) {
      try {
        const result = await cloudCreateSoloSession(
          cadence,
          sessionId,
          USE_SHORT_TIMERS,
        );
        startedAtMs = result.startedAtMs;
        endsAtMs = result.endsAtMs;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start session";
        logger.error("createSoloSession failed:", err);
        // Bubble user-friendly error up to the screen.
        throw new Error(message);
      }
    }

    // AI Phase-0 capture (analytics only; no money meaning) — derived from the
    // canonical start time (server-returned in prod). Deterministic.
    const startDate = new Date(startedAtMs);
    const startedAtLocalHour = startDate.getHours(); // 0–23 user-local
    const dayOfWeek = startDate.getDay(); // 0 (Sun) – 6 (Sat)

    const session: Session = {
      id: sessionId,
      cadence,
      stakeAmount: config.stake,
      potentialPayout: config.stake,
      startedAt: new Date(startedAtMs),
      endsAt: new Date(endsAtMs),
      status: "active",
      ...(AI_DATA_CAPTURE_ENABLED ? { startedAtLocalHour, dayOfWeek } : {}),
    };

    // Local wallet deduct mirrors the server-side debit so the UI updates
    // immediately. The Firestore wallet snapshot subscription will reconcile
    // if there's drift. In DEMO_MODE this is the source of truth.
    useWalletStore.getState().deductStake(config.stake, session.id);

    // Clear stale forgiveness flag — only relevant to the most recent surrender.
    set({ currentSession: session, isBlocking: true, lastForgivenCents: null });

    // Start Screen Time blocking (fire-and-forget; no-op on simulator)
    startBlocking().catch((err) =>
      logger.warn("Screen Time startBlocking failed:", err),
    );

    // Tell the shield this is a STAKED session so it shows forfeit copy with
    // the amount. Free quick-blocks never set this (they clear it), and the
    // shield defaults to free copy whenever stake ≤ 0 — default-safe.
    setSessionContext({
      names: [],
      stake: config.stake,
      type: "solo",
    }).catch(() => {});

    // Start Live Activity (no-op when Lane B disabled or iOS <16.1). Solo
    // sessions ship an empty leaderboard — the widget shows just timer + blob.
    {
      const userColor =
        useAuthStore.getState().user?.blobAvatar?.colorPreset ?? "forest";
      startLiveActivity({
        sessionId: session.id,
        sessionType: "solo",
        blobAssetName: `blob_${userColor}`,
        endsAt: session.endsAt.getTime() / 1000,
        leaderboard: [],
        userPayoutCents: session.potentialPayout,
      }).catch((err) => logger.warn("startLiveActivity (solo) failed:", err));
    }

    // Local notification fires at session.endsAt even if app is backgrounded.
    // Cancelled on completeSession/surrenderSession so a manually-ended session
    // never leaves a stale push pending.
    scheduleSessionEndNotification(
      session.endsAt,
      "Tap to collect your stake.",
    ).catch((err) =>
      logger.warn("scheduleSessionEndNotification failed:", err),
    );

    // Listen for surrender requests from the custom shield screen.
    // If the user taps "Surrender Session" on the Niyah shield while a
    // blocked app is open, the ShieldActionExtension writes a flag to
    // shared UserDefaults and this subscription picks it up.
    const unsubSurrender = onSurrenderRequested(() => {
      unsubSurrender();
      get().surrenderSession();
    });

    // Track shield violations (user tried to open a blocked app)
    _unsubViolation?.();
    _unsubViolation = onShieldViolation(() => {
      const { currentSession } = get();
      if (!currentSession) return;
      const newCount = get().violationCount + 1;
      set({ violationCount: newCount });

      // Fire-and-forget Firestore update
      updateSession(currentSession.id, {
        status: "active",
        violationCount: newCount,
      }).catch((err) => logger.warn("Failed to update violation count:", err));
    });

    // Persist session to Firestore (fire-and-forget). In production the
    // createSoloSession CF already wrote the canonical doc via admin SDK,
    // and the Firestore rule denies client-side creates, so we only write
    // here in DEMO_MODE where there's no CF round-trip.
    const userId = useAuthStore.getState().user?.id;
    if (DEMO_MODE && userId) {
      writeSession(session.id, {
        userId,
        cadence: session.cadence,
        stakeAmount: session.stakeAmount,
        potentialPayout: session.potentialPayout,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        status: "active",
        ...(AI_DATA_CAPTURE_ENABLED ? { startedAtLocalHour, dayOfWeek } : {}),
      }).catch((err) =>
        logger.error("Failed to persist session to Firestore:", err),
      );
    } else if (AI_DATA_CAPTURE_ENABLED && !DEMO_MODE) {
      // Prod: the createSoloSession CF already wrote the canonical doc, but it
      // can't derive the user's LOCAL hour. Add the time-of-day capture via a
      // fire-and-forget update (the sessions rule allowlists these benign keys).
      // Analytics only — never touches money/status; failure is non-fatal.
      updateSession(session.id, { startedAtLocalHour, dayOfWeek }).catch(
        (err) => logger.warn("Failed to persist session time-of-day:", err),
      );
    }

    logEvent("solo_session_started", {
      cadence,
      stakeAmount: session.stakeAmount,
    });
  },

  surrenderSession: (reason?: SurrenderReason, note?: string) => {
    const { currentSession, sessionHistory } = get();
    if (!currentSession) return;

    const completedAt = new Date();
    // Read shield tallies BEFORE the stopBlocking below (see helper docs).
    const blockedByCategory = captureBlockedByCategory();
    const completedSession: Session = {
      ...currentSession,
      status: "surrendered",
      completedAt,
      actualPayout: 0,
      ...(AI_DATA_CAPTURE_ENABLED && reason ? { surrenderReason: reason } : {}),
      ...(AI_DATA_CAPTURE_ENABLED && blockedByCategory
        ? { blockedByCategory }
        : {}),
    };

    const authStore = useAuthStore.getState();
    authStore.updateUser({
      currentStreak: 0,
      totalSessions: (authStore.user?.totalSessions || 0) + 1,
    });
    useWalletStore
      .getState()
      .recordForfeit(currentSession.stakeAmount, currentSession.id);

    // Stop Screen Time blocking (fire-and-forget)
    stopBlocking().catch((err) =>
      logger.warn("Screen Time stopBlocking (surrender) failed:", err),
    );
    endLiveActivity().catch((err) =>
      logger.warn("endLiveActivity (surrender) failed:", err),
    );
    cancelSessionEndNotification().catch(() => {});

    // Clean up violation listener
    _unsubViolation?.();
    _unsubViolation = null;

    set({
      currentSession: null,
      isBlocking: false,
      violationCount: 0,
      sessionHistory: [completedSession, ...sessionHistory],
    });

    // Status update path differs by mode:
    //   - DEMO_MODE: client writes status=surrendered directly (no CF).
    //   - prod: cloudForfeit's transaction does the update server-side.
    //     Writing here would race the CF's read — it would see status=
    //     surrendered and reject with 400 "Session is not active".
    if (DEMO_MODE) {
      updateSession(currentSession.id, {
        status: "surrendered",
        completedAt,
      }).catch((err) =>
        logger.error("Failed to update session in Firestore:", err),
      );
    } else {
      cloudForfeit(currentSession.id, currentSession.stakeAmount)
        .then((result) => {
          if (!result?.forgiven) return;
          const refunded = result.refundedCents ?? 0;
          if (refunded <= 0) return;
          useWalletStore.getState().deposit(refunded);
          useAuthStore.getState().updateUser({ firstSurrenderForgiven: true });
          set({ lastForgivenCents: refunded });
        })
        .catch((err) => logger.error("cloudForfeit failed:", err));
    }

    // AI Phase-0: persist the structured surrender reason (analytics only; no
    // money meaning). Separate fire-and-forget update from the forfeit money
    // path — the CF owns status; this only writes the allowlisted capture keys.
    if (AI_DATA_CAPTURE_ENABLED && reason) {
      const trimmed = note?.trim();
      updateSession(currentSession.id, {
        surrenderReason: reason,
        ...(trimmed ? { surrenderNote: trimmed.slice(0, 500) } : {}),
      }).catch((err) =>
        logger.warn("Failed to persist surrender reason:", err),
      );
    }

    logEvent("solo_session_surrendered", {
      cadence: currentSession.cadence,
      stakeAmount: currentSession.stakeAmount,
      ...(reason ? { surrenderReason: reason } : {}),
      ...violationCategoryProps(),
    });
  },

  completeSession: () => {
    const { currentSession, sessionHistory } = get();
    if (!currentSession) return;

    const payout = currentSession.potentialPayout;
    const completedAt = new Date();
    // Read shield tallies BEFORE the stopBlocking below (see helper docs).
    const blockedByCategory = captureBlockedByCategory();

    const completedSession: Session = {
      ...currentSession,
      status: "completed",
      completedAt,
      actualPayout: payout,
      ...(AI_DATA_CAPTURE_ENABLED && blockedByCategory
        ? { blockedByCategory }
        : {}),
    };

    const authStore = useAuthStore.getState();
    const newStreak = (authStore.user?.currentStreak || 0) + 1;
    authStore.updateUser({
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, authStore.user?.longestStreak || 0),
      totalSessions: (authStore.user?.totalSessions || 0) + 1,
      completedSessions: (authStore.user?.completedSessions || 0) + 1,
      // Net profit: payout minus stake already deducted at session start
      totalEarnings:
        (authStore.user?.totalEarnings || 0) +
        (payout - currentSession.stakeAmount),
    });
    useWalletStore.getState().creditPayout(payout, currentSession.id);

    // Stop Screen Time blocking (fire-and-forget)
    stopBlocking().catch((err) =>
      logger.warn("Screen Time stopBlocking (complete) failed:", err),
    );
    endLiveActivity().catch((err) =>
      logger.warn("endLiveActivity (complete) failed:", err),
    );
    cancelSessionEndNotification().catch(() => {});

    // Clean up violation listener
    _unsubViolation?.();
    _unsubViolation = null;

    set({
      currentSession: null,
      isBlocking: false,
      violationCount: 0,
      sessionHistory: [completedSession, ...sessionHistory],
    });

    // Status update path differs by mode (mirror surrenderSession):
    //   - DEMO_MODE: client writes status=completed directly (no CF).
    //   - prod: cloudComplete's transaction is the SOLE status writer (it marks
    //     status=completed + actualPayout atomically, index.ts handleSessionComplete).
    //     Writing status here would race the CF's read — it would see
    //     status=completed and reject with 400 "Session is not active", so the
    //     payout transaction would never run and the stake would never return.
    if (DEMO_MODE) {
      updateSession(currentSession.id, {
        status: "completed",
        completedAt,
      }).catch((err) =>
        logger.error("Failed to update session in Firestore:", err),
      );
    } else {
      cloudComplete(currentSession.id, currentSession.stakeAmount).catch(
        (err) => logger.error("cloudComplete failed:", err),
      );
    }

    logEvent("solo_session_completed", {
      cadence: currentSession.cadence,
      stakeAmount: currentSession.stakeAmount,
      payoutAmount: payout,
      ...violationCategoryProps(),
    });
  },

  getTimeRemaining: () => {
    const { currentSession } = get();
    if (!currentSession) return 0;

    const remaining = currentSession.endsAt.getTime() - Date.now();
    return Math.max(0, remaining);
  },

  recoverActiveSession: async (userId: string) => {
    const { currentSession } = get();
    // Don't recover if we already have an active session in memory
    if (currentSession || _isRecovering) return;

    _isRecovering = true;
    try {
      const activeSession = await getActiveSession(userId);
      if (!activeSession) return;

      // Check if the session has already expired
      if (activeSession.endsAt.getTime() <= Date.now()) {
        // Session expired while app was closed — auto-complete it
        const payout = activeSession.potentialPayout;
        const completedAt = new Date();

        const completedSession: Session = {
          id: activeSession.id,
          cadence: activeSession.cadence as CadenceType,
          stakeAmount: activeSession.stakeAmount,
          potentialPayout: activeSession.potentialPayout,
          startedAt: activeSession.startedAt,
          endsAt: activeSession.endsAt,
          status: "completed",
          completedAt,
          actualPayout: payout,
        };

        // Mark the session as completed in Firestore FIRST. If this fails
        // (e.g. network timeout), we skip the local payout so the next app
        // restart will find the same "active" session and retry — preventing
        // duplicate local credits.
        try {
          await updateSession(activeSession.id, {
            status: "completed",
            completedAt,
          });
        } catch (err) {
          logger.error("Failed to auto-complete expired session:", err);
          // Firestore still has status: "active", so the next restart will
          // retry. Don't credit the payout locally to avoid double-counting.
          return;
        }

        const authStore = useAuthStore.getState();
        const newStreak = (authStore.user?.currentStreak || 0) + 1;
        authStore.updateUser({
          currentStreak: newStreak,
          longestStreak: Math.max(
            newStreak,
            authStore.user?.longestStreak || 0,
          ),
          totalSessions: (authStore.user?.totalSessions || 0) + 1,
          completedSessions: (authStore.user?.completedSessions || 0) + 1,
          totalEarnings:
            (authStore.user?.totalEarnings || 0) +
            (payout - activeSession.stakeAmount),
        });
        useWalletStore.getState().creditPayout(payout, activeSession.id);

        set((state) => ({
          sessionHistory: [completedSession, ...state.sessionHistory],
        }));

        // Clear any shields that lingered because the DeviceActivityMonitor
        // schedule isn't wired to the session duration yet — without these
        // calls the user reopens Niyah to find apps still blocked.
        stopBlocking().catch((err) =>
          logger.warn("stopBlocking (recovery) failed:", err),
        );
        endLiveActivity().catch(() => {});
        cancelSessionEndNotification().catch(() => {});

        if (!DEMO_MODE) {
          cloudComplete(activeSession.id, activeSession.stakeAmount).catch(
            (err) => logger.error("cloudComplete (recovery) failed:", err),
          );
        }
        return;
      }

      // Session is still active — restore it
      const restoredSession: Session = {
        id: activeSession.id,
        cadence: activeSession.cadence as CadenceType,
        stakeAmount: activeSession.stakeAmount,
        potentialPayout: activeSession.potentialPayout,
        startedAt: activeSession.startedAt,
        endsAt: activeSession.endsAt,
        status: "active",
      };

      set({ currentSession: restoredSession, isBlocking: true });
    } catch (error) {
      logger.error("Failed to recover active session:", error);
    } finally {
      _isRecovering = false;
    }
  },

  reset: () => {
    _unsubViolation?.();
    _unsubViolation = null;
    // Logout hygiene: don't leave a stale staked context that would show
    // forfeit copy on the next account's free blocks.
    clearSessionContext().catch(() => {});
    set({
      currentSession: null,
      sessionHistory: [],
      isBlocking: false,
      violationCount: 0,
      lastForgivenCents: null,
    });
  },
}));
