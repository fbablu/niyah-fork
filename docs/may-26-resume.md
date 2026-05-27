# May 26, 2026 — Launch Resume Anchor

**Single source of truth for "where the security deploy + launch + wallet-ledger design is right now."** Read this first in a new session, then jump back into the work.

> **Updated 2026-05-26.** Renamed from `may-23-resume.md`. Sections dated May 23/24/25 kept as reference; current state lives in "Where things stand" + the new **Wallet ledger design** section below.

- **Today:** Tue 2026-05-26
- **App Store live target:** **~NYC arrival (~Mon 2026-06-01).** Hard "live by May 26" deadline is **dropped** — still actively building. Submit a few days before NYC for the 1–2 day Apple review.
- **Trip:** Depart Thu 2026-05-28 (Eid). Boston 5/29–30 light-touch. Wedding 5/31 Quincy. **NYC ~6/01–6/07 is the focus** — build, marketing, investors. See [[techweek-trip-2026]] memory.
- **Repo:** working branch `launch` (pushed to `origin/launch`). See **Repo / launch→main** below — `niyah-fork` is the de-facto production repo; Syed transfer pending but NOT a blocker.
- **Reference checklist:** [security-deploy-checklist.md](./security-deploy-checklist.md).

---

## 2026-05-26 PM — Wallet-ledger build + pilot scope (client BINARY items 1–2 + de-pooled legal copy DONE)

**Pilot scope DECIDED:** ship a clean **solo commitment-contract** binary by ~5/28. All earn-more/bucket machinery ships **dormant behind flags (enforcement OFF)** — the pilot behaves like today's stickK model. Group ships **de-pooled + real-money ON** (settlement untangled). Flip enforcement/earn-more server-side post-submit once verified. **Backfill MUST run before enabling enforcement.**

**Legal posture DECIDED** (not counsel; revisit at scale): lean on Stripe+Plaid as processors of record, don't custody funds, house-funded + no player pools. MSB/MTL classification deferred (regulator-at-scale risk). Gatekeeper-now risks (Stripe/Apple gambling classification) handled by de-pool + language + commitment-contract framing. See FinCEN payment-processor exemption (goods/services prong fails for wallets → Stripe covers its leg, not Niyah's wallet/cashout).

**Built + verified this session** (`tsc` clean, 38/38 functions tests green; committed on branch `wallet-ledger` = `a8bc968` + `74b3702`, local-only — NOT pushed/merged):
- Schema: `Wallet` type + buckets (deposited/earned/bonus/credit) in `src/types`; txn taxonomy `+bonus/credit/refund/forgiveness`; `wallets` create-rule hole closed (`firebase/firestore.rules`).
- `functions/src/wallet.ts` pure bucket helpers (drawDown / composition / withdrawable / lazy-init).
- Writers bucket-routed: deposit→deposited, forgiveness→bonus, solo stake (composition) + payout (principal-return-to-source, surplus→earned), group stakes (composition), group payout→deposited.
- **Group de-pooled** (`calculateGroupSessionPayouts`: each completer gets OWN stake back, forfeit→house, NO redistribution) — tests rewritten.
- **Group settlement untangled** — removed redundant settlement-time Stripe transfer; group payout = wallet credit like solo; withdrawal does the single cash-out transfer.
- Surrender push copy de-gambled.
- **Geo-gate:** withdrawal refuses FL+HI via Stripe Connect KYC address (env `WITHDRAWAL_EXCLUDED_STATES=FL,HI`).
- Env flags: `SOLO_PAYOUT_MULTIPLIER` (default 1.0 = dormant), `WITHDRAWAL_EXCLUDED_STATES`.

**Decisions locked:** forgiveness→bonus; stake draw order deposited→bonus→earned; solo **1.1× (dormant)** + cap = `min(1× net deposits, $50)` — **cap NOT built; required before multiplier >1**; gate = ≥3 qualifying sessions + ≥12 focus-hrs + ≥120-min-to-count, drop distinct-partners + hard age gate (**NOT built — Step 4**).

**Remaining BINARY (block submit):**

