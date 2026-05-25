# May 23, 2026 — Launch Resume Anchor

**Single source of truth for "where the security deploy + launch is right now."** Read this first in a new session, then jump back into the work.

> **Updated 2026-05-25.** Original anchor was Sat 2026-05-23; sections dated May 23/24 are kept as reference but the current state lives in "Where things stand" below.

- **Today:** Sun 2026-05-25
- **App Store live target:** **moved to ~NYC arrival (~Mon 2026-06-01).** The hard "live by May 26" deadline is **dropped** — still actively building. Submit a few days before NYC for the 1–2 day Apple review.
- **Trip:** Depart Thu 2026-05-28 (Eid). Boston 5/29–30 light-touch (few events). Wedding 5/31 Quincy. **NYC ~6/01–6/07 is the focus** — build, marketing, investors. See [[techweek-trip-2026]] memory.
- **Repo:** working branch `launch` (pushed to `origin/launch`); `main` untouched.
- **Reference checklist:** [security-deploy-checklist.md](./security-deploy-checklist.md).

---

## Status snapshot

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 0 — Deploy security branch | ✅ Done | `firestore:rules` + `functions` deployed; migration ran (16 processed, 9 migrated) |
| 1 — GitHub hardening | ✅ Done | Secret scanning, push protection, Dependabot alerts + updates, CodeQL (TS), branch ruleset on `main` w/ linear history |
| 2 — GCP / Firebase | ✅ Done | Budget alert, Pub/Sub kill switch armed, PITR + daily backups on, Auth settings (email enum protect, authorized domains stripped to `niyah.live` + project domains + `localhost`, anonymous off, phone quota lowered, SMS region US-only), IAM cleaned (Owner + break-glass only) |
| 2.5 — App Check | 🟡 Audit mode | reCAPTCHA Enterprise key created, App Attest + DeviceCheck wired. Currently `APP_CHECK_ENFORCED=false`. **Don't flip until Firebase Console → App Check → Metrics shows ≥99% verified traffic** or you'll lock yourself out. |
| 3 — Stripe | 🟡 Mostly done | 2FA required, webhook URL + events (`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`) subscribed, `MAX_DEPOSIT_CENTS=50000` deployed in `createPaymentIntent` (server-side Radar replacement). **Remaining: see "Open in Stripe" below.** |
| 3.5 — Stripe 1099 wizard | ⏸ Paused | Stopped at Business Information step. Resume after email/phone migration. Optional: CPA review of TPSO/Third-party network toggles before final submit. |
| 4 — Plaid | ⬜ Todo | Webhook URL not set, ITEM events not subscribed |
| 5 — Apple Dev Portal | ⬜ Todo | APNs Auth Key, 2FA across all team Apple IDs, role audit |
| 6 — Sentry source maps | ⬜ Todo | `eas secret:create SENTRY_AUTH_TOKEN` |
| 7 — Post-paying-users | ⏸ Deferred | Rate limit tuning, quarterly rotations, monthly audits |

## Where things stand (updated 2026-05-25)

