# Overnight Polish Loop — Progress Log

> Newest entries on top. Each implementation entry carries a **suggested commit message** +
> file list so Fardeen can commit in logical slices. Nothing here is committed.
> See [plan.md](./plan.md) for guardrails + the backlog.

---

## Day session 2026-06-05 PM → 06-06 — Blob Maker onboarding + shapeSeed + rules (UNCOMMITTED, stacks on the overnight tree)

Separate daytime session on top of the overnight loop's working tree. Builds directly on the
overnight "unique" blob generator (Session 1 rank 25). **All gates green at handoff:** `tsc` 0 ·
eslint 0 errors (1 pre-existing warning) · client Jest **812/818 pass, 0 fail** (10 new contract
tests) · NEW `pnpm test:rules` **13/13** · `/vibe-security` on the rules diff: no Critical/High.

### ✅ Shuffle Blob Maker onboarding screen (Fardeen-requested feature)
- New `app/(auth)/blob-maker.tsx` between profile-setup → intake: one morphing blob on an SVG
  podium, shuffle button (Ionicons, was dice — swapped for App-Store optics) + tap-blob-to-shuffle,
  history row of last 5 shuffles (tap to morph back), Continue persists via `setBlobAvatar`.
  Responsive sizing fits iPhone SE; VoiceOver labels throughout; reduced-motion safe.
- New `src/components/MorphingBlob.tsx` — UI-thread shape morphing: `generateBlobPoints` +
  worklet `pointsToBlobPath` (generator split, output byte-identical — pinned by a
  cross-validation test), spring-overshoot jelly wobble, dual-gradient color crossfade,
  blink + squash mid-morph. `useDerivedValue` shares one per-frame path build.
