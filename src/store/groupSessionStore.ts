import { create } from "zustand";
import {
  GroupSession,
  GroupSessionDoc,
  GroupSessionParticipant,
  GroupSessionStatus,
  GroupInvite,
  GroupInviteStatus,
  GroupLeaderboardEntry,
  SessionParticipant,
  CadenceType,
  UserReputation,
} from "../types";
import {
  CADENCES,
  DEMO_MODE,
  USE_SHORT_TIMERS,
  SOLO_COMPLETION_MULTIPLIER,
} from "../constants/config";
import { useAuthStore } from "./authStore";
import { useWalletStore } from "./walletStore";
import { calculatePayouts, ParticipantResult } from "../utils/payoutAlgorithm";
import { generateId } from "../utils/id";
import {
  createGroupSession as cloudCreateGroupSession,
  respondToGroupInvite as cloudRespondToGroupInvite,
  markOnlineForSession as cloudMarkOnline,
  startGroupSessionCF as cloudStartSession,
  reportSessionStatus as cloudReportStatus,
  cancelGroupSession as cloudCancelSession,
  getGroupLeaderboard as cloudGetGroupLeaderboard,
} from "../config/functions";
import {
  subscribeToGroupSession,
  subscribeToGroupInvites,
  subscribeToActiveGroupSessions,
} from "../config/firebase";
import { logger } from "../utils/logger";
import {
  setSessionContext,
  clearSessionContext,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  stopBlocking,
  getSavedAppBlockSummary,
} from "../config/screentime";
import {
  scheduleSessionEndNotification,
  cancelSessionEndNotification,
} from "../config/notifications";
import type { LiveActivityLeaderboardEntry } from "../../modules/niyah-screentime";

// Participants are provided without the fields the store sets internally.
type NewParticipant = Omit<
  SessionParticipant,
  "stakeAmount" | "completed" | "screenTime" | "payout"
>;

// ─── Firestore data parsing helpers ──────────────────────────────────────────

function parseTimestamp(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === "number") return new Date(val);
  return undefined;
}

function parseParticipants(
  raw: Record<string, unknown> | undefined,
): Record<string, GroupSessionParticipant> {
  if (!raw) return {};
  const result: Record<string, GroupSessionParticipant> = {};
  for (const [uid, data] of Object.entries(raw)) {
    const p = data as Record<string, unknown>;
    result[uid] = {
      name: (p.name as string) ?? "",
      profileImage: p.profileImage as string | undefined,
      reputation: ((p.reputation as UserReputation) ?? {
        score: 50,
        level: "sapling",
        paymentsCompleted: 0,
        paymentsMissed: 0,
        totalOwedPaid: 0,
        totalOwedMissed: 0,
        lastUpdated: new Date(),
      }) as UserReputation,
      accepted: (p.accepted as boolean) ?? false,
      online: (p.online as boolean) ?? false,
      completed: p.completed as boolean | undefined,
      surrendered: p.surrendered as boolean | undefined,
      surrenderedAt: parseTimestamp(p.surrenderedAt),
      violationCount: (p.violationCount as number) ?? 0,
      // Server-written (CF-sanitized) block summary + stake-mode. MUST be
      // carried through here — the waiting-room start-gate reads
      // participant.appBlockSummary, so dropping it would make
      // everyoneHasBlockSelection permanently false (proposer can never start).
      appBlockSummary:
        p.appBlockSummary as GroupSessionParticipant["appBlockSummary"],
      stakeMode: p.stakeMode as GroupSessionParticipant["stakeMode"],
    };
  }
  return result;
}

function parseGroupSessionDoc(data: Record<string, unknown>): GroupSessionDoc {
  return {
    id: (data.__id as string) || (data.id as string),
    proposerId: data.proposerId as string,
    status: data.status as GroupSessionStatus,
    cadence: data.cadence as CadenceType,
    stakePerParticipant: data.stakePerParticipant as number,
    customStake: (data.customStake as boolean) ?? false,
    duration: data.duration as number,
    participantIds: (data.participantIds as string[]) ?? [],
    participants: parseParticipants(
      data.participants as Record<string, unknown>,
    ),
    poolTotal: data.poolTotal as number,
    startedAt: parseTimestamp(data.startedAt),
    endsAt: parseTimestamp(data.endsAt),
    completedAt: parseTimestamp(data.completedAt),
    payouts: data.payouts as Record<string, number> | undefined,
    createdAt: parseTimestamp(data.createdAt) ?? new Date(),
    updatedAt: parseTimestamp(data.updatedAt) ?? new Date(),
    autoTimeoutAt: parseTimestamp(data.autoTimeoutAt),
  };
}