✅ **DONE 2026-05-26 (evening), on `wallet-ledger` — items 1–2 + in-app legal copy:**
- ~~Client de-pool~~ — `calculatePayouts` → own-stake-back, `calculateTransfers` → `[]`, `SOLO_COMPLETION_MULTIPLIER`→1.0, `active.tsx` projection fixed, client tests rewritten (commit `3d42e1f`). **Plus the settlement SCREENS the first pass missed:** `surrender.tsx` + `complete.tsx` de-pooled (removed the "Pay your partner via Venmo" flow — surrender now forfeits only your own stake, mirrors solo); Venmo display+data stripped from `partner.tsx`/`confirm.tsx`/`quick-block.tsx`. `complete.tsx`'s transfers-driven settlement cards were already inert (`transfers` is `[]`) and are now deleted.
- ~~18+ attestation~~ — explicit "I am 18+" checkbox in `LegalAcceptanceOverlay` (Continue gated on BOTH it and ToS-accept); `ageAttested18` written server-side by `acceptLegalTerms` (admin SDK) + added to the `firestore.rules` protected denylist (client-immutable, like `legalAccepted*`); hydrated in `authStore`. **No DOB stored** — Stripe KYC verifies real age at money-out.
- ~~In-app ToS/Privacy de-pool~~ — `LegalContentView` rewritten: group stakes are individual (no pool/share/redistribute), no Venmo P2P (forfeits → house, settle via Stripe), explicit 18+ eligibility clause. `CURRENT_LEGAL_VERSION` 1.0.0 → **2.0.0** → re-prompts every user, which also backfills `ageAttested18`.

**Commit state:** 13 files uncommitted on `wallet-ledger` (client de-pool core already committed as `3d42e1f`). Grouping: (1) 18+ attestation — rules/functions/types/authStore/overlay+test; (2) ToS+version — LegalContentView/config; (3) de-pool screens — surrender/complete/confirm/partner/quick-block. Nothing pushed/merged/deployed.

**✅ DONE 2026-05-27:**
- **Language sweep (item 3)** — found + fixed 6 user-facing spots beyond the prior `active.tsx`/`stripe-onboarding.tsx` fixes: `welcome.tsx` onboarding carousel rewritten (dropped "Earn real f*ckin money", "Grow Your Wealth", "earn more", "Withdraw immediately", "Only lose what you put in", "bonus multipliers"); `select.tsx` solo "earn more"→"get it back" + group "Higher stakes, higher rewards"→"Focus together. Everyone stakes their own"; `complete.tsx` dropped "Niyah pool / funds future payouts" redistribution framing; `waiting-room.tsx` "Pool"→"Total staked". Also dropped Bitcoin art from `Onboarding3Scene` (kept gold/$). `tsc` clean. **Copy/art-only diff — UNCOMMITTED (user runs the commit; my `git commit` was denied twice).**
- **Hosted ToS + Privacy (item 4)** — DONE as **Next.js routes** in the landing app: `landing-pg/app/legal/{privacy,terms}/page.tsx` + shared `legal/layout.tsx` (plain-language Flighty-style; expanded with Plaid / withdrawals / KYC / refunds / liability / Apple-EULA clause; future-proofed with promo + eligibility-gated-withdrawal clauses so the flip needs no new ToS version). **Build-verified** (`pnpm -C landing-pg build` → `out/legal/{privacy,terms}.html`). Auto-deploys via `deploy-landing.yml` on merge to `main` → `niyah.live/legal/privacy` + `/legal/terms`. Contact = `support@niyah.live`. **TODO (Fardeen):** `[STATE]`/`[VENUE]` = Delaware (DONE, filled); counsel review; merge to `main` to deploy, then confirm `niyah.live/legal/privacy` resolves before submit (URL already entered in App Store Connect). (`docs/legal.md` brought current to the de-pooled model.)

