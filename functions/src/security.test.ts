import assert from "node:assert/strict";
import test from "node:test";

import {
  authUsersShareVerifiedContact,
  buildGroupLeaderboard,
  buildStoredPayouts,
  calculateGroupSessionPayouts,
  calculateReferralReputation,
  compareAdminKey,
  decideAccountMerge,
  decideReferralClaim,
  evaluateAppCheckToken,
  isValidFirebaseUid,
  parseAppBlockSummary,
  type LeaderboardSessionInput,
  type MinimalAuthRecord,
} from "./security";

// Helpers for auth-merge tests.
const isoMinus = (ms: number): string =>
  new Date(Date.now() - ms).toISOString();
const minutesAgo = (m: number): string => isoMinus(m * 60 * 1000);

const authFixture = (
  override: Partial<MinimalAuthRecord> & { uid: string },
): MinimalAuthRecord => ({
  uid: override.uid,
  email: override.email ?? null,
  emailVerified: override.emailVerified ?? false,
  phoneNumber: override.phoneNumber ?? null,
  metadata: override.metadata ?? { creationTime: minutesAgo(60) },
});

test("calculateGroupSessionPayouts returns each completer their own stake (no pool)", () => {
  // Individual stakes: a completer gets their OWN stake back, never a share of
  // a non-completer's forfeited stake. bob forfeits 500 to the house; alice and
  // cara each get exactly their own 500 back — NOT 750.
  const payouts = calculateGroupSessionPayouts(
    ["alice", "bob", "cara"],
    {
      alice: { completed: true },
      bob: { completed: false },
      cara: { completed: true },
    },
    500,
  );

  assert.deepEqual(payouts, {
    alice: 500,
    bob: 0,
    cara: 500,
  });
});

test("calculateGroupSessionPayouts applies the house-funded completion multiplier", () => {
  const payouts = calculateGroupSessionPayouts(
    ["alice", "bob"],
    { alice: { completed: true }, bob: { completed: false } },
    1000,
    1.1,
  );
  // alice: own 1000 + 10% house-funded surplus; bob forfeits to the house.
  assert.deepEqual(payouts, { alice: 1100, bob: 0 });
});

test("buildStoredPayouts normalizes missing or invalid amounts", () => {
  const payouts = buildStoredPayouts(["alice", "bob", "cara"], {
    alice: 1500,
    bob: -20,
    cara: "oops",
  });

  assert.deepEqual(payouts, [
    { userId: "alice", amount: 1500 },
    { userId: "bob", amount: 0 },
    { userId: "cara", amount: 0 },
  ]);
});

test("decideReferralClaim allows only the first referrer", () => {
  assert.deepEqual(decideReferralClaim(undefined, "ref-1"), {
    status: "claim",
  });

  assert.deepEqual(decideReferralClaim("ref-1", "ref-1"), {
    status: "already_claimed",
    sameReferrer: true,
  });

  assert.deepEqual(decideReferralClaim("ref-1", "ref-2"), {
    status: "already_claimed",
    sameReferrer: false,
  });
});

test("calculateReferralReputation increments referral count and recalculates score", () => {
  const reputation = calculateReferralReputation({
    referralCount: 2,
    paymentsCompleted: 3,
    paymentsMissed: 1,
  });

  assert.deepEqual(reputation, {
    referralCount: 3,
    score: 100,
    level: "oak",
  });
});

test("isValidFirebaseUid accepts Firebase-style UIDs only", () => {
  assert.equal(isValidFirebaseUid("abc123XYZ"), true);
  assert.equal(isValidFirebaseUid("with-dash"), false);
  assert.equal(isValidFirebaseUid(""), false);
  assert.equal(isValidFirebaseUid(null), false);
});

// ─── decideAccountMerge ─────────────────────────────────────────────────────

test("decideAccountMerge → self_match when uids are identical", () => {
  const u = authFixture({
    uid: "same",
    phoneNumber: "+15555550100",
    metadata: { creationTime: minutesAgo(30) },
  });
  assert.equal(decideAccountMerge(u, u).status, "self_match");
});

test("decideAccountMerge → no_match when no shared contact", () => {
  const caller = authFixture({
    uid: "A",
    phoneNumber: "+15555550101",
    metadata: { creationTime: minutesAgo(30) },
  });
  const candidate = authFixture({
    uid: "B",
    phoneNumber: "+15555550102",
    metadata: { creationTime: minutesAgo(120) },
  });
  assert.equal(decideAccountMerge(caller, candidate).status, "no_match");
});