function parseGroupInvite(data: Record<string, unknown>): GroupInvite {
  return {
    id: (data.__id as string) || (data.id as string),
    sessionId: data.sessionId as string,
    fromUserId: data.fromUserId as string,
    fromUserName: data.fromUserName as string,
    fromUserImage: data.fromUserImage as string | undefined,
    toUserId: data.toUserId as string,
    stake: data.stake as number,
    cadence: data.cadence as CadenceType,
    duration: data.duration as number,
    status: data.status as GroupInviteStatus,
    createdAt: parseTimestamp(data.createdAt) ?? new Date(),
    respondedAt: parseTimestamp(data.respondedAt),
  };
}

// ─── Unsubscribe tracking (outside Zustand to avoid serialization issues) ───

let _unsubSession: (() => void) | null = null;
let _subscribedSessionId: string | null = null;
let _unsubInvites: (() => void) | null = null;
let _subscribedInvitesUid: string | null = null;
let _unsubActiveSessions: (() => void) | null = null;
let _subscribedActiveSessionsUid: string | null = null;

// ─── Live Activity transition tracking ──────────────────────────────────────
// Tracks the last status we mirrored to the iOS Live Activity so we know
// when to call start (null → active) vs update (active tick) vs end (active
// → terminal). Lives outside the store because it represents an external
// side-effect handle, not user-visible state.
let _liveActivityStartedFor: string | null = null;

function buildLeaderboard(
  doc: GroupSessionDoc,
): LiveActivityLeaderboardEntry[] {
  return Object.values(doc.participants)
    .map((p) => ({
      name: p.name || "Friend",
      status: p.surrendered
        ? ("surrendered" as const)
        : p.completed
          ? ("completed" as const)
          : ("active" as const),
      violations: p.violationCount ?? 0,
    }))
    .slice(0, 3);
}

function optimisticUserPayoutCents(doc: GroupSessionDoc): number {
  const myId = useAuthStore.getState().user?.id;
  if (!myId) return 0;
  const me = doc.participants[myId];
  if (!me || me.surrendered) return 0;
  // De-pooled: a completer gets their OWN stake back (× the dormant completion
  // multiplier), NEVER a share of a pool. Does not grow when others surrender.
  // The Cloud Function runs the authoritative settlement on completion.
  return Math.round(doc.stakePerParticipant * SOLO_COMPLETION_MULTIPLIER);
}

/**
 * Reflect each Firestore session-doc update to the iOS Live Activity.
 * Start on first "active" transition, update on subsequent ticks, end
 * when the session leaves "active". The native side is a no-op when
 * Lane B is disabled or ActivityKit isn't available.
 */
function mirrorToLiveActivity(doc: GroupSessionDoc): void {
  const endsAtSec = doc.endsAt ? doc.endsAt.getTime() / 1000 : 0;
  if (!endsAtSec) {
    // No endsAt means session hasn't started — nothing to mirror yet.
    return;
  }

  const isActive = doc.status === "active";
  const leaderboard = buildLeaderboard(doc);
  const userPayoutCents = optimisticUserPayoutCents(doc);

  if (isActive && _liveActivityStartedFor !== doc.id) {
    const userColor =
      useAuthStore.getState().user?.blobAvatar?.colorPreset ?? "forest";
    _liveActivityStartedFor = doc.id;
    startLiveActivity({
      sessionId: doc.id,
      sessionType: "group",
      blobAssetName: `blob_${userColor}`,
      endsAt: endsAtSec,
      leaderboard,
      userPayoutCents,
    }).catch((err) => logger.warn("startLiveActivity (group) failed:", err));
    return;
  }

  if (isActive && _liveActivityStartedFor === doc.id) {
    updateLiveActivity({
      endsAt: endsAtSec,
      leaderboard,
      userPayoutCents,
    }).catch((err) => logger.warn("updateLiveActivity (group) failed:", err));
    return;
  }

  if (!isActive && _liveActivityStartedFor === doc.id) {
    _liveActivityStartedFor = null;
    endLiveActivity().catch((err) =>
      logger.warn("endLiveActivity (group) failed:", err),
    );
  }
}

// ─── Store interface ────────────────────────────────────────────────────────