- `BLOB_PALETTES` is now the single palette source of truth (BlobAvatar + MorphingBlob +
  ProfileHeader swatches all read it; ProfileHeader's hardcoded duplicate deleted).
- Adversarially reviewed (22-agent workflow, 13 confirmed findings) — all fixed: SE overflow,
  podium contact, first-shuffle layout jump, a11y, wobble-snap, duplicate path build.
- _suggested commit:_ `feat(onboarding): shuffle Blob Maker screen with UI-thread morphing blob + podium`
- Files: `app/(auth)/blob-maker.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/profile-setup.tsx`,
  `src/components/MorphingBlob.tsx`, `src/components/index.ts`,
  `src/__tests__/unit/components/MorphingBlob.test.tsx`

### ✅ shapeSeed — account-bound blob identity (`uid:nonce`)
- `BlobAvatarConfig.shapeSeed` (optional): each shuffle mints `uid:nonce` (expo-crypto), so every
  shape is account-bound by construction — a **visual fingerprint** (identicon-style), NOT a
  credential (rendered + world-readable ⇒ never gate anything on it; documented in session log).
  Survives account merges (stored literal, not re-derived from uid).
- `normalizeBlobAvatarConfig` preserves a valid seed (string, ≤64) and drops junk — stays the
  sole read-path sanitizer at `authStore.ts:230`. `BlobAvatar` renders `config.shapeSeed ?? seed`
  at every call site (zero call-site changes).
- `completeProfile` now seeds `shapePreset:"unique"` so an onboarding interrupted at blob-maker
  still persists the exact blob the user saw.
- _suggested commit:_ `feat(blob): shapeSeed identity + point-based generator split + shared palettes`
- Files: `src/constants/blobAvatar.ts`, `src/components/BlobAvatar.tsx`,
  `src/components/profile/ProfileHeader.tsx`, `src/store/authStore.ts`, `jest.setup.ts`,
  `src/__tests__/unit/constants/blobAvatar.test.ts`

### ✅ firestore.rules — users.blobAvatar validation + emulator rules tests
- `validBlobAvatar()` on `users/{uid}` write+create: map, `hasOnly` 4 known keys, string types,
  16/64-char caps. **Diff-gated on update** (legacy docs keep writing unrelated fields) and
  validates the **post-merge** state (partial merges can't smuggle junk). Key/type/size only —
  preset *values* stay client-whitelisted so new presets don't need a rules deploy.
- NEW test infra: `pnpm test:rules` → `firebase/rules.test.ts` (@firebase/rules-unit-testing,
  node:test+tsx like functions tests) against the emulator — 13 tests pin the contract incl.
  must-fail cases + legacy escape + denylist intact. ⚠️ firebase-tools needs **Java 21+**
  (system JDK is 17): run with `JAVA_HOME=$(brew --prefix openjdk)`.
- New devDeps `firebase` + `@firebase/rules-unit-testing` (dev-only; web SDK never imported by
  app code ⇒ not bundled).
- **Deploy note:** this clause rides the **already-pending** `firebase deploy --only
  firestore:rules` (queued with the bucket-ledger functions deploy). Backward compatible with
  the shipping client (proven by the legacy-escape tests) — deploy order doesn't matter.
- Known follow-up (Medium, pre-existing, intentionally out of scope): the users update rule
  still has no doc-wide `hasOnly()` key whitelist — separate reviewed pass before public launch.
- _suggested commit:_ `feat(rules): validate users.blobAvatar server-side + emulator rules test suite`
- Files: `firebase/firestore.rules`, `firebase/rules.test.ts`, `package.json`, `pnpm-lock.yaml`

---

## ✅ FINAL HANDOFF (overnight loop — commit slices 1–7) — 2026-06-05 overnight

**Verdict (final 3-agent review, w17y29iqv): SAFE to review-and-commit as-is. `guardrailsHeld: true`,
0 blockers, 0 must-fix.** The reviewers explicitly confirmed every money-adjacent edit is
presentation/notification/perf only — no money/auth/payout/access-control logic was touched.

**Verified green:** `tsc` clean every batch · full Jest suite **802 passed / 0 failed** · notifications
**42/42** · eslint 0 errors (1 pre-existing `_layout.tsx:259` warning, not mine). Nothing is committed —
all changes are working-tree edits on `wallet-ledger`.

**What shipped (23 files, +765/−156; details + per-item suggested commits in Sessions 1–10 below):**
- **Track A** — reusable `Skeleton` (dashboard/profile/txn/friends-standings); dashboard + Timer-ring
  animations → UI-thread Reanimated; in-house procedural **"unique" blob** generator + breathing + Blob-Maker
  press feedback; **personalized blob celebration** on session-complete; Confetti memoized + reduce-motion aware.
- **Retention** (your emphasized goal) — local notifee reminder system + **per-day dedup guard**; **streak-at-risk**
  nudge (fires on completion) + **scheduled-block "starts soon"** reminders (per template).
- **Track B** — granular Zustand selectors on **all 4 main tabs** + `StandingRow`/`StatCard` `React.memo`.
- **Bugs fixed in passing** — Confetti restart-on-count-up; surrender showing a ✓; success-haptic firing on
  surrender; stale "money plant" copy; blob-shape type duplication.

**Suggested commit slices** (each Session entry has the exact message; several `app/(tabs)/*.tsx` files carry
multiple themes so they'll land together — use `git add -p` if you want finer slices):
1. tooling/docs (`.claude/settings.json`, `.gitignore`, `docs/ui-animation.md`, `expo-docs/`, `docs/overnight-2026-06-05/`)
2. Skeleton + loading states · 3. blob system + type unification · 4. UI-thread animations (Timer/dashboard/Confetti/`jest.setup.ts`)
5. complete-screen celebration · 6. retention reminders (`notifications.ts`+`scheduleStore.ts`+test) · 7. perf selectors+memo

**Deferred / moot / N-A (verified, not skipped lazily — see each entry for the reasoning):**
- **Deferred (needs review):** friends `FollowingRow`/`PartnerRow` memo restructure (rank 1+4) — exact plan in
  `plan.md §Deferred`; `HoldToConfirmModal` Reanimated (money-critical hold gate); re-engagement nudge (needs `_layout` AppState hook).
- **Moot (already `useNativeDriver:true` = native thread):** rank 8 complete-checkmark, rank 9 blocked-pulse,
  rank 13 scale/opacity, rank 21 StatusBanner/AnimatedNote.
- **N-A / low-value:** rank 20 session-tab skeleton (no loading state), rank 22 NumPad (180ms one-shot color tween).

**Morning steps (all git is yours — these are HELD for you):**
1. `git status` + `git diff` (and skim this folder). 2. Commit in slices (messages above; one-liner subjects, no trailer).
3. `pnpm build:local` to verify the binary (iPhone is connected). 4. **Merge to `main` is your call** — `wallet-ledger`
   is **64 commits ahead** of the live-payments `main`; do it deliberately. Exact commands in `plan.md §Morning handoff`.

---

## Session 11 — final review (clean) + Confetti reduce-motion (2026-06-05)

- **Final 3-agent review (w17y29iqv)** over the whole diff (correctness · guardrail-compliance · UX):
  **0 blockers, 0 must-fix, `guardrailsHeld: true`.** Verdict: safe to review-and-commit as-is.
- ✅ **Applied the one nice-to-have:** `Confetti.tsx` now honors OS reduce-motion (`useReducedMotion()` →
  renders nothing when enabled), consistent with Skeleton + blob breathing. Gated GREEN (`tsc` 0, eslint 0).
- _amends the Confetti commit:_ `fix(confetti): memoize + reduce-motion aware (no restart on count-up ticks)`
- Files: `src/components/Confetti.tsx`

---

## Session 10 — session-tab selectors; remaining-animation triage (2026-06-05)

### ✅ session.tsx granular group-store selectors (Track B)
- `app/(tabs)/session.tsx`: whole-store `useGroupSessionStore()` → 4 field selectors. **All four main tabs**
  (dashboard / profile / friends / session) now use granular store subscriptions.
- Gated GREEN: `tsc` 0, eslint 0.
- _suggested commit:_ `perf(session-tab): granular group-store selectors`

### ⏭️ Remaining-animation triage (verified, not guessed)
- **Rank 21 StatusBanner / AnimatedNote — MOOT:** both use `useNativeDriver:true` (native thread already).
- **Rank 21 HoldToConfirmModal — SKIP (money-critical):** its `useNativeDriver:false` (hold progress-bar
  *width*, not native-drivable) is genuinely JS-thread, but it's the **delete/forfeit hold-to-confirm gate**.
  Per guardrail, migrating risks the confirm threshold — left for a reviewed pass.
- **Rank 22 NumPad — LOW-VALUE SKIP:** only JS-thread animation is a 180ms one-shot **error-color tween**
  (color isn't native-drivable); cursor blink + press feedback are already native. Not a jank source.

### Diminishing-returns note
High-value work is done: Track A (UI-thread animations, skeletons, blobs, celebration), retention (streak +
scheduled-block reminders + dedup), Track B (granular selectors on all 4 main tabs + StandingRow/StatCard
memo). Remaining backlog is marginal (brief animations, lower-traffic screens) or risky-deferred (friends row
memo §Deferred). Slowing loop cadence; still picking up genuine wins + running a final review capstone.

---

## Session 9 — Track B perf: dashboard (2026-06-05)

### ✅ Dashboard performance (Track B)
- `app/(tabs)/index.tsx`:
  - **Granular groupSessionStore selectors** — replaced the whole-store `useGroupSessionStore()` destructure
    with three field selectors (activeGroupSession / groupSessionHistory / pendingInvites). The most-viewed
    screen no longer re-renders on every unrelated group-store mutation.
  - **Memoized StatCard** (`React.memo`) — primitive props, so a dashboard re-render that doesn't change a
    card's value/label/color/loading skips it. (ActionButton left un-memoized: its onPress is an inline arrow,
    so memo would be a no-op without stabilizing it — not worth the churn.)
- Gated GREEN: `tsc` 0, eslint 0.
- _suggested commit:_ `perf(dashboard): granular group-store selectors + memoized StatCard`
- Files: `app/(tabs)/index.tsx`

### ⏭️ Rank 20 (session tab) — NOT APPLICABLE
`app/(tabs)/session.tsx` has no loading state to skeleton — it's rich static content (Solo/Group cards +
How-it-works) with conditionally-rendered invite/active banners, so it already paints instantly. The valuable
rank-20 targets (public profile + transaction history) shipped in Session 3.

---

## Session 8 — scheduled-block reminders (2026-06-05)

### ✅ Rank 10 — "starts soon" reminder for scheduled focus blocks (retention)
- Extended `scheduleRetentionReminder` with an optional `key` so one reason can carry many independent
  reminders (separate notifee ids + dedup slots) — needed for per-template blocks. `cancelRetentionReminder`
  takes the key too. Existing streak/cancel tests stay green (key omitted → unchanged behavior).
- `src/store/scheduleStore.ts`: per-template reminder wired at the `armNative`/`disarmNative` choke points
  (covers create/enable/update/syncNative + disable/delete/cancel). Computes the next occurrence of the daily
  start window minus a 5-min lead; reschedules on app launch (syncNative on rehydrate), capped 1/day per
  template by the dedup guard. Notification-only — no wallet/session reads, no money.
- Gated GREEN: `tsc` 0, eslint 0, scheduleStore + notifications **53/53** (Node 20).
- _suggested commit:_ `feat(retention): scheduled-block "starts soon" reminders (per-template, deduped)`
- Files: `src/config/notifications.ts`, `src/store/scheduleStore.ts`

---

## Session 7 — retention reminders foundation + streak-at-risk nudge (2026-06-05)

### ✅ Rank 16 + 7 (foundation + first nudge) — local retention reminders (notifee, zero-rebuild)
- `src/config/notifications.ts` (**notification-only, read-only over wallet/session/auth — no functions/,
  no money logic**):
  - **`scheduleRetentionReminder({reason, fireAt, title, body})`** — wraps notifee's TimestampTrigger with a
    **stable per-reason id** (re-scheduling REPLACES, never stacks); no-ops on past times.
  - **Per-day dedup guard (rank 16)** — AsyncStorage `{reason: utcDay}` log; caps to one reminder per reason
    per UTC day so nudges can't pile into fatigue. Functional notifications (session-end) are exempt.
  - **`cancelRetentionReminder(reason)`** + deep-link nav cases (streak_at_risk/reengagement →
    /session/select; scheduled_block_reminder → /(tabs)/schedule; low_balance → /session/deposit).
  - 4 new tests (stable id, past no-op, dedup, cancel) — notifications suite now **42/42**.
- **First concrete nudge wired** (`app/session/complete.tsx`): on a confirmed completion with streak ≥ 1,
  schedule a **streak-at-risk reminder ~22h out** ("Keep your N-day streak alive"). Fires at the natural
  moment (completion), re-scheduled each session, capped 1/day — cleaner + lower-risk than an `_layout`
  AppState listener.
- Gated GREEN: `tsc` 0, eslint 0, notifications **42/42** (Node 20).
- _suggested commit:_ `feat(retention): local streak-at-risk reminder + per-day notifee dedup guard`
- Files: `src/config/notifications.ts`, `app/session/complete.tsx`, `src/__tests__/unit/config/notifications.test.ts`

### ⏭️ Rank 9 — blocked.tsx pulse/entrance Reanimated — MOOT
Pulse + slide + fade all use `useNativeDriver: true` → **already on the native thread**. Migrating would be
churn with no perf gain (same as rank 8 / rank 13-scale; the only genuine JS-thread animation was the Timer
ring, already migrated). Skipped per "don't overdo it."

### Remaining retention (build on the foundation; need a launch/session-start hook)
rank 10 scheduled-block reminder (on template enable, in scheduleStore) · rank 14 low-balance (at session
start) · re-engagement "haven't-opened-in-3-days" nudge (needs an app-launch/AppState hook in `_layout` —
riskier, do reviewed). All route through `scheduleRetentionReminder` + the dedup guard.

---

## Critique 2 + Blob Maker tactile feedback (2026-06-05)

### Critique 2 adjudication (wrobov14i, 4 agents over the Sessions 2–6 visuals)
- ✅ **Applied (high):** complete.tsx fired a **success haptic unconditionally — even on a surrender**.
  Moved it into the `didComplete`-gated effect (also fixes its async-confirmation timing): success haptic
  now fires only on a confirmed completion, with the confetti + milestone pulse; surrender → no
  celebratory haptic. + trivial: friends standings rank skeleton width 20→24 (matches `minWidth:24`).
- ❌ **Rejected (5 reanimated findings):** the synthesis itself flagged them factually wrong —
  `useSharedValue` is render-stable, so no cancel/restart loop; the proposed `useMemo(() => useSharedValue())`
  fix is an **illegal conditional hook that would crash**. Not applied.
- ⏳ **Deferred:** sub-pixel skeleton-height cosmetics; the lint-only "drop stable shared values from deps"
  (keeping them satisfies exhaustive-deps).
- _amends Session-5 commit:_ `fix(complete): success haptic only on confirmed completion, not surrender`

### ✅ Rank 15b — Blob Maker tactile press feedback (Track A) — completes rank 15
- `src/components/profile/ProfileHeader.tsx`: each color/shape/eyes option now scales to 0.92 on press
  (Pressable `pressed` state — no extra Reanimated, test-safe) alongside the existing `Haptics.selectionAsync`.
  Subtle, fast, satisfying.
- Gated GREEN: `tsc` 0, eslint 0, ProfileHeader test **12/12** (Node 20).
- _suggested commit:_ `feat(blob-maker): press-scale feedback on color/shape/eyes options`
- Files: `src/components/profile/ProfileHeader.tsx` (+ complete.tsx & friends.tsx from the critique fixes)

---

## Session 6 — friends tab: standings memo + skeleton, partner selector (2026-06-05)

### ✅ Safe friends-tab wins (Track A/B)
- `app/(tabs)/friends.tsx`:
  - **Skeleton standings** (rank 5): standings-tab loading `ActivityIndicator` → 5 layout-matched
    skeleton rows (rank chip + avatar + 2 lines + rate) so the leaderboard fetch feels instant.
  - **Memoized StandingRow** (rank 1, safe part): takes only `{rank, entry}` (no handler props), so
    `React.memo` is effective with zero restructure.
  - **Granular partner selector** (rank 3): `usePartnerStore((s) => s.partners)` instead of the
    whole-store destructure.
- Gated GREEN: `tsc` 0, eslint 0 (fixed a transient unused-`Colors` dep warning I introduced).
- _suggested commit:_ `perf(friends): memoize StandingRow + granular partner selector; skeleton the standings load`
- Files: `app/(tabs)/friends.tsx`

### ⏸️ Deferred (documented) — FollowingRow/PartnerRow memoization (rank 1+4)
The high-value fix (a single follow-toggle re-rendering the whole list) needs rows to take a `uid` +
**stable `useCallback` handlers** (bound inside the row) instead of per-render inline arrows. That's
intricate surgery on a 1100-line file with **no UI test coverage** and no commit rollback — the kind of
change to do in a focused, reviewed pass, not unattended. Exact step-by-step plan recorded in
[plan.md](./plan.md) §Deferred. Left deliberately.

---

## Session 5 — session-complete celebration: personalized blob + bug fixes (2026-06-05)

Full-CI checkpoint before this session: **798 jest passed / 6 skipped / 0 failed**, eslint clean
(1 pre-existing warning) — zero regressions across Sessions 1–4.

### ✅ Rank 11 — personalized blob celebration on the complete screen (Track A)
- `app/session/complete.tsx` (**presentation-only — NO payout/forfeit/settlement logic touched**):
  replaced the generic green checkmark with the user's **own BlobAvatar**, breathing, expression by
  outcome + streak (happy → wink ≥7 → surprised ≥30; **sleepy on surrender**). Added a Heavy haptic
  pulse on streak milestones (3/5/10/30), fired with the confetti.
- **Bug fixed:** the old checkmark showed a green ✓ even on a *surrender* — now the sleepy blob reads
  correctly as "session ended, not celebrated."
- **Stale-copy fix:** `getStreakMessage` still referenced the **removed "money plant"** ("growing your
  plant", "money plant is thriving") — rewritten to streak/focus language.
- Rank 8 (checkmark→Reanimated) is **moot**: the header entrance is already `useNativeDriver:true`
  (native thread); migrating would be churn. Skipped per "don't overdo it."
- Gated GREEN: `tsc` 0, eslint 0. (Presentation-only — no money/auth/rules logic, so no /vibe-security needed.)
- _suggested commit:_ `feat(complete): personalized blob celebration (streak expression + milestone haptic) + drop stale money-plant copy`
- Files: `app/session/complete.tsx`

---

## Session 4 — Timer ring to UI-thread Reanimated (2026-06-05)

### ✅ Rank 12 — Timer SVG progress ring + entrance fade migrated to Reanimated (Track A)
- `src/components/Timer.tsx`: the ring's `strokeDashoffset` animated on the **JS thread**
  (`useNativeDriver:false` — the only option for SVG props with legacy Animated). Migrated to
  `useAnimatedProps` on the `AnimatedCircle` (UI thread) + the entrance fade to
  `useSharedValue`/`useAnimatedStyle`/`withTiming`. Removed legacy RN `Animated`/`useRef`. The ring is
  on **every solo + group session screen** — the app's highest-traffic animation.
- Extended `jest.setup.ts` Reanimated mock with `useAnimatedProps`.
- Gated GREEN: `tsc` 0, eslint 0, **Timer test 10/10** (Node 20).
- _suggested commit:_ `perf(timer): drive the SVG progress ring on the UI thread via Reanimated useAnimatedProps`
- Files: `src/components/Timer.tsx`, `jest.setup.ts`

_Next: friends list skeletons + row memoization (rank 5/1/4), session-complete checkmark + streak blob
(rank 8/11), blocked pulse (rank 9), then retention reminders + remaining perf._

---

## Session 3 — profile + public-profile skeletons, profile perf (2026-06-05)

All gated GREEN: `tsc` 0; eslint 0; component tests **26/26** (TransactionHistory + ProfileHeader, Node 20).

### ✅ Rank 20 (partial) — skeletons for public profile + transaction history (Track A)
- `app/user/[uid].tsx`: replaced the bare centered `ActivityIndicator` loading state with a layout
  skeleton (avatar circle + name + rep badge + progress bar + stat grid + button) sized to match the
  loaded layout → no jump on load.
- `src/components/profile/TransactionHistory.tsx`: new `loading` prop → 4 skeleton rows while the
  wallet hydrates; wrapped `slice(0, limit)` in `useMemo`. Wired `loading={!isWalletHydrated}` from
  profile.tsx. _(session-tab skeletons still TODO.)_
- _suggested commit:_ `feat(ui): skeleton loading states for public profile + transaction history`

### ✅ Rank 3 — granular Zustand selectors in profile.tsx (Track B-perf)
- Replaced the whole-store `useWalletStore()` destructure with single-field selectors
  (`balance`/`transactions`/`pendingWithdrawal`/`isHydrated`) + `usePartnerStore`/`useSocialStore` field
  selectors. An unrelated store mutation no longer re-renders the whole profile tab.
- _suggested commit:_ `perf(profile): granular zustand selectors to cut needless re-renders`
- Files (Session 3): `app/user/[uid].tsx`, `src/components/profile/TransactionHistory.tsx`,
  `app/(tabs)/profile.tsx`

_Next: friends.tsx skeletons + row memoization (rank 5/1/4), session-tab skeletons, session-complete
checkmark + streak blob (rank 8/11), Timer ring (rank 12)._

---

## Session 2 — Confetti restart-bug fix (2026-06-05)

### ✅ Rank 13 (core) — memoize Confetti (fixes a real animation bug, not just perf)
- `Confetti` recomputed its 60 pieces with fresh `Math.random()` on **every** parent render, and
  `ConfettiPiece`'s mount effect depends on `delay` — so each MoneySuccessOverlay count-up tick
  (per-frame `setState`) **restarted all confetti animations mid-celebration** (a visible jump).
- Fix: compute `pieces` once via `useMemo([count, colors, Colors])` + wrap the component in
  `React.memo`. Confetti now renders once and falls smoothly through the count-up. Benefits the
  deposit/withdraw overlay **and** `complete.tsx` (both render Confetti).
- MoneySuccessOverlay's scale/opacity are already `useNativeDriver:true` (native thread), so a full
  Reanimated migration there is unnecessary churn — skipped per "don't overdo it." The count-up
  `setState` now only re-renders the lightweight amount text.
- Gated GREEN: `tsc` 0, eslint/prettier 0.
- _suggested commit:_ `fix(confetti): memoize pieces + component so count-up ticks don't restart the fall`
- Files: `src/components/Confetti.tsx`

---

## Critique 1 outcome + blob breathing (2026-06-05)

**UX critique workflow (wgcrdq27z, 4 agents)** over the Session-1 batch. Verdict: shippable once 2
fixes land. My adjudication (the loop verifies findings, doesn't blindly apply):
- ✅ **Applied:** balance Skeleton height 44 → **56** (matches `Typography.displayLarge=56`; kills a
  ~22% layout shift on hydrate), radius 10 → 12.
- ❌ **Rejected (with reason):** "StatCard deps `[value, scale, opacity]` → `[value]`." Reanimated
  `useSharedValue` returns **stable refs**, so both dep arrays behave identically — no churn. Keeping
  them satisfies `react-hooks/exhaustive-deps` (removing risks a lint warning). 3 agents shared the
  same misconception.
- ⏳ **Deferred (cosmetic):** unify StatCard/ActionButton spring feel; BlobAvatar memo-dep micro-opt.

### ✅ Rank 15a — BlobAvatar opt-in breathing idle (Track A)
- `BlobAvatar` gains an `animated` prop: subtle scale 1→1.025 breathing loop (~2.6s, UI-thread
  Reanimated), reduced-motion aware. **Opt-in + used sparingly** (profile hero avatar only) — delight,
  not noise. _(rank 15b selection spring/haptic still TODO.)_
- Extended `jest.setup.ts` Reanimated mock (`useReducedMotion`, `cancelAnimation`, `Easing.in/out/inOut`)
  so Skeleton + breathing APIs are covered.
- Gated GREEN: `tsc` 0; ProfileHeader+blob tests **19/19** (Node 20).
- _suggested commit:_ `feat(blob): opt-in breathing idle on hero avatar + cover reanimated APIs in jest mock`
- Files: `src/components/BlobAvatar.tsx`, `src/components/profile/ProfileHeader.tsx`, `jest.setup.ts`,
  `app/(tabs)/index.tsx` (skeleton-height fix)

---

## Session 1 — Skeletons, Reanimated touchstone, procedural blobs (2026-06-05)

All three **gated GREEN**: `npx tsc --noEmit` exit 0; changed-file `eslint` clean; targeted
Jest on Node 20 **19/19** (`blobAvatar.test.ts` + `ProfileHeader.test.tsx`). Nothing committed.

### ✅ Rank 2 — reusable `Skeleton` + dashboard shimmer (Track A)
- New `src/components/Skeleton.tsx`: Reanimated opacity-pulse placeholder (UI thread, no new
  dep), respects reduced-motion, a11y-hidden. Exported from the barrel.
- `app/(tabs)/index.tsx`: balance shimmers until `walletStore.isHydrated`; the 4 stat cards
  shimmer until `user` is ready. One component reused in both spots.
- _suggested commit:_ `feat(ui): reusable Skeleton + dashboard balance/stat shimmer (kill spinner pop-in)`
- Files: `src/components/Skeleton.tsx`, `src/components/index.ts`, `app/(tabs)/index.tsx`

### ✅ Rank 6 — dashboard Reanimated touchstone (recipe for ranks 8/9/12/13/21/22)
- `ActionButton` press-scale + `StatCard` pop-in migrated legacy `Animated` →
  `useSharedValue`/`useAnimatedStyle`/`withSpring`/`withTiming`. Removed RN `Animated`/`useRef`
  imports from the file. Visual timings preserved (≤300ms).
- _suggested commit:_ `perf(dashboard): move ActionButton + StatCard animations to UI-thread Reanimated`
- Files: `app/(tabs)/index.tsx`

### ✅ Rank 25 — in-house procedural blob generator ("unique" shapes, zero deps) (Track A)
- `generateBlobPath(seed)` in `src/constants/blobAvatar.ts`: deterministic organic closed-Bézier
  blob (FNV-1a→mulberry32 PRNG + Catmull-Rom smoothing), centered in a 100×100 box so it never
  clips. Same seed → same blob (stable per user).
- New selectable **"Unique"** shape in the Blob Maker; `BlobAvatar` gains a `seed` prop and renders
  the procedural path for `shapePreset:"unique"`. Auto-generated avatars stay on the base 3 presets
  (never silently "unique"). Threaded `seed={user?.id}` through ProfileHeader (avatar + previews),
  dashboard header, blocked screen.
- **Single-source-of-truth fix:** `User.blobAvatar` + `saveUserProfile`'s param both duplicated the
  shape union inline; repointed both to the shared `BlobAvatarConfig` (the `firebase.ts` change is
  type-only — no money/auth logic touched).
- New test `src/__tests__/unit/constants/blobAvatar.test.ts` (determinism, bounds, clamp,
  never-auto-unique).
- _suggested commit:_ `feat(blob): in-house seeded "unique" blob shapes (zero-dep) + unify blobAvatar type`
- Files: `src/constants/blobAvatar.ts`, `src/components/BlobAvatar.tsx`,
  `src/components/profile/ProfileHeader.tsx`, `app/(tabs)/index.tsx`, `app/blocked.tsx`,
  `src/types/index.ts`, `src/config/firebase.ts`, `src/__tests__/unit/constants/blobAvatar.test.ts`

_Next: UX critique workflow over this batch → apply fixes → continue (rank 11 streak blob expression
+ rank 15 breathing/haptics, then more skeletons + Reanimated migrations)._

---

## Iteration 0 — Setup + baseline (2026-06-05, night)

**Status:** done. **No code changed yet** (setup only).

- Pending working-tree changes that were already here (NOT mine, left for Fardeen to commit):
  - `.claude/settings.json` — enable expo design + official agent plugins.
    _suggested commit:_ `chore(claude): enable expo design + official agent plugins`
  - `docs/ui-animation.md` — "Native SwiftUI Feel" design north star + Expo skills table.
  - `expo-docs/expo-llm-docs-access.md` (new) + `.gitignore` (ignore the 2 MB `expo-docs/*.rtf`).
    _suggested commit:_ `docs(ui): native-feel design north star + Expo agent-skill & LLM-docs references`
- This loop's new docs (mine): `docs/overnight-2026-06-05/{plan,progress}.md`.
- **Baseline verification — GREEN:**
  - `npx tsc --noEmit` → exit 0 (clean).
  - `npx eslint .` → exit 0 (1 pre-existing warning: `app/_layout.tsx:259` exhaustive-deps).
  - `node --import tsx --test functions/src/*.test.ts` → **91/91 pass**.
  - Client Jest not run here (Node-version friction: pnpm needs Node ≥22.13, Jest needs Node 20);
    will run the specific Jest file under Node 20 whenever a tested component is touched.
- Per-iteration gate from here on: `npx tsc --noEmit` must stay exit-0.

_Next: discovery workflow → fill plan.md §Backlog → start implementing the top item._
