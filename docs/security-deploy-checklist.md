# Security Deploy Checklist (operator runbook)

> **This is the operator runbook** — the by-hand dashboard/CLI steps to activate each protection.
> Background + what's wired in code: [security.md](./security.md). Current execution status (what's
> actually been done): [STATUS.md](./STATUS.md).

This doc lists what's left for **you** to do — by hand in a dashboard or via CLI — to fully activate the protections.

Items are ordered by deploy criticality. ✅ = ready to do now. ⏸ = wait until after first paying users / specific signal.

---

## ✅ Phase 0: Deploy the branch (CLI)

```bash
# From repo root (de-pooled money path is already merged into `main`; the
# `wallet-ledger` branch only carries landing-pg copy). Deploy from `main`:
firebase deploy --only firestore:rules
firebase deploy --only functions

# After functions deploy succeeds, run the one-shot user-doc migration.
# Drains Plaid tokens, Stripe IDs, KYC names, and fcmTokens off the public
# users/{uid} doc into the new userPrivate / userPushTokens collections.
# Get ADMIN_API_KEY from your password manager or Firebase Secret Manager.
ADMIN_KEY="<paste-your-admin-key>"
PROJECT_ID="<your-firebase-project>"

# Dry run first to see what would change:
curl -s -X POST \
  "https://us-central1-${PROJECT_ID}.cloudfunctions.net/migrateSensitiveFieldsToPrivate" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "content-type: application/json" \
  -d '{"dryRun": true, "limit": 500}' | jq

# Real run, paginated. Repeat with the returned `nextCursor` until missing:
curl -s -X POST \
  "https://us-central1-${PROJECT_ID}.cloudfunctions.net/migrateSensitiveFieldsToPrivate" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "content-type: application/json" \
  -d '{"dryRun": false, "limit": 500}' | jq

# When the response has no `nextCursor` field, migration is complete.
```

---

## ✅ Phase 1: GitHub repo hardening (5 min, web UI only)

These are all under **Settings → Code security and analysis** on the repo:

- [ ] Secret scanning → **enabled**
- [ ] Push protection → **enabled** (blocks commits containing API keys before they hit GitHub)
- [ ] Dependabot alerts → **enabled**
- [ ] Dependabot security updates → **enabled**
- [ ] CodeQL → **enabled** (TypeScript)

Then **Settings → Branches**:

- [ ] Protect `main`: require pull request before merging, require status checks (CI), require linear history.

---

## ✅ Phase 2: GCP / Firebase Console (15 min, mix of console + CLI)

### Budget alert (web UI)

GCP Console → Billing → **Budgets & alerts → Create budget**:

- Name: `niyah-prod-monthly`
- Amount: `$300/month` (raise as scale demands)
- Threshold alerts at `50%`, `90%`, `100%`, `200%` — actual spend, all to email
- **Connect a Pub/Sub topic**: `billing-alerts` (creates the topic; the `disableBillingOnBudgetExceeded` CF I shipped is already subscribed to this name).

### Arm the kill switch (CLI, only after testing the topic publishes)

```bash
# Grant the Cloud Functions runtime SA the role needed to detach billing.
# Replace PROJECT_NUMBER with the numeric project number.
PROJECT_NUMBER="<your-project-number>"
BILLING_ACCOUNT_ID="<your-billing-account-id>"   # e.g. 01ABCD-EF1234-567890

gcloud billing accounts add-iam-policy-binding "${BILLING_ACCOUNT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/billing.projectManager"

# Arm the kill switch. By default the CF logs only; arming enables the actual
# `detachBilling` call once cost > 2× budget. Armed state resolves at RUNTIME
# (resolveBillingKillSwitchArmed: Firestore config/serverFlags →
# BILLING_KILL_SWITCH_ENABLED env → false). The durable, no-redeploy source is
# the Firestore doc — set it there so a lost env file can't silently disarm:
#   Firebase Console → Firestore → config/serverFlags → billingKillSwitchEnabled = true
# (No redeploy needed; the resolver caches for ~60s.)
```

### Firestore backups (web UI)

Firebase Console → Firestore → **Backups**:

- [ ] Enable Point-in-Time Recovery (7-day window)
- [ ] Schedule a daily export to a GCS bucket (`gs://niyah-firestore-backups`). Auto-delete after 30 days.

### Firebase Auth settings (web UI)

Authentication → **Settings**:

- [ ] **Email enumeration protection** → enable. (Firebase will start returning generic errors on `signInMethodsForEmail`; the client already handles this.)
- [ ] **Authorized domains** → strip everything except: `niyah.live`, `<projectId>.firebaseapp.com`, `localhost`. Remove any test domains.

Authentication → **Sign-in method**:

