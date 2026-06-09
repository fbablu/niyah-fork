# Build-23 feedback pass — progress

> Working branch: **`worktree-build-23-feedback`** (git worktree under `.claude/worktrees/`,
> branched from the same commit as `main`). **Everything here is OFF `main` and UNCOMMITTED** —
> raw `git` is permission-gated this session, so Fardeen commits/merges. Canonical state:
> [STATUS.md](./STATUS.md). Last updated **2026-06-08**.

## Triage outcome (with Fardeen)

The walk feedback (`docs/nyc-tech-week.md`) was triaged into two buckets — then Fardeen chose to
**commit to all ten**, not defer:

**Build-23 UX (the 5 must-fix):**

- **A. onboarding-shows-once** — ✅ **DONE** (see below).
- **B. dead notification buttons → push-to-stop deep link** — ⏳ **needs hot-reload + a build.**
  The JS notification-tap router (`handleNotificationData`, `src/config/notifications.ts:179`)
  already routes `session_*` → `/session/active`. The remaining gap is **native**: the shield's
  "Open Niyah" / "Back to it" buttons live in `targets/shieldaction` (`ShieldActionExtension.swift`)
  and a persistent "tap to stop" notification — both need a rebuild to verify, so they're NOT done
  blind. Left for a reviewed native pass.
- **C. schedule green-toggle** — ⏳ **needs hot-reload.** Visual UX restructure of the schedule
  start/stop flow; overlaps item-5 nav and the Staked copy gates on W1. Best done live.
- **D. blob-maker behind an edit pencil** — ✅ **DONE** (see below).
- **E. global content-view positioning sweep** — ⏳ **needs hot-reload.** Survey shows it's not a
  glaring mess (9 screens use `SafeAreaView`; only `session/verify-identity` + `session/stripe-
  onboarding` lack it, possibly intentionally). "Too high / too low" is a visual judgment — doing it
  blind risks reverting intentional layout. Best done with the simulator open.

**Five "later" tracks (now committed):** business-model redesign, anti-cheat/KYC, app-block
notification allow-list, "meaningful minutes away" metric, single fluid action button / zen-vs-staked
nav. Researched by two background workflows ↓.

## Item A — onboarding shows once ✅

**Root cause (two distinct bugs):**

1. **Legal re-prompt every launch.** `hasAcceptedCurrentLegal` was derived purely from the Firestore
   doc's `legalAcceptanceVersion`. When the `acceptLegalTerms` CF write lagged/failed (the build-21
   pin outage, or simply because the idempotent CF isn't deployed to prod yet), the doc never carried
   `2.0.0`, so the gate re-showed Terms on every cold start.
2. **Screen Time / "stay in the loop" every launch.** `app/index.tsx` hard-redirected any profiled
   user to `screentime-setup` whenever `getScreenTimeAuthStatus() !== "approved"` — which a
   cold-start native race (or any later revoke) trips, walking them back through
   screentime-setup ("You're all set") → notifications-setup ("Stay in the loop").

**Fix:**

- **Durable local legal-acceptance** (`src/store/authStore.ts`): `acceptLegal` now records a
  uid-scoped `@niyah/pending_legal_acceptance:<uid>` marker **up front, unconditionally** (not just
  on CF failure); `initialize()` computes `hasAcceptedCurrentLegal = docVersion === CURRENT || marker
  === CURRENT`, so an acceptance the user already gave never re-prompts while the CF reconciles. The
  marker is cleared **only** once a launch reads the doc carrying the current version — never on a
  bare CF "success" (a non-persisting/legacy CF could falsely report success). `retryPendingLegalAcceptance`
  hardened to match.
- **`onboardingComplete` milestone** (`authStore` + `app/(tabs)/_layout.tsx`): a uid-scoped
  `@niyah/onboarding_complete:<uid>` flag is set on first tabs mount (`markOnboardingComplete`,
  idempotent) and hydrated in `initialize()`. `app/index.tsx`'s Screen Time redirect now also
  requires `!onboardingComplete` — it stays a hard gate **during first-run onboarding** but never
  re-traps a user who finished it. (Reconnect belongs in Profile; a staked session should re-check
  Screen Time at start — follow-up, see below.)

