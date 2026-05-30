# STATUS — Niyah launch (canonical)

> **Single source of truth for "where the build is right now."** Read this first in a new session.
> Supersedes the old `may-26-resume.md`, `may-16-progress.md`, and the per-session summaries
> (now in [`archive/`](./archive/)). When state changes, update **this** file — don't spawn a new resume doc.
>
> Last updated: **2026-05-30.**

## Right now

- **Branch:** `wallet-ledger` — **22 commits ahead of `main`**, clean fast-forward (no divergence).
  All de-pool / legal / dead-code / privacy-manifest work is **committed** on this branch.
  - **2026-05-30 legal-UX polish (staged, not yet committed):** acceptance overlay redesigned;
    legal gate moved to fire right after sign-in (before profile setup); the permission-denied on
    accept fixed; `acceptLegalTerms` CF made idempotent. Detail in the **Legal** bullet below. The
    CF change needs the functions deploy to fully persist a new user's acceptance.
  - **2026-05-30 money-path security hardening (staged, not yet committed):** `/vibe-security` run on
    the branch → all findings fixed across 3 adversarial verification rounds. The bucket ledger
    (`balance == Σbuckets`) is now enforced **everywhere money moves**: withdrawal is bucket-aware;
    promo → `bonus`; delete refunds `deposited`-to-card only (+ pays/holds withdrawable house money,
    records forfeits, guards frozen/drifted wallets); group cancel/timeout refunds + account merge
    move buckets in lockstep; group refunds are now **idempotent**. Detail in **Audit findings**
    below. **Needs the functions + rules deploy to take effect.**
- **NOT merged, NOT pushed to `main`, NOT deployed.** Nothing live yet from this branch.
- **Tests green:** ~742 client (Jest) + **52/52 functions** (`wallet.test.ts` — 14
  bucket/withdrawal/deletion contract tests + `security`/`withdraw-earned`). Functions suites now
  run via `pnpm test:functions` (Node built-in runner + `tsx`) and are **gated in CI** (`ci` script
  + `.github/workflows/ci.yml`). `tsc` clean both sides, eslint 0 errors.
- **Deployed today:** the previously-shipped `launch` security/payments work (rules + functions
  deploy ran; migration ran 16 processed / 9 migrated). The landing `niyah.live/stripe/return`
  bounce is live. The `wallet-ledger` changes are **not** part of that — they ship at the next deploy.

### What `wallet-ledger` contains (the v1 submission binary)

Pilot scope is **locked**: ship a clean **de-pooled commitment-contract** binary. All earn-more /
bucket-multiplier machinery ships **dormant behind flags** (enforcement OFF) — the pilot behaves
like stickK (complete → get your exact stake back, `SOLO_COMPLETION_MULTIPLIER = 1`).

- **Server money-path** (`functions/src/wallet.ts` + `index.ts`): 4 wallet buckets
  (`deposited` / `earned` / `bonus` / `credit`), bucket-routed writers, txn taxonomy
  (`+bonus/credit/refund/forgiveness`). Group **de-pooled** (`calculateGroupSessionPayouts`: each
  completer gets their own stake back, forfeit → house, no redistribution). Settlement untangled
  (group payout = wallet credit like solo; the single cash-out transfer happens at withdrawal).
  Geo-gate: withdrawal refuses **FL + HI** (`WITHDRAWAL_EXCLUDED_STATES`). Dormant flags
  `SOLO_PAYOUT_MULTIPLIER` (default 1.0), clamped `[1.0, 2.0]`.
- **Client de-pool:** `payoutAlgorithm` own-stake-back, `calculateTransfers → []`,
  `SOLO_COMPLETION_MULTIPLIER = 1.0`. Settlement screens de-pooled (`surrender.tsx`,
  `complete.tsx`); the "Pay your partner via Venmo" flow removed; Venmo/Zelle/`photoURL` dead code
  purged client + server.
- **18+ self-attestation:** explicit "I am 18+" checkbox in `LegalAcceptanceOverlay` (Continue
  gated on it **and** ToS-accept). `ageAttested18` written server-side by `acceptLegalTerms`,
  client-immutable via `firestore.rules` denylist, hydrated in `authStore`. **No DOB stored** —
  Stripe KYC verifies real age at money-out.
