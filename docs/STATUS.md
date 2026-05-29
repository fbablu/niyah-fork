# STATUS — Niyah launch (canonical)

> **Single source of truth for "where the build is right now."** Read this first in a new session.
> Supersedes the old `may-26-resume.md`, `may-16-progress.md`, and the per-session summaries
> (now in [`archive/`](./archive/)). When state changes, update **this** file — don't spawn a new resume doc.
>
> Last updated: **2026-05-29.**

## Right now

- **Branch:** `wallet-ledger` — **22 commits ahead of `main`**, clean fast-forward (no divergence).
  All de-pool / legal / dead-code / privacy-manifest work is **committed** on this branch.
- **NOT merged, NOT pushed to `main`, NOT deployed.** Nothing live yet from this branch.
- **Tests green:** ~796 client (Jest) + 38/38 functions. `tsc` clean both sides, eslint 0 errors.
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

## Post-submit dormant flips (NOT before submit)

The earn-more multiplier + "$5/$5" promo are **core but sequenced post-approval** — flipped
**server-side** (env flags + CFs, no client resubmit), then a fast-follow copy update. The 1.0×
binary ships now; the gate is the enabler.

**Non-negotiable before flipping any bonus/earned $ to withdrawable on live keys:**

- **Backfill + reconcile** bucket invariant MUST run first (maps txn-log → `deposited`/`earned`;
  unexplained residual is **flagged/frozen for manual review**, never auto-bucketed to `credit`).
- **Engagement gate LIVE** — re-enable `assertWithdrawalEligibility` (currently returns `{ok:true}`),
  made bucket-aware. Proposed gate: account age ≥ 5 days, ≥ 3 completed sessions, ≥ ~8–12 focus-hrs,
  ≥ 120-min min session to count; **drop** the distinct-partners requirement (kills solo users).
  Without it, promo = deposit-$5 / withdraw-$5 / churn.
- **Surplus cap** built — `min(1× net deposits, $50)` — before any multiplier > 1.

Dormant work still to build (behind flags): bucket-aware `requestWithdrawal`; `deleteAccount` bucket
rewrite (refund `deposited` to card / ACH-or-forfeit `earned`+`bonus` / always-forfeit `credit`);
soft `deactivate`/pause path (App Store 5.1.1(v) keeps hard-delete irreversible, so restore-on-return
needs a separate path); client withdrawable-balance UI. Then `/vibe-security` the full diff →
backfill → flip flags.

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
