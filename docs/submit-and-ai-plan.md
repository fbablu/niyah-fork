# Submit + AI Integration — Audited Plan

> **Source of truth** for the "finish last-minute work → submit to App Store" push **and** the
> parallel AI-integration build. Audited 2026-05-31 (3 read-only agents: submission readiness,
> security/admin completeness, remaining features/QA). Point a new Claude Code session at this file.
>
> Companion docs: [STATUS.md](./STATUS.md) (canonical build state) · [ai-integration.md](./ai-integration.md)
> (AI design doc) · [techweek-2026-06-launch.md](./techweek-2026-06-launch.md) (TestFlight/event track) ·
> [smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md) (money-path smoke).

## TL;DR — is the app submittable?

**YES, on code — zero code-side blockers remain.** The remaining gate is a **Fardeen-run manual
chain + one post-deploy device re-test**, not feature work.

- **The AI work (Phase-0 capture + `ml/`) is NOT on the path to submission** — it is parallel/optional
  (the "discuss-later moat"). Building it does not get you closer to submit; the **Long Pole** does.
- **"Admin/security mostly complete" = TRUE** — Firestore rules (PII off public docs, wallet
  client-immutable), admin-key constant-time compare, Stripe webhook signature verify + IP allowlist,
  account-merge takeover protection, and server-side daily stake cap are all verified DONE. Two items
  are intentionally open and documented (App Check off; withdrawal minute-bucket double-debit) — both
  accepted-with-mitigation, neither a submit blocker.

**Code-side submit prerequisites verified DONE (evidence):** privacy manifest (`app.config.js`
10 data types + generated `PrivacyInfo.xcprivacy`), `ITSAppUsesNonExemptEncryption:false`, all
`NSUsageDescription` strings, in-app account deletion (UI `app/(tabs)/profile.tsx` + CF
`deleteAccount` in `functions/src/index.ts`), hosted legal live (`niyah.live/legal/{privacy,terms}`)
+ support email, version/bundle/build (`1.0.0` / `com.niyah.app` / `11`), `eas.json` production =
store distribution.

**Decisions locked (2026-05-31):** build the AI work **fully now** — Phase-0 in-app capture (flag-on)
+ the `ml/` artifact, **full Bayesian (NumPyro)**. Screen-capture protection **stays OFF** for the
submitted build with a **tracked post-event flip**. Proceed from research summaries (paste papers later).

**Guardrails:** Fardeen runs ALL git/deploy/EAS/Firebase/ASC — supply exact commands, never execute.
One-liner commit subjects, no body/trailer. `/vibe-security` on any auth/payments/rules diff. No
bet/wager/gamble/win/pool language. Keep `APP_CHECK_ENFORCED=false`. `STRIPE_SECRET_KEY` is LIVE.

---

## Part 1 — SUBMIT CRITICAL PATH (the real gate — Fardeen-run; Claude supplies commands)

1. **Deps:** `cd functions && npm install` (functions use **npm**, not pnpm).
2. **Deploy (LIVE, irreversible):**
   `firebase deploy --only functions,firestore:rules,firestore:indexes` — activates the bucket
   ledger + deposit-idempotency/PII fixes (`d81eb93`, `5c95f12`) + legal-acceptance idempotency.
3. **APNs `.p8`** → Firebase Console → Cloud Messaging (Team `4R55F73KCP`). *(Defer option:*
   `EXPO_PUBLIC_DISABLE_PHONE_AUTH=true` → Google/Apple-only.)*
4. **⭐ Post-deploy device re-test: solo complete → payout** — the single highest-risk item. The race
   fix (`src/store/sessionStore.ts:343` — the CF is the sole status writer in prod) only takes effect
   post-deploy. On a **fresh** account (NOT frozen `cMtHvQ…`), non-demo build: deposit → start solo →
   complete → confirm confetti + balance increments + Firestore `status=completed` + `actualPayout` +
   a payout txn. Repeat ×3 across cadences. **If it fails, STOP and redeploy — do not submit.**
5. **Controlled real-$ smoke** ([smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)), tiny real
   money; watch Firestore / Stripe / webhook deliveries (200s). Fix → redeploy loop.