- [ ] Confirm Anonymous is **off**.
- [ ] Phone → lower the daily quota to a realistic ceiling (default 10k is too high for early stage).

### App Check enforcement flip (web UI)

Firebase Console → App Check → **Apps tab**:

- [ ] Confirm the iOS app is registered with **App Attest** as the provider (not the debug provider).
- [ ] Once the **Metrics tab** shows ≥99% verified production traffic for Cloud Functions / Firestore / Auth, click **Enforce** on each.
- [ ] Set the server-side env flag to match: `APP_CHECK_ENFORCED=true`, then redeploy. **Note:** Firebase's functions dotenv only loads `functions/.env`, `functions/.env.<projectId>` (`.env.niyah-b972d`), and `functions/.env.<alias>` (`.env.default`) — **not** `functions/.env.production`, and no predeploy script copies it in. Put the flag in `functions/.env.niyah-b972d` (or `.env`) so the deploy actually picks it up; `.env.production` alone is a dead pin (`firebase.json` also sets `disallowLegacyRuntimeConfig`, so the old `functions:config:set` path is off too).

### IAM least-privilege (web UI)

GCP Console → **IAM & Admin → IAM**:

- [ ] Drop any external collaborators with `Owner` or `Editor`. Keep `Owner` to one human + maybe a break-glass account.
- [ ] Service accounts: review what each does. The default compute SA shouldn't have `Owner`.

---

## ✅ Phase 3: Stripe Dashboard (10 min, web UI + CLI)

### Web UI

- [ ] Profile → Two-step authentication → required for every team member.
- [ ] Developers → Webhooks → confirm endpoint URL is `https://us-central1-<projectId>.cloudfunctions.net/stripeWebhook`.
- [ ] Developers → Webhooks → **Listening to** → subscribe only to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`. Unsubscribe from everything else. (The CF's `switch` only acts on `payment_intent.succeeded` + `account.updated`; `payment_intent.payment_failed` is currently received-and-ignored — keep it subscribed for future handling / dashboard visibility.)
- [ ] Radar → Rules → enable default rules. Consider blocking transactions from countries you don't serve.
- [ ] Connect → Settings → review payout schedule + branding + supported countries.

### CLI

```bash
# If you need to rotate the webhook signing secret (do quarterly):
stripe trigger payment_intent.succeeded   # confirm webhook is alive first
# Then in Dashboard → Webhooks → Roll signing secret → copy new value
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # paste new value
firebase deploy --only functions:stripeWebhook

# Refresh the IP allowlist in the codebase quarterly. The authoritative list:
curl -s https://stripe.com/files/ips/ips_webhooks.json | jq -r '.WEBHOOKS[]'
# If the list changed, update STRIPE_WEBHOOK_IPS in functions/src/index.ts.
```

---

## ✅ Phase 4: Plaid Dashboard (5 min, web UI + CLI)

### Web UI

- [ ] **Webhook URL is NOT set in the dashboard** — the CF passes it per-Item via the `webhook:` param on `/link/token/create` (`PLAID_WEBHOOK_URL` in `index.ts`, default `https://us-central1-<projectId>.cloudfunctions.net/plaidWebhook` derived from `GCLOUD_PROJECT`). Only override `PLAID_WEBHOOK_URL` if you front the CF with a custom domain.
- [ ] Team Settings → Webhooks → **Verification key** → reveal and copy (optional; the CF fetches keys by `kid` at runtime).
- [ ] No dashboard subscription step needed — the CF reverse-looks up the Item and clears tokens on these `ITEM` codes: `ITEM_LOGIN_REQUIRED`, `USER_PERMISSION_REVOKED`, `PENDING_EXPIRATION`, `ERROR` (item-fatal). It ignores everything else.

### CLI

```bash
# Store the Plaid webhook verification reference (PLAID_WEBHOOK_KEY is not
# strictly needed — the CF fetches keys by `kid` via plaid.webhookVerificationKeyGet —
# but if you ever want to pin to a known key, set it here):
# firebase functions:secrets:set PLAID_WEBHOOK_KEY

# Trigger a sandbox webhook to verify the CF accepts it:
# (in Plaid Dashboard → Sandbox → "Fire a test webhook")
# Then check Cloud Logging for "plaidWebhook" entries.
```

---

## ✅ Phase 5: Apple Developer Portal (10 min, web UI only)

- [ ] Identifiers → Niyah app ID → confirm **App Attest** capability is checked.
- [ ] Identifiers → Keys → generate an **APNs Auth Key** (`.p8` file, APNs scope). Download it once and store in your password manager. Upload to **Firebase Console → Project Settings → Cloud Messaging → Apple app config**.
- [ ] All admin/developer Apple IDs → enable **2FA**.
- [ ] App Store Connect → Users → audit role assignments. Remove anyone who left.
- [ ] FamilyControls Distribution → confirm extension App IDs are still active (already approved per project memory).

