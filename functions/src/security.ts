import { timingSafeEqual } from "node:crypto";

export interface GroupSessionPayoutParticipant {
  completed?: boolean;
}

// ─── Admin key (constant-time) ──────────────────────────────────────────────

/**
 * Constant-time admin key comparison. Returns true iff `provided` matches
 * `expected`, both are non-empty strings, and the secret has at least the
 * minimum length. Length pre-check is leak-safe — the worst signal is
 * "secret is short", and a short secret is rejected anyway.
 */
export function compareAdminKey(
  provided: unknown,
  expected: unknown,
): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── App Check token gate ────────────────────────────────────────────────────

export type AppCheckVerifier = (token: string) => Promise<void>;

/**
 * Pure-ish App Check gate, separated from `admin.appCheck()` so unit tests
 * can inject a stub verifier. Returns void on success, throws otherwise.
 *
 *   - missing / non-string / "skip-dev" → "App Check attestation required"
 *   - verifier rejects → "Invalid App Check token"
 */
export async function evaluateAppCheckToken(
  rawToken: unknown,
  verify: AppCheckVerifier,
): Promise<void> {
  if (!rawToken || typeof rawToken !== "string" || rawToken === "skip-dev") {
    throw new Error("App Check attestation required");
  }
  try {
    await verify(rawToken);
  } catch (err) {
    console.warn("app_check_verify_failed:", err);
    throw new Error("Invalid App Check token");
  }
}

export type ReferralClaimDecision =
  | { status: "claim" }
  | { status: "already_claimed"; sameReferrer: boolean };

export function isValidFirebaseUid(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9]{1,128}$/.test(value);
}

/**
 * Group sessions are INDIVIDUAL stakes, not a pool. Each completer gets their
 * OWN stake back (times an optional house-funded completion multiplier).
 * Non-completers forfeit their stake to the house — it is NEVER redistributed
 * to other participants. Redistributing losers' stakes to winners would be a
 * wagering pool: a Stripe/Apple gambling-classification risk and strict-state
 * gambling exposure (see docs/may-26-resume.md). The completion multiplier (>1)
 * is house-funded surplus, gated like solo earnings; it defaults to 1 (stake
 * returned, no surplus) so it ships dormant.
 */
export function calculateGroupSessionPayouts(
  participantIds: string[],
  participants: Record<string, GroupSessionPayoutParticipant>,
  stakePerParticipant: number,
  completionMultiplier = 1,
): Record<string, number> {
  const perCompleter = Math.round(stakePerParticipant * completionMultiplier);
  const payouts: Record<string, number> = {};
  for (const pid of participantIds) {
    payouts[pid] = participants[pid]?.completed ? perCompleter : 0;
  }
  return payouts;
}

/**
 * Sanitize a client-supplied app-block summary (display-only — NO money, NO
 * opaque tokens). Coerces counts to clamped non-negative integers and trims the
 * label. Returns undefined for an empty/garbage selection so we never persist a
 * "0 apps" summary that would imply the member is blocking something (the
 * waiting-room start-gate reads these counts).
 */
export function parseAppBlockSummary(
  raw: unknown,
): { appCount: number; categoryCount: number; label: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const clampInt = (v: unknown, max: number): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0
      ? Math.min(v, max)
      : 0;
  const appCount = clampInt(r.appCount, 1000);
  const categoryCount = clampInt(r.categoryCount, 100);
  if (appCount === 0 && categoryCount === 0) return undefined;
  const label =
    typeof r.label === "string" && r.label.trim()
      ? r.label.trim().slice(0, 100)
      : `${appCount} apps, ${categoryCount} categories`;
  return { appCount, categoryCount, label };
}

// ─── group leaderboard (de-pool: rank by completion rate, NEVER earnings) ────

export interface LeaderboardSessionInput {
  participants: Record<
    string,
    {
      name?: string;
      completed?: boolean;
      surrendered?: boolean;
      violationCount?: number;
    }
  >;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  /** Completed (the user themselves) across the shared completed sessions. */
  completed: number;
  surrendered: number;
  violations: number;
  /** Shared completed sessions this member appeared in. */
  sessions: number;
  /** completed / sessions, 0..1. */
  completionRate: number;
  isMe: boolean;
}

