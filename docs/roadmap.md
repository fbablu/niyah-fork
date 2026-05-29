# Roadmap

> Development phases, what shipped, and what's left.
> **Current launch state lives in [STATUS.md](./STATUS.md)** — this doc is the phase history + the
> forward-looking backlog. See also: [Features](./features.md) | [Payments](./payments.md) | [Native Modules](./native-modules.md)

## Phase history

| Phase | Window | Status |
| ----- | ------ | ------ |
| 1 — Demo Day + Immersion Showcase | Apr 15–16, 2026 | ✅ Shipped (zero crashes, real Stripe deposits + group payouts flowed live) |
| 2 — Solo Sessions (UI wiring) | Apr 16–18, 2026 | ✅ Shipped (select → confirm → active → complete/surrender; `sessionStore` source of truth) |
| 3 — Campus Launch "Lock In For Finals" | Apr 19 – May 5, 2026 | ✅ Shipped (Vanderbilt finals TestFlight cohort; surfaced 11 UX/reliability gaps → Phase 4) |
| 4 — Premium UX Push | May 8 – May 16, 2026 | ✅ Largely shipped (see below) |
| 5 — De-pooled v1 + App Store submission | May 2026 → | 🚧 In progress — [STATUS.md](./STATUS.md) |

> Campus-cohort outcome numbers (DAU, completion rate, avg stake, retention) exist in
> Firestore/Stripe/Analytics but are **not yet computed**. Plan: a read-only metrics script
> (model on `functions/scripts/diagnose-wallet.js`, zero writes, exclude test uids) → real numbers
> for the pre-seed pitch.

## Foundation — shipped and stable

| Area | Notes |
| ---- | ----- |
| Firebase Auth | Google, Apple, Email magic link, Phone SMS OTP via RNFB; multi-provider account linking (`linkWithCredential`) + `mergeDuplicateUsers` admin CF |
| Firestore | Profiles, wallets, follows, sessions; crash recovery; hardened rules (default-deny) |
| Solo sessions | Full lifecycle, flexible cadence, `handleSessionComplete`/`Forfeit` CFs |
| Quick block | One-tap blocking without stake (`quick-block.tsx`) |
| Group sessions | N-person propose/invite/waiting-room/active; ~10 Cloud Functions; real-time Firestore listeners. **De-pooled** (see [legal.md](./legal.md), [payments.md](./payments.md)) |
| Social | Following/followers, public profiles, reputation (5 tiers), contact discovery, referrals |
| Screen Time (Swift) | Auth, picker, blocking, violation polling, custom branded shield. Extensions via `@bacons/apple-targets` in `targets/` |
| Live Activities | Lock-screen + Dynamic Island widget (`targets/widget/`) — shipped 2026-05-16 |
| Push (FCM) | Token management, ~7 notification types, foreground via notifee |
| Stripe + Plaid | Live keys deployed; deposit/withdrawal/Connect/Plaid; nightly `reconcileWalletBalances` |
| Legal acceptance | `acceptLegalTerms` CF, server-timestamped, 18+ attestation, `CURRENT_LEGAL_VERSION` 2.0.0 |
| Security | Server-side validation, rate limiting, SSL pinning, screen protection, App Check (flag-gated) |

### Apple / business / Firebase

- ✅ Apple Developer Program; FamilyControls Distribution approved **2026-05-16 for all 5 extension bundle IDs** (main app + monitor + report + shieldaction + shieldconfig).
- ✅ Niyah, Inc. (Delaware C-Corp, EIN); Stripe live mode + production webhook; Plaid production; landing site live at `niyah.live`.
- ✅ Firebase project: Auth + Firestore; ~40 Cloud Function exports deployed; rules hardened.

## Phase 4 — Premium UX Push (shipped 2026-05-08 → 05-16)

Closed the 11 gaps from May 5 TestFlight testing. Ran as four parallel swimlanes. Status:

- **Lane A — Auth & Identity** — ✅ Phone OTP global throttle, multi-provider account linking, `mergeDuplicateUsers`, profile source-of-truth fix, global keyboard handling. App Check is **wired + flag-gated** (`APP_CHECK_ENFORCED`); only the enforce flip remains (gated on ≥99% token coverage).
- **Lane B — Native iOS** — ✅ Migrated all 5 extensions to `@bacons/apple-targets`; `DeviceActivityReport` + Live Activity (lock screen + Dynamic Island) shipped; custom branded shield + two-step surrender. Deferred: per-app shield variants (B4), baseline-onboarding screen (B3).
- **Lane C — Inline UX & Push** — ✅ `StatusBanner` replacing `Alert.alert` across group flow, scrubber timer with pause-as-surrender, foreground push via notifee. Open: leaderboard polish, richer in-session push types, optimistic payout preview.
- **Lane D — Bank & Payout Reliability** — ✅ `unlinkBankAccount` + `replaceBankAccount` CFs, "Manage Bank" UI, nightly `reconcileWalletBalances`, transfer idempotency keys, earned-funds withdrawal integration test.

## Phase 5 — De-pooled v1 + Public Launch

Active. The pivot from the old pooled/duo design to a **de-pooled commitment-contract** model
(every participant stakes their own money; no peer-to-peer payments) plus the wallet-ledger bucket
system. **Full current state + remaining-to-submit + post-submit dormant flips → [STATUS.md](./STATUS.md).**

Beyond submission:

- Pitch deck with real campus metrics (compute the cohort numbers).
- Unit economics (CAC, LTV, take rate from forfeited stakes).
- Earn-more multiplier + promo (server-side flip post-approval; gated on engagement gate + surplus cap + backfill — see STATUS).
- Legal compliance review for additional states (geo-gate is env-tunable).
- Subscription tier later ($3–5/mo for analytics + schedules).

## Forward-looking design (not yet built)

- **Group equity (cap-target payout)** — Strava-style per-user screen-time cap verified by the DeviceActivityReport extension. Design: [group-equity.md](./group-equity.md). Note: superseded in priority by the de-pool; revisit if/when group competition returns.
- **Schedule blocking** — `scheduleStore`, schedule-builder, calendar integration. Reopens post-grad.
- **Custom in-app KYC** — replace Stripe Express onboarding with native verification ([memory: custom KYC](../)). Express stays for v1.

## Open product decisions (Fardeen)

1. Solo payout multiplier value once flipped (1.1× / 1.2×) + the surplus cap factor.
2. Default screen-time `CAP_FACTOR` if group equity returns.
3. `member_app_opened` push cooldown (30s vs higher).
4. Final Phase 3 cohort numbers for the deck.
