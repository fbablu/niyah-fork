#!/usr/bin/env node
/**
 * scrub-empty-contact-fields.js — one-off follow-up to migrateSensitiveFieldsToPrivate
 * (launch-line, 2026-06-06).
 *
 * Why: the migration CF moves email/phone off `users/{uid}` ONLY when the value
 * is a non-empty string (`typeof v === "string" && v`). verify-lane-a flags
 * FIELD PRESENCE (`!== undefined`). So docs carrying `email: ""` / `null` (or
 * non-string junk) stay flagged forever — vestigial fields holding no PII.
 *
 * This script deletes email/phone fields from users/* ONLY when the value is
 * empty ("" / null / non-string junk). If it ever finds a NON-EMPTY STRING the
 * migration somehow left behind, it does NOT touch it — it prints the uid
 * loudly and exits non-zero, because that would mean real PII the migration
 * missed (investigate, don't auto-scrub).
 *
 * DRY RUN by default — prints field types/emptiness per doc, writes nothing.
 * Pass --apply to delete the empty fields.
 *
 * Run from functions/:  node scripts/scrub-empty-contact-fields.js [--apply]
 * Auth: Application Default Credentials (same as verify-lane-a.js).
 */

const admin = require("firebase-admin");

const PROJECT_ID = "niyah-b972d"; // hardcoded on purpose (one-off, live writes)
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const SCAN_CAP = 1000;

// ONLY "" and null are scrubable. Anything else with content (non-empty
// string, number, object, …) is treated as REAL contact data — refuse.
function classify(v) {
  if (v === undefined) return { present: false };
  if (v === "") return { present: true, real: false, desc: "empty string" };
  if (v === null) return { present: true, real: false, desc: "null" };
  if (typeof v === "string") return { present: true, real: true, desc: `non-empty string (len ${v.length})` };
  return { present: true, real: true, desc: `non-string ${typeof v} (could encode contact data)` };
}

async function main() {
  console.log(`project=${PROJECT_ID}  mode=${APPLY ? "APPLY (writes!)" : "DRY RUN"}\n`);

  const snap = await db.collection("users").limit(SCAN_CAP).get();
  console.log(`users scanned: ${snap.size}\n`);
  if (snap.size >= SCAN_CAP) {
    console.warn(`⚠ scan hit the ${SCAN_CAP}-doc cap — docs beyond it were NOT scanned.`);
  }

  // Pass 1: classify everything BEFORE any write. Any real value anywhere
  // aborts the whole run — never partially apply around a real leak.
  const plan = [];
  let realLeaks = 0;
  for (const doc of snap.docs) {
    const d = doc.data() ?? {};
    const clear = {};
    const notes = [];
    for (const [field, c] of [["email", classify(d.email)], ["phone", classify(d.phone)]]) {
      if (!c.present) continue;
      if (c.real) {
        realLeaks += 1;
        console.error(`🚨 ${doc.id}: ${field} is a ${c.desc} — REAL contact data the migration left. Investigate.`);
      } else {
        clear[field] = admin.firestore.FieldValue.delete();
        notes.push(`${field}=${c.desc}`);
      }
    }
    if (Object.keys(clear).length > 0) plan.push({ ref: doc.ref, id: doc.id, clear, notes });
  }

  if (realLeaks > 0) {
    console.error(`\nABORT: ${realLeaks} real contact value(s) found — NOTHING was written.`);
    console.error("Re-check migrateSensitiveFieldsToPrivate before scrubbing.");
    process.exit(1);
  }

  // Pass 2: apply (or print) the empty-field deletes.
  for (const item of plan) {
    if (APPLY) {
      await item.ref.set(
        { ...item.clear, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      console.log(`✓ ${item.id}: deleted ${item.notes.join(", ")}`);
    } else {
      console.log(`would delete from ${item.id}: ${item.notes.join(", ")}`);
    }
  }

  console.log(`\n${APPLY ? "scrubbed" : "would scrub"}: ${plan.length} doc(s); real leaks: 0`);
  console.log(`Done (${APPLY ? "APPLY" : "DRY RUN"}). Re-run verify-lane-a.js to confirm ✅.`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message || e);
  process.exit(1);
});
