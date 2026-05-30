import { GroupSessionDoc, SessionParticipant } from "../types";
import { SOLO_COMPLETION_MULTIPLIER } from "../constants/config";

export interface ParticipantResult {
  userId: string;
  completed: boolean;
  screenTime?: number; // ms of phone usage during session
}

export interface ParticipantPayout {
  userId: string;
  payout: number; // in cents
}

// Shape of a single peer transfer. Retained only as the typed return of
// calculateTransfers, which is always [] post de-pool — no peer-to-peer money.
export interface TransferDraft {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number; // in cents, always positive
}

/**
 * Calculate payouts for a completed session.
 *
 * Individual stakes, NOT a wager pool — solo and group settle identically:
 *   - A completer gets their OWN stake back, times the house-funded completion
 *     multiplier (SOLO_COMPLETION_MULTIPLIER, dormant at 1.0 → exact stake).
 *   - A non-completer forfeits their stake to the house.
 *   - Stakes are NEVER redistributed to other participants. Pooling a loser's
 *     stake onto winners would be a wager — a Stripe/Apple gambling-
 *     classification risk and strict-state gambling exposure.
 *
 * Mirror of the authoritative server settlement in functions/src/security.ts
 * `calculateGroupSessionPayouts`. Keep the two in lockstep — and use the same
 * Math.round on the multiplier so client projections never promise a cent the
 * server won't pay.
 */
export const calculatePayouts = (
  stakePerParticipant: number,
  results: ParticipantResult[],
): ParticipantPayout[] => {
  const perCompleter = Math.round(
    stakePerParticipant * SOLO_COMPLETION_MULTIPLIER,
  );
  return results.map((r) => ({
    userId: r.userId,
    payout: r.completed ? perCompleter : 0,
  }));
};

/**
 * De-pooled sessions have NO inter-player transfers: a completer keeps their
 * own stake and a non-completer forfeits to the house, so no participant ever
 * owes another. Always returns []. Retained as the typed seam that
 * `completeGroupSession` consumes — previously a greedy pool-settlement solver,
 * removed with the de-pool so peer-to-peer money movement can't resurrect.
 */
export const calculateTransfers = (
  _participants: Pick<SessionParticipant, "userId" | "name" | "stakeAmount">[],
  _payouts: ParticipantPayout[],
): TransferDraft[] => {
  return [];
};

export interface OptimisticPayoutRow {
  userId: string;
  // What this participant gets back if they complete: their OWN stake × the
  // (dormant) completion multiplier. Surrendered participants get 0.
  estimatedPayout: number; // in cents
  // 1 while still in the run (own stake returned on completion), 0 once
  // surrendered. NOT a share of a pool — there is no pool to share.
  share: number; // 0 or 1
  status: "focused" | "completed" | "surrendered";
}

/**
 * Live, optimistic payout preview shown on the active-session leaderboard.
 *
 * De-pooled: each participant's projection is simply their OWN stake back
 * (× the dormant multiplier) while they remain in the run. It does NOT grow
 * when someone else surrenders — forfeits go to the house, never to other
 * players. Mirrors `calculatePayouts`; the server runs the authoritative
 * settlement at completion.
 */
export const optimisticGroupPayouts = (
  session: Pick<GroupSessionDoc, "stakePerParticipant" | "participants">,
): OptimisticPayoutRow[] => {
  const perCompleter = Math.round(
    session.stakePerParticipant * SOLO_COMPLETION_MULTIPLIER,
  );

  return Object.entries(session.participants ?? {}).map(([userId, p]) => {
    const inRun = !p.surrendered; // still focused, or already completed
    return {
      userId,
      estimatedPayout: inRun ? perCompleter : 0,
      share: inRun ? 1 : 0,
      status: p.completed
        ? "completed"
        : p.surrendered
          ? "surrendered"
          : "focused",
    };
  });
};
