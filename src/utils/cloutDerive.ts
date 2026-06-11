/**
 * Internal history-shape parsing for Clout derivation (see ./clout.ts —
 * the public Clout API lives there). Pure, defensive, throw-free helpers.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Stake amounts are integer cents; non-finite/negative reads as unstaked. */
export function hasStake(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export interface GroupDocFacts {
  completedByMe: boolean;
  staked: boolean;
  participantCount: number;
  otherIds: string[];
}

/**
 * Reads BOTH group-history shapes defensively:
 * - Firestore `GroupSessionDoc`: participants is a Record keyed by uid
 *   (+ `participantIds`); doc.status is the GROUP's status.
 * - Legacy in-memory `GroupSession`: participants is a SessionParticipant[]
 *   with `userId` fields; doc.status is from the CURRENT USER's perspective.
 */
export function inspectGroupDoc(
  doc: Record<string, unknown>,
  uid: string,
): GroupDocFacts {
  const otherIds = new Set<string>();
  let completedByMe = false;
  let staked = hasStake(doc.stakePerParticipant);
  let participantCount = 0;

  const participants = doc.participants;
  if (Array.isArray(participants)) {
    let foundMe = false;
    for (const entry of participants) {
      if (!isRecord(entry)) continue;
      participantCount += 1;
      const pid = typeof entry.userId === "string" ? entry.userId : "";
      if (!pid) continue;
      if (pid !== uid) otherIds.add(pid);
      else {
        foundMe = true;
        completedByMe = entry.completed === true;
        if (hasStake(entry.stakeAmount)) staked = true;
      }
    }
    // Legacy user-perspective status — trust it only when my row is missing.
    if (!foundMe && doc.status === "completed") completedByMe = true;
  } else if (isRecord(participants)) {
    for (const [pid, p] of Object.entries(participants)) {
      participantCount += 1;
      if (pid !== uid) otherIds.add(pid);
      else if (isRecord(p)) completedByMe = p.completed === true;
    }
  }

  // participantIds (rules/queries) recovers membership when the map is partial.
  if (Array.isArray(doc.participantIds)) {
    const ids = doc.participantIds.filter(
      (id): id is string => typeof id === "string",
    );
    participantCount = Math.max(participantCount, ids.length);
    for (const id of ids) if (id !== uid) otherIds.add(id);
  }

  return { completedByMe, staked, participantCount, otherIds: [...otherIds] };
}
