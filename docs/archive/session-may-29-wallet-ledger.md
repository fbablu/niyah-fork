# Session Summary — Wallet-Ledger / App Store Prep (2026-05-29)

> Branch: `wallet-ledger`. Goal: finish App Store submission prep — de-gamble copy, hosted legal pages, privacy labels, dead-code cleanup, privacy manifest. All changes uncommitted in working tree at session end (git is run manually by Fardeen — Claude's commit/push are permission-blocked).
>
> **Read alongside:** [docs/may-26-resume.md](may-26-resume.md) (SSOT for pilot scope + post-submit steps), [docs/legal.md](legal.md) (de-pooled model legal posture).

---

## What we did this session

### 1. Language sweep — de-gamble all user-facing copy (item 3, DONE)

Replaced every "bet / wager / gamble / win" and overstated-payout phrasing with commitment-contract language (stake / commitment / goal / complete / Earned). Files:

- **app/(auth)/welcome.tsx** — onboarding carousel rewritten. 4 pages now: "Welcome to Niyah" / "Take your focus to the next level" / "Put your money where your focus is" (stake → finish → money back; quit early → forfeit) / "Build the habit".
- **app/session/select.tsx** — solo: "Stake on yourself. Complete to get it back." group: "Focus together. Everyone stakes their own."
- **app/session/complete.tsx** — forfeit receipt reframed: "forfeited to Niyah. You staked this money so your future self couldn't weasel out — that's what keeps the commitment real."
- **app/session/waiting-room.tsx** — "Pool" → "Total staked"; "Pool of $X will be returned" → "All $X in stakes will be returned."
- **src/components/onboarding/Onboarding3Scene.tsx** — removed Bitcoin SVG art (const, render block, BTC offsets). Kept gold coins + $ + plant pot.

Left intact (intentional): plant-pot art, "Not Gambling" legal text.

### 2. Solo multiplier — confirmed ships DORMANT at 1.0×

Question resolved: solo completion does **not** pay 1.1/1.2× right now.

- **src/constants/config.ts** — `SOLO_COMPLETION_MULTIPLIER = 1` (dormant).
- **functions/src/index.ts** — `SOLO_PAYOUT_MULTIPLIER` env-read, default `1.0`, clamped `[1.0, 2.0]`. Surplus calc: `surplus = Math.max(0, Math.round(principalCents * (SOLO_PAYOUT_MULTIPLIER - 1)))`.

**Decision: "submit now, flip in days."** Ship honest 1.0× copy. Earn-more (multiplier >1) + the "deposit $5 earn $5" promo flip **server-side post-approval** — no client resubmit needed.

> ⚠️ **Cap NOT built.** Before flipping multiplier >1, must build the payout cap (`min(1× net deposits, $50)`) as the anti-fraud lever. The engagement gate is the enabler that ships now; multiplier is dormant behind it.

### 3. Hosted legal pages (item 4, DONE)

niyah.live is a **Next.js 16 App Router app in `landing-pg/`** (`output: "export"`, Tailwind v4 + shadcn/ui, deployed via `.github/workflows/deploy-landing.yml` → GitHub Pages, triggers on push to `main` touching `landing-pg/**`). CNAME = niyah.live, basePath empty → routes serve at clean URLs.

New files (plain-language, Flighty-inspired but original — adapted to Niyah + Apple guidelines):

- **landing-pg/app/legal/layout.tsx** — shared header/footer, links to /legal/privacy + /legal/terms.
- **landing-pg/app/legal/privacy/page.tsx** — Privacy Policy w/ "Summary in Plain Words" box. Covers: collection, screen-time stays on device, money via Stripe/Plaid, no ads / no selling, 18+ US-only, deletion. support@niyah.live. Last updated May 27, 2026.
- **landing-pg/app/legal/terms/page.tsx** — ToS w/ summary box, commitment-contract framing, withdrawals/KYC, refunds/deletion, completion rewards & promotions (future-proofed), **Apple App Store EULA clause** (Apple not a party, third-party beneficiary), **Governing Law = State of Delaware**.

Clean URLs: serve at `niyah.live/legal/privacy` and `niyah.live/legal/terms` (NOT `.html`). Auto-deploy on merge to `main`.

- **docs/legal.md** — rewritten to de-pooled commitment-contract model. Removed old pool/Venmo design. Stripe/Plaid processor posture, MSB/MTL deferred, eligibility/KYC, App Store strategy (Stripe-not-IAP), points to landing-pg routes.

### 4. App Store privacy labels — walked through every type

Confirmed final set of **10 collected data types** for v1.0, verified against deps + data model + roadmap:

Name, Email Address, Phone Number, Other Financial Info, Contacts, User ID, Device ID, Product Interaction (+ Analytics purpose), Crash Data, Performance Data — all **Linked = true, Tracking = false**, NSPrivacyTracking false.

Decisions:
- Avatars = blobs → no Photos/image type.
- Added Device ID (Sentry/FCM device identifiers), keep User ID.
- No Physical Address now (declare-on-ship when KYC adds it).
- Raw per-app usage minutes: Apple's DeviceActivity API **architecturally blocks** raw per-app usage from leaving device (opaque tokens, sandboxed report extension). Leaderboard runs on derived threshold/pass-fail signals already collected. No new privacy type needed unless that derived data is transmitted.

**Declare-on-ship later:** KYC → Physical Address; DeviceActivityReport → Usage Data (only if transmitted); subscription → Purchases.

### 5. Dead-code cleanup — venmo / zelle / photoURL removed

User confirmed venmo/zelle are dead code (not in main UX). Removed across client + server:

- **functions/src/index.ts** — removed `"venmo"` from withdrawal method union, `pending_venmo` status branch, venmo early-return block, `venmoHandle` from group-invite participant type + 2 write sites.
- **functions/src/withdraw-earned.test.ts** — method union `"standard" | "instant"`.
- **src/types/index.ts** — removed venmoHandle (User/Partner/SessionParticipant/GroupSessionParticipant), zelleHandle (User), partnerVenmo (DuoSession). Kept profileImage.
- **src/store/authStore.ts** — removed setVenmoHandle/setZelleHandle, venmoHandle/zelleHandle reads, all 3 `firebaseUser.photoURL` → profileImage mappings.
- **src/store/partnerStore.ts, groupSessionStore.ts** — removed getVenmoPayLink import/decl/export, venmoHandle parses, partnerVenmo write.
- **src/utils/format.ts** — removed `getVenmoPayLink` only.
- **src/config/firebase.ts** — `saveUserProfile` no longer sources profileImage from `authUser.photoURL`; removed photoURL from internal FirebaseUser interface + mapUser. (photoURL capture dropped → drove the photo-permission removal below.)
- **7 test files** — deleted venmo/zelle blocks + fixtures.

Verified: client `src`/`app` zero venmo/zelle/photoURL, client tsc clean + 796 tests pass; server functions tsc clean + 38/38 tests pass.

### 6. iOS privacy manifest + photo perm removal

- **app.config.js** — added `collectedType()` helper + `ios.privacyManifests`:
  - NSPrivacyTracking: false
  - 4 NSPrivacyAccessedAPITypes: FileTimestamp (C617.1/0A2A.1/3B52.1), UserDefaults (CA92.1/1C8F.1/C56D.1), DiskSpace (E174.1/85F4.1), SystemBootTime (35F9.1)
  - NSPrivacyCollectedDataTypes = the 10 types above
  - Removed `NSPhotoLibraryUsageDescription` (no longer capture photoURL).
- `PrivacyInfo.xcprivacy` generated from this on prebuild (`ios/` is gitignored).

### 7. Support email + ops TODOs (answered)

- Recommend **support@niyah.live**, display name **"Niyah Support"** (not personal "Fardeen"). Created in Google Workspace; fix reply-from setting.
- Incorporation: Delaware C Corp (confirmed on Stripe) → drove Governing Law = Delaware in ToS.

### 8. Build / run on public wifi (resolved)

pnpm version mismatch bug fixed: standalone `pnpm@11.4.0` was overriding pinned `pnpm@10.33.3`, which (a) ignored apple-targets patch + overrides, (b) enforced 24h `minimumReleaseAge` gate → `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Fix: `git checkout package.json`, `pnpm config set manage-package-manager-versions true`, verify `pnpm -v` = 10.33.3. User confirmed build ran after.

Public-wifi Metro connection: **ngrok BLOCKED on this wifi** (dev-doctor: HTTP 000). Use USB cable bypass instead — `REACT_NATIVE_PACKAGER_HOSTNAME=<169.254.x cable IP> pnpm start` (wifi-independent). Get current cable IP via `pnpm run doctor`.

Build warnings (duplicate `-lc++`, ambiguous script deps, Pod deployment-version mismatches, MODULEMAP_FILE) — all **benign / cosmetic**, Build Succeeded, none fixed (regenerated by prebuild anyway).

---

## State at session end

- **All changes uncommitted** in `wallet-ledger` working tree (verified intact).
- Branch divergence: `origin/main` 0 ahead, `wallet-ledger` 14 ahead → clean fast-forward merge.
- Tests green: client 796, server 38/38. tsc clean both sides.

## Remaining steps (Fardeen does these)

1. Commit (6 provided one-liner commits) → merge `wallet-ledger` → `main`.
2. Verify `niyah.live/legal/privacy` + `/legal/terms` live (auto-deploy on merge).
3. Click **Publish** on App Store Connect App Privacy.
4. Set support@niyah.live display name "Niyah Support" + reply-from.
5. **POST-MERGE (critical):** merging code ≠ deploying. Before real users transact — run `/vibe-security` on the money-path diff, then `firebase deploy --only firestore:rules,functions`.

## Hard constraints (preserve)

- `STRIPE_SECRET_KEY` is LIVE (`sk_live_`) — real refunds/charges/transfers fire.
- Keep `APP_CHECK_ENFORCED=false` until Console App Check Metrics ≥99%, or users lock out.
- Run `/vibe-security` on diffs touching auth/payments/rules before commit; fix Critical+High first.
- No VAIL / Dr. White references — purged, never re-add.
- Commitment contract, NOT gambling: no bet/wager/gamble/win; use stake/commitment/goal/complete/Earned.
- No `firebase deploy` / merge-to-main / outward actions without explicit go-ahead.
- Drifted test account `cMtHvQkJJZOgU6pgYARj8nN5Wpf1` stays frozen — don't reuse.
- Multiplier stays 1.0× until payout cap (`min(1× net deposits, $50)`) is built.
