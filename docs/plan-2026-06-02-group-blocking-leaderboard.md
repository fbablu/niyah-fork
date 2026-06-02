# Plan — group blocking + solo-stake-in-group + leaderboard + notifications (2026-06-02)

> Branch `wallet-ledger`. De-pool model is **fixed and must not change** (each member stakes own money,
> complete → own stake back at multiplier 1.0, surrender → forfeit to house; never pooled). This plan is
> entirely the **blocking / social / notification** layer. Fardeen runs all git/deploy; one-liner commit
> subjects; `/vibe-security` on money/auth diffs.
>
> Derived from a 6-subsystem code map + synthesis (workflow `wf_4bd55bc4-d73`). Decisions locked by Fardeen.

## Two corrections the code review surfaced (read first)

1. **Goal 4b ("notify when a member opens a blocked app") is dead code, not just un-pushed.**
   `startBlocking()` (`modules/niyah-screentime/ios/NiyahScreenTimeModule.swift:243-276`) applies a
   `ManagedSettingsStore` shield **directly** and never calls `DeviceActivityCenter.startMonitoring` with a
   `DeviceActivityEvent` → `DeviceActivityMonitorExtension.eventDidReachThreshold` never fires →
   `recordViolation()` is unreachable on the session path. The **server side is fully built and idle**:
   `reportShieldViolation` CF → `sendPushToUsers`, type `member_app_opened`, 30s throttle
   (`functions/src/index.ts:6134`). Fix routes detection through `ShieldActionExtension` (the one extension
   guaranteed to run when the user taps the shield).

2. **Goal 2 ("normalize block sets across members") is impossible as literally stated.** FamilyControls
   `ApplicationToken`s are **opaque + device-local** — a token captured on member A's phone is meaningless on
   B's and cannot be merged/reconstructed server-side. Reframed (decision below) to a per-member
   **agreement/display** layer + a start-gate.

Also: **Goal 4a (surrender notify) is already server-wired** (`reportSessionStatus` → `sendPushToUsers` type
`session_surrender`, `functions/src/index.ts:5848`); only a client nav case is missing. **Goal 3
(solo-in-group) is already de-pool** — money is functionally solo already; needs labeling only.

## Decisions (locked)

