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
| 6 — Green-world redesign + Profile rebuild | June 2026 (builds 25–28) | ✅ Shipped to TestFlight (single brand theme, near-static motion, Profile v2) |
| 7 — Staking Wizard (session-flow restructure) | Next | 📋 Planned — [staking-wizard-plan.md](./staking-wizard-plan.md) |

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
| UI / theme | Single green brand theme (dark/light toggle removed), near-static motion, Profile v2 (Clout, blob-stamp calendar, all-time ticker) — builds 25–28 (Phase 6) |

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

## Phase 6 — Green-world redesign + Profile rebuild (shipped, builds 25–28)

A whole-app visual redesign onto a **single green brand theme**, plus a ground-up Profile tab. Shipped
to TestFlight across builds 25–28 (`BUILD_NUMBER` is now epoch-seconds via `scripts/build-prod.sh`,
`eas.json` `appVersionSource: "local"`). Gates green: typecheck 0 errors, jest ~957/963 (6 intentional
skips), eslint 0/0. Design-system rules: [figma-design-rules.md](./figma-design-rules.md); profile spec:
[profile-redesign-brief.md](./profile-redesign-brief.md). (Overnight-run history log:
`redesign-all-tabs-progress.md`.)

- **Single theme** — every tab, all 16 session screens, money screens, `app/blocked.tsx`,
  `app/user/[uid].tsx`, and shared components restyled to full-bleed `primaryDark` fields / `primary`
  surfaces / `primaryLight` sheets, white text hierarchy, proportional sizing, glass overlays. The
  dark/light **UI toggle was removed** (founder decision 2026-06-12); subtrees wrap in
  `ThemeOverrideContext.Provider value="dark"`. `themeStore` (`toggleTheme`/`setTheme`) retained for a
  future light variant. New tokens in `src/constants/colors.ts` (glass set + `black`) and `BLOB_INK`
  consolidated in `src/constants/blobAvatar.ts`.
- **Near-static motion** — ~200ms entrance fades, no springs/spins/stagger; kept the founder-loved
  "sleepy-eye" platform flip and house press-scale springs. All reduced-motion aware.
- **Profile v2** (`src/components/profile/`) — Clout score + tiers + `CloutInfoSheet` (replaces the
  Reputation card **on the Profile tab only**; reputation system unchanged elsewhere); blob-stamp
  streak calendar + tap-to-receipt with per-category app usage; balance + all-time ticker
  (`balanceDelta.ts`) + glass `+/-` chooser; blob customizer v2. See [features.md](./features.md#profile-tab-redesigned).
- **Known carve-out** — the SwiftUI liquid-glass `+/-` pill via `@expo/ui` is hard-disabled
  (`POD_INCLUDED = false`, pod excluded from autolinking) after a confirmed iOS-26 render crash
  (builds 25/26); RN glass fallback ships. Revisit at SDK 55.

## Phase 7 — Staking Wizard (next, planned)

Restructures the session flow: the dashboard collapses to **two buttons** — *Focus* (free →
quick-block) and *Stake a session* (new wizard route group `app/session/wizard/{people,stake,apps,schedule,review}`)
— driven by a reusable haptic `Dial` (people 1–5, dollar amount) and ticket-stub invites. The group
server surface already supports it; solo needs a small reviewed `createSoloSession` extension
(Option A) or snaps to the cadence ladder (Option B). `propose.tsx`'s never-wired Day/Time pickers are
removed by the wizard. Full spec: [staking-wizard-plan.md](./staking-wizard-plan.md).

Milestones (high level):

- **M0** — money prereqs (Fardeen-reviewed batch): C2, then C1/H1/M1; real-money smoke test.
- **M1** — `Dial.tsx` + detent-math tests.
- **M2** — wizard scaffold (route group, `_layout` + draft store, progress UI); dashboard → two buttons.
- **M3** — Steps 1–2: people dial + friend-list reuse; stake dial + cap/balance clamps.
- **M4** — Steps 3–4: apps picker reuse; schedule screen + schedule-tab cross-link.
- **M5** — solo finish: slide-to-stake review, repoint onboarding/duo/notification entries; **Option A** solo CF extension (reviewed) or **Option B** ladder.
- **M6** — group finish: TicketStub + share + invites restyle + waiting-room handoff; delete `propose.tsx`.
- **M7** — robustness pass: weak-spot fixes, full on-device matrix, copy sweep (stake/commit/complete — never bet/win), `/vibe-security` on money-adjacent diffs.
- (M8 — Phase A.2 open-claim CF + Phase B App Clip — **listed, NOT scheduled**.)

Ticket-stub invites ship in two honest phases: **Phase A** (this build, JS-only) is a share sheet over
the existing `niyah.live/join` universal link + restyled invites screen; **Phase B** (App Clip) is
specced but **not scheduled**.

**Money prerequisites** (Fardeen-reviewed pass, NOT yet applied — see [STATUS.md](./STATUS.md)): C1
withdrawal double-debit (deterministic `txnRef`), C2 recovery-payout race (client writes status before
`cloudComplete`), H1 payout `idempotencyKey`, M1 `stakeComposition` validation. **C2 is a hard
prerequisite** for force-quit/recovery testing of the wizard.

**Pending founder decisions** (block specifics, not start):

1. Solo: **Option A** (extend `createSoloSession` with custom stake+duration, reviewed money-path change) vs **Option B** (snap solo dial to the cadence ladder, zero server change).
2. Ticket-stub invites: ship **Phase A** only now (App Clip Phase B stays unscheduled).
3. Whether to land the open-seat claim CF (`claimGroupSessionSeat`, Phase A.2) in this build or defer.

## Forward-looking design (not yet built)

- **Group equity (cap-target payout)** — Strava-style per-user screen-time cap verified by the DeviceActivityReport extension. Design: [group-equity.md](./group-equity.md). Note: superseded in priority by the de-pool; revisit if/when group competition returns.
- **Schedule blocking** — `scheduleStore`, schedule-builder, calendar integration. Reopens post-grad.
- **Custom in-app KYC** — replace Stripe Express onboarding with native verification ([memory: custom KYC](../)). Express stays for v1.

## Open product decisions (Fardeen)

1. Solo payout multiplier value once flipped (1.1× / 1.2×) + the surplus cap factor.
2. Default screen-time `CAP_FACTOR` if group equity returns.
3. `member_app_opened` push cooldown (30s vs higher).
4. Final Phase 3 cohort numbers for the deck.