6. **ASC metadata:** Publish App Privacy (10 types, Linked=true / Tracking=false), confirm
   account-deletion + support URLs, screenshots, description/keywords, **review notes** (Stripe = the
   user's **own funds** not IAP; **commitment-contract, not gambling**; **Productivity**).
7. **Build + submit:** `eas build --profile production --platform ios` →
   `eas submit --platform ios --profile production`.
8. **Pre-flight re-confirms (cheap, every time):** `DEMO_MODE=false`, `APP_CHECK_ENFORCED=false`,
   `serverFlags.promoCents=0`, `STRIPE_SECRET_KEY` is `sk_live_`, `niyah.live/legal/{privacy,terms}` load.

→ Then Lane B external TestFlight (Beta review → public QR) per
[techweek-2026-06-launch.md](./techweek-2026-06-launch.md).

**Accepted-open (documented, NOT blockers; monitor):** `APP_CHECK_ENFORCED=false` (intentional until
App Check metrics ≥ 99%); withdrawal minute-bucket double-debit (`functions/src/index.ts:3813`;
mitigated by 3/hr rate limit + billing kill-switch — watch Stripe/Firestore during the event);
screen-capture protection OFF (post-event flip, below).

---

## Part 2 — Manual-QA must-fix surface (functional / reviewer-visible)

Walk in `EXPO_PUBLIC_DEMO_MODE=true` **except** the one post-deploy money re-test (Part 1.4, real build):

- **Legal gate fires before profile-setup** (auth ×3 → overlay → "I am 18+" → links resolve to the
  hosted pages) — reviewer + compliance check.
- **Full screen inventory** (~40 routes): auth ×3, onboarding carousel, session loop solo+group
  (`select → confirm → active → complete / surrender`, `propose → waiting-room`), friends, profile
  (theme / legal / bank / **delete account**), **logout → re-auth reset**, deposit/withdraw (incl.
  FL/HI geo-gate).
- Verify the new **deposit/withdraw `MoneySuccessOverlay`** + **dashboard `StatCard` pop** behave on
  device (audit: integrate cleanly).
- Known rough spots (note/fix): <5.5" portrait fit (NumPad / MoneyPlant), `app/session/propose.tsx:366`
  discover fallback, occasional haptic double-fire — **all cosmetic / post-submit** unless they break a flow.

**Highest-risk QA focus:** the solo complete → payout money mutation (Part 1.4). A success that fails
to post a payout is a stake loss — worst case for a real-money app, and only valid once deployed.

---

## Part 3 — AI Phase-0 in-app data capture (BUILD NOW, flag-on) *(no money-path / CF changes)*

Starts the data flywheel the moat needs. Pattern: a **fire-and-forget `updateSession`** for the
reason (mirrors the existing `violationCount` update in `src/store/sessionStore.ts:189`) + derive
time-of-day at the existing session write. **Does not change `cloudForfeit` / any CF signature or
money logic.**

- **`src/types/index.ts`** — add to `Session` (~L113) + the Firestore session shape:
  `surrenderReason?: SurrenderReason`, `startedAtLocalHour?: number` (0–23), `dayOfWeek?: number`
  (0–6). Add a `SurrenderReason` union: `"distracted" | "interrupted" | "too_long" |
  "lost_motivation" | "emergency" | "other"`. (No new transaction types — no money meaning.)
- **`src/constants/config.ts`** — `AI_DATA_CAPTURE_ENABLED` (default **true** per decision) +
  placeholder `AI_STAKE_CALIBRATION_ENABLED = false` for later phases.
- **Time-of-day:** in `src/store/sessionStore.ts` `startSession` (~L70), where `startedAtMs` is known,
  derive hour/day-of-week and include them in the session object + the `src/config/firebase.ts`
  `createSession` `setDoc` (~L534) payload. Deterministic.
- **Surrender-reason chips:** in `app/session/surrender.tsx`, add a one-tap chip row (the six
  `SurrenderReason` values) + optional note above the type-QUIT confirm; on confirm, persist via a
  separate fire-and-forget `updateSession`. Reuse existing Button/chip styling + `logger`.
  **This expands the manual-QA surface → include the surrender screen in Part 2.**

**Out of scope for Phase 0:** variable solo stake lever (Phase 1), per-app violation breakdown
(privacy/native), any in-app model inference.

---

## Part 4 — `ml/` standalone Bayesian research artifact (offline; decoupled from `sk_live_`)

New top-level **`ml/`** Python subproject; **add `ml/` to `.easignore`** (Metro won't bundle it;
keeps it out of the EAS upload). Trains on a **synthetic simulator** of the doc's dose-response story
(no real data exists yet). Two simple-but-novel methods:

- **Method 1 — Hierarchical Bayesian monotonic dose-response (the model).**
  `P(complete | user, difficulty, stake)`, constrained **monotone non-decreasing in stake** (loss
  aversion) with an avoidance ceiling; per-user effects **partially pooled** toward a population prior
  (cold start = population mean, shrinks to personal as sessions accrue). Posterior via **NumPyro
  NUTS**. "Minimum effective stake" = smallest `s` with `P(complete) ≥ target` (default 0.80). Maps to
  the doc: effective stake ≈ sensitivity × difficulty.
- **Method 2 — Thompson-sampling contextual bandit (the selector).**
  Sample params from the posterior; choose the **smallest** stake ≤ `DAILY_STAKE_CAP_CENTS` meeting
  the target. Reward `= completed − λ · stake_risked` ⇒ the optimum **is** the lowest effective stake
  (harm-reduction is the objective, not a bolt-on). New users explore more (wide posterior),
  warm-started from the population prior.

**Files:**
- `ml/README.md` — research note: problem framing + mapping to Niyah fields (`stakeAmount`,
  `violationCount`, `screenTime`, completion), the generative model, the two methods, the
  harm-reduction math, cold start, limitations, path-to-production (advisory, cap-respecting, counsel
  sign-off), and the citations below.
- `ml/requirements.txt` — `numpyro`, `jax`, `numpy`, `matplotlib`, `arviz`.
- `ml/simulate.py` — synthetic DGP: latent per-user sensitivity; per-session difficulty (proxy for
  screen-time / violation pull); stake; outcome from the monotone dose-response; emits
  `(user, context, stake, outcome)` + ground-truth min-effective-stake per user for eval.
- `ml/model.py` — the NumPyro hierarchical monotonic dose-response model + posterior fit.
- `ml/bandit.py` — Thompson-sampling selector, harm-reduction reward, min-effective-stake solver,
  population-prior warm start.
- `ml/train.py` — fit on simulated data; plot learned per-user curves vs ground truth + calibration.
- `ml/evaluate.py` — online A/B sim: **fixed preset vs calibrated** over a session stream → report
  completion-rate lift, **average stake risked** (harm reduction), regret, cold-start curve.

**Citations** (from this session's research; proceed from summaries, paste full text later to tighten
equations):
- Monotonicity: Runje & Shankaranarayana, *Constrained Monotonic NNs*, ICML 2023; Wehenkel & Louppe,
  *UMNN*, NeurIPS 2019 (arXiv:1908.05164).
- Hierarchical dose-response: Neuenschwander et al., *Bayesian hierarchical Emax*, Pharm. Stat. 2019;
  Wörtwein et al., *Neural Mixed Effects* (arXiv:2306.08149).
- Bandit: Agrawal & Goyal, *Thompson Sampling for Linear Payoffs*, ICML 2013 (arXiv:1209.3352);
  Riquelme et al., *Deep Bayesian Bandits Showdown*, ICLR 2018 (arXiv:1802.09127); Shen et al.,
  *SEEDA* (safe dose-finding), ICML 2020 (arXiv:2006.05026).

---

## Part 5 — Doc patches (Claude code; Fardeen commits) — close the audit's gaps

Patch **`docs/STATUS.md`**: add **APNs `.p8`** explicitly into the "Remaining to submit" step list
(today it only lives in the techweek doc); state the **`migrateSensitiveFieldsToPrivate` run-status**;
record the **screen-protection post-event flip** (`src/hooks/useScreenProtection.ts:33` stays OFF for
the submit build, flip after the event) as a tracked decision; note the **engagement-gate definition
still needs finalizing**; add a one-liner that **AI work is parallel, not a submit blocker**.

---

## Verification

- **Part 1/2:** post-deploy solo complete → payout re-test passes on device (`balance == Σbuckets`,
  exact stake returns); legal gate + hosted links verified; pre-flight flags confirmed.
- **Part 3:** `node_modules/.bin/tsc --noEmit` clean; eslint clean on changed files; pure-logic suites
  green (`node_modules/.bin/jest --runInBand src/__tests__/unit/...` — note: the full Jest run is
  flaky under Node ≥ 24 sandboxes; the firebase-mock suites crash workers, unrelated to changes);
  manual: a demo surrender writes `surrenderReason` + `startedAtLocalHour` / `dayOfWeek` to the
  session doc; **forfeit / money path unchanged** (no `cloudForfeit` signature change). `/vibe-security`
  not triggered (no auth/payments/rules logic).
- **Part 4:** `pip install -r ml/requirements.txt`; `python ml/train.py` recovers per-user sensitivity
  from synthetic data; `python ml/evaluate.py` shows the calibrated bandit lifts completion **and**
  lowers average stake risked vs the fixed preset, converging to the ground-truth minimum effective
  stake. `ml/` is in `.easignore` → Metro/EAS build unaffected.

## Commit grouping (Fardeen runs git)

1. `feat(data): Phase-0 capture — surrender reason + session time-of-day`
   → `src/types/index.ts`, `src/constants/config.ts`, `src/store/sessionStore.ts`,
   `src/config/firebase.ts`, `app/session/surrender.tsx`.
2. `chore(ml): offline Bayesian stake-calibration research prototype (synthetic data)`
   → `ml/**`, `.easignore`.
3. `docs(status): fold APNs/migration/screen-protection/gate + mark AI parallel`
   → `docs/STATUS.md`.

---

## Handoff prompt for a NEW Claude Code session

```
Niyah, branch wallet-ledger (== main == origin/main). Read FIRST, in order:
docs/submit-and-ai-plan.md  (the full audited plan — source of truth for this work),
docs/STATUS.md,  docs/ai-integration.md,  docs/techweek-2026-06-launch.md,  docs/smoke-test-2026-05-30.md.

State of play (audited 2026-05-31): the app is CODE-SUBMIT-READY — zero code-side blockers. Submission
is gated on a Fardeen-run manual chain (functions deploy -> APNs .p8 -> post-deploy device re-test of
solo complete->payout -> real-$ smoke -> ASC metadata -> eas build/submit), NOT on any feature work.
Admin/security is verified mostly-complete. The AI work below is PARALLEL, not a submit blocker.

GUARDRAILS: I (Fardeen) run ALL git/deploy/EAS/Firebase/ASC actions — give me exact commands, never
execute them. One-liner commit subjects, no body/trailer. /vibe-security on any auth/payments/rules
diff. No bet/wager/gamble/win/pool language. Keep APP_CHECK_ENFORCED=false. STRIPE_SECRET_KEY is LIVE.

Do, in this order (all specced in docs/submit-and-ai-plan.md — follow it):
  1) Part 3 — AI Phase-0 in-app data capture, BUILD NOW (flag AI_DATA_CAPTURE_ENABLED default on):
     surrenderReason chips + optional note in app/session/surrender.tsx (persist via fire-and-forget
     updateSession — do NOT change cloudForfeit/CF signatures or any money logic); derive
     startedAtLocalHour/dayOfWeek at the session write (sessionStore.startSession + firebase.createSession);
     add types to src/types/index.ts + the flag to src/constants/config.ts. Keep tsc + eslint + the
     pure-logic jest suites green. This expands the manual-QA surface (include the surrender screen).
  2) Part 4 — ml/ standalone NumPyro research artifact (offline, synthetic data, add ml/ to .easignore):
     hierarchical Bayesian monotonic dose-response + Thompson-sampling bandit for the MINIMUM EFFECTIVE
     STAKE, harm-reduction reward = completed - lambda*stake. Files: README.md, requirements.txt,
     simulate.py, model.py, bandit.py, train.py, evaluate.py. Citations are in the plan.
  3) Part 5 — patch docs/STATUS.md: add APNs .p8 to the submit step list; state the
     migrateSensitiveFieldsToPrivate run-status; record the screen-protection post-event flip
     (useScreenProtection.ts:33 stays OFF for the submit build, flip after the event); note the
     engagement-gate definition still needs finalizing; mark AI work as parallel/not-a-blocker.

Then give me the exact Long Pole commands (Part 1) when I'm ready to deploy + submit. Do NOT run builds,
deploys, or tests without me asking — propose commands and suggested commit messages only.
```
