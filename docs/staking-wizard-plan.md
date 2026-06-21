# Staking Wizard Plan — Session-Flow Restructure (Founder Spec, 2026-06-12)

> Founder spec (verbatim): "the only buttons allowed should be 1) non staked 2) staked
> (collapse solo and group staked into one, just make everything into multiple big screens;
> 1) How many people (dial), 1-5 max people ima. Group 2) how much to stake — Again a dial
> for dollar amount 3,4) etc, for app block selection and for scheduling the block times and
> sections 5) finally send the invites as a ticket stub to friends (not as Niyah.live link,
> but rather through the app as an app clip or app invite". Plus: "test and wire and fix the
> robustness and completeness and UX of the staking sessions and the group sessions."
>
> Copy rules (green world): **stake / commit / complete / keep your stake / forfeit** —
> never bet/win/wager/pool. All staked copy reads from config flags
> (`SOLO_COMPLETION_MULTIPLIER`, `MIN_STAKE_CENTS`), never literals
> (docs/post-1.0x-engineering-plan.md, Track 4 rule).

## 0. Grounding — what exists today (verified in-repo)

**Entry (dashboard).** `app/(tabs)/index.tsx:967-1002` renders THREE CTAs when nothing is
running: "Start a Focus Session (Free)" → `/session/quick-block`, "Stake a Solo Session" →
`/session/select?type=solo`, "Stake a Group Session" → `/session/propose`. The render guard
is `!activeGroupSession && !activeSoloSession && !showScheduledBlock`.

**Current staked flows.**
- Solo staked: `select.tsx` (cadence carousel — stake is FIXED per cadence:
  focus $2/25m, hour $5/1h, daily $5/24h, weekly $25/7d, monthly $100/30d from
  `src/constants/config.ts` CADENCES) → `confirm.tsx` (Screen Time gate via
  `validateAndPromptForAppSelection`, double-tap `startingRef` guard, SlideToConfirm) →
  `sessionStore.startSession(cadence)` → `createSoloSession` CF (cadence-only; **no custom
  stake or duration parameter exists server-side for solo**).
- Group staked: `propose.tsx` (custom stake chips + custom $ input, duration chips,
  friend checklist from partners+following, start-now/schedule toggle) →
  `groupSessionStore.proposeSession` → `createGroupSession` CF (validates: stake
  **$1–$100 integer cents**, duration positive int ms, 2–20 total participants, dedup,
  no self-invite; **debits the proposer's stake at creation**) → `waiting-room.tsx`
  (accept/online gates, `everyoneHasBlockSelection` start gate, auto-timeout countdown,
  cancel + Share link) → `startGroupSession` CF → `active.tsx`.
  **Known dishonesty:** propose.tsx's Day/Time pickers are cosmetic — `handlePropose`
  never sends them; the session is created immediately. There is no scheduled-group
  support server-side.
- Non-staked: `quick-block.tsx` (free, local-only via legacy
  `groupSessionStore.startGroupSession` single-participant path; no Firestore doc).

**Invites today.** `createGroupSession` writes `groupInvites` docs for pre-selected
`inviteeIds` (must already be Niyah friends); recipients see them via
`subscribeToGroupInvites` → dashboard banner → `invites.tsx` (accept gates on Screen Time
selection; `respondToGroupInvite` CF debits the accepter's stake transactionally; decline
that drops the session below 2 participants cancels + refunds everyone). The
`https://niyah.live/join?s=<id>` Universal Link (AASA `/join`,`/join/*` in
`landing-pg/public/.well-known/apple-app-site-association`; handler `app/_layout.tsx:212-227`
→ SecureStore `PENDING_JOIN_KEY` → `/session/invites`) **only works for users who already
have an invite doc** — `respondToGroupInvite` 403s anyone else, and
`app/(auth)/profile-setup.tsx:93-95` explicitly drops the join link for new users
("open-join CF not built yet"). Referral link `niyah.live/i?ref=` is separate (`app/invite.tsx`).

**Blocking primitives** (`src/config/screentime.ts`): `presentAppPicker`,
`validateAndPromptForAppSelection` (the staked-start gate), `getSavedAppBlockSummary`
(shareable counts/label, no tokens), `startScheduledBlocking(startHour, startMinute,
endHour, endMinute, name)`, plus `BlockTemplateChips` (`src/components/session/`) for
named block-list templates. Schedule tab (`app/(tabs)/schedule.tsx` + `scheduleStore` +
`src/constants/scheduleTemplates.ts`) owns recurring free blocks; per-template staking is
double-flag-dormant (`SCHEDULED_STAKE_ENABLED` client + server; `createScheduledStakedSession`
CF returns 501 until the server flag flips).

**W2 feasibility findings to reuse** (docs/post-1.0x-engineering-plan.md, Track 4 —
verdict: 100% JS/Expo-Router, no native rebuild beyond the normal bundle, NO OTA channel so
everything ships in the next `pnpm build:prod`):
- The 3-button block is the fork to fold; `SessionMode` taxonomy already exists.
- `friendCount` is derivable client-side (mirror `propose.tsx:372-398` partners+following dedup).
- Preserve the alternate entry points: onboarding step-2 (`index.tsx:790-801`), active
  banners, partner duo CTA (`app/user/[uid].tsx` → select→confirm with `currentPartner`),
  notification deep-links.
- Staked copy/economics from config flags only.
The Track-4 FAB + formSheet `start.tsx` sheet is **superseded** by this wizard (founder now
wants two explicit buttons + full screens, not a FAB sheet). Do not build `start.tsx`.

**Money-path state (docs/deep-audit-2026-06-08.md + docs/STATUS.md):** deferred P0s —
C1 withdrawal double-debit (deterministic `txnRef`, `functions/src/index.ts:3993`),
C2 recovery auto-complete payout race (`src/store/sessionStore.ts:470-513` — client writes
`status:"completed"` before `cloudComplete`, so the CF rejects and the server wallet never
pays), H1 missing `idempotencyKey` on `stripe.payouts.create` (`index.ts:4235`),
M1 stakeComposition validation. None auto-applied; all need Fardeen's reviewed pass.

---

## 1. Entry: two buttons only

In `app/(tabs)/index.tsx` replace the 3-button Quick-Start card (lines 967–1002) with two:

1. **"Focus" (non-staked)** → `router.push('/session/quick-block')` — unchanged flow.
2. **"Stake a session"** → `router.push('/session/wizard/people')` — the new wizard.

Keep the same render guard. Keep copy config-driven ("Stake on yourself. Complete it,
keep it." — no earn/win framing at 1.0x).

**Fate of the old screens:**
- `propose.tsx` — **replaced** by the wizard (group branch). Keep the file until the wizard
  reaches parity (Milestone 6), then delete it and its route registration.
- `select.tsx` + `confirm.tsx` — **kept temporarily as internals** for the preserved entry
  points (onboarding step-2, partner duo CTA, notification deep-links), then retired:
  in Milestone 5 those entries repoint to the wizard with prefill params
  (`/session/wizard/people?partner=<uid>` preselects 2 people + the partner;
  onboarding deep-links to the wizard start). `confirm.tsx`'s hard-won logic — the
  Screen Time gate-before-charge, the synchronous `startingRef` double-tap guard, the
  SlideToConfirm + "stake deducted immediately" disclaimer — **migrates into the wizard's
  final review step**, not thrown away.
- `quick-block.tsx`, `waiting-room.tsx`, `invites.tsx`, `active.tsx`, `complete.tsx`,
  `surrender.tsx` — unchanged (the wizard drives into them).
- `partner.tsx` — absorbed by wizard step "who" once the duo CTA repoints; retire with select.

## 2. Wizard architecture: route group of full screens (recommended)

**Recommendation: `app/session/wizard/` expo-router route group** — five real screens under
a nested `Stack`, not a paged container.

```
app/session/wizard/_layout.tsx     // nested Stack + WizardDraft provider + progress dots
app/session/wizard/people.tsx      // step 1 — people dial (1–5)
app/session/wizard/stake.tsx       // step 2 — dollar dial
app/session/wizard/apps.tsx        // step 3 — app-block selection
app/session/wizard/schedule.tsx    // step 4 — when + how long
app/session/wizard/review.tsx      // step 5 — solo: review + slide-to-stake
                                   //          group: ticket-stub send → waiting room
```
Register `wizard` in `app/session/_layout.tsx` (inherits the dark-pinned green world and
`slide_from_bottom`; wizard's internal pushes use default horizontal slides so steps feel
like "big screens" advancing).

**Why route group over a paged container:**
- Founder asked for "multiple big screens" — discrete screens with native push/back
  gestures read as big screens; a horizontal pager reads as one screen with dots.
- The native FamilyControls picker (step 3) and keyboardless dials interact badly with a
  gesture-owning pager; a Stack isolates each step's gesture space (the dial needs pan).
- Free deep-linking/prefill (`?partner=`, `?people=2`) for the preserved entry points.
- Matches existing conventions (every session surface is a routed screen).

**Draft state:** a tiny ephemeral `wizardDraftStore` (Zustand, NOT persisted) or context in
`_layout.tsx`: `{ people: 1–5, invitees: string[], stakeCents, appSelectionSummary,
startMode: 'now', durationMs }`. **No money moves until the final action on step 5**
(`createSoloSession` for solo / `createGroupSession` for group), so abandoning mid-wizard
at any step is free — back out or swipe down and nothing was charged. Reset the draft on
wizard unmount.

### Step 1 — People dial (1–5)
- The DIAL component (see §3) with detents 1,2,3,4,5. `1` = solo staked; `2–5` = group
  (proposer + 1–4 friends; server allows 2–20 so 5 is a pure product cap, define
  `MAX_WIZARD_PARTICIPANTS = 5` in `src/constants/config.ts`).
- When ≥2: inline friend checklist appears below the dial (reuse propose.tsx's
  partners+following dedup list verbatim; same empty state pointing to Find Friends).
  Continue requires `invitees.length === people - 1` (or allow fewer with "open seats" once
  the open-claim CF exists — Phase A.2, §5).
- Auto-fold (W2 finding): if `people ≥ 2` but friendCount is 0, show the one-line
  "Invite friends to stake together — starting solo for now" note and offer the referral
  share (`/invite`), folding to 1.

### Step 2 — Stake dial
- Same DIAL, dollar config: detents from `MIN_STAKE_CENTS` ($2) to
  `DAILY_STAKE_CAP_CENTS` ($25) in $1 steps (group server clamp is $1–$100; the daily cap
  is the real binding constraint — mirror the server's per-wallet daily counter UX from
  `sessionStore.startSession`'s cap check).
- Clamp live against wallet balance (`useWalletStore.balance`) and remaining daily cap;
  below-minimum balance shows "Add funds" → `/session/deposit` (modal, returns to wizard).
- Group: this is `stakePerParticipant` — "Everyone stakes their own $X" copy (de-pooled).
- **Solo constraint (decision needed, §5):** `createSoloSession` only accepts a cadence
  today. Option A (recommended) extends the CF with optional `stakeCents`+`durationMs`;
  Option B ships now by snapping the solo dial to the cadence ladder ($2/$5/$25 with their
  fixed durations shown). Build the dial UI once; the allowed-detents array is config.

### Step 3 — App-block selection
- Reuse exactly: `validateAndPromptForAppSelection` pattern split into its visible parts —
  authorize row, `presentAppPicker` row, current-selection label, `BlockTemplateChips`
  (apply/save templates). This is confirm.tsx's "Setup Required" card promoted to a full
  screen with the green-world treatment.
- Continue gated on `getAppSelectionStatus().hasApps` (or `available:false` passthrough on
  simulator — never trap, same contract as today).
- Group: note "Everyone blocks their own apps on their own phone" (tokens can't cross
  devices; the waiting room enforces per-member selection before start).

### Step 4 — Schedule (when + how long)
- **Honest v1: "Start now" + duration.** Duration: chips or a third dial config
  (25m / 1h / 2h / 4h / until-tonight, + 30s demo under `USE_SHORT_TIMERS`), feeding
  `durationMs`. The current group CF takes any positive duration; solo depends on §5
  Option A/B.
- **Scheduled start is NOT server-supported for groups** (propose.tsx's day/time was
  cosmetic — do not reproduce that dishonesty). For solo, scheduled-staked exists only as
  the dormant `createScheduledStakedSession` (501 until server flag). So: render a
  "Schedule for later" affordance ONLY as a cross-link — "Make this a recurring block" →
  `/(tabs)/schedule` with the chosen window prefilled via `scheduleStore.addTemplate`
  (free block; the stake toggle stays behind `SCHEDULED_STAKE_ENABLED`). Display reuses
  `formatWindow`/`SCHEDULE_PRESETS` from `src/constants/scheduleTemplates.ts`.
- Skipping is allowed (defaults: start now, 1h).

### Step 5 — Review / Invites
- **Solo (people=1):** review card (stake, duration, blocked apps label, outcomes:
  "Complete: keep your $X" / "Surrender: forfeit your $X") + `SlideToConfirm` + the
  migrated gate/guard logic from confirm.tsx → `startSession` → `/session/active?mode=solo_staked`.
- **Group (people≥2):** the **ticket stub** (see §4). Primary action "Send tickets" calls
  `proposeSession` (debits proposer stake — say so above the button), then presents the
  share sheet per missing-channel invitee, then `router.replace('/session/waiting-room?...')`.
  In-app invitees also get their existing push + invite docs automatically (no server change).
  Skipped entirely for solo.

## 3. The DIAL component

One reusable component, `src/components/session/Dial.tsx`, two configs (people / dollars,
later durations).

- **Mechanics:** `react-native-gesture-handler` Pan + `react-native-reanimated` 4.1 (both
  installed; no new deps). A horizontal tick-strip wheel (or arc) where drag translation
  maps to value via `interpolate` + snap-to-detent on release with a **timing settle
  (~250ms, `Easing.out(cubic)`) — no springs, no overshoot**, per the house motion spec
  (docs/redesign-all-tabs-progress.md: "SUBTLE motion… no overshoots"). Reduced-motion:
  jump straight to the detent.
- **Haptics:** `Haptics.selectionAsync()` on every detent crossing (runOnJS from the
  worklet, throttled to detent boundaries), `impactAsync(Medium)` on release-commit —
  "precise, haptic-ticked, not springy".
- **API:** `{ values: number[] (detents), value, onChange, format: (v) => string,
  disabledAbove?: number (cap/balance clamp, rendered dimmed + un-draggable past it),
  label, accessibilityLabel }`. Center readout is a big white numeral (people: "3 people";
  dollars: "$12"); dollars get the "Everyone stakes their own" subline in group mode.
- **A11y:** `accessibilityRole="adjustable"` with increment/decrement actions so VoiceOver
  users aren't locked out of the only input mechanism.
- **Tests:** pure detent-math helper (`valueForOffset`, clamping) extracted and unit-tested;
  light render test for both configs (jest, existing patterns).

## 4. Ticket-stub invites — honest phasing

### Phase A (this build, JS-only)
- `src/components/session/TicketStub.tsx`: green-world ticket card — primary surface fill,
  white@0.25 dashed perforation line, BlobAvatar of the proposer, session details (stake
  "$X each — everyone stakes their own", duration, starts-when, participants count),
  notched edges (two primaryDark circles overlapping the card).
- Step 5 renders one stub per invitee (or one shared stub). "Send" path:
  1. In-app: the invite docs + FCM push from `createGroupSession` already reach Niyah
     friends — the stub is the in-app representation; recipients' `invites.tsx` should be
     restyled to render the SAME TicketStub component so the invite arrives "as a ticket".
  2. Out-of-app share: native share sheet (`Share.share`) with the EXISTING
     `https://niyah.live/join?s=<sessionId>` Universal Link (waiting-room.tsx:488 pattern)
     — presents richly in Messages; **no new native targets, no AASA change**.
- **Known limit, flagged honestly:** the /join link only resolves for users who already
  hold an invite doc; brand-new users hit the referral/install path and the join is
  dropped (profile-setup.tsx:93). Closing this needs the **open-claim CF** (Phase A.2,
  optional): `claimGroupSessionSeat(sessionId)` — validates status pending/ready +
  capacity (≤ wizard people count) + not already a participant, creates the participant +
  debits their stake with the same transactional helper `respondToGroupInvite` uses.
  Money-adjacent (wallet debit, NOT Stripe APIs) → Fardeen-reviewed.

### Phase B (separate build/native effort — DO NOT schedule in this build)
A real App Clip via `@bacons/apple-targets` (already drives the 5 existing targets in
`targets/`; config in app.config.js:191) + AASA changes on niyah.live:
1. New `targets/appclip` SwiftUI target (Expo skill `expo:add-app-clip` covers scaffolding);
   parent-app association `NSAppClip` + `com.apple.developer.parent-application-identifiers`.
2. AASA: add an `appclips` block (`"apps": ["<TEAMID>.live.niyah.app.Clip"]`) next to the
   existing `applinks` in `landing-pg/public/.well-known/apple-app-site-association`;
   advanced App Clip experience registered in App Store Connect for `niyah.live/join`.
3. Clip content: native SwiftUI ticket view (session details fetched via a public,
   unauthenticated-read CF or token-scoped endpoint), "Accept & get Niyah" → full-app
   install handoff carrying the pending join.
**Risks (why Phase B is separate):** App Clip uncompressed size limits (15 MB for
advanced experiences; 50 MB only for default link launches on iOS 17+) rule out an RN/Expo
bundle — it must be pure SwiftUI; **FamilyControls/ManagedSettings are unavailable in App
Clips**, so the clip can never start a real block — it is invite-acceptance UX only;
money actions inside a clip raise review questions (keep the clip read-only + handoff);
every clip change is a full build + resubmit (no OTA), and it adds a new review surface
on the critical path. List it, link it, don't build it now.

## 5. Server impact (precise)

| Area | Change | Risk class |
| --- | --- | --- |
| Group create/accept/decline/online/start/cancel/timeout (`createGroupSession`, `respondToGroupInvite`, `markOnlineForSession`, `startGroupSession`, `cancelGroupSession`, `autoTimeoutGroupSessions`) | **None.** Already supports custom stake ($1–$100), custom duration, 2–20 participants, transactional debits/refunds, block-summary plumbing. The wizard is a pure client re-skin of these calls. | n/a |
| Solo custom stake+duration | **Option A (recommended):** extend `createSoloSession` (`functions/src/index.ts:2896`) with optional `stakeCents` + `durationMs`, validated exactly like the group CF (integer, $2–$25 via the existing daily-cap helper at `:525-560`, positive duration) and falling back to cadence defaults when absent. Touches a live wallet-debit path → **Fardeen-reviewed pass + `pnpm test:functions` coverage + `/vibe-security`**. **Option B (zero server change):** solo dial snaps to the cadence ladder. Ship B first if A slips. | Money path (wallet debit; no Stripe API touched) |
| Open seat claim (Phase A.2, optional) | New `claimGroupSessionSeat` CF modeled on `respondToGroupInvite`'s accept transaction. | Money-adjacent (wallet debit) — Fardeen-reviewed |
| Ticket share, dial, wizard, entry rewire, schedule cross-link | Pure client. | None |
| Stripe paths (`requestWithdrawal`, payouts, deposits, webhooks) | **Untouched by this feature.** The only Stripe-path work in scope is landing the already-specified C1+H1 fixes, which are independent of the wizard and explicitly Fardeen's reviewed pass. | Live Stripe — never bundle into wizard commits |

## 6. Robustness & completeness pass — known weak spots

**Prerequisites for heavy on-device staked testing (land first, reviewed):**
- **C2** (sessionStore.ts:470-513): crash-recovered solo completions silently never pay the
  server wallet. Every force-quit test case hits this — fix per deep-audit (delete the
  client status write; `cloudComplete` is the sole status writer), mirroring `completeSession`.
- **M1** stakeComposition validation — verify against real session docs first.

**Orthogonal to session testing (but land in the same reviewed money batch):**
- **C1 + H1** are withdrawal-side (double-debit + payout idempotency). They don't block
  session-flow testing, but do them in the same Fardeen-reviewed pass since real-money group
  testing ends in withdrawals.

**Session/group weak spots found in this exploration (wire/fix in Milestone 7):**
1. propose.tsx cosmetic Day/Time (dishonest scheduling) — eliminated by wizard §2 step 4.
2. `/join` link dead-ends for non-pre-invited + new users (profile-setup.tsx:93) — Phase A.2.
3. Quick-block/free sessions are in-memory only (legacy `startGroupSession` local path):
   force-quit mid-free-block leaves shields on with no recoverable session and no entry to
   stop them except manual — verify on device; minimal fix = a local persisted marker +
   `stopBlocking` reconciliation on cold start.
4. `markOnlineForSession` does a non-transactional update+read (benign last-writer race on
   `allOnline`, self-healing since each client computes it) — document, don't rewrite.
5. Invite acceptance races to verify, not assumed: accept-vs-autoTimeout (invite expired
   mid-tap → error surfaced + wallet untouched), double-accept (status check in txn),
   decline-below-2 (cancel + refund-all, verified at index.ts:5959-5985), accept with
   insufficient balance (error message quality).
6. Waiting-room recovery exists (dashboard `activeGroupSessions` cards) — keep it in the
   test matrix; ensure the wizard's `router.replace` chain can't strand a back-stack into a
   half-built draft after staking.
7. Stale `setSessionContext` / Live Activity teardown on every exit path (complete,
   surrender, cancel, timeout) — spot-check after wizard rewiring.

**End-to-end on-device test matrix (Fardeen, TestFlight build):**

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Solo staked via wizard (1 person, $5, 25m) → complete | stake returned server+local, streak++, shields drop |
| 2 | Solo staked → surrender | forfeit recorded; first-surrender forgiveness badge if eligible |
| 3 | Solo staked → force-quit → reopen after end | recovery pays out ONCE, server wallet matches (post-C2) |
| 4 | Abandon wizard at each of steps 1–4 (back + swipe-down) | zero money moved, draft reset |
| 5 | Group 2-person: wizard → tickets → friend accepts → both online → start → both complete | both keep stakes; waiting-room gates (online + block-selection) hold |
| 6 | Group 2-person: invitee declines | session cancelled, proposer refunded + notified |
| 7 | Group 3-person: one accepts, one ignores → auto-timeout | refunds for proposer + accepter, invites expired |
| 8 | Proposer cancels from waiting room | hold-to-confirm; all accepted refunded |
| 9 | Invitee accepts with insufficient balance | clean error, no partial state |
| 10 | Force-quit in waiting room → reopen | dashboard recovery card → waiting room rejoins |
| 11 | Ticket share → installed friend taps /join | lands on invites (ticket-styled) → accept works |
| 12 | Ticket share → friend without app | install path; (Phase A limit) join dropped — verify referral still credits |
| 13 | Stake dial vs caps: balance < $2; daily cap nearly spent | dial clamps; "Add funds"; server agrees with client |
| 14 | Double-tap the final stake action; double-tap Accept | single charge (migrated `startingRef` + loading guards) |
| 15 | Free Focus button → quick block → force-quit | shields recoverable/stoppable (weak spot 3) |
| 16 | Wizard with 0 friends, dial at 3 | auto-fold messaging → solo path |

## 7. Build order (gate-able milestones)

| M | Scope | Effort | Gate |
| --- | --- | --- | --- |
| 0 | Money prereqs (Fardeen-reviewed, separate commits): C2 (+ C1/H1/M1 batch), real-money smoke test | 0.5–1d + review | `pnpm test && pnpm test:functions` green; smoke test |
| 1 | ✅ **DONE (2026-06-20)** — `src/components/session/Dial.tsx` + pure `dialMath.ts` + tests (people 1–5 + dollar $2–$25 configs) | 1–1.5d | ✅ unit + render tests (35 cases) green, typecheck/eslint clean, full suite 992 pass; **on-device feel check pending (Fardeen)** |
| 2 | Wizard scaffold: route group, `_layout` + draft store, progress UI; dashboard → two buttons; old routes still reachable | 1d | typecheck/tests; both buttons navigate |
| 3 | Steps 1–2 (people dial + friend list reuse + auto-fold; stake dial + cap/balance clamps) | 1d | render tests; clamp unit tests |
| 4 | Steps 3–4 (apps screen reusing picker+templates; schedule screen + schedule-tab cross-link) | 1–1.5d | gate behavior matches confirm.tsx contract |
| 5 | Solo finish: review + slide-to-stake (migrate confirm guards); repoint onboarding/duo/notification entries; **Option A solo CF extension (sub-gated, reviewed) or Option B ladder** | 1–2d | solo E2E (matrix 1–4); CF tests if Option A |
| 6 | Group finish: TicketStub + share + invites.tsx ticket restyle + waiting-room handoff; delete propose.tsx; retire select/confirm/partner | 1.5d | group E2E (matrix 5–10); dead-route sweep |
| 7 | Robustness pass: weak spots 3/5/6/7, full matrix on device, copy sweep (stake/commit/complete — never bet/win), `/vibe-security` on any money-adjacent diff | 1–2d | full matrix; gates green |
| 8 | (Listed, NOT scheduled) Phase A.2 open-claim CF; Phase B App Clip | — | separate sign-offs |

Total core build: ~7–10 dev-days after M0 sign-off. Everything ships in the next
`pnpm build:prod` (no OTA). Implementation can start at M1 immediately after sign-off;
M0 runs in parallel as Fardeen's reviewed batch.