/**
 * Pure group-leaderboard aggregation. Given the caller's COMPLETED group
 * sessions, tallies each participant's completions / surrenders / violations
 * across those shared sessions and ranks them.
 *
 * De-pool: ranking is by COMPLETION RATE (then fewest violations, then raw
 * completions) — NEVER by money/earnings. Nobody wins another member's stake,
 * so an earnings ranking would be both wrong and imply a pool.
 */
export function buildGroupLeaderboard(
  sessions: LeaderboardSessionInput[],
  uid: string,
): LeaderboardEntry[] {
  const agg = new Map<
    string,
    {
      userId: string;
      name: string;
      completed: number;
      surrendered: number;
      violations: number;
      sessions: number;
    }
  >();

  for (const session of sessions) {
    const participants = session.participants ?? {};
    for (const [pid, p] of Object.entries(participants)) {
      const rec =
        agg.get(pid) ??
        {
          userId: pid,
          name: "",
          completed: 0,
          surrendered: 0,
          violations: 0,
          sessions: 0,
        };
      rec.sessions += 1;
      if (p?.completed === true) rec.completed += 1;
      if (p?.surrendered === true) rec.surrendered += 1;
      if (typeof p?.violationCount === "number" && p.violationCount > 0) {
        rec.violations += p.violationCount;
      }
      // Keep the first non-empty name we see for this member.
      if (!rec.name && typeof p?.name === "string") rec.name = p.name;
      agg.set(pid, rec);
    }
  }

  return [...agg.values()]
    .map((r) => ({
      ...r,
      isMe: r.userId === uid,
      completionRate: r.sessions > 0 ? r.completed / r.sessions : 0,
    }))
    .sort(
      (a, b) =>
        b.completionRate - a.completionRate ||
        a.violations - b.violations ||
        b.completed - a.completed ||
        a.userId.localeCompare(b.userId),
    );
}

export function buildStoredPayouts(
  participantIds: string[],
  rawPayouts: Record<string, unknown>,
): Array<{ userId: string; amount: number }> {
  return participantIds.map((userId) => {
    const rawAmount = rawPayouts[userId];
    const amount =
      typeof rawAmount === "number" && Number.isFinite(rawAmount)
        ? Math.max(0, Math.floor(rawAmount))
        : 0;

    return { userId, amount };
  });
}

export function decideReferralClaim(
  existingReferrerUid: unknown,
  requestedReferrerUid: string,
): ReferralClaimDecision {
  if (typeof existingReferrerUid !== "string" || !existingReferrerUid) {
    return { status: "claim" };
  }

  return {
    status: "already_claimed",
    sameReferrer: existingReferrerUid === requestedReferrerUid,
  };
}

// ─── Account-merge verification ──────────────────────────────────────────────

/**
 * Subset of `admin.auth().getUser()` we actually depend on. Avoids importing
 * the full admin SDK type into pure helpers so they stay test-friendly.
 */
export interface MinimalAuthRecord {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  metadata: { creationTime: string };
}

export type AccountMergeDecision =
  | {
      status: "merge";
      newUid: string;
      existingUid: string;
      matchedField: "phone" | "email";
    }
  | { status: "no_match" }
  | { status: "self_match" }
  | { status: "no_verified_contact" };

const VERIFICATION_GRACE_MS = 5 * 60 * 1000; // 5 min

/**
 * Decide which uid is canonical and which is the duplicate when a user signs
 * in with a second provider whose verified contact already exists on another
 * account.
 *
 * Trust model:
 *   - We **only** trust auth-verified contacts. Firebase Auth populates
 *     `phoneNumber` after OTP success; `emailVerified` flips to true after
 *     the magic-link click. Firestore profile fields are user-writable and
 *     must NOT be consulted here.
 *   - The duplicate is the newer auth user. Older = canonical. Ties (same
 *     creation timestamp, within a grace window) resolve in favour of the
 *     caller staying put — pre-merge, we don't know which the human meant.
 *
 * Returns the decision the caller should act on. `mergeOne` and the
 * `requestAccountMerge` CF both consume this — keeping it pure means the
 * security-critical decision can be regression-tested directly.
 */
