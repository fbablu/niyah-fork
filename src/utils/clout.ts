import type { Session } from "../types";
import { hasStake, inspectGroupDoc, isRecord } from "./cloutDerive";

/**
 * Clout scoring — pure logic for the profile-tab redesign. Replaces the
 * "social credit" PRESENTATION (docs/profile-redesign-brief.md, comment 7).
 * Only COMPLETED sessions earn Clout; quitting earns nothing (self-balancing,
 * no punitive term).
 */

export interface CloutCounters {
  soloNone: number; // completed, unstaked, alone
  soloStake: number; // completed, staked, alone
  groupNone: number; // completed group, unstaked (or staked but < 2 people)
  groupStaked: number; // completed group, staked AND >= 2 participants
  distinctFriends: number; // unique other-participant uids completed-with
}

/**
 * Single source of the tunable scoring knobs.
 *
 * OPEN KNOB (Fardeen — brief comment 7): the soloStake (3) vs groupNone (4)
 * ORDERING is explicitly undecided ("even one more person is better than just
 * a solo stake version, I believe?"). Re-ordering is a single-constant swap.
 * friendBonusFactor: bonus = round(factor·√distinctFriends) — rewards breadth,
 * stops one-friend farming.
 */
export const CLOUT_WEIGHTS = {
  soloNone: 1,
  soloStake: 3,
  groupNone: 4,
  groupStaked: 8,
  friendBonusFactor: 4,
} as const;

/** Defensive: non-finite or negative counts collapse to 0 (never NaN). */
function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/**
 * Clout = 1·soloNone + 3·soloStake + 4·groupNone + 8·groupStaked
 *         + round(4·√distinctFriends)
 */
export function computeCloutScore(c: CloutCounters): number {
  const base =
    CLOUT_WEIGHTS.soloNone * asCount(c?.soloNone) +
    CLOUT_WEIGHTS.soloStake * asCount(c?.soloStake) +
    CLOUT_WEIGHTS.groupNone * asCount(c?.groupNone) +
    CLOUT_WEIGHTS.groupStaked * asCount(c?.groupStaked);
  return (
    base +
    Math.round(
      CLOUT_WEIGHTS.friendBonusFactor * Math.sqrt(asCount(c?.distinctFriends)),
    )
  );
}

export interface CloutTier {
  key: "newcomer" | "committed" | "trusted" | "innerCircle";
  label: string;
  min: number;
  max: number | null; // null = unbounded top tier
}

/** Tunable bands (brief): Trusted = feature betas, Inner Circle = first access. */
export const CLOUT_TIERS: CloutTier[] = [
  { key: "newcomer", label: "Newcomer", min: 0, max: 49 },
  { key: "committed", label: "Committed", min: 50, max: 149 },
  { key: "trusted", label: "Trusted", min: 150, max: 399 },
  { key: "innerCircle", label: "Inner Circle", min: 400, max: null },
];

export function getCloutTier(score: number): CloutTier {
  const s = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  for (let i = CLOUT_TIERS.length - 1; i >= 0; i--) {
    if (s >= CLOUT_TIERS[i].min) return CLOUT_TIERS[i];
  }
  return CLOUT_TIERS[0];
}

/** 0..1 progress within the current tier; the unbounded top tier pins to 1. */
export function getCloutProgress(score: number): number {
  const s = Number.isFinite(score) ? Math.max(0, score) : 0;
  const tier = getCloutTier(s);
  if (tier.max === null) return 1;
  const span = tier.max + 1 - tier.min; // next tier's min − this tier's min
  return Math.min(1, Math.max(0, (s - tier.min) / span));
}

/**
 * Derives CloutCounters from local histories. Never throws, never NaN —
 * Clout is presentation-layer; a malformed legacy doc must not crash profile.
 * Group-history docs may be EITHER Firestore `GroupSessionDoc`s or legacy
 * in-memory `GroupSession`s (see ./cloutDerive.ts).
 */
export function deriveCloutCounters(input: {
  soloHistory: Session[];
  groupHistory: unknown[];
  uid: string;
  fallbackCompletedSessions?: number;
}): CloutCounters {
  const counters: CloutCounters = {
    soloNone: 0,
    soloStake: 0,
    groupNone: 0,
    groupStaked: 0,
    distinctFriends: 0,
  };
  try {
    const solo = Array.isArray(input?.soloHistory) ? input.soloHistory : [];
    const group = Array.isArray(input?.groupHistory) ? input.groupHistory : [];
    const uid = typeof input?.uid === "string" ? input.uid : "";

    for (const session of solo) {
      if (!isRecord(session) || session.status !== "completed") continue;
      if (hasStake(session.stakeAmount)) counters.soloStake += 1;
      else counters.soloNone += 1;
    }

    const friends = new Set<string>();
    for (const raw of group) {
      if (!isRecord(raw)) continue;
      const facts = inspectGroupDoc(raw, uid);
      if (!facts.completedByMe) continue;
      if (facts.staked && facts.participantCount >= 2) counters.groupStaked++;
      else counters.groupNone++;
      for (const id of facts.otherIds) friends.add(id);
    }
    counters.distinctFriends = friends.size;

    // Best-effort floor: the profile doc's lifetime completedSessions count
    // survives reinstalls while local histories start empty. Stake/group
    // splits are unrecoverable there, so credit them at the lowest weight.
    if (solo.length === 0 && group.length === 0) {
      counters.soloNone = asCount(input?.fallbackCompletedSessions);
    }
  } catch {
    // Swallow — partial counters beat a crashed profile tab.
  }
  return counters;
}
