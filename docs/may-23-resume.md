# May 23, 2026 — Launch Resume Anchor

**Single source of truth for "where the security deploy + launch is right now."** Read this first in a new session, then jump back into the work.

- **Today:** Sat 2026-05-23, 1pm CT
- **App Store live target:** Tue 2026-05-26 (submit by Mon 2026-05-25 EOD for 1–2 day Apple review)
- **Departure for Boston Tech Week:** Thu 2026-05-28 (shifted from May 26 → 2 extra days of runway before the trip)
- **Repo:** `fbablu/niyah-fork` (security branch open as PR #1, not merged; main untouched until merge)
- **Reference checklist:** [security-deploy-checklist.md](./security-deploy-checklist.md). This doc tracks what's actually done.

---

## Status snapshot

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 0 — Deploy security branch | ✅ Done | `firestore:rules` + `functions` deployed; migration ran (16 processed, 9 migrated) |
| 1 — GitHub hardening | ✅ Done | Secret scanning, push protection, Dependabot alerts + updates, CodeQL (TS), branch ruleset on `main` w/ linear history |
| 2 — GCP / Firebase | ✅ Done | Budget alert, Pub/Sub kill switch armed, PITR + daily backups on, Auth settings (email enum protect, authorized domains stripped to `niyah.live` + project domains + `localhost`, anonymous off, phone quota lowered, SMS region US-only), IAM cleaned (Owner + break-glass only) |
| 2.5 — App Check | 🟡 Audit mode | reCAPTCHA Enterprise key created, App Attest + DeviceCheck wired. Currently `APP_CHECK_ENFORCED=false`. **Don't flip until Firebase Console → App Check → Metrics shows ≥99% verified traffic** or you'll lock yourself out. |
| 3 — Stripe | 🟡 Mostly done | 2FA required, webhook URL + events (`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`) subscribed, `MAX_DEPOSIT_CENTS=50000` deployed in `createPaymentIntent` (server-side Radar replacement). **Remaining: see "Open in Stripe" below.** |
| 3.5 — Stripe 1099 wizard | ⏸ Paused | Stopped at Business Information step. Resume after email/phone migration. |
| 4 — Plaid | ⬜ Todo | Webhook URL not set, ITEM events not subscribed |
| 5 — Apple Dev Portal | ⬜ Todo | APNs Auth Key, 2FA across all team Apple IDs, role audit |
| 6 — Sentry source maps | ⬜ Todo | `eas secret:create SENTRY_AUTH_TOKEN` |
| 7 — Post-paying-users | ⏸ Deferred | Rate limit tuning, quarterly rotations, monthly audits |

**Uncommitted in working tree (security branch):**
- `functions/src/index.ts` — `MAX_DEPOSIT_CENTS` server-side deposit cap (already deployed, not yet committed)
- `.gitignore` — `functions/.env*` line added
- `package.json` + `pnpm-lock.yaml` — `react-native-keyboard-controller` 1.21.7 → 1.21.8 + Expo lock churn from `pnpm install`
- New file `docs/qa.md` (in-progress manual QA notes)
- New file `docs/may-23-resume.md` (this file)

→ Commit before resuming work tomorrow so the deploy-checklist updates aren't lost.

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
12. **VAIL gate before submitting:** confirm 1099 settings (Exclude fees, TPSO, Third party network) with Mark/Cat. Don't click Submit on the 1099 setup until they confirm.

### Block 4 — Plaid + Apple + Sentry (~30 min)

13. Phase 4 (Plaid): webhook URL + ITEM events.
14. Phase 5 (Apple): APNs Auth Key, 2FA audit.
15. Phase 6 (Sentry): EAS secrets.

---

## Critical-path days to App Store live

| Day | Goal |
| --- | ---- |
| Sun May 24 | Email migration + Stripe/Plaid/Apple/Sentry done (above). Commit the uncommitted security files. |
| Mon May 25 | **E2E real-money smoke test:** $1 deposit → solo stake → complete → payout. **Submit App Store build EOD** with metadata, screenshots, privacy nutrition label. |
| Tue May 26 | Original ship target — likely "In Review" with Apple |
| Wed May 27 | Buffer / approval / respond to Apple if rejected |
| Thu May 28 | **Departure for Boston.** App Store should be live before wheels up. |

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

## Your "other plan" placeholder

Fardeen mentioned in the May 23 1pm session that he has a separate next-steps plan to discuss in a new session beyond this checklist. **That plan is not captured here yet** — bring it up explicitly in the next session and update this doc (or create a sibling) once the scope is clear.
