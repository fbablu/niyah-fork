# Session 2026-05-29 — Orchestration + Lane A Summary & Merge Runbook

> **Master handoff.** A new Claude Code session should read **this** + each lane's own
> summary, then execute the add → commit → push → merge order in §3. This file is
> authoritative for the **merge phase**; it ties the five parallel lanes together.
>
> **Also read:** [lanes.md](lanes.md) (lane scope + kickoff prompts), [may-26-resume.md](may-26-resume.md)
> + [legal.md](legal.md) (product/launch context). Decision memory: `project_gambling_deferred_v2`.

---

## 0. Goal + the one big decision

- **Goal:** submit **de-pooled commitment-contract v1** to the App Store (~Jun 1, pre-NYC tech week).
- **DECISION (locked 2026-05-29):** NO re-pool / parlay / prediction-market in v1. The gambling
  vision is a **licensed v2 roadmap pitched to investors, not shipped.** Re-pooling re-creates the
  exact gatekeeper risks the branch removed: Apple Guideline 5.3, Stripe prohibited-business freeze
  (funds held on a LIVE `sk_live_` account), MSB/MTL money-transmission. Keep `calculateTransfers`=`[]`,
  `calculateGroupSessionPayouts` = own-stake-back, completion multiplier dormant at 1.0×.

---

## 1. What this session did (orchestrator + Lane A)

### Parallel audit (9-agent workflow)
Doc-vs-code reconciliation, navigability map, verified security sweep, dead-code, App Store readiness,
gambling-pivot risk. Outputs → seeded the five lanes below. Headlines: 2 verified High security bugs
(fixed in Lane A); app is submittable after ~5 small copy fixes (Lane B); 29 docs → ~12 (Lane D);
gambling = hard-NO-for-v1.

### Lane A — security / money-path (DONE + VERIFIED, committed on `wallet-ledger`)
Files: `functions/src/index.ts`, `firebase/firestore.rules`, `src/config/firebase.ts`,
`src/store/authStore.ts`, `src/__tests__/unit/config/firebase.test.ts`,
`functions/scripts/verify-lane-a.js` (new, read-only).

1. **Deposit double-credit (was High).** New shared `creditCardDeposit()` helper uses a deterministic
   `transactions/deposit_<paymentIntentId>` doc id checked **inside** `runTransaction` → race-safe
   across the client `verifyAndCreditDeposit` and the `stripeWebhook` backup handler. `depositedBalance`
   now stays in lockstep with `balance` on **both** paths (also closed the webhook bucket gap).
2. **email/phone PII leak (was High).** Removed from the world-readable `users/{uid}`. `acceptLegalTerms`
   now strips them and writes an **auth-verified** contact index `{email(lowercased), phoneNumber}` to
   owner-only `userPrivate/{uid}`. `findContactsOnNiyah` repointed to `userPrivate` (then hydrates
   name/reputation from `users`). 5 Stripe customer/Connect email+phone prefills repointed to the merged
   view. `migrateSensitiveFieldsToPrivate` extended to migrate + scrub existing docs. Rules CREATE
   denylist hardened (`+phone,email`, also blocks contact-impersonation-on-create). `saveUserProfile`
   stops writing them. Test flipped to **pin the absence** of PII on the public doc.
