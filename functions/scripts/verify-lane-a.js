#!/usr/bin/env node
/**
 * verify-lane-a.js — READ ONLY post-deploy verification for the Lane A
 * security fixes (deposit double-credit + email/phone PII leak).
 *
 * Performs ZERO writes — only `.get()`s documents. Safe to run against prod.
 *
 * Checks:
 *   1. DEPOSIT INTEGRITY — scans `transactions` (type=="deposit") and flags any
 *      paymentIntentId that appears more than once (= a double-credit). Reports
 *      how many deposits use the new deterministic doc id (`deposit_<pi>`) vs a
 *      legacy auto-id. After the fix, NO paymentIntentId should appear twice.
 *   2. PII LEAK — scans `users/*` and flags any doc that still has an `email` or
 *      `phone` field (these must live only in userPrivate now). After deploy +
 *      the migration, this count should reach 0. Spot-checks that userPrivate
 *      holds the contact index for migrated users.
 *   3. PER-USER (optional uid arg) — dumps the user's wallet buckets + deposit
 *      txns and reconciles balance == sum(all txns).
 *
 * Usage:
 *   cd functions
 *   node scripts/verify-lane-a.js            # global sweep (both checks)
 *   node scripts/verify-lane-a.js <uid>      # global sweep + per-user deep dive
 *
 * Auth (run once in this shell first):
 *   A) gcloud auth application-default login            (recommended)
 *   B) export GOOGLE_APPLICATION_CREDENTIALS="/abs/path/key.json"
 *
 * Project id from GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT, else the constant below.
 */

const admin = require("firebase-admin");

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "niyah-b972d";

const SCAN_CAP = Number(process.env.SCAN_CAP) || 20000; // safety bound
const uidArg = process.argv[2] || null;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const money = (cents) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return `${cents}`;
  const sign = cents < 0 ? "-" : "";
  return `${cents} (${sign}$${(Math.abs(cents) / 100).toFixed(2)})`;
};

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

// ── 1. Deposit integrity (double-credit detector) ──────────────────────────
async function checkDeposits() {
  console.log("\n=== 1. DEPOSIT INTEGRITY (double-credit detector) ===");
  const byPi = new Map(); // paymentIntentId -> { count, docIds:[], amount }
  let scanned = 0;
  let deterministicIds = 0;
  let legacyIds = 0;
  let missingPi = 0;

  let last = null;
  while (scanned < SCAN_CAP) {
    let q = db
      .collection("transactions")
      .where("type", "==", "deposit")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(1000);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      const d = doc.data();
      if (doc.id.startsWith("deposit_")) deterministicIds += 1;
      else legacyIds += 1;

      const pi = d.paymentIntentId;
      if (!pi) {
        missingPi += 1;
        continue;
      }
      const rec = byPi.get(pi) || { count: 0, docIds: [], amount: d.amount };
      rec.count += 1;
      rec.docIds.push(doc.id);
      byPi.set(pi, rec);
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 1000) break;
  }

  const dups = [...byPi.entries()].filter(([, r]) => r.count > 1);

  console.log(`   deposit txns scanned : ${scanned}${scanned >= SCAN_CAP ? " (CAP HIT — raise SCAN_CAP)" : ""}`);
  console.log(`   deterministic ids    : ${deterministicIds} (deposit_<pi>)`);
  console.log(`   legacy auto-ids      : ${legacyIds}`);
  console.log(`   missing paymentIntentId: ${missingPi}`);
  if (dups.length === 0) {
    console.log(`   ${PASS} no paymentIntentId credited more than once`);
  } else {
    console.log(`   ${FAIL} ${dups.length} paymentIntentId(s) DOUBLE-CREDITED:`);
    for (const [pi, r] of dups.slice(0, 25)) {
      console.log(
        `      pi=${pi} x${r.count} amount=${money(r.amount)} docs=[${r.docIds.join(", ")}]`,
      );
    }
    if (dups.length > 25) console.log(`      … and ${dups.length - 25} more`);
  }
  return dups.length === 0;
}