test("decideAccountMerge → matches on phone, picks newer caller as duplicate", () => {
  const caller = authFixture({
    uid: "newer",
    phoneNumber: "+15555550111",
    metadata: { creationTime: minutesAgo(5) },
  });
  const candidate = authFixture({
    uid: "older",
    phoneNumber: "+15555550111",
    metadata: { creationTime: minutesAgo(60) },
  });
  const result = decideAccountMerge(caller, candidate);
  assert.deepEqual(result, {
    status: "merge",
    newUid: "newer",
    existingUid: "older",
    matchedField: "phone",
  });
});

test("decideAccountMerge → flips direction when candidate is newer", () => {
  const caller = authFixture({
    uid: "older",
    phoneNumber: "+15555550112",
    metadata: { creationTime: minutesAgo(60) },
  });
  const candidate = authFixture({
    uid: "newer",
    phoneNumber: "+15555550112",
    metadata: { creationTime: minutesAgo(5) },
  });
  const result = decideAccountMerge(caller, candidate);
  assert.deepEqual(result, {
    status: "merge",
    newUid: "newer",
    existingUid: "older",
    matchedField: "phone",
  });
});

test("decideAccountMerge → matches verified email case-insensitively", () => {
  const caller = authFixture({
    uid: "newer",
    email: "Fardeen@Niyah.LIVE",
    emailVerified: true,
    metadata: { creationTime: minutesAgo(5) },
  });
  const candidate = authFixture({
    uid: "older",
    email: "fardeen@niyah.live",
    emailVerified: true,
    metadata: { creationTime: minutesAgo(60) },
  });
  const result = decideAccountMerge(caller, candidate);
  assert.equal(result.status, "merge");
  if (result.status === "merge") {
    assert.equal(result.matchedField, "email");
    assert.equal(result.newUid, "newer");
    assert.equal(result.existingUid, "older");
  }
});

test("decideAccountMerge → rejects email match when either side is unverified", () => {
  const caller = authFixture({
    uid: "A",
    email: "x@x.com",
    emailVerified: true,
    metadata: { creationTime: minutesAgo(5) },
  });
  const unverified = authFixture({
    uid: "B",
    email: "x@x.com",
    emailVerified: false,
    metadata: { creationTime: minutesAgo(60) },
  });
  assert.equal(decideAccountMerge(caller, unverified).status, "no_match");
});

test("decideAccountMerge → self_match inside the 5-minute creation grace window", () => {
  const t = Date.now();
  const caller = authFixture({
    uid: "A",
    phoneNumber: "+15555550199",
    metadata: { creationTime: new Date(t).toISOString() },
  });
  const candidate = authFixture({
    uid: "B",
    phoneNumber: "+15555550199",
    metadata: { creationTime: new Date(t + 60_000).toISOString() }, // 1 min apart
  });
  assert.equal(decideAccountMerge(caller, candidate).status, "self_match");
});

test("decideAccountMerge → no_match when creation timestamps are unparseable", () => {
  const caller = authFixture({
    uid: "A",
    phoneNumber: "+15555550120",
    metadata: { creationTime: "not-a-date" },
  });
  const candidate = authFixture({
    uid: "B",
    phoneNumber: "+15555550120",
    metadata: { creationTime: "also-not-a-date" },
  });
  assert.equal(decideAccountMerge(caller, candidate).status, "no_match");
});

test("decideAccountMerge → phone match wins over email match (deterministic)", () => {
  // If both phone AND email match, the function should pick "phone" so the
  // matchedField is deterministic and audit logs stay consistent.
  const caller = authFixture({
    uid: "newer",
    phoneNumber: "+15555550130",
    email: "z@z.com",
    emailVerified: true,
    metadata: { creationTime: minutesAgo(5) },
  });
  const candidate = authFixture({
    uid: "older",
    phoneNumber: "+15555550130",
    email: "z@z.com",
    emailVerified: true,
    metadata: { creationTime: minutesAgo(60) },
  });
  const result = decideAccountMerge(caller, candidate);
  assert.equal(result.status, "merge");
  if (result.status === "merge") assert.equal(result.matchedField, "phone");
});

// ─── authUsersShareVerifiedContact ──────────────────────────────────────────

test("authUsersShareVerifiedContact → true on matching verified phone", () => {
  const a = authFixture({ uid: "A", phoneNumber: "+15555550140" });
  const b = authFixture({ uid: "B", phoneNumber: "+15555550140" });
  assert.equal(authUsersShareVerifiedContact(a, b), true);
});

test("authUsersShareVerifiedContact → true on matching verified email (case-insensitive)", () => {
  const a = authFixture({
    uid: "A",
    email: "Same@Domain.com",
    emailVerified: true,
  });
  const b = authFixture({
    uid: "B",
    email: "same@domain.com",
    emailVerified: true,
  });
  assert.equal(authUsersShareVerifiedContact(a, b), true);
});

