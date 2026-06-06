#!/usr/bin/env node
/**
 * cleanup-test-accounts.js — one-off launch-line step 1 (2026-06-06).
 *
 * Two accounts, two different treatments:
 *
 * 1. cMtHvQkJJZOgU6pgYARj8nN5Wpf1 (drifted, FROZEN, phone-only):
 *    AUTH RECORD ONLY — frees Fardeen's real phone number for a fresh account.
 *    Firestore deliberately untouched: the wallet/txn drift fixture and the
 *    $41 Stripe charge history must survive for backfill.
 *
 * 2. apY32vwEdWcL7baSEfD92azq7tA3 (fardeeneb@gmail.com, clean delta $0):
 *    FULL PURGE — Auth + Firestore cascade mirroring the deleteAccount CF's
 *    Firestore path (functions/src/index.ts): users/userPrivate/wallets/
 *    userFollows/userPushTokens docs, transactions + sessions sweeps by
 *    userId, expire pending/ready groupInvites addressed to it, then a
 *    deletions/{uid} audit marker. NO Stripe/Plaid calls — its payment
 *    intents live in an orphaned old Stripe account (resource_missing in
 *    the current "Niyah, Inc." account).
 *
 * DRY RUN by default — prints what it would do, writes nothing.
 * Pass --apply to execute.
 *
 * Run from functions/:  node scripts/cleanup-test-accounts.js [--apply]
 * Auth: Application Default Credentials (same as diagnose-wallet.js).
 */

const admin = require("firebase-admin");

// Hardcoded on purpose for this one-off — a stale GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT
// shell var must not be able to aim live writes at another project.
const PROJECT_ID = "niyah-b972d";
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

const APPLY = process.argv.includes("--apply");

const FROZEN_UID = "cMtHvQkJJZOgU6pgYARj8nN5Wpf1"; // auth-only delete (free the number)
const PURGE_UID = "apY32vwEdWcL7baSEfD92azq7tA3"; // full purge
const PURGE_EMAIL = "fardeeneb@gmail.com"; // identity guard

const DOC_DELETES = ["users", "userPrivate", "wallets", "userFollows", "userPushTokens"];
const SWEEPS = ["transactions", "sessions"];

async function commitInChunks(refs, op) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + 400)) op(batch, ref);
    await batch.commit();
  }
}

async function main() {
  console.log(`project=${PROJECT_ID}  mode=${APPLY ? "APPLY (writes!)" : "DRY RUN"}\n`);

  // ---------- 1. Frozen drifted account: free the phone number ----------
  console.log(`--- ${FROZEN_UID} (frozen drifted acct) ---`);
  let frozen = null;
  try {
    frozen = await auth.getUser(FROZEN_UID);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e; // transient/permission errors must abort
    console.log("auth record not found — already deleted, skipping.");
  }
  if (frozen) {
    const providers = frozen.providerData
      .map((p) => p.providerId)
      .sort()
      .join(",");
    console.log(
      `phone=${frozen.phoneNumber} providers=[${providers}] email=${frozen.email || "none"}`,
    );
    if (!frozen.phoneNumber || providers !== "phone" || frozen.email) {
      throw new Error(
        "identity guard: expected phone-only acct with a number and no email — ABORT",
      );
    }
    if (APPLY) {
      await auth.deleteUser(FROZEN_UID);
      console.log(
        `✓ auth record deleted — ${frozen.phoneNumber} is free. Firestore untouched (by design).`,
      );
    } else {
      console.log(
        `would delete AUTH RECORD ONLY (frees ${frozen.phoneNumber}); Firestore stays frozen as-is.`,
      );
    }
  }

  // ---------- 2. Gmail test account: full purge ----------
  console.log(`\n--- ${PURGE_UID} (gmail test acct) ---`);
  let purge = null;
  try {
    purge = await auth.getUser(PURGE_UID);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e; // transient/permission errors must abort
    console.log("auth record not found — continuing to Firestore sweep.");
  }
  if (purge) {
    console.log(`email=${purge.email} phone=${purge.phoneNumber || "none"}`);
    if (purge.email !== PURGE_EMAIL) {
      throw new Error(`identity guard: email=${purge.email}, expected ${PURGE_EMAIL} — ABORT`);
    }
    if (purge.phoneNumber) {
      throw new Error("identity guard: expected NO phone on this acct — ABORT");
    }
  }

  // 2a. direct doc deletes (doc id == uid)
  for (const coll of DOC_DELETES) {
    const ref = db.collection(coll).doc(PURGE_UID);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`${coll}/${PURGE_UID}: absent`);
      continue;
    }
    if (APPLY) {
      await ref.delete();
      console.log(`✓ deleted ${coll}/${PURGE_UID}`);
    } else {
      console.log(`would delete ${coll}/${PURGE_UID}`);
    }
  }

  // 2b. sweeps by userId field
  for (const coll of SWEEPS) {
    const snap = await db.collection(coll).where("userId", "==", PURGE_UID).get();
    console.log(`${coll}: ${snap.size} docs with userId==uid`);
    if (coll === "sessions") {
      // mirror the deleteAccount CF's active-session gate — never delete an in-flight stake
      const active = snap.docs.filter((d) => d.get("status") === "active");
      if (active.length) {
        throw new Error(`sessions: ${active.length} ACTIVE session(s) for uid — ABORT`);
      }
    }
    if (APPLY && snap.size) {
      await commitInChunks(
        snap.docs.map((d) => d.ref),
        (b, r) => b.delete(r),
      );
      console.log(`✓ deleted ${snap.size} ${coll} docs`);
    }
  }

  // 2c. expire pending/ready invites addressed to the purged acct
  // (status filtered client-side to avoid needing a composite index)
  const invites = await db.collection("groupInvites").where("toUserId", "==", PURGE_UID).get();
  const pending = invites.docs.filter((d) => ["pending", "ready"].includes(d.get("status")));
  console.log(
    `groupInvites: ${pending.length} pending/ready addressed to uid (of ${invites.size} total)`,
  );
  if (APPLY && pending.length) {
    await commitInChunks(
      pending.map((d) => d.ref),
      (b, r) =>
        b.update(r, {
          status: "expired",
          expiredReason: "recipient_deleted",
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
    );
    console.log(`✓ expired ${pending.length} invites`);
  }

  // 2d. audit marker, then auth record last (partial failure leaves a findable acct)
  if (APPLY) {
    await db.collection("deletions").doc(PURGE_UID).set(
      {
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: "manual_test_account_purge",
        source: "scripts/cleanup-test-accounts.js (launch-line step 1, 2026-06-06)",
      },
      { merge: true }, // mirror the CF — never clobber a prior audit record
    );
    console.log(`✓ wrote deletions/${PURGE_UID} audit marker`);
    if (purge) {
      await auth.deleteUser(PURGE_UID);
      console.log("✓ auth record deleted");
    }
  } else {
    console.log(`would write deletions/${PURGE_UID} marker + delete the auth record`);
  }

  console.log(`\nDone (${APPLY ? "APPLY" : "DRY RUN"}).`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message || e);
  process.exit(1);
});
