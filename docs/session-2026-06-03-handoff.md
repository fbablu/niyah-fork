# Session handoff — 2026-06-03

> Branch `wallet-ledger`. Read alongside [STATUS.md](./STATUS.md),
> [deploy-runbook-2026-06-03.md](./deploy-runbook-2026-06-03.md),
> [schedule-templates-plan-2026-06-03.md](./schedule-templates-plan-2026-06-03.md).
> Client test baseline: **775 passing on Node 20** (`nvm use 20 && pnpm test`; NOT Node 26 — see
> guardrails). typecheck + eslint clean.

## Guardrails (carry into the new session)

- **Fardeen runs ALL git / deploy / EAS / Firebase / ASC.** The agent supplies exact commands only.
- **Commit style:** one-liner subject, no body, no trailer.
- **Run client Jest on Node 20** (`$HOME/.nvm/versions/node/v20.19.3/bin`), not the shell's Node 26
  (jest-worker crashes). **Pin `DEMO_MODE` in every store test** via `jest.mock("../../../constants/config", …)` — never inherit ambient `EXPO_PUBLIC_DEMO_MODE`.
- **🚨 No yield / interest / "grows over time like a HYSA" — ever.** That's deposit-taking / a security
  and breaks the de-pool model. The approved "earn" lever is a **house-funded *completion* reward**
  (finish the session → get stake back × a multiplier, e.g. 1.1×): the >1× bonus lands in the gated
  `earned`/`bonus` bucket, is **not withdrawable until the engagement gate is met**, and is capped
  (`min(1× net deposits, $50)`). De-pooled: money never pools/moves between users.
- No bet/wager/gamble/win/pool in user-facing copy. `APP_CHECK_ENFORCED=false`. `STRIPE_SECRET_KEY` is live.
- `/vibe-security` on any auth/payments/rules diff; fix Critical+High before commit.

## What this session shipped (all UNCOMMITTED — commit plan below)

1. **Onboarding — notification priming:** stopped the contextless OS prompt at sign-in; added
   `app/(auth)/notifications-setup.tsx` (in-context "enable" screen) + `enableNotifications()`.
   `initializeNotifications()` is now non-prompting (checks `hasNotificationPermission()`).
2. **Onboarding — Screen Time hard gate (Opal-style):** `screentime-setup.tsx` no-skip + denied→Settings
   recovery (re-checks on foreground / auth-change); `app/index.tsx` re-routes profiled-but-unauthorized
   users back to setup until granted; **bypassed on sim/DEMO**.
3. **CI repair:** fixed 7 de-pool-rot suites (DEMO local-path mocks + `subscribeToWallet` mock +
   logout-then-seed + fireAndForget DEMO pin). Suite green.
4. **Schedule tab (Phase 1):** `app/(tabs)/schedule.tsx` + `scheduleStore` + 4 presets + inline day
   editor + OS auto-start of FREE blocks; **overlapping/duplicate blocks now refused** (`templatesConflict`)
   with warning/success haptics. Stake field exists but inert.
5. **Active session:** staked sessions are **end-only (no pause)**; end control money-stamped
   (`💸 End early — forfeit $X`).
6. **Dashboard:** **money plant removed** everywhere (kept simple numeric `StatCard`s).
7. **iOS build/submit fix** (from earlier): ExtensionKit report extension + non-interactive `eas submit`
   via `ascAppId`.
8. **Waitlist landing page** (`landing-pg/app/waitlist`) for the Tech Week QR — needs a Formspree ID +
   deploy.
9. **Docs:** pivot-vision, observability, group-equity/anticheat, deploy runbook, schedule plan, this file.

## ▶ Remaining CODING work — for the new session, do these IN PARALLEL

All client-side / non-manual. The agent can fan these out (independent except where noted). After each,
keep `nvm use 20 && pnpm test` + typecheck + eslint green, then hand Fardeen the commit message.

### Task A — Scheduled-block dashboard indicator + lock CTAs  (`app/(tabs)/index.tsx`)
The dashboard already shows an active-**session** card and hides the Start CTAs during a session
(lines ~696–781), but it has **zero awareness of an active scheduled block** (a `DeviceActivitySchedule`
is NOT a `currentSession`). So during a scheduled block a user still sees Start CTAs + "Get Started".
- Add a pure helper (e.g. in `scheduleStore` or `src/utils/`) `getActiveScheduledBlock(templates, now)`
  → the enabled template whose weekday includes `now`'s day AND whose window contains `now`'s minute.
- Surface an Opal-style "Focus block running · Morning 6–11 AM" indicator card on the dashboard
  (reuse `activeSessionCard` styles), and gate the Start CTAs + Get Started while one is active.