export function decideAccountMerge(
  caller: MinimalAuthRecord,
  candidate: MinimalAuthRecord,
): AccountMergeDecision {
  if (caller.uid === candidate.uid) return { status: "self_match" };

  const phoneMatch =
    !!caller.phoneNumber &&
    !!candidate.phoneNumber &&
    caller.phoneNumber === candidate.phoneNumber;

  const emailMatch =
    !!caller.email &&
    !!candidate.email &&
    caller.emailVerified === true &&
    candidate.emailVerified === true &&
    caller.email.toLowerCase() === candidate.email.toLowerCase();

  if (!phoneMatch && !emailMatch) return { status: "no_match" };

  const matchedField: "phone" | "email" = phoneMatch ? "phone" : "email";

  const callerCreated = Date.parse(caller.metadata.creationTime);
  const candidateCreated = Date.parse(candidate.metadata.creationTime);

  // Both bad timestamps — refuse rather than guess.
  if (!Number.isFinite(callerCreated) || !Number.isFinite(candidateCreated)) {
    return { status: "no_match" };
  }

  // Within the grace window we can't reliably pick a newer one; treat as
  // self-match so the caller stays on its current uid until a human merges
  // out-of-band. Prevents flapping during near-simultaneous account creates.
  if (Math.abs(callerCreated - candidateCreated) < VERIFICATION_GRACE_MS) {
    return { status: "self_match" };
  }

  if (callerCreated > candidateCreated) {
    return {
      status: "merge",
      newUid: caller.uid,
      existingUid: candidate.uid,
      matchedField,
    };
  }
  return {
    status: "merge",
    newUid: candidate.uid,
    existingUid: caller.uid,
    matchedField,
  };
}

/**
 * Sanity check used by `mergeOne` before any wallet/auth mutation: the two
 * accounts must still share a verified contact at merge time. Catches the
 * phone-squat case where a stale queue entry (written before phone/email
 * fields were locked) would otherwise move funds to an unrelated uid.
 */
export function authUsersShareVerifiedContact(
  a: MinimalAuthRecord,
  b: MinimalAuthRecord,
): boolean {
  if (a.uid === b.uid) return false;
  const phone =
    !!a.phoneNumber && !!b.phoneNumber && a.phoneNumber === b.phoneNumber;
  const email =
    !!a.email &&
    !!b.email &&
    a.emailVerified === true &&
    b.emailVerified === true &&
    a.email.toLowerCase() === b.email.toLowerCase();
  return phone || email;
}

export function calculateReferralReputation(rep: Record<string, unknown>): {
  referralCount: number;
  score: number;
  level: string;
} {
  const referralCount =
    (typeof rep.referralCount === "number" && Number.isFinite(rep.referralCount)
      ? rep.referralCount
      : 0) + 1;
  const paymentsCompleted =
    typeof rep.paymentsCompleted === "number" &&
    Number.isFinite(rep.paymentsCompleted)
      ? rep.paymentsCompleted
      : 0;
  const paymentsMissed =
    typeof rep.paymentsMissed === "number" &&
    Number.isFinite(rep.paymentsMissed)
      ? rep.paymentsMissed
      : 0;
  const totalPayments = paymentsCompleted + paymentsMissed;

  let score = 50;
  if (totalPayments > 0) {
    const successRate = paymentsCompleted / totalPayments;
    score = Math.round(50 + (successRate - 0.5) * 100);
    score = Math.max(0, Math.min(100, score));
  }

  score = Math.min(100, score + referralCount * 10);

  const level =
    score <= 20
      ? "seed"
      : score <= 40
        ? "sprout"
        : score <= 60
          ? "sapling"
          : score <= 80
            ? "tree"
            : "oak";

  return { referralCount, score, level };
}