| # | Decision | Choice |
| - | -------- | ------ |
| Scope | What to build | **All 4 phases, now** (not deferred post-submit) |
| Goal 2 | Normalization behavior | **Per-member isolation + category-summary agreement + start-gate** (block session start until every member has a non-empty selection; waiting room shows each member's category summary and flags empty selectors). No token plumbing. |
| Leaderboard | Ranking metric | **Completion rate** (completed / total sessions together), tiebreak **fewest violations**. Never earnings (de-pool/legal). |
| Goal 3 | Concurrent solo + group on one device | **No** — single active session; keep the shared `.niyahSession` store; goal 3 is **labeling/copy only**. Defer the named-store native refactor. |

## Phases

### Phase 1 — App-selection validation + surrender nav `[JS, hot-reload]`
The real "doesn't work" bug: `confirm.tsx`/`active.tsx` call `startBlocking()` with **no selection guard** → the
native module throws on an empty selection (`NiyahScreenTimeModule.swift:246-251`), the error is swallowed,
and the **session runs unshielded, silently**. Only `quick-block.tsx` validates.
- `src/config/screentime.ts` — `validateAndPromptForAppSelection()` single chokepoint (checks
  `getSavedAppSelection()`; prompts picker if empty + auth ok; typed `needs-auth` result otherwise).
- `app/session/confirm.tsx` — "Setup Required" card (mirror `quick-block.tsx`) + disabled Confirm until
  auth+selection exist + "Change apps" affordance + visible failure banner (no swallowed log).
- `app/session/active.tsx` — guard the re-entrant `startBlocking()` (≈:430); warn banner if empty instead of
  silently unshielded.
- `src/config/notifications.ts` — add `session_surrender` case to `handleNotificationNavigation` → `/session/active` (**closes 4a**).

### Phase 2 — Blocked-app-open detection fix + push `[native, needs build:local + device]`
- `targets/shieldaction/ShieldActionExtension.swift` — on **both** `.primaryButtonPressed` ("Back to Focus",
  currently records nothing) and `.secondaryButtonPressed`, append `Date().timeIntervalSince1970*1000` to the
  app-group `niyah_shield_violations` array (mirror `DeviceActivityMonitorExtension.recordViolation`), guarded
  by the `niyah_is_blocking` flag. The existing 2s poll (`NiyahScreenTimeModule.swift:597`) → existing
  `reportShieldViolation` CF → existing `member_app_opened` push then fire end-to-end.
- Optional: centralize the app-group UserDefaults key strings into one shared `Constants` to prevent drift.

### Phase 3 — Computed group leaderboard `[server + JS]`
- `functions/src/index.ts` — new `getGroupLeaderboard` callable (model on `getWithdrawalEligibilityStats`
  query): query `groupSessions` where `participantIds array-contains` caller, aggregate per co-member
  `{completedCount, surrenderCount, violationCount, sessionsTogether}`, rank by completion rate, tiebreak
  fewest violations. Computed on request (non-real-time). No `groups/` collection for v1.
- `src/store/groupSessionStore.ts` — `fetchGroupLeaderboard` (cached snapshot, non-subscription).
- `app/(tabs)/friends.tsx` — "Standings" section; copy says **completion rate**, never earnings.
- `firebase/firestore.indexes.json` — index on `groupSessions.participantIds` if needed.
- Functions `node:test` seeding `groupSessions` and asserting the ranking.

### Phase 4 — Per-member block agreement + start-gate + solo labeling `[data-model + client + light server]`
- `src/types/index.ts` — extend `GroupSessionParticipant` with `appBlockSummary?: {appCount: number;
  categoryLabels: string[]}` and `stakeMode?: 'solo'` (only mode under de-pool). Store **human-readable
  summaries, never tokens.**
- `functions/src/index.ts` — `createGroupSession` (~:5055) + `respondToGroupInvite` (~:5340) accept optional
  `appBlockSummary`, persist to `participants.{uid}.appBlockSummary`. No token storage, no server merge.
- `app/session/propose.tsx` — surface proposer's saved selection summary + "Change apps"; pass summary.
- `app/session/waiting-room.tsx` — render each member's `appBlockSummary` ("Sarah: 6 apps · Social, Video"),
  flag empty selectors, **GATE start until every member has a non-empty selection**.
- `app/session/invites.tsx` + copy — state solo-stake semantics ("You stake your own money; finish and you
  get it back — your friends' results never change yours").

## Cross-cutting guardrails

- De-pool intact: **no payout-math change** in goal 3. `stakeMode` is a label; `calculateGroupSessionPayouts`
  (`functions/src/security.ts:77`) stays at multiplier 1.0, no peer-to-peer transfers. No "win/pool" copy (legal).
- Money/auth diffs (`confirm.tsx`, `createGroupSession`, `respondToGroupInvite`, new CF) → `/vibe-security`,
  fix Critical+High before commit.
- Functions tests use the **Node built-in runner** (`node:test` + `tsx`), NOT jest — `pnpm test:functions`.
- Native phases need `pnpm build:local` on a physical iOS 16+ device; JS phases hot-reload.
- **`functions/src/index.ts` also holds the uncommitted finding-#8 withdrawal-cap fix** — commit that
  separately FIRST so the money-path change isn't entangled with feature commits.

## Build order (respecting the shared `functions/src/index.ts`)

1. Phase 1 (client only — no `index.ts`).
2. → Fardeen commits the finding-#8 fix (clean tree before server work).
3. Phase 4 (types + client + light `index.ts`).
4. Phase 3 (`index.ts` CF + client).
5. Phase 2 (native).
6. Final review + `/vibe-security` + CI + handoff.

## Status

- [x] **Phase 1 — done** (client-only): `screentime.ts` `getAppSelectionStatus()` + `validateAndPromptForAppSelection()`; `confirm.tsx` Setup-Required card + disabled start + "Change apps" + gate-before-charge; `active.tsx` guarded re-entrant `startBlocking` + warn banner; `notifications.ts` `session_surrender` nav (closes 4a). tsc 0 · eslint 0 · screentime tests 37/37 (+11). Files: `src/config/screentime.ts`, `src/config/notifications.ts`, `app/session/confirm.tsx`, `app/session/active.tsx`, `src/__tests__/unit/config/screentime.test.ts`.
- [x] **Phase 4 — done**: `types/index.ts` `AppBlockSummary` + `appBlockSummary`/`stakeMode:'solo'` on `GroupSessionParticipant`; `createGroupSession` + `respondToGroupInvite` accept + sanitize (`parseAppBlockSummary`) + persist per-member summary; client wrappers + `groupSessionStore` derive the summary from the saved selection (`getSavedAppBlockSummary`); `propose.tsx` + `invites.tsx` gate on a selection before staking; `waiting-room.tsx` shows each member's "Blocking …" / "No apps selected yet" + **disables Start until everyone has a non-empty selection** (`blockReadyCount/totalCount`); solo-stake copy on the invite card. NO payout-math change. tsc 0 (client + functions) · eslint 0. Files: `src/types/index.ts`, `functions/src/index.ts` (createGroupSession/respondToGroupInvite + parseAppBlockSummary), `src/config/functions.ts`, `src/config/screentime.ts` (getSavedAppBlockSummary), `src/store/groupSessionStore.ts`, `app/session/{propose,invites,waiting-room}.tsx`.
- [x] **Phase 3 — done**: `security.ts` `buildGroupLeaderboard()` (pure, completion-rate rank, tiebreak fewest violations); `getGroupLeaderboard` CF (reuses the existing `participantIds`+`status` index, 500-session scan cap logged); client `getGroupLeaderboard` wrapper + `GroupLeaderboardEntry` type; `groupSessionStore` `leaderboard`/`leaderboardLoading`/`fetchGroupLeaderboard` (+ reset); `friends.tsx` **Standings** tab (3rd segment, `StandingRow`, completion-rate copy, never earnings). 5 node:tests. functions 65/65 · client jest green.
- [x] **Phase 2 — done** (native, needs `build:local`): `ShieldActionExtension.swift` now `recordViolation()` on BOTH button presses (guarded by `niyah_is_blocking`), mirroring the monitor's `niyah_shield_violations` `[Double]` ms format + `synchronize()`. Live path: shield tap → 2s poll (`NiyahScreenTimeModule`) → existing `reportShieldViolation` CF → existing `member_app_opened` push. (The DeviceActivity event path stays dead — direct ManagedSettings shielding; this is the working signal.) Can't unit-test; verify on device.
- [x] **Final review — done**: 6-agent adversarial review of the feature diff (de-pool/money, stake-path regression, leaderboard CF security, client gating) → **0 confirmed / 0 likely** (one cosmetic `stakeMode` nit, applied as polish). `/vibe-security`: clean — `groupSessions` is `allow write: if false` (CF-only, sanitized) + participant-scoped reads, so `appBlockSummary` is unforgeable and the leaderboard query can't leak cross-cohort. Full CI green: eslint 0 · tsc 0 · jest 752 pass · functions 65/65.

## Deploy / rebuild (Fardeen runs all git/deploy)
- **Functions**: `firebase deploy --only functions` — new `getGroupLeaderboard` + changed `createGroupSession`/`respondToGroupInvite` (+ the #8 `requestWithdrawal`). No env change, no migration.
- **Firestore rules/indexes**: none (reused the existing `participantIds`+`status` index; no rule change).
- **Client JS** (Phases 1/3/4): ships on the next JS bundle / hot-reload — no rebuild.
- **Native** (Phase 2, `ShieldActionExtension.swift`): needs `pnpm build:local` on a physical iOS device (source-only change to an existing target — no prebuild).
