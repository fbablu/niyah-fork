# Session Summary — Client De-Pool, 18+ Attestation, Legal Copy

**Date:** 2026-05-26 → 2026-05-29
**Branch:** `wallet-ledger` (local-only — NOT pushed, merged, or deployed)
**Context:** One of several parallel Claude sessions feeding a launch-prep status review. This doc covers the **client-side de-pool + legal/eligibility binary items**. The server money-path work (wallet buckets, group de-pool, geo-gate) is summarized in `docs/may-26-resume.md` and was already committed (`a8bc968`, `74b3702`).

---

## Pilot scope (locked)

Ship a clean **solo commitment-contract** binary by ~5/28. All earn-more / bucket multiplier machinery ships **dormant behind flags** (enforcement OFF) — the pilot behaves like today's stickK model (complete → get your exact stake back, `SOLO_COMPLETION_MULTIPLIER = 1`). Group ships **de-pooled + real-money ON**. Earn-more + $5/$5 promo are sequenced **post-approval** (server-side flip, no resubmit).

**Core model — de-pool:** every participant stakes individually. A completer gets their **own** stake back (× a house-funded multiplier, currently 1.0×). A non-completer forfeits their stake **to the house**. Stakes are **never** pooled, shared, or redistributed between players. This avoids Stripe/Apple gambling classification and removes any peer-to-peer payment flow.

---

## What this session shipped (4 binary items)

### 1. Client de-pool — settlement screens
The pre-session de-pool fixed the payout math but missed the settlement **screens**. Fixed here:
- **`app/session/surrender.tsx`** — full rewrite. Removed the "Pay Your Partner via Venmo" payment screen, the `?? stakePerParticipant` fallback that fabricated an "owed" amount, and `getVenmoPayLink`/`markTransferPaid`. Surrender now forfeits **only your own stake** (server-authoritative `reportSurrender`); all paths `router.replace("/session/complete")`. Mirrors the solo flow.
- **`app/session/complete.tsx`** — removed dead transfers/Venmo settlement (−263 lines): `activeTransfers`, pending-transfer handlers, the transfer-card JSX, 15 transfer styles. Payments section now shows only "Settled via Stripe" / "No payments needed". No behavior change (the branch was already inert since `transfers` is always `[]` post-de-pool).
- **Venmo display/data stripped** from `partner.tsx` (the `venmoHandle` row), `quick-block.tsx`, `confirm.tsx` (the `venmoHandle` field on participant objects passed to `startGroupSession`).

> Note: "duo" sessions route through the already-de-pooled `groupSessionStore` (2-person `startGroupSession`), NOT the dormant legacy `partnerStore`. De-pooling surrender/complete fully closes the P2P contradiction.

### 2. 18+ self-attestation
- **`src/components/LegalAcceptanceOverlay.tsx`** — added a reusable `CheckRow`; Continue is now gated on **both** "I confirm I am 18 years of age or older" **and** "I agree to the Terms of Service and Privacy Policy" (`canContinue = age18 && agreedTerms`).
- **`functions/src/index.ts`** (`acceptLegalTerms` CF) — writes `ageAttested18: true` via the admin SDK alongside `legalAcceptanceVersion`/`legalAcceptedAt`.
- **`firebase/firestore.rules`** — added `ageAttested18` to both denylists (create + update), making it **client-immutable**. Only the CF can write it, so the attestation is un-forgeable.
- **`src/store/authStore.ts`** — hydrates `ageAttested18` from Firestore; sets it in the `acceptLegal` local write.
- **`src/types/index.ts`** — added `ageAttested18?: boolean` to `User`.
- **No DOB is stored.** Stripe KYC verifies actual age at money-out; this is a self-attestation gate at acceptance time.