interface GroupSessionState {
  // Real-time synced from Firestore
  activeSession: GroupSessionDoc | null;
  pendingInvites: GroupInvite[];
  activeGroupSessions: GroupSessionDoc[];

  // Computed (non-real-time) group leaderboard — fetched on demand, cached.
  leaderboard: GroupLeaderboardEntry[] | null;
  leaderboardLoading: boolean;

  // Legacy local-only state (keep for backward compat with existing screens)
  activeGroupSession: GroupSession | null;
  groupSessionHistory: GroupSession[];

  // Subscription management
  subscribeToInvites: (userId: string) => void;
  subscribeToSession: (sessionId: string) => void;
  subscribeToActiveSessions: (userId: string) => void;
  unsubscribeAll: () => void;

  // Cloud Function actions
  proposeSession: (params: {
    cadence: CadenceType;
    stakePerParticipant: number;
    duration: number;
    inviteeIds: string[];
    customStake?: boolean;
  }) => Promise<string>;

  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  markOnline: (sessionId: string) => Promise<boolean>;
  startSession: (sessionId: string) => Promise<void>;
  reportCompletion: (sessionId: string) => Promise<void>;
  reportSurrender: (sessionId: string) => Promise<void>;
  cancelSession: (sessionId: string) => Promise<void>;
  fetchGroupLeaderboard: () => Promise<void>;

  // Legacy lifecycle (keep for backward compat, wraps new Cloud Function calls)
  startGroupSession: (
    cadence: CadenceType,
    participants: NewParticipant[],
    customDurationMs?: number,
  ) => void;
  completeGroupSession: (
    results: ParticipantResult[],
  ) => GroupSession | undefined;
  getTimeRemaining: () => number;