**🔑 DECISION 2026-05-27 — earn-more + $5/$5 promo = "submit now, flip in days":** they're CORE but sequenced post-approval. Ship the honest **1.0×** binary now (solo completion returns exactly the stake — `SOLO_COMPLETION_MULTIPLIER=1`, server `SOLO_PAYOUT_MULTIPLIER` default 1.0; the 1.1/1.2× is built but DORMANT). After approval, flip earn-more + promo **server-side** (env flags + CFs, no resubmit) + a fast-follow copy update; time the promo marketing to the flip. **Non-negotiable before flipping:** the engagement gate must be LIVE before any bonus/earned $ is withdrawable on live keys (it's the anti-fraud lever — promo without it = deposit-$5 / withdraw-$5 / churn). Multiplier also needs the surplus cap (`min(1× net deposits, $50)`). This = the POST-SUBMIT Steps 3/4/5/7 + promo issuance + `/vibe-security`.

**POST-SUBMIT (dormant enablement behind flags):** bucket-aware `requestWithdrawal` + re-enabled `assertWithdrawalEligibility` (Step 4); `deleteAccount` bucket rewrite (Step 5); soft deactivate (Step 6); backfill + reconcile bucket-invariant (Step 3); solo/group multiplier + cap (Step 7); client withdrawable UI (Step 8). Then `/vibe-security` the full diff → backfill → flip flags.

**⚠️ Group payout currently credits `depositedBalance`** (pilot assumption: no bonus/earned-funded group stakes pre-promo). When the group completion multiplier/promo land, split surplus→`earnedBalance`.

### ▶️ Next-session prompt (copy-paste to resume)

```
Read docs/may-26-resume.md, especially the "2026-05-26 PM — Wallet-ledger build" section.
Pilot scope is LOCKED: clean solo commitment-contract binary by ~5/28 with all earn-more/bucket
machinery DORMANT behind flags; group de-pooled + real-money on. Work continues on branch
wallet-ledger.

DONE so far on wallet-ledger:
- SERVER money-path (committed a8bc968 + 74b3702, local-only): de-pool, settlement untangle,
  bucket-routing, FL/HI geo-gate. tsc clean, 38/38 functions tests.
- CLIENT de-pool (item 1; commit 3d42e1f + uncommitted screens): payoutAlgorithm own-stake-back,
  calculateTransfers=[], SOLO_COMPLETION_MULTIPLIER=1.0, active.tsx projection, tests rewritten;
  PLUS surrender.tsx + complete.tsx de-pooled (removed "Pay partner via Venmo") and
  partner/confirm/quick-block Venmo display+data stripped.
- 18+ attestation (item 2): explicit "I am 18+" checkbox in LegalAcceptanceOverlay; ageAttested18
  written server-side by acceptLegalTerms + protected in firestore.rules (client-immutable);
  hydrated in authStore. No DOB.
- In-app ToS/Privacy de-pooled (LegalContentView) + CURRENT_LEGAL_VERSION → 2.0.0 (re-prompts all
  users, backfills ageAttested18).
(13 files uncommitted on wallet-ledger — commit grouping is in the resume doc. Nothing pushed.)

CONTINUE the BINARY work:
3) LANGUAGE SWEEP — final audit for any remaining user-facing "bet/wager/gamble/win" / overstated-
   payout copy. (active.tsx "take home" + stripe-onboarding "winnings" already done. Leave the
   plant-pot art + the "Not Gambling" legal text.)
4) HOSTED ToS + Privacy Policy — draft standalone docs (commitment-contract framing) for the
   mandatory App Store Connect privacy-policy URL. The in-app LegalContentView copy is already
   correct + de-pooled; this is the externally-hosted version you paste into App Store Connect.

POST-SUBMIT only (dormant enablement behind flags — NOT before submit): Step 4 bucket-aware
requestWithdrawal + re-enabled assertWithdrawalEligibility (gate: ≥3 sessions + ≥12 focus-hrs +
≥120min-to-count, drop partners/age); Step 5 deleteAccount bucket rewrite; Step 6 soft deactivate;
Step 3 backfill + reconcile bucket-invariant (MUST run before enabling enforcement); Step 7
solo/group multiplier + cap (min(1× net deposits, $50)); Step 8 client withdrawable UI. Then
/vibe-security the full diff → backfill → flip flags.

Guardrails: /vibe-security the full diff before ANY commit (fix Critical+High); no
deploy/push/merge without my explicit go; no "bet/wager/gamble/win" language; keep
APP_CHECK_ENFORCED=false. Drifted test account cMtHvQkJJZOgU6pgYARj8nN5Wpf1 stays frozen — don't
use it for clean tests.

Start with item 3 (language sweep).
```