### 3. In-app ToS / Privacy de-pool (`src/components/LegalContentView.tsx`)
Rewritten so the in-app legal copy matches the de-pooled model:
- Clause 2 — explicit 18+ and U.S.-resident affirmation.
- Clause 3 — "each participant stakes individually … stakes are never pooled, shared, or redistributed between participants."
- Clause 4 — "Stakes are never wagered against or pooled with other users."
- Clause 5 — "Forfeited stakes are retained by Niyah … There are no peer-to-peer payments between users within Niyah." (Removed the old Venmo P2P settlement language.)
- Privacy clause 1 — dropped the specific "Venmo handle" data item; added the 18+ affirmation record.
- **`src/constants/config.ts`** — `CURRENT_LEGAL_VERSION` bumped `1.0.0` → **2.0.0**. The bump re-prompts every existing user, which also backfills `ageAttested18` for them.

### 4. Language sweep (done 2026-05-27)
Found + fixed 6 user-facing spots beyond the earlier `active.tsx` / `stripe-onboarding.tsx` fixes:
- `welcome.tsx` onboarding carousel rewritten (dropped "Earn real f*ckin money", "Grow Your Wealth", "earn more", "Withdraw immediately", "Only lose what you put in", "bonus multipliers"; dropped Bitcoin art, kept gold/$).
- `select.tsx` — solo "earn more" → "get it back"; group "Higher stakes, higher rewards" → "Focus together. Everyone stakes their own".
- `complete.tsx` — dropped "Niyah pool / funds future payouts" redistribution framing.
- `waiting-room.tsx` — "Pool" → "Total staked".

Left intentionally: the plant-`pot` art and the "Not Gambling" legal text.

### Hosted ToS + Privacy (item 4, done 2026-05-27)
Next.js routes in the landing app: `landing-pg/app/legal/{privacy,terms}/page.tsx` + shared `legal/layout.tsx` (plain-language; covers Plaid / withdrawals / KYC / refunds / liability / Apple-EULA; future-proofed with promo + eligibility-gated-withdrawal clauses so the post-approval flip needs no new ToS version). Build-verified → `out/legal/{privacy,terms}.html`. Auto-deploys via `deploy-landing.yml` on merge to `main` → `niyah.live/legal/privacy` + `/legal/terms`. State/venue = Delaware. Contact = `support@niyah.live`.

---

## Verification
- `tsc` clean, `eslint` 0 errors, full Jest suite green (811 → 813 after the two new overlay two-checkbox tests) at every checkpoint.
- Final grep confirmed **zero** P2P payment instructions remain in `app/` — clause 5 (no P2P) and the screen fixes ship in the **same binary**, so there's no deploy-ordering risk. (The `firebase deploy` for rules+functions is separate and only matters for `ageAttested18` enforcement.)

---

## State / guardrails (carry forward)
- **Nothing pushed, merged, or deployed.** Branch `wallet-ledger`, local only.
- The copy/art language-sweep diff and hosted-legal routes may be **uncommitted** depending on which commits the user ran manually. (User does all `git add`/`git commit` manually; Claude supplies messages only.)
- `APP_CHECK_ENFORCED=false` must stay false until App Check Metrics ≥99% verified (else user lockout).
- `STRIPE_SECRET_KEY` is LIVE (`sk_live_`) — real money paths.
- No "bet/wager/gamble/win" language — use "stake/commitment/goal/complete/Earned".
- Backfill MUST run before enabling any bucket/multiplier enforcement.
- Engagement gate must be LIVE before any bonus/earned $ is withdrawable on live keys (anti-fraud lever).

## What's NOT done (post-submit, dormant behind flags)
Bucket-aware `requestWithdrawal` + re-enabled `assertWithdrawalEligibility`; `deleteAccount` bucket rewrite; soft deactivate; backfill + reconcile bucket-invariant job; solo/group multiplier + surplus cap (`min(1× net deposits, $50)`); client withdrawable-balance UI. Then `/vibe-security` the full diff → backfill → flip flags.

**Authoritative ongoing doc:** `docs/may-26-resume.md`.