test("authUsersShareVerifiedContact → false when emails match but unverified", () => {
  const a = authFixture({
    uid: "A",
    email: "x@x.com",
    emailVerified: false,
  });
  const b = authFixture({
    uid: "B",
    email: "x@x.com",
    emailVerified: true,
  });
  assert.equal(authUsersShareVerifiedContact(a, b), false);
});

test("authUsersShareVerifiedContact → false when uids are identical", () => {
  const same = authFixture({ uid: "X", phoneNumber: "+15555550141" });
  assert.equal(authUsersShareVerifiedContact(same, same), false);
});

test("authUsersShareVerifiedContact → false when neither phone nor email matches", () => {
  const a = authFixture({ uid: "A", phoneNumber: "+15555550150" });
  const b = authFixture({ uid: "B", phoneNumber: "+15555550151" });
  assert.equal(authUsersShareVerifiedContact(a, b), false);
});

// ─── compareAdminKey ────────────────────────────────────────────────────────

const STRONG_KEY = "a".repeat(32); // ≥16 chars

test("compareAdminKey → true on exact match", () => {
  assert.equal(compareAdminKey(STRONG_KEY, STRONG_KEY), true);
});

test("compareAdminKey → false when provided differs by one char", () => {
  const tampered = "b" + STRONG_KEY.slice(1);
  assert.equal(compareAdminKey(tampered, STRONG_KEY), false);
});

test("compareAdminKey → false on length mismatch", () => {
  assert.equal(compareAdminKey(STRONG_KEY + "x", STRONG_KEY), false);
  assert.equal(compareAdminKey(STRONG_KEY.slice(1), STRONG_KEY), false);
});

test("compareAdminKey → false when provided is not a string", () => {
  assert.equal(compareAdminKey(undefined, STRONG_KEY), false);
  assert.equal(compareAdminKey(null, STRONG_KEY), false);
  assert.equal(compareAdminKey(12345, STRONG_KEY), false);
  assert.equal(compareAdminKey({}, STRONG_KEY), false);
});

test("compareAdminKey → refuses weak secrets (<16 chars) even if they match", () => {
  // A weak secret is a bug to flag in config — never accept it.
  assert.equal(compareAdminKey("short", "short"), false);
  assert.equal(compareAdminKey("a".repeat(15), "a".repeat(15)), false);
});

test("compareAdminKey → false when expected is empty/missing", () => {
  assert.equal(compareAdminKey(STRONG_KEY, ""), false);
  assert.equal(compareAdminKey(STRONG_KEY, undefined), false);
});

// ─── evaluateAppCheckToken ──────────────────────────────────────────────────

test("evaluateAppCheckToken → rejects missing token", async () => {
  await assert.rejects(
    () => evaluateAppCheckToken(undefined, async () => undefined),
    /App Check attestation required/,
  );
});

test("evaluateAppCheckToken → rejects non-string token", async () => {
  await assert.rejects(
    () => evaluateAppCheckToken(12345, async () => undefined),
    /App Check attestation required/,
  );
  await assert.rejects(
    () => evaluateAppCheckToken({}, async () => undefined),
    /App Check attestation required/,
  );
});

test('evaluateAppCheckToken → rejects "skip-dev" sentinel', async () => {
  await assert.rejects(
    () => evaluateAppCheckToken("skip-dev", async () => undefined),
    /App Check attestation required/,
  );
});

test("evaluateAppCheckToken → rejects when verifier throws", async () => {
  await assert.rejects(
    () =>
      evaluateAppCheckToken("real-token", async () => {
        throw new Error("boom");
      }),
    /Invalid App Check token/,
  );
});

test("evaluateAppCheckToken → resolves when verifier resolves", async () => {
  let seen = "";
  await evaluateAppCheckToken("real-token", async (t) => {
    seen = t;
  });
  assert.equal(seen, "real-token");
});

// ─── buildGroupLeaderboard (de-pool: completion-rate ranking) ────────────────

const lbSession = (
  participants: LeaderboardSessionInput["participants"],
): LeaderboardSessionInput => ({ participants });

test("leaderboard: empty history yields no standings", () => {
  assert.deepEqual(buildGroupLeaderboard([], "me"), []);
});