3. **Group-invite push copy** de-pooled ("winner takes the pool" → "finish your focus goal to get your
   stake back").
4. **Sentry** user context = `uid` only (no email).

**Verification:** tsc clean both sides; 38/38 functions tests; 796 client tests pass. `/vibe-security`
on the diff: no Critical/High introduced, both Highs closed. Deeper QA traced edge cases
(ACH-processing, double-tap, legacy deposits, phone-only users, Apple relay email, existing Stripe
customers, legal-acceptance ordering) — all clean. `verify-lane-a.js` is the read-only post-deploy gate.

### Cross-lane coordination (orchestrator decisions)
- **Lane C ruling.** The `settlement_paid/received` + `DuoSession` types are entangled with a
  still-present but **INERT** group-transfer layer (`session.transfers` is always `[]`, so nothing moves
  money). Lane C does **only** the `partnerStore` duo-method removal + its tests, and **does NOT touch
  `src/types/index.ts`** — so it never collides with the type removal below.
- **Sequenced group-transfer de-pool (orchestrator owns; runs AFTER Lane C merges).** Remove
  `recordSettlement` (`walletStore`), `markTransfer*` (`groupSessionStore`), the dead `inbound`/`transfers`
  branch in `app/(tabs)/index.tsx:890`, and the `settlement/transfer/Duo` types in `types/index.ts`; update
  the group tests. This is **cleanup, not a submission blocker** (no live money path).

---

## 2. Lane map — worktrees already exist (do NOT re-create)

| Folder | Branch | Lane | Owns (only edits) | Status |
|---|---|---|---|---|
| `~/Documents/Projects/niyah` | `wallet-ledger` | **A** (orchestrator) | `functions/src/index.ts`, `firebase/firestore.rules`, `src/config/firebase.ts`, `src/store/authStore.ts`, `functions/scripts/*`, that test | code done; **commit pending** |
| `~/Documents/Projects/niyah-docs` | `chore/docs` | **D** | `docs/**`, root `*.md`, subdir `CLAUDE.md`, `.claude/settings.json` | has commits |
| `~/Documents/Projects/niyah-deadcode` | `chore/dead-code` | **C** | `src/store/partnerStore.ts` (+ its tests) — **NOT** `types/index.ts` | has commits |
| `~/Documents/Projects/niyah-appstore` | `fix/appstore-copy` | **B** | `src/components/LegalContentView.tsx`, `app/session/waiting-room.tsx`, `src/config/functions.ts` | has commits |
| `~/Documents/Projects/niyah-ux` | `feat/ux-onboarding` | **E** | `src/components/onboarding/**`, `app/(auth)/welcome.tsx`, `app/session/select.tsx`, anim assets | in progress |

All lanes own **disjoint files** → merges are expected to be **conflict-free**. Lane A is committed
directly on `wallet-ledger` (the base), so it is NOT a branch to merge — the others merge *into* it.

---

## 3. add → commit → push → merge order (AUTHORITATIVE)

> Do NOT `git add package.json pnpm-lock.yaml` in the Lane A commit — those are unrelated dep bumps.

### 3a. Commit each lane *in its own folder*
```bash
# Lane A — main folder (selective add; excludes the dep bumps)
cd ~/Documents/Projects/niyah
git add functions/src/index.ts firebase/firestore.rules src/config/firebase.ts \
        src/store/authStore.ts src/__tests__/unit/config/firebase.test.ts \
        functions/scripts/verify-lane-a.js
git commit -m "fix(security): deposit idempotency + email/phone PII leak + Sentry/copy hygiene"

# Lanes B/C/D/E — each in its own folder (disjoint files → git add -A is safe per folder)
cd ~/Documents/Projects/niyah-appstore && git add -A && git commit -m "fix(appstore): support email + invite domain + drop dead venmo union"
cd ~/Documents/Projects/niyah-deadcode && git add -A && git commit -m "chore: remove dead duo-session methods from partnerStore"
cd ~/Documents/Projects/niyah-docs     && git add -A && git commit -m "docs: consolidate + CLAUDE.md hierarchy + STATUS.md"
cd ~/Documents/Projects/niyah-ux       && git add -A && git commit -m "feat(onboarding): reanimated polish + session-select presets"
```

### 3b. (Optional) push each branch for backup / PRs
```bash
git -C ~/Documents/Projects/niyah        push -u origin wallet-ledger
git -C ~/Documents/Projects/niyah-appstore push -u origin fix/appstore-copy
git -C ~/Documents/Projects/niyah-deadcode push -u origin chore/dead-code
git -C ~/Documents/Projects/niyah-docs     push -u origin chore/docs
git -C ~/Documents/Projects/niyah-ux       push -u origin feat/ux-onboarding
```

### 3c. Merge into `wallet-ledger` (run in the MAIN folder), `pnpm ci` after each
Order = lowest-risk → highest-risk. Lane A is already on `wallet-ledger`.
```bash
cd ~/Documents/Projects/niyah
git checkout wallet-ledger

git merge --no-ff chore/docs         && pnpm ci   # D — docs, zero code risk
git merge --no-ff chore/dead-code    && pnpm ci   # C — partnerStore only

#   ── orchestrator step: group-transfer de-pool ──
#   NOW have Claude do the sequenced removal (walletStore.recordSettlement,
#   groupSessionStore.markTransfer*, app/(tabs)/index.tsx:890, types/index.ts
#   settlement/transfer/Duo types, group tests). Commit it. Re-run pnpm ci.

git merge --no-ff fix/appstore-copy  && pnpm ci   # B — copy
git merge --no-ff feat/ux-onboarding && pnpm ci   # E — UX, highest bug risk → manual QA after
```
If `pnpm ci` fails after a merge, that lane caused it — fix before the next merge.

### 3d. Ship `wallet-ledger` → `main`
```bash
git checkout main
git merge --no-ff wallet-ledger && pnpm ci
git push origin main
```

---

## 4. Post-merge: deploy → migrate → verify → submit

```bash
# 1. deploy server (rules + functions)
firebase deploy --only firestore:rules,functions

# 2. scrub existing docs of the email/phone leak (paginate until no nextCursor)
curl -X POST -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"dryRun":true}' https://us-central1-niyah-b972d.cloudfunctions.net/migrateSensitiveFieldsToPrivate
#   then drop dryRun to execute; pass nextCursor back as cursor until done

# 3. verify both Lane A fixes (read-only)
gcloud auth application-default login
cd functions && node scripts/verify-lane-a.js            # global gate
node scripts/verify-lane-a.js <test-uid>                 # per-user deep dive

# 4. build + submit
pnpm build:production                                     # then App Store Connect submit
```
On-device QA: fresh deposit credits exactly once (double-tap to stress the race); `users/{uid}` has no
email/phone, `userPrivate/{uid}` has the contact index; contact discovery still finds a known friend;
Sentry user = uid only.

---

## 5. Hard constraints (carry forward — verbatim)
- `STRIPE_SECRET_KEY` is **LIVE** (`sk_live_`) — real refunds/charges/transfers fire.
- Keep `APP_CHECK_ENFORCED=false` until App Check Metrics ≥99% verified (else lockout).
- `/vibe-security` on any auth/payments/rules diff before commit; fix Critical+High first.
- No `bet/wager/gamble/win/pool` in user-facing copy — `stake/commitment/goal/complete/Earned`.
- No `firebase deploy` / merge-to-`main` / push without explicit user go-ahead.
- Drifted test account `cMtHvQkJJZOgU6pgYARj8nN5Wpf1` stays frozen — don't reuse for clean tests.
- Multiplier stays 1.0× until the payout cap (`min(1× net deposits, $50)`) is built (post-submit).

---

## 6. Read next (per-lane detail)
Each lane's own CC session prints a summary in its worktree — read all five for full file-level detail,
then execute §3 here. Authoritative product context stays in `may-26-resume.md` + `legal.md`; Lane D is
folding the session/resume sprawl into `docs/STATUS.md`.
