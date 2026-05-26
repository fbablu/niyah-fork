#!/usr/bin/env node
/**
 * diagnose-wallet.js — READ ONLY wallet/ledger diagnostic.
 *
 * Dumps a single user's wallet + every `transactions` doc, grouped by `type`
 * with signed subtotals, so we can see exactly where a balance-drift gap comes
 * from (missing deposits, double-counted withdrawals, untyped manual credits).
 *
 * This script performs ZERO writes. It only `.get()`s documents.
 *
 * Usage:
 *   cd functions
 *   node scripts/diagnose-wallet.js [uid]
 *
 * Defaults to the known-drifted account if no uid is passed.
 *
 * Auth (pick one, run once in this shell before the script):
 *   A) Application Default Credentials (recommended):
 *        gcloud auth application-default login
 *   B) Service-account key:
 *        # Firebase Console → Project Settings → Service accounts → Generate new private key
 *        export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/key.json"
 *
 * Project id is read from GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT if set,
 * else falls back to the constant below.
 */

const admin = require("firebase-admin");

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "niyah-b972d";

const DEFAULT_UID = "cMtHvQkJJZOgU6pgYARj8nN5Wpf1";
const uid = process.argv[2] || DEFAULT_UID;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// ── helpers ──────────────────────────────────────────────────────────────
const money = (cents) => {
  // Values in this codebase are integer cents. Show both raw + dollars.
  if (typeof cents !== "number" || !Number.isFinite(cents)) return `${cents}`;
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${cents} (${sign}$${(abs / 100).toFixed(2)})`;
};

const toDateStr = (v) => {
  if (!v) return "—";
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  return String(v);
};

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  console.log(`\n=== READ-ONLY wallet diagnostic ===`);
  console.log(`project: ${PROJECT_ID}`);
  console.log(`uid:     ${uid}\n`);

  // ── wallet doc ───────────────────────────────────────────────────────────
  const walletSnap = await db.collection("wallets").doc(uid).get();
  if (!walletSnap.exists) {
    console.log(`wallets/${uid} does NOT exist.`);
  } else {
    const w = walletSnap.data() || {};
    console.log(`--- wallets/${uid} ---`);
    console.log(`  balance:          ${money(w.balance)}`);
    if ("pendingBalance" in w) console.log(`  pendingBalance:   ${money(w.pendingBalance)}`);
    // Surface any bucket fields if they already exist (post-ledger migration).
    for (const k of ["depositedBalance", "earnedBalance", "bonusBalance", "creditBalance", "withdrawableBalance"]) {
      if (k in w) console.log(`  ${pad(k + ":", 18)}${money(w[k])}`);
    }
    console.log(`  frozen:           ${w.frozen === true ? "TRUE" : w.frozen}`);
    if (w.frozenReason) console.log(`  frozenReason:     ${w.frozenReason}`);
    if (w.frozenAt) console.log(`  frozenAt:         ${toDateStr(w.frozenAt)}`);
    if (w.mergeInProgress) console.log(`  mergeInProgress:  ${w.mergeInProgress} (startedAt ${toDateStr(w.mergeStartedAt)})`);
  }

  // ── transactions ─────────────────────────────────────────────────────────
  const txnSnap = await db
    .collection("transactions")
    .where("userId", "==", uid)
    .get();

  console.log(`\n--- transactions (userId == uid): ${txnSnap.size} docs ---`);

  const byType = new Map(); // type -> { count, sum, missingAmount, positive, negative }
  const anomalies = [];
  const rows = [];
  let grandSum = 0;

  txnSnap.forEach((d) => {
    const t = d.data();
    const type = typeof t.type === "string" ? t.type : "(no type)";
    const amount = typeof t.amount === "number" ? t.amount : null;

    if (!byType.has(type)) {
      byType.set(type, { count: 0, sum: 0, missingAmount: 0, positive: 0, negative: 0 });
    }
    const g = byType.get(type);
    g.count += 1;
    if (amount === null) {
      g.missingAmount += 1;
      anomalies.push(`  ${d.id}: type=${type} has NON-NUMERIC amount: ${JSON.stringify(t.amount)}`);
    } else {
      g.sum += amount;
      grandSum += amount;
      if (amount > 0) g.positive += 1;
      else if (amount < 0) g.negative += 1;
    }

    // Flag deposits with no payment-intent link (untracked / unrefundable on delete).
    if (type === "deposit" && !t.paymentIntentId && !t.payment_intent && !t.stripePaymentIntentId) {
      anomalies.push(`  ${d.id}: deposit with NO paymentIntentId (amount ${money(amount)})`);
    }

    rows.push({
      id: d.id,
      type,
      amount,
      status: t.status || t.state || "—",
      pi: t.paymentIntentId || t.payment_intent || t.stripePaymentIntentId || "",
      created: t.createdAt || t.timestamp || t.date,
    });
  });

  // grouped subtotals
  console.log(`\n  ${pad("type", 22)}${pad("count", 8)}${pad("signed subtotal", 22)}(+ / -)`);
  console.log(`  ${"-".repeat(60)}`);
  const types = [...byType.entries()].sort((a, b) => a[1].sum - b[1].sum);
  for (const [type, g] of types) {
    const flag = g.missingAmount ? `  ⚠ ${g.missingAmount} missing amount` : "";
    console.log(
      `  ${pad(type, 22)}${pad(g.count, 8)}${pad(money(g.sum), 22)}(${g.positive}+ / ${g.negative}-)${flag}`,
    );
  }
  console.log(`  ${"-".repeat(60)}`);
  console.log(`  ${pad("GRAND SUM", 22)}${pad(txnSnap.size, 8)}${money(grandSum)}`);

  // reconcile comparison (mirrors reconcileWalletBalances)
  const storedBalance =
    walletSnap.exists && typeof walletSnap.data().balance === "number"
      ? walletSnap.data().balance
      : 0;
  const delta = storedBalance - grandSum;
  console.log(`\n--- reconcile check (storedBalance - summedFromTransactions) ---`);
  console.log(`  storedBalance:          ${money(storedBalance)}`);
  console.log(`  summedFromTransactions: ${money(grandSum)}`);
  console.log(`  delta:                  ${money(delta)}   ${delta === 0 ? "✓ clean" : "⚠ DRIFT"}`);

  // anomalies
  if (anomalies.length) {
    console.log(`\n--- anomalies (${anomalies.length}) ---`);
    anomalies.forEach((a) => console.log(a));
  } else {
    console.log(`\n--- anomalies: none ---`);
  }

  // recent rows for eyeballing
  rows.sort((a, b) => {
    const av = a.created && a.created.toMillis ? a.created.toMillis() : 0;
    const bv = b.created && b.created.toMillis ? b.created.toMillis() : 0;
    return bv - av;
  });
  const N = Math.min(20, rows.length);
  console.log(`\n--- most recent ${N} transactions ---`);
  console.log(`  ${pad("created", 26)}${pad("type", 18)}${pad("amount", 18)}${pad("status", 14)}pi`);
  rows.slice(0, N).forEach((r) => {
    console.log(
      `  ${pad(toDateStr(r.created), 26)}${pad(r.type, 18)}${pad(money(r.amount), 18)}${pad(r.status, 14)}${r.pi}`,
    );
  });

  console.log(`\n=== done (no writes performed) ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("diagnostic failed:", err);
  process.exit(1);
});