test("leaderboard: aggregates completions/surrenders/violations across shared sessions", () => {
  const sessions: LeaderboardSessionInput[] = [
    lbSession({
      me: { name: "Me", completed: true },
      bob: { name: "Bob", completed: true },
    }),
    lbSession({
      me: { name: "Me", surrendered: true, violationCount: 2 },
      bob: { name: "Bob", completed: true },
    }),
  ];
  const board = buildGroupLeaderboard(sessions, "me");
  const me = board.find((e) => e.userId === "me")!;
  const bob = board.find((e) => e.userId === "bob")!;
  assert.equal(me.sessions, 2);
  assert.equal(me.completed, 1);
  assert.equal(me.surrendered, 1);
  assert.equal(me.violations, 2);
  assert.equal(me.completionRate, 0.5);
  assert.equal(me.isMe, true);
  assert.equal(bob.completed, 2);
  assert.equal(bob.completionRate, 1);
  assert.equal(bob.isMe, false);
});

test("leaderboard: ranks by completion rate, then fewest violations (de-pool — never money)", () => {
  // Three members, all 1 session. cara + dan both 100% complete; cara has fewer
  // violations so ranks above dan. ed is 0% complete -> last.
  const sessions: LeaderboardSessionInput[] = [
    lbSession({
      cara: { name: "Cara", completed: true, violationCount: 0 },
      dan: { name: "Dan", completed: true, violationCount: 3 },
      ed: { name: "Ed", surrendered: true },
    }),
  ];
  const board = buildGroupLeaderboard(sessions, "cara");
  assert.deepEqual(
    board.map((e) => e.userId),
    ["cara", "dan", "ed"],
  );
  assert.equal(board[0].completionRate, 1);
  assert.equal(board[2].completionRate, 0);
});

test("leaderboard: tie on rate + violations breaks deterministically by userId", () => {
  const sessions: LeaderboardSessionInput[] = [
    lbSession({
      zed: { name: "Zed", completed: true },
      amy: { name: "Amy", completed: true },
    }),
  ];
  const board = buildGroupLeaderboard(sessions, "amy");
  assert.deepEqual(
    board.map((e) => e.userId),
    ["amy", "zed"],
  );
});

test("leaderboard: a member missing a name still appears (name defaults to empty)", () => {
  const board = buildGroupLeaderboard(
    [lbSession({ me: { completed: true }, ghost: { completed: false } })],
    "me",
  );
  const ghost = board.find((e) => e.userId === "ghost")!;
  assert.equal(ghost.name, "");
  assert.equal(ghost.completionRate, 0);
});

// ─── parseAppBlockSummary (client-input sanitizer; feeds the start-gate) ──────

test("parseAppBlockSummary: null / non-object / empty → undefined", () => {
  assert.equal(parseAppBlockSummary(null), undefined);
  assert.equal(parseAppBlockSummary(undefined), undefined);
  assert.equal(parseAppBlockSummary("nope"), undefined);
  assert.equal(parseAppBlockSummary({}), undefined);
});

test("parseAppBlockSummary: both counts zero → undefined (never a misleading '0 apps')", () => {
  assert.equal(parseAppBlockSummary({ appCount: 0, categoryCount: 0 }), undefined);
});

test("parseAppBlockSummary: clamps oversized counts and generates a default label", () => {
  const r = parseAppBlockSummary({ appCount: 999999, categoryCount: 500, label: "" });
  assert.deepEqual(r, {
    appCount: 1000,
    categoryCount: 100,
    label: "1000 apps, 100 categories",
  });
});

test("parseAppBlockSummary: rejects negative / float counts (treated as 0)", () => {
  // appCount negative → 0; categoryCount float → 0; both 0 → undefined.
  assert.equal(parseAppBlockSummary({ appCount: -999, categoryCount: 0 }), undefined);
  assert.equal(parseAppBlockSummary({ appCount: 5.5, categoryCount: 0 }), undefined);
  // A valid category survives even when appCount is garbage.
  const r = parseAppBlockSummary({ appCount: -3, categoryCount: 2 });
  assert.deepEqual(r, { appCount: 0, categoryCount: 2, label: "0 apps, 2 categories" });
});

test("parseAppBlockSummary: keeps a provided label, trimmed + capped at 100 chars", () => {
  assert.equal(
    parseAppBlockSummary({ appCount: 5, categoryCount: 0, label: "  Social media  " })?.label,
    "Social media",
  );
  const long = "x".repeat(250);
  assert.equal(
    parseAppBlockSummary({ appCount: 5, categoryCount: 0, label: long })?.label.length,
    100,
  );
});

test("parseAppBlockSummary: whitespace-only label falls back to the count summary", () => {
  assert.equal(
    parseAppBlockSummary({ appCount: 3, categoryCount: 1, label: "   " })?.label,
    "3 apps, 1 categories",
  );
});

test("parseAppBlockSummary: valid input passes through intact", () => {
  assert.deepEqual(
    parseAppBlockSummary({ appCount: 5, categoryCount: 2, label: "My Apps" }),
    { appCount: 5, categoryCount: 2, label: "My Apps" },
  );
});