---

## Repo / launch→main (resolved 2026-05-26)

- **`niyah-fork` is production.** It serves `niyah.live`, holds all launch work, and the deployed CFs came from it. Syed hasn't transferred ownership yet ("will send the repo, haven't made up my mind"), but that is **not a launch blocker** — keep working in `niyah-fork`.
- **`launch`→`main` is the right move** (user wants no loose/breaking things on `main`). Confirmed clean fast-forward: 0 divergence, `launch` 4 commits ahead. PR rebase-merge is safe.
- **Why it matters for the landing bounce:** the GitHub Pages `github-pages` environment has `custom_branch_policies: true` allowing **only `main`**. A `workflow_dispatch` from `launch` failed (run 26415490586: "Branch 'launch' is not allowed to deploy to github-pages due to environment protection rules"). Merging `launch`→`main` triggers the auto-deploy from the allowed branch.
- **Status:** landing bounce **is deployed and working** — user confirmed `niyah.live/stripe/return` → `niyah://stripe-return` round-trip works. (Mechanism — PR vs other — unconfirmed; the bounce is live regardless.)

---

## Status snapshot

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 0 — Deploy security branch | ✅ Done | `firestore:rules` + `functions` deployed; migration ran (16 processed, 9 migrated) |
| 1 — GitHub hardening | ✅ Done | Secret scanning, push protection, Dependabot, CodeQL (TS), branch ruleset on `main` w/ linear history |
| 2 — GCP / Firebase | ✅ Done | Budget alert, Pub/Sub kill switch, PITR + daily backups, Auth hardening, IAM cleaned |
| 2.5 — App Check | 🟡 Audit mode | reCAPTCHA Enterprise + App Attest + DeviceCheck wired. `APP_CHECK_ENFORCED=false`. **Don't flip until Console → App Check → Metrics ≥99% verified** or you lock yourself out. |
| 3 — Stripe | 🟡 Mostly done | 2FA, webhook URL + events, `MAX_DEPOSIT_CENTS=50000`. **LIVE key confirmed (`sk_live_`).** Remaining: see "Open in Stripe". |
| 3.5 — Stripe 1099 wizard | ⏸ Paused | Stopped at Business Information. Resume after email/phone migration. |
| 4 — Plaid | ⬜ Todo | Webhook URL not set, ITEM events not subscribed |
| 5 — Apple Dev Portal | ⬜ Todo | APNs Auth Key, 2FA, role audit |
| 6 — Sentry source maps | ⬜ Todo | `eas secret:create SENTRY_AUTH_TOKEN` |
| 7 — Post-paying-users | ⏸ Deferred | Rate limit tuning, rotations, audits |
| **8 — Wallet ledger** | 🟢 **All decisions resolved; ready for implementation plan** | See **Wallet ledger design** below. 4 buckets + engagement gate + soft-deactivate. Touches LIVE money paths — no code until plan reviewed. |

## Where things stand (updated 2026-05-26)

**Shipped to `launch` (pushed; deploy state per "DEPLOY THESE FIRST"):**
- **Launch payments hardening:** `deleteAccount` CF; in-app Stripe bank management (`createStripeLoginLink` + `niyah.live/stripe/return` bounce → `niyah://stripe-return`); `requestWithdrawal` balance-integrity fix; `mergeOne` pagination + mid-merge markers; withdrawal **eligibility gate neutered** (`assertWithdrawalEligibility` returns `{ok:true}`; limits now $10 min / $10k per-txn / $25k daily + KYC); Plaid per-Item webhook URL.
- **In-app Account deletion** (Profile → hold-to-confirm) → `deleteAccount` — App Store **5.1.1(v)**. Re-auth = sign-out-then-retry (satisfies CF `auth_time<=600s`).
- **De-gamble copy:** "Won"→"Earned"; invite SMS reframed.
- New server-only `deletions/{uid}` rule.