**Shipped to `launch` (pushed, but NOT yet deployed):**
- **Launch payments hardening:** `deleteAccount` CF; in-app Stripe bank management (`createStripeLoginLink` + `niyah.live/stripe/return` bounce → `niyah://stripe-return` deep-link handler); `requestWithdrawal` balance-integrity fix (no minting / no reconcile drift); `mergeOne` pagination + mid-merge markers; withdrawal **eligibility gate removed** (limits now $10 min / $10k per-txn / $25k daily + KYC); Plaid per-Item webhook URL.
- **In-app Account deletion** (Profile → Delete Account, hold-to-confirm) wired to `deleteAccount` — App Store **5.1.1(v)** gate. Re-auth = sign-out-then-retry (works for all providers; satisfies the CF's `auth_time<=600s` gate).
- **De-gamble copy:** dashboard "Won"→"Earned"; invite SMS reframed; dead `YOUR_CODE` TestFlight link removed.
- notifee test-mock completed (clean `pnpm test` output).
- New server-only `deletions/{uid}` Firestore rule.

**⚠️ DEPLOY THESE FIRST — nothing above is live yet:**
1. `firebase deploy --only firestore:rules`
2. `firebase deploy --only functions`
3. **Publish landing bounce:** merge `launch`→`main` *or* GitHub → Actions → "Deploy Landing Page" → Run workflow. Else `niyah.live/stripe/return` 404s and both the bank round-trip and Stripe onboarding-return break.
4. Verify secrets: `firebase functions:secrets:access STRIPE_SECRET_KEY PLAID_CLIENT_ID PLAID_SECRET`
5. Rebuild dev/production client to pick up the new Delete Account screen + copy.

Then work the phased plan at the bottom of this doc, using the "Open in Stripe / Plaid / Apple / Sentry" reference sections below. **Those console statuses were last touched May 23 — re-verify against live state before trusting them.**

---

## Open in Stripe (do tomorrow, before resuming the 1099 wizard)

1. **Connect → Settings:** uncheck "Allow accounts to manage payout schedule." Niyah owns payout cadence, users don't.
2. **Connect → Connected accounts:** delete old test-mode Connect accounts left over from sandbox testing.
3. **1099 wizard resume:** dashboard.stripe.com/settings/connect/tax-reporting → Business Information step. Fill with the new business identity (Niyah Inc, EIN, new business email, new phone, new address if you got one).

---

## Open in Plaid (Phase 4, ~5 min)

1. Team Settings → Webhooks → **Webhook URL:** `https://us-central1-niyah-b972d.cloudfunctions.net/plaidWebhook`
2. Subscribe to ITEM events: `ERROR`, `PENDING_EXPIRATION`, `USER_PERMISSION_REVOKED`, `LOGIN_REPAIRED`
3. Confirm environment = **Production** (not Sandbox)
4. Verify CF picks up a test webhook from the Plaid dashboard's "Fire a test webhook" tool → check Cloud Logging for `plaidWebhook` entries with `200`

---

## Open in Apple Developer Portal (Phase 5, ~10 min)

1. Identifiers → `com.niyah.app` → confirm **App Attest** capability is checked
2. Keys → **Create APNs Auth Key** (`.p8`, APNs scope). Download ONCE → password manager. Upload to Firebase Console → Project Settings → Cloud Messaging → Apple app config.
3. All admin Apple IDs → enable **2FA**
4. App Store Connect → Users → audit roles, remove anyone who left
5. FamilyControls Distribution → confirm all 5 extension App IDs still show "Approved" (per `lane-b-landed` memory, all approved 2026-05-16)

---

## Open in Sentry / EAS (Phase 6, ~5 min)

```bash
# After generating a Sentry auth token at https://sentry.io/settings/account/api/auth-tokens/
# (scopes: project:read, project:releases, org:read)

eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<paste-token>"
eas secret:create --scope project --name SENTRY_ORG --value "niyah"
eas secret:create --scope project --name SENTRY_PROJECT --value "niyah-mobile"

# Local archive builds need it too:
echo 'export SENTRY_AUTH_TOKEN="<paste-token>"' >> ~/.zshrc
```

After the next production build, confirm sourcemaps appear at `sentry.io/settings/niyah/projects/niyah-mobile/source-maps/`.

---

## Tomorrow (Sun 2026-05-24) morning plan — ~90 min

In strict order so nothing has to be redone:

### Block 1 — Infra (~45 min)

1. **Get a real business phone number.** Pick one — don't agonize:
   - OpenPhone ($15/mo, business-positioned VoIP — Stripe accepts it)
   - Add a $10/mo extra line to your existing T-Mobile/Verizon account
   - Mint Mobile prepaid eSIM ($15 first month, real cellular = always accepted)
   - Google Voice (still free, but Stripe sometimes rejects)
2. **(Optional) Get a virtual business address** — iPostal1 / Earth Class Mail / Anytime Mailbox (~$15/mo). They'll mail you a notarization form for later; you don't need to wait for it. If you skip this, keep using your home address.
3. **Confirm `fardeen@niyah.live` works:** sign in to Google Workspace, enable MFA, send yourself a test email.

### Block 2 — Email migration (~30 min)

Goal: `fardeen@niyah.live` becomes primary; `fardeeneb@gmail.com` stays as break-glass secondary Owner everywhere.

4. **GCP / Firebase:** Console → IAM → Add `fardeen@niyah.live` as Owner. Sign out of `firebase` CLI, sign back in as the new account, run `firebase projects:list` to confirm access.
5. **Stripe:** Team → Invite `fardeen@niyah.live` as Admin. Accept invite (separate browser session). Verify access to Connect + Webhooks settings.
6. **Plaid:** Team → Invite `fardeen@niyah.live` as Admin. Accept + verify dashboard access.
7. **Leave Gmail in place as secondary Owner** on all three. Do NOT remove it tomorrow — keep it as break-glass for ≥30 days.

### Block 3 — Finish Stripe (~15 min)

8. Log back into Stripe as `fardeen@niyah.live`.
9. Uncheck "Allow accounts to manage payout schedule" (Connect → Settings).
10. Delete old test Connect accounts.
11. Resume 1099 wizard → Business Information (legal name = Niyah, Inc.; EIN; new phone; address; email = fardeen@niyah.live) → State filing → Delivery preferences → Summary.
12. **Optional CPA review** before final Submit: confirm 1099 settings (Exclude fees, TPSO, Third-party network). Defensible defaults for a P2P facilitator C-corp: all three ON. Settings are editable through Jan 2027 — first 1099-K cycle.

### Block 4 — Plaid + Apple + Sentry (~30 min)

13. Phase 4 (Plaid): webhook URL + ITEM events.
14. Phase 5 (Apple): APNs Auth Key, 2FA audit.
15. Phase 6 (Sentry): EAS secrets.

---

## Critical-path days to App Store live

| Day | Goal |
| --- | ---- |
| Sun May 25 | Code shipped to `launch`. **Deploy** rules + functions + landing (see "DEPLOY THESE FIRST"). Re-verify Stripe/Plaid/Apple/Sentry console state. |
| Mon–Tue May 26–27 | Live keys (Stripe + Plaid prod), Apple (APNs + `pnpm build:production`), App Store Connect listing (privacy labels, account-deletion disclosure, ToS/Privacy URLs). **E2E real-money smoke:** $1 deposit → stake → complete → payout; test Delete Account on a throwaway. |
| Wed May 28 | Eid + depart. **Submit App Store build** by now for the 1–2 day review. |
| Thu–Sat May 29–31 | Boston (light) + wedding 5/31. Respond to Apple if rejected. |
| ~Mon Jun 1 | **Target: App Store live as you land in NYC.** |

---

## How to resume cold in a new session

```
"Read docs/may-23-resume.md. Pick up from the Tomorrow plan."
```

That's it. This doc is the anchor.

If the resume is later in the week (Mon/Tue/Wed), say "Read docs/may-23-resume.md and tell me what's still open" — Claude will diff this against current git/firebase state and flag what shifted.

---

## What's intentionally NOT being done before launch

- **Stripe Connect Embedded Components (Path B custom KYC)** — deferred per [[project_custom_kyc]] memory. Stripe Express onboarding stays for v1.0.
- **Apple Universal Links AASA file** on `niyah.live/.well-known/apple-app-site-association` — needs to be hosted on the marketing site, separate from the mobile app. Tracked in `security-deploy-checklist.md` "What's NOT done."
- **Branded auth handler on niyah.live** — uses default Firebase domain for v1.0. Post-launch polish.
- **Narrowing compute SA from Editor → specific roles** — risk of breaking deployed CFs mid-launch week. Post-launch.
- **App Engine default SA removal** — same reason.
- **Phase 4 swimlanes (post-demo)** — Lane A (auth/identity), B (native iOS), C (inline UX), D (bank reliability) — already largely landed per [[lane-b-landed]] memory. Outstanding items in `docs/post-demo-roadmap.md` are NOT launch blockers.

---

## Phased manual-task plan (captured 2026-05-25)

The "separate next-steps plan" is now this phased launch sequence:

- **Phase A — Deploy (today):** rules + functions + landing bounce. See "DEPLOY THESE FIRST" above.
- **Phase B — Live keys / consoles:** Stripe live keys + webhook + uncheck payout-schedule + 1099; Plaid production + ITEM webhook. See "Open in Stripe" / "Open in Plaid".
- **Phase C — Apple + build + submit:** APNs key + 2FA; `pnpm build:production`; App Store Connect listing (Productivity category, ToS/Privacy URLs, **App Privacy labels**, **account-deletion disclosure**, age rating, export compliance); submit. See "Open in Apple Developer Portal" / "Open in Sentry / EAS".
- **Phase D — Post-submit:** keep `APP_CHECK_ENFORCED=false` until App Check Metrics ≥99% verified, then flip. Monitor `deletions.refundShortfallCents` > 0, withdrawal txns `sent_with_warning`, Plaid webhook deliveries.
- **Phase E — Post-launch (NYC+):** custom in-app KYC ([[project_custom_kyc]]); revisit the removed withdrawal eligibility gate if cash-out fraud appears.

⚠️ **#1 App Review risk:** real-money stake→payout framing. Lead with the commitment-contract precedent (stickK / Beeminder), Productivity category, zero "bet/wager/win" copy. Decide the framing before you submit.

### Code blockers still open (my end, not console)
- Functions runtime audit not yet run — it's npm-based: `cd functions && npm audit` before deploy (stripe / plaid / firebase-admin are the money-path deps that matter).
- Root `pnpm audit`: 13 advisories, **all build/CLI tooling** (`@bacons/apple-targets`, `eas-cli`, `expo`>metro) — none ship. Defer; optional `pnpm.overrides` post-launch.
- Delete Account re-auth is sign-out-then-retry (functional, slightly clunky). Smoother inline/resume flow is a post-launch polish if wanted.
