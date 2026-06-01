# Session 2026-06-01 — Heavy work: AI Phase-0 + submit-ready (TestFlight QR + App Store)

> One-doc summary of the 2026-06-01 push. **Source of truth stays
> [submit-and-ai-plan.md](./submit-and-ai-plan.md)** (the audited plan) + [STATUS.md](./STATUS.md)
> (canonical build state). This doc = what landed today + glaring issues + the exact submit commands.
>
> **State of play:** app is **CODE-SUBMIT-READY** — zero code-side blockers. Submission is a
> **Fardeen-run manual chain** (deploy → APNs → device re-test → real-$ smoke → ASC → build/submit),
> NOT feature work. The AI work below is **parallel, not a blocker.**

## Guardrails (carry forward)
Fardeen runs ALL git/deploy/EAS/Firebase/ASC — Claude supplies commands, never executes. One-liner
commit subjects (no body/trailer). `/vibe-security` on any auth/payments/rules diff. No
bet/wager/gamble/win/pool language. Keep `APP_CHECK_ENFORCED=false`. `STRIPE_SECRET_KEY` is LIVE.

---

## What landed this session

### Part 3 — AI Phase-0 in-app data capture (BUILT, flag-on) — analytics only, NO money-path change
- `src/types/index.ts` — `SurrenderReason` union + `Session.{startedAtLocalHour,dayOfWeek,surrenderReason,surrenderNote}`.
- `src/constants/config.ts` — `AI_DATA_CAPTURE_ENABLED` (default **true**, env-overridable) + `AI_STAKE_CALIBRATION_ENABLED = false` (placeholder).
- `src/store/sessionStore.ts` — `startSession` derives `startedAtLocalHour`/`dayOfWeek` from the canonical start; persists via DEMO `writeSession` + a prod **fire-and-forget `updateSession`**. `surrenderSession(reason?, note?)` persists the reason fire-and-forget. No `cloudForfeit`/CF signature or money change.
- `src/config/firebase.ts` — `updateSession` made **status-optional** (so metadata writes don't touch `status`) + writes the new keys; `writeSession`/`SessionDoc` extended.
- `app/session/surrender.tsx` — one-tap reason **chips** (6 values) + optional note above the type-QUIT confirm; best-effort persist.
- `firebase/firestore.rules` — **sessions update allowlist expanded** with the 4 benign keys (+ `is string/int` + size/range guards). **This is the enabler** — see Glaring Issue #1. `/vibe-security` run on the rules diff: clean (no Critical/High; financial fields stay immutable, ownership gate intact).

### Part 4 — `ml/` offline Bayesian research artifact (synthetic, decoupled from `sk_live_`)
Built in a background workflow (NumPyro hierarchical monotonic dose-response + Thompson-sampling bandit for the *minimum effective stake*; reward = `completed − λ·stake`). Files: `README.md`, `requirements.txt`, `simulate.py`, `model.py`, `bandit.py`, `train.py`, `evaluate.py`. `ml/` added to **`.easignore`** (never bundled). Commit `ml/**` after the workflow finishes (verify: `pip install -r ml/requirements.txt && python ml/train.py`).

### Part 5 — STATUS.md patched
Audit close-out banner added: APNs `.p8` as an explicit submit step; `migrateSensitiveFieldsToPrivate` run-status (NOT yet run); screen-protection post-event flip; engagement-gate still-needs-finalizing; AI marked parallel.

---

## ⚠️ Glaring issues (read this)

1. **Phase-0 capture was silently dead in prod without the rules change (FIXED).** Fire-and-forget
   `updateSession` writes are `.catch`-swallowed, so the blocked write would have looked fine while
   persisting **nothing**. The `sessions` update rule's `hasOnly` allowlist rejected the new keys.
   Fixed by expanding the allowlist. **Takes effect only after the `firestore:rules` deploy.**
2. **Surrender-reason topology gap — RESOLVED (safely).** The solo confirm is a shared
   `HoldToConfirmModal` in `active.tsx` with delicate `performSurrender`/`stopBlocking` timing —
   re-routing it pre-submit was the wrong risk. Capture now happens on **`app/session/complete.tsx`**
   (the universal funnel — solo, firestore-group, legacy surrenders all land there), shown only when a
   session was surrendered **without** a reason (never double-asks the group screen). Persists
   fire-and-forget to the `sessions` doc (rule-allowlisted). **Zero money-path change** —
   `HoldToConfirmModal`/`performSurrender` untouched. Group-session reason still needs a CF to persist
   (server-only docs) — out of scope, deferred.
3. **Solo complete→payout race fix is post-deploy only** (`sessionStore.ts:343`; CF is the sole status
   writer). Prod still runs the OLD `launch` functions until the deploy. This is **Part 1.4 — the #1
   re-test**. If it fails on device after deploy, **STOP — redeploy, do not submit.**
4. **Withdrawal minute-bucket double-debit** (`functions/src/index.ts:3813`, pre-existing,
   accepted-open): two same-amount withdrawals in one minute double-debit the wallet but fire one
   Stripe transfer. Mitigated by the 3/hr rate limit + billing kill-switch. **Watch Stripe/Firestore
   during the live event.**
5. **DEMO session docs are local-only** (`sessions` create:`if false`): DEMO `writeSession` is
   rejected + `.catch`-logged. Expected — DEMO is local-source-of-truth. Don't expect DEMO session
   docs (or DEMO time-of-day) in Firestore; verify capture on a **real** (non-demo) session.

---

## Verify (propose — Fardeen runs; don't execute without ask)
```bash
node_modules/.bin/tsc --noEmit                                   # expect clean
node_modules/.bin/eslint app/session/surrender.tsx src/store/sessionStore.ts src/config/firebase.ts src/constants/config.ts src/types/index.ts
node_modules/.bin/jest --runInBand src/__tests__/unit            # pure-logic suites (full run flaky on Node≥24)
# ml/ (after the workflow writes it):
pip install -r ml/requirements.txt && python ml/train.py && python ml/evaluate.py
```

## Commit grouping (Fardeen runs git; one-liner subjects)
1. `feat(data): Phase-0 capture — surrender reason + session time-of-day`
   → `src/types/index.ts`, `src/constants/config.ts`, `src/store/sessionStore.ts`,
   `src/config/firebase.ts`, `app/session/surrender.tsx`, `app/session/complete.tsx`,
   **`firebase/firestore.rules`** (allowlist — rules diff, `/vibe-security` clean).
2. `chore(ml): offline Bayesian stake-calibration prototype (synthetic data)` → `ml/**`, `.easignore`.
3. `docs(status): fold APNs/migration/screen-protection/gate + mark AI parallel`
   → `docs/STATUS.md`, `docs/session-2026-06-01-heavy-work.md`.

---

## Part 1 — SUBMIT critical path (the real gate — exact commands)
```bash
# 1. functions deps (functions use npm, not pnpm)
cd functions && npm install && cd ..

# 2. DEPLOY (LIVE, IRREVERSIBLE) — also ships the Part-3 rules allowlist + the bucket-ledger/
#    deposit-idempotency/PII/legal-idempotency fixes that are committed but not yet deployed
firebase deploy --only functions,firestore:rules,firestore:indexes

# 3. APNs .p8 → Firebase Console → Cloud Messaging (Apple Team 4R55F73KCP).
#    Defer option: set EXPO_PUBLIC_DISABLE_PHONE_AUTH=true (Google/Apple-only).

# 4. ⭐ POST-DEPLOY device re-test (highest-risk): fresh non-demo account (NOT cMtHvQ…),
#    deposit → start solo → complete → confirm confetti + balance up + Firestore status=completed
#    + actualPayout + a payout txn. Repeat ×3 across cadences. IF IT FAILS → STOP, redeploy, do not submit.

# 5. Controlled real-$ smoke — follow docs/smoke-test-2026-05-30.md (tiny real money; watch
#    Firestore / Stripe / webhook 200s). Fix → redeploy loop.

# 6. (optional) run the Lane-A money-path verifier read-only:
gcloud auth application-default login && node functions/scripts/verify-lane-a.js
#    and the migration (paginate via nextCursor):
#    curl -X POST -H "x-admin-key: $ADMIN_API_KEY" -d '{}' \
#      https://us-central1-niyah-b972d.cloudfunctions.net/migrateSensitiveFieldsToPrivate

# 7. ASC metadata: Publish App Privacy (10 types, Linked=true/Tracking=false), account-deletion +
#    support URLs, screenshots, description/keywords, review notes (Stripe = user's OWN funds not IAP;
#    commitment-contract not gambling; Productivity).

# 8. Build + submit
eas build --profile production --platform ios
eas submit --platform ios --profile production

# Pre-flight re-confirms (cheap, every time): DEMO_MODE=false, APP_CHECK_ENFORCED=false,
#   serverFlags.promoCents=0, STRIPE_SECRET_KEY=sk_live_, niyah.live/legal/{privacy,terms} load.
```
→ Then external TestFlight public-QR track (Beta App Review → public link → sticker QR) per
[techweek-2026-06-launch.md](./techweek-2026-06-launch.md).

## Pointers
[submit-and-ai-plan.md](./submit-and-ai-plan.md) (source of truth) · [STATUS.md](./STATUS.md) ·
[ai-integration.md](./ai-integration.md) · [smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md) ·
[techweek-2026-06-launch.md](./techweek-2026-06-launch.md).