**Tests** (`src/__tests__/unit/store/legalAcceptance.test.ts`, 8/8): marker written even on CF
success; marker kept on failure + replay, cleared only on doc-confirm; `markOnboardingComplete` sets
+ persists + is idempotent + no-ops unauthenticated.

**Validation:** `pnpm format` clean, `pnpm run ci` green (client jest + 91/91 functions, lint,
typecheck).

**Follow-ups (not blocking A):** (1) add a "Reconnect Screen Time" + "review legal" + notification
affordance in Profile settings; (2) guard staked-session start on Screen Time so the softened launch
gate can't let a blocking session run without it. These pair naturally with item E (profile/settings
sweep) and the nav work.

## Design workflows

- **W2 — engineering feasibility (DONE):** [post-1.0x-engineering-plan.md](./post-1.0x-engineering-plan.md).
  Grounded in-repo with file:line citations. Headlines:
  - **Notification allow-list (item 3): NOT FEASIBLE via any public iOS API** — ManagedSettings /
    FamilyControls / DeviceActivity / Focus filters all lack cross-app notification control. The
    shield blocks app *launch*, not notification delivery. Substitute: a "Niyah Focus" guided
    handoff (deep-link to the user's own Focus). **Also flags a copy-accuracy risk: nothing in the
    app actually silences blocked apps' notifications — audit marketing/App Store copy.**
  - **Zen-vs-staked nav + fluid FAB (item 5): 100% JS-buildable now** (FAB overlay + `formSheet`
    `app/session/start.tsx` route + Mode fork + friend-count auto-fold). Structure is
    model-independent; only Staked copy/economics gate on W1. ~1.5–2.5 days.
  - **Anti-cheat / KYC (item 2): mostly gated on the multiplier flip.** Layer 0 (flip
    `APP_CHECK_ENFORCED=true` once App Check Metrics ≥99%) is free now. Layer 1 (Stripe Identity
    selfie/doc dedup) is the real "new phone / new Apple ID" fix but only justified once payout >
    1.0× (don't add KYC friction at 1.0×). Layer 2 (DeviceCheck) folds into a native rebuild.
  - **"Meaningful minutes away" (item 4): unmeasurable on iOS** (an idle phone == a focused person).
    Ship an honest "slips" metric from the blocked-attempt counts already collected. JS-only, ~0.5–1 day.
- **W1 — business-model + abuse-prevention (RUNNING):** stress-tests monetization/reward models
  (subscription, points/blobs, group-rake, hybrid) against the abuse vectors + the no-pooling legal
  line, answers "is 1.0× stake-back useful / what reward is feasible," corrects the profit math, and
  writes `docs/monetization-model.md`. Output gates a Fardeen decision on model direction.

## When Fardeen is back

Commit A (suggested message, per house style — one-liner, no body/trailer):

```
git -C .claude/worktrees/build-23-feedback add -A
git -C .claude/worktrees/build-23-feedback commit -m "fix(onboarding): show legal + Screen Time/notification setup once, not every launch"
```

Then decide the W1 model direction (it shapes items C/4/5 copy) and pick the next build-23 item to
implement with hot reload (B/C/E/nav are the most visual → best reviewed live).

## Item D — blob-maker behind an edit pencil ✅

- **`ProfileHeader`**: the always-on "Blob Maker" card is gone. The profile blob now carries a
  pencil edit badge (shown only when an `onBlobAvatarChange` handler is passed); tapping the blob or
  the badge opens the editor.
- **New `src/components/profile/BlobMakerSheet.tsx`**: a pageSheet modal where the blob **zooms from
  background to foreground** (Reanimated scale/opacity entrance, reduced-motion aware). **No shape
  picker** — shapes are fully generative: a **Shuffle** button re-mints a `uid:nonce` seed (a quick
  scale "pop" on shuffle); Color + Expression stay explicit pickers. Save writes
  `shapePreset:"unique"` + the seed.
- **`BlobAvatar`**: the `unique` shape's eyes nudged up (`eyeCenterY` 46 → 42) so the generated blob
  reads as a face. ⚠️ Visual-tune on device — easy to adjust.
- **Animation note:** used **Reanimated** (already in the project, powers `MorphingBlob`), NOT
  `@expo/ui/swift-ui`. A new native dep can't be build-verified unattended and would risk the next
  `pnpm build:prod`. `@expo/ui` SwiftUI animations are a good **follow-up** once there's an on-device
  rebuild to verify them (`/plugin install expo` → `@expo/ui/swift-ui`).
- **Tests:** `ProfileHeader.test.tsx` updated (pencil affordance present with handler / absent
  without / absent when null) — 13/13. `pnpm format` + `pnpm run ci` green.

## Overnight plan (Fardeen asleep)

Per Fardeen's ladder: build-23 tasks that don't need him → then audits. A + D are done; B/C/E/nav
genuinely need his hot-reload/native review (documented above), so the unattended time goes to the
**audit ladder**, each step CI-gated and behavior-preserving:

1. **Security audit** — `/vibe-security` + `docs/security.md` + `docs/security-deploy-checklist.md`.
   Read-only findings → fix only clear, testable, code-level Critical/High. Console/Firebase/Stripe
   steps stay Fardeen's.
2. **Inefficiency / slowness** — behavior-preserving perf fixes (no test breakage, no functional
   change).
3. **Dead/hanging/redundant comments** — debloat.
4. **File cleanup / structure** — per the Claude-Code-at-scale guidance (lean, layered CLAUDE.md;
   per-subdir context; no broken references).

All on the `worktree-build-23-feedback` branch, uncommitted (git permission-gated → Fardeen commits).

## Overnight results (running log)

- **W1 (business model): DONE → [monetization-model.md](./monetization-model.md).** The workflow's
  synthesis step stalled on rate limits at 33/34 agents; I salvaged it by synthesizing from the 33
  completed agent results in the journal (5 stress-tested models + 25 verdicts). Headline: the
  friend's group-rake model is DEAD (no-pooling line); subscription-gating the staked mode hits App
  Store 3.1.1; fee-on-returned-stake breaks the promise; recommended = pure 1.0× cash rail + non-cash
  affiliate-funded "blobs" reward + cosmetics-only IAP subscription. Plus a real **deposit→withdraw
  round-trip leak** to close (pass card fees through). Decision list for Fardeen at the end of that doc.
- **Audit ladder (first pass): DONE.**
  - Security → [security-audit-2026-06-08.md](./security-audit-2026-06-08.md): strong posture, no new
    Critical/High; the one Medium (users-update no doc-wide allowlist) is documented + deferred to a
    reviewed rules pass (whitelist risks false-denying legit writes). A/D diffs reviewed clean.
  - Code-quality → [code-quality-audit-2026-06-08.md](./code-quality-audit-2026-06-08.md): codebase
    is clean (negligible dead code/comments/TODOs; structure already follows at-scale guidance). One
    safe fix APPLIED: removed the dead, rules-denied client `reputation` write in
    `authStore.updateReputation` (kept the optimistic local update; CFs are the authoritative writer)
    + fixed the 2 tests that pinned the dead behavior. CI green (authStore 50/50).
- **Deep audit: DONE → [deep-audit-2026-06-08.md](./deep-audit-2026-06-08.md)** (13 confirmed
  findings, adversarially verified). Triage + applied set are at the top of that doc. **Applied
  (CI-green, non-money, behavior-preserving):** H3 (foreground-notification crash guard), M4 (FCM
  token try/catch — listener-leak fix), M3 (error callbacks on all 4 `onSnapshot` wallet/session
  streams), L1 (removed 4 dead `updateUser({balance})` dual-writes + orphaned import). **Rejected:**
  H2 (`__DEV__` "build-blocking" — FALSE POSITIVE; typecheck is green). **DEFERRED to Fardeen
  (P0 money-path — do NOT apply blind):**
  - **C1** withdrawal double-debit (deterministic `txnRef`) — this is the known-open STATUS issue.
  - **C2** recovery payout race — real, but the audit's fix is incomplete (must mirror
    `completeSession` DEMO-gating + reconcile local-vs-CF credit at `sessionStore.ts:495`).
  - **H1** payout `idempotencyKey` (pairs with C1).
  - **M1** validate `stakeComposition` before bucket split (verify vs legacy docs first).
  - **M2** rules `users` allowlist (also in the security doc). M5/L2 deferred as marginal.
  These have precise fixes in the doc; they need your review + a real-money smoke test, so they're
  the top of the next reviewed money-path pass — not overnight-blind edits.

Everything stays on `worktree-build-23-feedback`, uncommitted (git permission-gated → Fardeen commits).