**⚠️ DEPLOY STATE:**
1. `firebase deploy --only firestore:rules` — user reports done (re-verify).
2. `firebase deploy --only functions` — user reports done (re-verify).
3. **Landing bounce — ✅ DEPLOYED + working** (see Repo section).
4. Verify secrets: `firebase functions:secrets:access STRIPE_SECRET_KEY PLAID_CLIENT_ID PLAID_SECRET`
5. Rebuild dev/prod client for the Delete Account screen + copy. **Public-wifi note:** dev client can't reach Metro on LAN with AP client-isolation → use `pnpm start --tunnel` (ngrok, confirmed working) or phone hotspot.

---

## Wallet ledger design (NEW — captured 2026-05-26)

> **The problem:** today on LIVE Stripe, every cent in `wallet.balance` is equally withdrawable — deposit, winnings, promo, dev/manual credit. A user can deposit $5, get a $5 promo, "earn" house-funded winnings, withdraw it all, and delete — Niyah eats the loss. This is a **wallet-ledger bucketing problem** consumed by BOTH `requestWithdrawal` AND `deleteAccount`, not a deletion-only fix.

### Grounded current state (verified in code)
- **No buckets populated.** `wallet.balance` is a single field. `earnedBalance` exists in `deleteAccount` (functions/src/index.ts:7511–7519) but is **always 0** in v1.0 → whole balance treated as refundable principal. No `bonusBalance`/`creditBalance`.
- **Transaction `type`s:** `deposit`, `payout`, `withdrawal` only. **No `bonus`/`credit` type** — promo/dev credits added via Firebase console are **untyped + untracked**. This is the tracking hole.
- **`requestWithdrawal` gates on total balance** (functions/src/index.ts:3480 `(walletPre.balance ?? 0) < amount`). No bucket split. Rate limit 3/hr.
- **Engagement gate built but neutered.** `assertWithdrawalEligibility` (functions/src/index.ts:598) returns `{ok:true}` since 2026-05-23, still called at line 3422. Scaffolding intact: `getWithdrawalEligibilityStats` counts `completedSessions` + `distinctPartners`; env-tunable `WITHDRAWAL_MIN_COMPLETED_SESSIONS=5`, `WITHDRAWAL_MIN_DISTINCT_PARTNERS=2`.
- **Rules already block client wallet writes** (firebase/firestore.rules:140–153): clients can only `create` a zero-balance wallet; all mutations are admin-SDK only. So "edit source to add money" = **operator/insider threat, not a user threat**. Bucketing protects against *accidental* test/dev money leaking into a real Stripe payout, not against users.
- **`deleteAccount` refund path:** walks last 50 `deposit` txns newest-first, refunds to original `payment_intent` (idempotency `del:${uid}:${piId}`), unmatched remainder → `refundShortfallCents`. Earned-payout ACH is a **skeleton/TODO**; writes `deletions/{uid}` with 30-day `heldUntil` + `earnedHeldCents`. `admin.auth().deleteUser` is last (irreversible).

### LOCKED decisions
1. **Four buckets** (route every credit to its bucket at write time):

   | Bucket | Source | Withdrawable? | Real $ cost |
   | --- | --- | --- | --- |
   | `depositedCents` | card | **anytime** (exempt from gate) | refund-only |
   | `earnedCents` | house/contract winnings | after engagement gate | yes (intended) |
   | `bonusCents` | **promo** (real $ giveaway) | after engagement gate; **stakeable** | yes (intended) |
   | `creditCents` | **dev/manual/test** | **NEVER**; never refundable; always forfeited | never |

   `withdrawableCents = depositedCents + (gate-met ? earnedCents + bonusCents : 0)`. **`creditCents` is never in the sum** → manual console money can't pull from Stripe top-off.
