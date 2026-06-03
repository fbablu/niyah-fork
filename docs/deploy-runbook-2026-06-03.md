# Deploy runbook — 2026-06-03 (NY Tech Week)

> **You (Fardeen) run every command here.** Claude supplies them; never executes deploy/EAS/git.
> Grounded in [STATUS.md](./STATUS.md) "Remaining to submit" + [techweek-2026-06-launch.md](./techweek-2026-06-launch.md).
> `STRIPE_SECRET_KEY` is LIVE — steps 2/4 move real money and are irreversible.

## Tonight reality (the event is 6–8pm)

You do **NOT** need steps 1–7 done for the booth. The scannable QR points at the **waitlist page**
(`niyah.live/waitlist`, built tonight) — collect emails, invite to TestFlight after Beta review
clears in 1–2 days. The deploy below is for when **real testers actually transact**, not for the pitch.
Honest pitch line: *"real-money focus app, money path security-audited, shipped to TestFlight tonight,
first beta cohort onboarding"* — NOT "live on the App Store," NOT a fabricated user count.

## Critical path (in order)

### 1. Merge `wallet-ledger` → `main`
Clears the 11 Dependabot alerts (they scan `main`). Also un-blocks an accurate submit.
```
git checkout main && git pull
git merge wallet-ledger        # resolve if needed
git push
```

### 2. Deploy functions + rules + indexes  ⚠️ LIVE, IRREVERSIBLE
Activates the bucket ledger, `unfreezeWallet`, the withdrawal-TOCTOU atomic counter, the
legal-acceptance idempotency fix, and the `config/featureFlags` public-read fix.
```
cd functions && npm install
firebase deploy --only functions,firestore:rules,firestore:indexes
```
Pre-flight already green (secrets, serverFlags promo=0, kill-switch off, Plaid prod) — see STATUS.

### 3. APNs Auth Key (.p8) → Firebase → Cloud Messaging
Required for phone auth + push on the **production** APNs gateway (Team `4R55F73KCP`; prod key
`BM42K87CP9` per qa-2026-06-02). Firebase Console → Project Settings → Cloud Messaging → upload.
**Defer option:** ship Google/Apple-only via `EXPO_PUBLIC_DISABLE_PHONE_AUTH=true`.

### 4. Real-money smoke on a FRESH clean account (NOT the frozen `cMtHvQ…`)
Tiny real $. Follow [smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md): deposit → solo session →
complete (payout) → surrender (forfeit) → withdraw. Watch Firestore / Stripe / webhook 200s.
Verify `balance == Σbuckets`. Fresh account = sign in with a spare phone number or a new Apple ID
(do NOT link the Gmail — account-merge folds it into the drifted acct).

### 5. Rebuild client + submit  (tonight's blocker fixes are JS, but TestFlight needs a new build)
Bump `app.config.js` `ios.buildNumber` **19 → 20** (single source for app + 5 extensions).
```
eas build --profile production --platform ios --local
eas submit --platform ios --profile production
```
`ascAppId` is already in `eas.json` → submit is non-interactive. Export compliance auto-answered
(`ITSAppUsesNonExemptEncryption:false`).

### 6. External TestFlight public link → the QR
ASC → TestFlight → create an **External** group → add build 20 → fill Test Info + App Review Info
(reviewer login: magic-link / a test acct; notes: **Stripe = user's own funds (not IAP)**,
**commitment-contract, not gambling**, **Productivity**, FamilyControls justification) → **Submit for
Beta Review** (~24–48h) → enable **Public Link** → QR = `testflight.apple.com/join/XXXX`. Point
`NEXT_PUBLIC_TESTFLIGHT_URL` at it.

### 7. App Store submit (separate, slower track, same binary)
ASC App Store tab: **Publish** App Privacy (10 data types, Linked=true / Tracking=false),
account-deletion URL, support URL + `support@niyah.live`, screenshots, description, keywords →
Submit for Review (~1–2 wk, high first-pass rejection risk for real-money — babysit it).

## Guardrails
- `APP_CHECK_ENFORCED=false` until App Check Metrics ≥ 99%.
- Low deposit cap + billing kill-switch (`serverFlags.billingKillSwitchEnabled`) ready for strangers.
- Do **not** hand out a "$5/$5 match" before the engagement gate ships (anti-fraud lever).
- Watch Stripe + Firestore live during the event.