---

## ✅ Phase 6: Sentry source-map upload (5 min, CLI)

The codebase is wired (`@sentry/react-native/expo` config plugin + `getSentryExpoConfig` in metro). You need to provision the auth token.

```bash
# 1. Create a Sentry auth token at https://sentry.io/settings/account/api/auth-tokens/
#    Scopes needed: project:read, project:releases, org:read.

# 2. Store as an EAS secret so production builds upload symbols:
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<paste-token>"

# 3. Also set SENTRY_ORG and SENTRY_PROJECT if they differ from defaults:
eas secret:create --scope project --name SENTRY_ORG --value "niyah"
eas secret:create --scope project --name SENTRY_PROJECT --value "niyah-mobile"

# 4. For local archive builds, drop them in your shell profile:
echo 'export SENTRY_AUTH_TOKEN="<paste-token>"' >> ~/.zshrc

# 5. Confirm next production build uploads maps:
#    Run: pnpm release:testflight
#    Check: https://sentry.io/settings/<org>/projects/<project>/source-maps/
#    You should see a new release with sourcemap files.
```

---

## ⏸ Phase 7: Wait until after first paying users

- [ ] Lower per-IP rate limits in `IP_RATE_LIMITS` if you observe abuse patterns in Cloud Logging.
- [ ] Add Plaid webhook secret rotation to your quarterly task list.
- [ ] Refresh Stripe webhook IP allowlist quarterly (see Phase 3 CLI).
- [ ] Run `pnpm audit` + `cd functions && npm audit` monthly; address any new highs.

---

## CLI quick-reference

```bash
# Full security deploy in one block:
firebase deploy --only firestore:rules,functions

# Migration (drain users.* sensitive fields to userPrivate):
curl -X POST "https://us-central1-${PROJECT_ID}.cloudfunctions.net/migrateSensitiveFieldsToPrivate" \
  -H "x-admin-key: ${ADMIN_KEY}" -H "content-type: application/json" \
  -d '{"dryRun":false,"limit":500}'

# EAS secrets for Sentry:
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<token>"

# Stripe webhook secret rotation:
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# IAM role for budget kill switch:
gcloud billing accounts add-iam-policy-binding "${BILLING_ACCOUNT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/billing.projectManager"
```

---

## Verification after deploy

Sanity-check that the protections actually work:

```bash
# 1. RLS check — confirm a signed-in user cannot read userPrivate of another user.
#    (Hit the Firebase emulator / staging with a non-owner Firebase ID token.)

# 2. Stripe webhook IP allowlist — non-Stripe IP should get 403:
curl -X POST "https://us-central1-${PROJECT_ID}.cloudfunctions.net/stripeWebhook" \
  -H "stripe-signature: t=1234,v1=abc" -d '{}'
# Expect: {"error":"Forbidden"}

# 3. Plaid webhook verification — bad JWT should get 401:
curl -X POST "https://us-central1-${PROJECT_ID}.cloudfunctions.net/plaidWebhook" \
  -H "plaid-verification: not-a-real-jwt" -d '{}'
# Expect: {"error":"Invalid Plaid signature"}

# 4. IP rate limit — hammer createPaymentIntent 10x rapidly from the same IP
#    with valid auth tokens for different users. After ~8 requests, expect 429
#    "Too many requests from your network".

# 5. Sentry source maps — after the next prod build, trigger a test crash via
#    the in-app crash button (if you have one) or `Sentry.captureException(new Error("test"))`
#    in dev. The Sentry issue should show the original TypeScript file + line.
```

---

## What's NOT done and why

- **Universal-link verification** (Apple's `apple-app-site-association` file on niyah.live): you need to upload `https://niyah.live/.well-known/apple-app-site-association` containing your app's bundle identifier + team ID. Without that file, the `applinks:niyah.live` entitlement doesn't actually intercept URLs.
- **Hosting that AASA file** is server-side work on niyah.live, not the mobile app. I can't do it from here. The file content is:
  ```json
  {
    "applinks": {
      "apps": [],
      "details": [
        { "appID": "4R55F73KCP.com.niyah.app", "paths": ["*"] }
      ]
    }
  }
  ```
  Served at `https://niyah.live/.well-known/apple-app-site-association` with `Content-Type: application/json`, no redirects.

- **Plaid webhook verification key persistence**: the CF fetches the JWK on-demand via `plaid.webhookVerificationKeyGet({key_id})` and caches in-memory for an hour. No need to pre-store the key in Secret Manager.

- **`functions/pnpm-lock.yaml`**: resolved — deleted, functions stays on npm (Node 22). No stray lockfile in the working tree.