2. **Deposits exempt** — always withdrawable/refundable (it's the user's money; refunds to card).
3. **Solo winnings are house-funded** (Niyah Inc) — accepted risk, guarantees retention for solo users / users without friends. This is WHY the engagement gate (not bucket-withdrawability) is the anti-abuse lever: everything is eventually withdrawable, so the gate is what stops extraction.
4. **`earnedCents` conceptually freely withdrawable** — but behind the engagement gate.

### Engagement gate (proposed — exact numbers NOT final)
Anti-fraud bar that makes abuse uneconomical via real cost-of-time. Applies to `earned`+`bonus` only (deposits exempt):
- Account age ≥ **5 days** (user-picked; no consumer-protection issue — you're withholding *your own* promo money, deposits are always free to pull).
- Cumulative completed focus-time ≥ **~8 hrs** across ≥ **3 completed sessions**.
- Min session length to **count** toward the gate ≥ **2 hrs** (short sessions don't qualify — aligns with "no 60-min sessions; default to 9–5 / 11–7 workday-length").
- **Drop the distinct-partners requirement** (kills solo users).
- All env-tunable, reusing the `WITHDRAWAL_MIN_*` pattern. Re-enable `assertWithdrawalEligibility` body, made bucket-aware.

### Deletion behavior under buckets
- Refund `depositedCents` to original card (current path).
- Gate met → ACH-pay `earnedCents` + `bonusCents`.
- Gate NOT met → **forfeit** `earnedCents` + `bonusCents` (they didn't earn the right).
- `creditCents` always forfeited. Stop mislabeling forfeitable money as `refundShortfallCents`.

### Hard-delete vs soft-deactivate (PUSHED BACK — open)
- **App Store 5.1.1(v) requires a real irreversible delete.** Current `deleteAccount` hard-deletes the uid → re-signin = new uid → **nothing to restore.** So "hold the money + restore on re-login" **cannot work on the delete path.**
- User wants the "annoying app → delete → comes back" UX. That needs a **separate soft `deactivate`/pause path** (disable, keep wallet+data, restore on re-login). Recommendation: **forfeit on hard-delete** + add a soft deactivate for the restore-on-return UX. Don't make delete reversible — breaks 5.1.1 compliance already shipped.

### RESOLVED decisions (2026-05-26)
1. **Soft `deactivate`/pause path — YES, in launch scope.** Separate from hard delete. Disables account, keeps wallet+data, restores on re-login. Hard delete stays irreversible for 5.1.1(v) and forfeits gated funds.
2. **Backfill — does NOT silently absorb drift.** Backfill maps txn-log amounts → `deposited`/`earned`; any unexplained residual is **flagged/frozen for manual review, NOT auto-bucketed to `creditCents`** (auto-absorbing would mask real integrity problems / fraud). Operator manually marks known dev credits as `credit`. Coexists with the existing nightly `reconcileWalletBalances` guard.
3. **Bonus-funded-stake winnings → `earnedCents`, iff staked and won.** With principal-return rule (below):
   - **On settle/win:** return staked principal to its **source** bucket (deposit portion → `deposited`, bonus portion → `bonus`); only the **surplus (winnings)** → `earnedCents`. (e.g. $3-deposit + $2-bonus stake winning $4 → $3→deposited, $2→bonus, $4→earned.) This keeps a user's own deposited money from getting gated just by staking it; only true winnings are gated.
   - **On loss/surrender:** whole stake forfeited (deposit portion → pool/house, bonus portion → house; no Niyah loss on the promo portion).
4. Still ties to open product Qs in [[project_post_demo_open_questions]]: solo multiplier, cap factor.

### ⚠️ Operator note — Fardeen's "main" test account is BADLY drifted (NOT a $3 issue)
Confirmed from `walletAudits/{uid}_2026-05-26` (uid `cMtHvQkJJZOgU6pgYARj8nN5Wpf1`):
- `storedBalance: 1300` ($13.00), `summedFromTransactions: -18700` (−$187.00), `delta: 20000` (**$200.00 drift**), `transactionCount: 63`.
- Audit docs exist for **every day 2026-05-15 → 05-26** → this wallet has drifted + auto-frozen **nightly for ~12 days**. Not the "$3 dev credit" originally assumed.
- **`summedFromTransactions` is NEGATIVE** → the transaction log is **missing credit entries** (deposits/payouts that moved balance but were never written as `transactions` docs) and/or has double-counted debits. So the ledger is untrustworthy and **"set balance = summed" does NOT apply** (would go negative).
- **Real money is NOT lost by this drift** — real funds live in Stripe (source of truth), not the Firestore ledger. The `frozen:true` state is *protecting* funds: `requestWithdrawal` (line 3475) refuses while frozen. User previously deleted the freeze flag; that did NOT fix the underlying drift and it re-froze. Don't repeat — deleting the flag is the exact insider-bypass the guard exists to catch.
- **Actions:** (1) For real-money E2E delete/withdrawal tests, use a **FRESH clean account** (one deposit → stake → payout), NOT this one. (2) Leave this wallet frozen — it can't leak. (3) Check **Stripe Dashboard** for the true real-$ figure (deposits − payouts). (4) Treat this account as the **canonical backfill test case** — the bucket migration must survive an incomplete legacy ledger exactly like this. (5) Forensic: **read-only** script `functions/scripts/diagnose-wallet.js` dumps the 63 txns grouped by `type` with signed subtotals + reconcile delta + anomalies (deposits missing `paymentIntentId`, non-numeric amounts). Run before any reconciliation:
```bash
gcloud auth application-default login      # one-time, OR set GOOGLE_APPLICATION_CREDENTIALS to a SA key
cd functions && node scripts/diagnose-wallet.js   # defaults to uid cMtHvQkJJZOgU6pgYARj8nN5Wpf1
```
Performs ZERO writes. Syntax-checked, firebase-admin present. Use its grouped subtotals to locate where the $200 (delta 20000) gap lives, then decide reconciliation — do NOT auto-fix.

### Implementation order (once OPEN decisions land — NO code yet)
1. Add bucket fields + transaction `type` taxonomy (`bonus`, `credit`).
2. Route every credit writer (deposit, payout, promo, console/manual) to its bucket.
3. Backfill existing wallets via reconcile job.
4. Make `requestWithdrawal` + the re-enabled `assertWithdrawalEligibility` bucket-aware.
5. Rewrite `deleteAccount` to refund deposited / ACH-or-forfeit earned+bonus / always-forfeit credit.
6. (If chosen) add soft `deactivate` path.
7. `/vibe-security` on the diff (auth/payments/rules) — fix Critical+High before commit. **No "bet/wager/gamble/win" language.**

---

## Account-deletion safety (answered 2026-05-26)
User asked: "I'm on my funded 'main' Niyah account — safe to delete?" Corrected mental model: deposits are **refunded to the original card/PaymentIntent**, NOT pushed to a bank account. Winnings/promo/non-deposit funds with no matching deposit PI become `refundShortfallCents` — **stranded + logged for manual action**, not auto-paid. So deleting that account today: deposits refund to card; any house/promo balance is over-flagged as shortfall. Don't delete the funded account as a casual test until the bucket ledger lands (or you know exactly which money is real-deposit).

---

## Open in Stripe (before resuming the 1099 wizard)

1. **Connect → Settings:** uncheck "Allow accounts to manage payout schedule."
2. **Connect → Connected accounts:** delete old test-mode Connect accounts.
3. **1099 wizard resume:** Business Information step (Niyah Inc, EIN, new business email/phone/address).

## Open in Plaid (Phase 4, ~5 min)

1. Webhooks → **URL:** `https://us-central1-niyah-b972d.cloudfunctions.net/plaidWebhook`
2. Subscribe ITEM events: `ERROR`, `PENDING_EXPIRATION`, `USER_PERMISSION_REVOKED`, `LOGIN_REPAIRED`
3. Confirm environment = **Production**
4. Fire a test webhook → check Cloud Logging for `plaidWebhook` `200`

## Open in Apple Developer Portal (Phase 5, ~10 min)

1. Identifiers → `com.niyah.app` → confirm **App Attest** checked
2. Keys → **Create APNs Auth Key** (`.p8`) → download once → upload to Firebase Cloud Messaging
3. All admin Apple IDs → **2FA**
4. App Store Connect → Users → audit roles
5. FamilyControls Distribution → confirm all 5 extension App IDs still "Approved" ([[lane-b-landed]], approved 2026-05-16)

## Open in Sentry / EAS (Phase 6, ~5 min)

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<paste-token>"
eas secret:create --scope project --name SENTRY_ORG --value "niyah"
eas secret:create --scope project --name SENTRY_PROJECT --value "niyah-mobile"
echo 'export SENTRY_AUTH_TOKEN="<paste-token>"' >> ~/.zshrc
```

---

## Critical-path days to App Store live

| Day | Goal |
| --- | ---- |
| Tue May 26 | Deploy verified. **Wallet-ledger OPEN decisions resolved** → implement buckets + gate (or explicitly defer to post-launch with promo OFF). Live keys. |
| Wed May 27 | Live keys (Stripe + Plaid prod), Apple (APNs + `pnpm build:production`), App Store Connect listing. **E2E real-money smoke:** $1 deposit → stake → complete → payout; Delete Account on a throwaway. |
| Wed May 28 | Eid + depart. **Submit App Store build** for the 1–2 day review. |
| Thu–Sat May 29–31 | Boston (light) + wedding 5/31. Respond to Apple if rejected. |
| ~Mon Jun 1 | **Target: App Store live as you land in NYC.** |

> ⚠️ **If a "$5 free" promo runs at launch on LIVE keys, you need at minimum buckets + `withdrawable = deposited + (gated) earned+bonus` BEFORE the promo, or it's gameable day one.** If buckets slip, launch with promo OFF.

---

## How to resume cold in a new session

```
⚠️ SUPERSEDED — the design is built and the implementation is underway. Use the
"▶️ Next-session prompt" in the "2026-05-26 PM — Wallet-ledger build" section near the
top of this doc to resume.
```

If resuming later in the week: "Read docs/may-26-resume.md and tell me what's still open — diff against current git/firebase state."

---

## Hard constraints (preserve verbatim)
- **STRIPE_SECRET_KEY is LIVE (`sk_live_`).** Real refunds/charges/transfers fire. Deletion is an irreversible LIVE money path.
- **Keep `APP_CHECK_ENFORCED=false`** until Console App Check Metrics ≥99% verified, or users lock out. ([[project_app_check_rollout]])
- **Run `/vibe-security`** on diffs touching auth/payments/rules before commit; fix Critical+High first. ([[feedback_security_audit_before_push]])
- **No VAIL/Dr. White references** — purged, never re-add. ([[feedback_no_vail_references]])
- **Commitment contract, NOT gambling:** no "bet/wager/gamble/win"; use "stake/commitment/goal/complete/Earned." ([[feedback_positioning]])
- **No `firebase deploy` / merge-to-main / outward actions without explicit user go-ahead.**

---

## What's intentionally NOT being done before launch
- Stripe Connect Embedded Components (custom KYC) — deferred ([[project_custom_kyc]]). Express onboarding stays for v1.0.
- Apple Universal Links AASA on `niyah.live/.well-known/apple-app-site-association` — needs marketing-site hosting.
- Branded auth handler on niyah.live — default Firebase domain for v1.0.
- Narrowing compute SA / App Engine default SA removal — post-launch (risk of breaking deployed CFs).
- Phase 4 swimlanes — largely landed ([[lane-b-landed]]); outstanding items in `docs/post-demo-roadmap.md` are not blockers.

## Code blockers still open
- `cd functions && npm audit` before deploy (stripe/plaid/firebase-admin are the money-path deps) — user reports done; re-verify.
- Root `pnpm audit`: 13 advisories, all build/CLI tooling — none ship. Defer.
- Delete Account re-auth is sign-out-then-retry (functional, slightly clunky). Smoother flow is post-launch polish.