- **Legal:** in-app `LegalContentView` rewritten de-pooled; `CURRENT_LEGAL_VERSION` 1.0.0 → **2.0.0**
  (re-prompts every user, backfills `ageAttested18`). Hosted ToS/Privacy as Next.js routes in
  `landing-pg/app/legal/{privacy,terms}/page.tsx` → `niyah.live/legal/{privacy,terms}`
  (build-verified; auto-deploys on merge to `main`). Governing law = **Delaware**.
  - **Acceptance UX (2026-05-30):** `LegalAcceptanceOverlay` is now a centered card with a 4-bullet
    plain-words summary + clean "Read full Terms / Privacy" links (`LEGAL_TERMS_URL` /
    `LEGAL_PRIVACY_URL` → hosted pages) instead of the full text inline. Acceptance now fires **right
    after sign-in, before profile-setup** — all sign-in paths (`auth-entry` Google/Apple,
    `verify-phone`) route through `/`, and `app/index.tsx` gates **legal → profile → tabs**. The dead
    client-side direct write of the legal fields (always blocked by the rules denylist →
    `permission-denied`) was removed from `authStore.acceptLegal`; `acceptLegalTerms` CF is the sole
    writer and is now **idempotent** (`.update` → `.set(merge)`) so it persists even before the
    profile doc exists. **Needs the functions deploy to take effect for new users** — until then a
    fresh account shows the right order but re-prompts once on next launch. Hosted-legal links 404
    until `landing-pg` is deployed.
- **Language sweep:** all user-facing "bet/wager/gamble/win"/overstated-payout copy replaced with
  stake/commitment/goal/complete/Earned (onboarding carousel, `select`, `complete`, `waiting-room`;
  crypto art dropped). See [legal.md](./legal.md) for the terminology rule.
- **iOS privacy manifest:** `app.config.js` `ios.privacyManifests` (NSPrivacyTracking false, 4
  accessed-API reason types, 10 collected data types). `NSPhotoLibraryUsageDescription` removed.

## Remaining to submit

These are the steps between here and an App Store build. **Fardeen runs all git/deploy/outward
actions** — Claude supplies messages only.

1. **Merge** `wallet-ledger` → `main` (clean fast-forward).
2. **Verify hosted legal live:** `niyah.live/legal/privacy` + `/legal/terms` (auto-deploys on merge).
3. **App Store Connect:** click **Publish** on App Privacy (10 data types, all Linked=true /
   Tracking=false); confirm account-deletion + support URLs; support email `support@niyah.live`
   (display name "Niyah Support", fix reply-from).
4. **Deploy** (merging code ≠ deploying — do before real users transact): run `/vibe-security` on
   the money-path diff, then `firebase deploy --only firestore:rules,functions`.
5. **Live infra:** confirm Stripe live key (`sk_live_`) + webhook; Plaid **prod** webhook URL +
   ITEM events (see [security-deploy-checklist.md](./security-deploy-checklist.md) Phase 4); Apple
   **APNs Auth Key** (.p8) → Firebase Cloud Messaging.
6. **Build + smoke:** `pnpm build:production`; E2E real-money smoke ($1 deposit → stake → complete →
   payout) on a **fresh clean account** (not the drifted test acct — see below); Delete Account on a
   throwaway.
7. **Submit** — be ready to explain in App Review notes: Stripe (not IAP) because deposits/stakes/
   withdrawals are the user's own funds; commitment-contract (not gambling), Productivity category.