- Add a unit test for `getActiveScheduledBlock` (pin: in-window true, out-of-window false, disabled false,
  wrong-day false). Pass `now` in for determinism.

### Task B — Onboarding + balance UX  (`app/(tabs)/index.tsx`, `app/session/deposit.tsx`, `src/store/walletStore.ts`)
- The "Get Started" deposit step / copy says "$5" but min stake is **$2** (`CADENCES.focus`) and the
  staked-solo min is $2 — align them: onboarding should require/suggest a deposit ≥ the min stake, and
  the checklist's `hasDeposited` shouldn't claim "$5" if it only checks `balance > 0`.
- **Stop the optimistic balance from vanishing:** after an optimistic `deposit()`, the realtime
  `subscribeToWallet` snapshot can arrive with the not-yet-credited server balance ($0, webhook lag) and
  stomp it down (`walletStore.ts:84`). Guard: don't let a snapshot lower the balance within a short
  window after an optimistic deposit, OR show a "pending" state until the credit lands. Add a test.
- NOTE: the *root* of "insufficient balance / vanishing $1" is the **undeployed functions** (see Fardeen
  track) — this task is the UX hardening on top, not the fix for the deploy mismatch.

### Task C — Schedule money toggle + auto-stake CF (Phase 2)  (`app/(tabs)/schedule.tsx`, `src/store/scheduleStore.ts`, `functions/src/…`)
- **Client:** add the per-template money toggle (the circle button) → sets `stakeCents` on the template
  (stake-ON vs free-block). Display only is fine until the CF is deployed. NO yield framing — copy is
  "stake $X on this block · finish → get it back" (+ the gated 1.1× completion reward where eligible).
- **Server (money-path → `/vibe-security` + Fardeen deploys):** a `createScheduledStakedSession` CF
  fired at block start (via the DeviceActivityMonitor extension → app/CF). Must: debit the wallet
  bucket-aware (mirror `createSoloSession`), be **idempotent** per `(uid, templateId, UTC-day)`, respect
  `DAILY_STAKE_CAP_CENTS`, never stake more than the wallet holds, and on completion return the stake +
  a **gated, capped** 1.x reward to the `earned` bucket. Needs forfeit-on-no-completion (the
  forfeit-on-heartbeat-loss path is NOT built yet — see group-equity-anticheat doc). Build behind a flag,
  defaulting OFF; do not flip live without backfill + the engagement gate.

### Task D — Shield "Open Niyah" → surrender-confirm  (`app/_layout.tsx`, `modules/.../ShieldActionExtension.swift`, native)
Tapping "Open Niyah" on the shield currently just lands on the home screen — it should fire the
confirm-end-session step. The `niyah://blocked` / `SURRENDER_CONFIRM` chain is broken (see
qa-2026-06-02 findings #10/#14): `_layout.tsx` only branches on `url.includes("surrender")`; the shield
writes `niyah_surrender_pending` while the poller reads `niyah_surrender_requested`. Wire the deep-link
→ `app/blocked.tsx` → confirm sheet, or register the `SURRENDER_CONFIRM` push. **Native → needs a device
rebuild to verify.**

### Also queued (lower priority)
- Broader **haptics pass** (the user noted missing feedback in expected spots).
- Smoother RN/Native-SwiftUI dashboard transitions (Fardeen's design lane).

## 🅿️ Fardeen's MANUAL / deploy track (in parallel; clears 3 reported "bugs")

These are almost certainly **deploy-state, not code** — the de-pool client is running against the OLD
deployed functions + an undeployed landing site:
- **Vanishing balance / "Insufficient balance to stake":** deploy the wallet-ledger functions + run the
  real-$ smoke (runbook). Client reads `wallet.balance`; the new credit path ships at deploy.
- **Invite 404 (`niyah.live/i?ref=…`):** deploy `landing-pg` (the `/i`, `/join`, `/waitlist` pages exist
  but aren't deployed). Also paste a Formspree ID into the waitlist form.
- Then: APNs `.p8`, rebuild **buildNumber 19→20**, external TestFlight beta review. Full chain in
  [deploy-runbook-2026-06-03.md](./deploy-runbook-2026-06-03.md).

## Git commit plan (run in order — see chat for the copy-paste block)

reset → gitignore logs → (1) iOS build/submit → (2) test repair → (3) notif priming →
(4) Screen Time gate → (5) schedule Phase-1 → (6) session end-only → (7) remove plant (+`git rm` MoneyPlant)
→ (8) waitlist landing → (9) docs. Then `nvm use 20 && pnpm test` → `git push`.