// ── 2. PII leak (email/phone must not be on the public users doc) ───────────
async function checkPii() {
  console.log("\n=== 2. PII LEAK (email/phone on world-readable users docs) ===");
  let scanned = 0;
  let leaking = 0;
  const samples = [];
  let withIndex = 0;
  let indexChecked = 0;

  let last = null;
  while (scanned < SCAN_CAP) {
    let q = db
      .collection("users")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      const d = doc.data() || {};
      const hasEmail = d.email !== undefined;
      const hasPhone = d.phone !== undefined;
      if (hasEmail || hasPhone) {
        leaking += 1;
        if (samples.length < 25)
          samples.push(
            `${doc.id} (${[hasEmail ? "email" : null, hasPhone ? "phone" : null].filter(Boolean).join("+")})`,
          );
      }
      // Spot-check the first 50 users have a userPrivate contact index.
      if (indexChecked < 50) {
        indexChecked += 1;
        const priv = await db.collection("userPrivate").doc(doc.id).get();
        const p = priv.data() || {};
        if (p.email !== undefined || p.phoneNumber !== undefined) withIndex += 1;
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  console.log(`   users scanned        : ${scanned}${scanned >= SCAN_CAP ? " (CAP HIT)" : ""}`);
  console.log(`   contact-index present: ${withIndex}/${indexChecked} sampled (userPrivate.email/phoneNumber)`);
  if (leaking === 0) {
    console.log(`   ${PASS} no users/* doc exposes email or phone`);
  } else {
    console.log(`   ${FAIL} ${leaking} users/* doc(s) STILL expose email/phone — run migrateSensitiveFieldsToPrivate:`);
    console.log(`      ${samples.join("\n      ")}`);
    if (leaking > samples.length) console.log(`      … and ${leaking - samples.length} more`);
  }
  if (withIndex === 0 && indexChecked > 0) {
    console.log(`   ${WARN}no sampled user has a userPrivate contact index yet — contact discovery will return nothing until users re-accept legal terms (2.0.0) or the migration runs.`);
  }
  return leaking === 0;
}

// ── 3. Per-user deep dive ───────────────────────────────────────────────────
async function checkUser(uid) {
  console.log(`\n=== 3. PER-USER DEEP DIVE — ${uid} ===`);
  const [walletSnap, privSnap, txnSnap] = await Promise.all([
    db.collection("wallets").doc(uid).get(),
    db.collection("userPrivate").doc(uid).get(),
    db.collection("transactions").where("userId", "==", uid).get(),
  ]);

  const w = walletSnap.data() || {};
  console.log(`   wallet.balance       : ${money(w.balance ?? 0)}`);
  console.log(`   depositedBalance     : ${money(w.depositedBalance ?? 0)}`);
  console.log(`   earnedBalance        : ${money(w.earnedBalance ?? 0)}`);
  console.log(`   bonusBalance         : ${money(w.bonusBalance ?? 0)}`);
  console.log(`   creditBalance        : ${money(w.creditBalance ?? 0)}`);

  const p = privSnap.data() || {};
  console.log(`   userPrivate.email    : ${p.email ?? "—"}`);
  console.log(`   userPrivate.phoneNumber: ${p.phoneNumber ?? "—"}`);

  let sum = 0;
  const deposits = [];
  txnSnap.forEach((doc) => {
    const d = doc.data();
    sum += typeof d.amount === "number" ? d.amount : 0;
    if (d.type === "deposit")
      deposits.push({ id: doc.id, pi: d.paymentIntentId, amount: d.amount });
  });
  console.log(`   txns                 : ${txnSnap.size} (sum=${money(sum)})`);
  console.log(`   deposits             : ${deposits.length}`);
  const piSet = new Set(deposits.map((x) => x.pi).filter(Boolean));
  if (piSet.size === deposits.filter((x) => x.pi).length) {
    console.log(`   ${PASS} no duplicate paymentIntentId among this user's deposits`);
  } else {
    console.log(`   ${FAIL} duplicate deposit paymentIntentId(s) for this user`);
    deposits.forEach((x) => console.log(`      ${x.id} pi=${x.pi} ${money(x.amount)}`));
  }
  const delta = (w.balance ?? 0) - sum;
  if (delta === 0)
    console.log(`   ${PASS} balance reconciles with summed transactions`);
  else
    console.log(`   ${WARN}balance ${money(w.balance ?? 0)} != sum(txns) ${money(sum)} (delta ${money(delta)}) — pre-existing ledger drift is separate from Lane A`);
}

(async () => {
  console.log(`verify-lane-a — project ${PROJECT_ID} (READ ONLY)`);
  try {
    const okDeposits = await checkDeposits();
    const okPii = await checkPii();
    if (uidArg) await checkUser(uidArg);
    console.log("\n=== SUMMARY ===");
    console.log(`   deposit double-credit: ${okDeposits ? PASS + " clean" : FAIL + " FOUND"}`);
    console.log(`   PII leak (users/*)   : ${okPii ? PASS + " clean" : FAIL + " present — run migration"}`);
    process.exit(okDeposits && okPii ? 0 : 1);
  } catch (err) {
    console.error("verify-lane-a error:", err);
    process.exit(2);
  }
})();