  reset: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useGroupSessionStore = create<GroupSessionState>((set, get) => ({
  // Real-time state
  activeSession: null,
  pendingInvites: [],
  activeGroupSessions: [],
  leaderboard: null,
  leaderboardLoading: false,

  // Legacy state
  activeGroupSession: null,
  groupSessionHistory: [],

  // ─── Subscription management ──────────────────────────────────────────────

  subscribeToSession: (sessionId: string) => {
    // Idempotent: same id, reuse existing subscription. Prevents teardown /
    // recreate churn on every component re-render.
    if (_subscribedSessionId === sessionId && _unsubSession) return;
    if (_unsubSession) {
      _unsubSession();
      _unsubSession = null;
    }
    _subscribedSessionId = sessionId;
    _unsubSession = subscribeToGroupSession(sessionId, (data) => {
      if (data) {
        const doc = parseGroupSessionDoc(data);
        set({ activeSession: doc });
        mirrorToLiveActivity(doc);
      } else {
        set({ activeSession: null });
        if (_liveActivityStartedFor) {
          endLiveActivity().catch(() => {});
          _liveActivityStartedFor = null;
        }
      }
    });
  },

  subscribeToInvites: (userId: string) => {
    if (_subscribedInvitesUid === userId && _unsubInvites) return;
    if (_unsubInvites) {
      _unsubInvites();
      _unsubInvites = null;
    }
    _subscribedInvitesUid = userId;
    _unsubInvites = subscribeToGroupInvites(userId, (rawInvites) => {
      const invites = rawInvites.map(parseGroupInvite);
      set({ pendingInvites: invites });
    });
  },

  subscribeToActiveSessions: (userId: string) => {
    if (_subscribedActiveSessionsUid === userId && _unsubActiveSessions) return;
    if (_unsubActiveSessions) {
      _unsubActiveSessions();
      _unsubActiveSessions = null;
    }
    _subscribedActiveSessionsUid = userId;
    _unsubActiveSessions = subscribeToActiveGroupSessions(
      userId,
      (rawSessions) => {
        const sessions = rawSessions.map(parseGroupSessionDoc);
        set({ activeGroupSessions: sessions });
      },
    );
  },

  unsubscribeAll: () => {
    if (_unsubSession) {
      _unsubSession();
      _unsubSession = null;
    }
    _subscribedSessionId = null;
    if (_unsubInvites) {
      _unsubInvites();
      _unsubInvites = null;
    }
    _subscribedInvitesUid = null;
    if (_unsubActiveSessions) {
      _unsubActiveSessions();
      _unsubActiveSessions = null;
    }
    _subscribedActiveSessionsUid = null;
    set({
      activeSession: null,
      pendingInvites: [],
      activeGroupSessions: [],
    });
  },

  // ─── Cloud Function actions ───────────────────────────────────────────────

  proposeSession: async (params) => {
    // Attach this device's own block summary (display + start-gate). Derived
    // from the saved selection so it always matches what actually gets blocked.
    const result = await cloudCreateGroupSession(
      params.cadence,
      params.stakePerParticipant,
      params.duration,
      params.inviteeIds,
      params.customStake,
      getSavedAppBlockSummary(),
    );
    return result.sessionId;
  },

  acceptInvite: async (inviteId: string) => {
    await cloudRespondToGroupInvite(inviteId, true, getSavedAppBlockSummary());
  },

  declineInvite: async (inviteId: string) => {
    await cloudRespondToGroupInvite(inviteId, false);
  },

  markOnline: async (sessionId: string) => {
    const result = await cloudMarkOnline(sessionId);
    return result.allOnline;
  },

  startSession: async (sessionId: string) => {
    await cloudStartSession(sessionId);
  },

  reportCompletion: async (sessionId: string) => {
    await cloudReportStatus(sessionId, "complete");
  },

  reportSurrender: async (sessionId: string) => {
    await cloudReportStatus(sessionId, "surrender");
  },

  cancelSession: async (sessionId: string) => {
    await cloudCancelSession(sessionId);
  },

  fetchGroupLeaderboard: async () => {
    set({ leaderboardLoading: true });
    try {
      const { standings } = await cloudGetGroupLeaderboard();
      set({ leaderboard: standings, leaderboardLoading: false });
    } catch (err) {
      logger.warn("fetchGroupLeaderboard failed:", err);
      set({ leaderboardLoading: false });
    }
  },

  // ─── Legacy lifecycle (backward compat) ───────────────────────────────────

  startGroupSession: (cadence, participants, customDurationMs) => {
    const isSoloSession = participants.length <= 1;

    // In live mode, keep the local legacy path for solo sessions until the
    // dedicated solo backend flow is wired back into the current screens.
    if (!DEMO_MODE && !isSoloSession) {
      logger.warn(
        "startGroupSession called in live mode — use proposeSession instead",
      );
      return;
    }

    const { activeGroupSession } = get();
    if (activeGroupSession) {
      throw new Error(
        "A group session is already active. Complete or surrender it first.",
      );
    }

    const config = CADENCES[cadence];
    const duration =
      customDurationMs ??
      (USE_SHORT_TIMERS ? config.demoDuration : config.duration);
    const stake = customDurationMs !== undefined ? 0 : config.stake;

    const fullParticipants: SessionParticipant[] = participants.map((p) => ({
      ...p,
      stakeAmount: stake,
    }));

    const session: GroupSession = {
      id: generateId(),
      cadence,
      stakePerParticipant: stake,
      poolTotal: stake * fullParticipants.length,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + duration),
      status: "active",
      participants: fullParticipants,
    };

    // Only deduct from the current user's wallet; remote participants manage their own wallets.
    if (stake > 0) {
      useWalletStore.getState().deductStake(stake, session.id);
    }

    set({ activeGroupSession: session });

    // Local notification at session.endsAt — fires whether the app is in the
    // foreground, backgrounded, or terminated. Cancelled on early end below.
    scheduleSessionEndNotification(
      session.endsAt,
      isSoloSession
        ? "Your focus block is up."
        : "Your group session is up — tap to see results.",
    ).catch((err) =>
      logger.warn("scheduleSessionEndNotification (group) failed:", err),
    );

    // Start Live Activity (lock screen banner). The legacy startGroupSession
    // path is what quick-block + non-Firestore solo sessions use, so without
    // this call those flows never get a Live Activity. New live-mode
    // (mirrorToLiveActivity) handles its own start when a Firestore doc lands.
    {
      const myId = useAuthStore.getState().user?.id;
      const me = fullParticipants.find((p) => p.userId === myId);
      const userColor =
        useAuthStore.getState().user?.blobAvatar?.colorPreset ?? "forest";
      const leaderboard = fullParticipants.slice(0, 3).map((p) => ({
        name: p.name || "Friend",
        status: "active" as const,
        violations: 0,
      }));
      startLiveActivity({
        sessionId: session.id,
        sessionType: isSoloSession ? "solo" : "group",
        blobAssetName: `blob_${userColor}`,
        endsAt: session.endsAt.getTime() / 1000,
        leaderboard: isSoloSession ? [] : leaderboard,
        userPayoutCents: me?.stakeAmount ?? 0,
      }).catch((err) =>
        logger.warn("startLiveActivity (group legacy) failed:", err),
      );
    }

    // Sync participant names + stake to shared UserDefaults so the shield
    // extension can show dynamic messages like "Sarah and Mike are watching."
    if (fullParticipants.length > 1) {
      const myId = useAuthStore.getState().user?.id;
      const otherNames = fullParticipants
        .filter((p) => p.userId !== myId)
        .map((p) => p.name || "Friend");
      setSessionContext({
        names: otherNames,
        stake,
        type: "group",
      }).catch(() => {});
    }
  },

  completeGroupSession: (results) => {
    const { activeGroupSession, groupSessionHistory } = get();
    if (!activeGroupSession) return undefined;

    const currentUserId = useAuthStore.getState().user?.id;

    const participantsWithResults: SessionParticipant[] =
      activeGroupSession.participants.map((p) => {
        const result = results.find((r) => r.userId === p.userId);
        return {
          ...p,
          completed: result?.completed ?? false,
          screenTime: result?.screenTime,
        };
      });

    const payouts = calculatePayouts(
      activeGroupSession.stakePerParticipant,
      results,
    );

    const finalParticipants: SessionParticipant[] = participantsWithResults.map(
      (p) => ({
        ...p,
        payout:
          payouts.find((pay) => pay.userId === p.userId)?.payout ??
          p.stakeAmount,
      }),
    );

    const currentUserResult = results.find((r) => r.userId === currentUserId);
    const didComplete = currentUserResult?.completed ?? false;

    const completedSession: GroupSession = {
      ...activeGroupSession,
      status: didComplete ? "completed" : "surrendered",
      completedAt: new Date(),
      participants: finalParticipants,
    };

    if (currentUserId) {
      const currentUserPayout =
        payouts.find((p) => p.userId === currentUserId)?.payout ??
        activeGroupSession.stakePerParticipant;

      if (didComplete) {
        useWalletStore
          .getState()
          .creditPayout(currentUserPayout, activeGroupSession.id);
      } else {
        useWalletStore
          .getState()
          .recordForfeit(
            activeGroupSession.stakePerParticipant,
            activeGroupSession.id,
          );
      }

      const authStore = useAuthStore.getState();
      if (didComplete) {
        const newStreak = (authStore.user?.currentStreak ?? 0) + 1;
        // Net profit only: the stake was already deducted at session start,
        // so earnings = payout received minus the stake we put in.
        const netProfit =
          currentUserPayout - activeGroupSession.stakePerParticipant;
        authStore.updateUser({
          currentStreak: newStreak,
          longestStreak: Math.max(
            newStreak,
            authStore.user?.longestStreak ?? 0,
          ),
          totalSessions: (authStore.user?.totalSessions ?? 0) + 1,
          completedSessions: (authStore.user?.completedSessions ?? 0) + 1,
          totalEarnings: (authStore.user?.totalEarnings ?? 0) + netProfit,
        });
      } else {
        // Surrendered: stake was already deducted at session start.
        authStore.updateUser({
          currentStreak: 0,
          totalSessions: (authStore.user?.totalSessions ?? 0) + 1,
        });
      }
    }

    // Clear dynamic shield context now that the session is over
    clearSessionContext().catch(() => {});

    // Clear shields + pending session-end notification. completeGroupSession
    // may be called from app-background paths (recovery on cold open, push
    // tap), so we can't rely on active.tsx's onComplete to drop the shield.
    stopBlocking().catch((err) =>
      logger.warn("stopBlocking (group complete) failed:", err),
    );
    endLiveActivity().catch(() => {});
    cancelSessionEndNotification().catch(() => {});

    set({
      activeGroupSession: null,
      groupSessionHistory: [completedSession, ...groupSessionHistory],
    });

    return completedSession;
  },

  getTimeRemaining: () => {
    const { activeGroupSession } = get();
    if (!activeGroupSession) return 0;
    return Math.max(0, activeGroupSession.endsAt.getTime() - Date.now());
  },

  // ─── Utilities ──────────────────────────────────────────────────────────────

  reset: () => {
    clearSessionContext().catch(() => {});
    set({
      // Firestore-backed state
      activeSession: null,
      pendingInvites: [],
      activeGroupSessions: [],
      leaderboard: null,
      leaderboardLoading: false,
      // Legacy local state
      activeGroupSession: null,
      groupSessionHistory: [],
    });
    // Note: subscriptions (_unsubSession etc.) are torn down by unsubscribeAll(),
    // which is called separately in the logout flow.
  },
}));