> **Strategic note (from the trip sessions):** a real-money app has high first-pass rejection risk.
> Realistic near-term deliverable is a **TestFlight build + deck + cohort metrics**; submit to public
> App Store when the review can be babysat. Do **not** hand out "deposit $5 / earn $5" promo cards
> before the engagement gate is live (it's the anti-fraud lever).

## Audit findings (2026-05-30 — money/auth sweep)

A 4-agent docs-vs-code sweep ran 2026-05-30. The auth surface + core money path are **solid**
(every money/user-mutation CF verifies the ID token; deposit crediting is idempotent via a
deterministic txn doc-id, race-safe vs the webhook; stake/`endsAt` re-derived server-side from the
cadence table; Stripe webhook verifies sig + IP; rules lock wallet/txn/group/server-owned-user
fields to admin-SDK-only). Findings:

**Fixed this session (pre-submit, client-only, no deploy):**
- **Solo `completeSession` race → dropped payout (was a money-loss BLOCKER).** `sessionStore.ts`
  `completeSession` wrote `status:"completed"` to Firestore unconditionally, then fired
  `cloudComplete`. The CF rejects if status ≠ active (`index.ts` handleSessionComplete:3066), so the
  client write usually won the race and the payout transaction never ran — user completes, stake
  never returns. `surrenderSession` was already fixed for this; complete was not. Now gated behind
  `DEMO_MODE` (CF is sole status writer), mirroring surrender. Test flipped to pin the new contract.
  **Needs device re-test of solo complete → payout once deployed.**

**Pre-submit decisions / checks (Fardeen — not code bugs):**
- ~~**Confirm `FINALS_PROMO_CENTS=0`**~~ — **DONE (2026-05-30).** Code default flipped 500 → **0**,
  and `functions/.env.production` pins `FINALS_PROMO_CENTS=0` explicitly. The promo is now safe even
  if re-enabled: it credits the gated `bonus` bucket and bucket-aware withdrawal won't release it
  before the engagement gate. The original "$5 of house money withdrawable per qualifying user" risk
  is closed.
- **Consider `SCREEN_PROTECTION_ENABLED=true`** (`src/hooks/useScreenProtection.ts:33`, currently
  `false` as a demo workaround) for the 6 sensitive payment screens (deposit/withdraw/bank-setup/
  verify-identity/stripe-onboarding/profile). It blanks during AirPlay/mirroring — verify it won't
  break investor screen-share demos before flipping.
- **`acceptLegal` advances the local 18+/ToS gate even if the `acceptLegalTerms` CF fails**
  (best-effort, re-prompts next launch). Decide whether to block deposit/stake until the server
  durably records acceptance (legal-state hardening for an 18+ money app).

**Money-path bugs — FIXED 2026-05-30 (`/vibe-security` + 3 adversarial verification rounds):**
- ✅ `maybeAwardFinalsPromo` now credits `bonusBalance` in lockstep with `balance` (invariant holds).
- ✅ **`requestWithdrawal` is bucket-aware** — gates on `computeWithdrawable(buckets, gateMet)`, draws
  buckets down on debit via `withdrawDrawOrder`, and one `restoreWithdrawalReservation` helper puts
  buckets back across all 6 abort paths. The previously-dead `computeWithdrawable`/draw-order helpers
  are now wired. This also gated the **live $5 first-surrender forgiveness** bonus (was withdrawable
  with no gate).
- ✅ `deleteAccount` refund basis is now the `deposited` bucket only (`cardRefundableCents`); gate-met
  withdrawable bonus is paid via the ACH/hold path; all forfeits recorded; added a frozen/drift guard
  (holds full balance for manual review, still deletes for App Store compliance) + an up-front split
  record so legs survive a mid-deletion crash.
- ✅ **Group cancel/timeout refunds** restore `depositedBalance` in lockstep AND are **idempotent**
  (deterministic `group_refund_<sid>_<uid>` doc id); `cancelGroupSession` now rejects already-
  `cancelled` sessions. Closes a double-refund cash leak. ✅ **Account merge** moves all 4 buckets in
  lockstep (no lockout of merged-in funds).
- ⏳ **STILL OPEN:** withdrawal idempotency key buckets by minute → two genuine same-amount
  withdrawals in one minute double-debit the wallet but fire one Stripe transfer. Mitigated by 3/hr
  rate limit; **not** addressed this session. The ACH-payout + held-earnings email TODOs in
  `deleteAccount` remain (unreachable in deposit-only v1).

> **Group-refund bucket note:** cancel/timeout refunds (and `recordGroupSessionPayout`) restore stake
> to `depositedBalance` regardless of source bucket — the documented pilot convention (no
> bonus/earned-funded group stakes pre-promo). When the group multiplier/promo land, split source.

## Post-submit dormant flips (NOT before submit)

The earn-more multiplier + "$5/$5" promo are **core but sequenced post-approval** — flipped
**server-side** (env flags + CFs, no client resubmit), then a fast-follow copy update. The 1.0×
binary ships now; the gate is the enabler.

**Non-negotiable before flipping any bonus/earned $ to withdrawable on live keys:**

- **Backfill + reconcile** bucket invariant MUST run first (maps txn-log → `deposited`/`earned`;
  unexplained residual is **flagged/frozen for manual review**, never auto-bucketed to `credit`).
  ⚠️ `reconcileWalletBalances` currently checks `balance` vs **transaction-sum**, NOT vs **Σbuckets** —
  extending it to also freeze on bucket drift is the right defense-in-depth, but would false-freeze
  un-backfilled legacy wallets, so **gate that change on the backfill being confirmed complete**.
- **Engagement gate — MECHANISM BUILT, CRITERIA is Fardeen's call.** Bucket-aware withdrawal is LIVE
  and currently derives `gateMet` from `getWithdrawalEligibilityStats` = **≥5 completed sessions AND
  ≥2 distinct partners** (the old finals-promo gate). ⚠️ This **conflicts with the plan to drop the
  distinct-partners requirement** (it kills solo users). Today it only affects bonus/earned
  withdrawal — deposits are always withdrawable, and the only gated $ in v1.0 is the $5 forgiveness
  bonus — but finalize the definition: proposed account age ≥ 5 days, ≥ 3 completed sessions,
  ≥ ~8–12 focus-hrs, ≥ 120-min min session, **no** distinct-partners. Change in one place: the
  `gateMet` computation (now in `requestWithdrawal`, `deleteAccount`, and `maybeAwardFinalsPromo`).
  The old `assertWithdrawalEligibility` (returns `{ok:true}`) is now superseded by this bucket gate.
- **Surplus cap** built — `min(1× net deposits, $50)` — before any multiplier > 1.

✅ **Built this session (2026-05-30):** bucket-aware `requestWithdrawal`; `deleteAccount` bucket
rewrite (refund `deposited` to card / pay-or-hold withdrawable `earned`+`bonus` / forfeit-and-record
non-withdrawable bonus + always-forfeit `credit`); group cancel/timeout + merge bucket consistency.
**Still to build (behind flags):** soft `deactivate`/pause path (App Store 5.1.1(v) keeps hard-delete
irreversible, so restore-on-return needs a separate path); client withdrawable-balance UI; the
backfill + reconcile-Σbuckets job above. Then finalize the gate criteria → backfill → flip flags.

Group payout currently credits `depositedBalance` (pilot assumption: no bonus/earned-funded group
stakes pre-promo). When the group multiplier/promo land, split surplus → `earnedBalance`.

## Operator notes / guardrails

- **`STRIPE_SECRET_KEY` is LIVE (`sk_live_`)** — real refunds/charges/transfers fire.
- **Keep `APP_CHECK_ENFORCED=false`** until Firebase Console → App Check → Metrics ≥ 99% verified,
  or users lock out.
- **Run `/vibe-security`** on auth/payments/rules diffs before commit; fix Critical + High first.
- **No** bet/wager/gamble/win/pool language (use stake/commitment/goal/complete/Earned). No VAIL /
  Dr. White references. No deploy/merge-to-main/outward action without Fardeen's explicit go.
- **Drifted test account `cMtHvQkJJZOgU6pgYARj8nN5Wpf1` stays frozen** ($200 ledger drift, auto-frozen
  nightly ~12 days; real money safe in Stripe, the freeze is *protecting* funds). **Don't reuse for
  clean tests** and don't delete the freeze flag — it's the canonical backfill test case. Forensic:
  read-only `functions/scripts/diagnose-wallet.js` (zero writes).

## Pointers

- Roadmap / phases: [roadmap.md](./roadmap.md)
- Money path detail: [payments.md](./payments.md) · Legal posture: [legal.md](./legal.md)
- Security posture: [security.md](./security.md) · Operator runbook: [security-deploy-checklist.md](./security-deploy-checklist.md)
- Historical session/resume/progress docs: [`archive/`](./archive/)
