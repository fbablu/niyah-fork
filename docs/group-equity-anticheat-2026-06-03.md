# Group Equity, Anticheat & Multi-Phone Testing (2026-06-03)

> **Status: strategy / decision doc.** Synthesizes the founder's open questions on **group session
> fairness**, **anticheat for a money product**, **session cadence**, and **solo-dev multi-phone
> testing**. This is an internal strategy doc — it discusses gambling/regulatory and cheating topics
> by name for analysis. **None of this language is user-facing.** App and landing copy still follow
> the legal rule: stake / commitment / goal / complete / Earned — never bet/wager/gamble/win/pool.
>
> **Read alongside (current shipping state, read first):**
> - [docs/plan-2026-06-02-group-blocking-leaderboard.md](./plan-2026-06-02-group-blocking-leaderboard.md)
>   — the group blocking/leaderboard/notification layer that **shipped** (all 4 phases done). This
>   doc builds on it; where they overlap, the plan doc is the source of truth for what exists.
> - [docs/group-equity.md](./group-equity.md) — the **superseded** cap-target/handicap payout model.
>   That model assumed a redistributable pool and is dead under de-pool. Referenced below only for the
>   meritocracy-vs-equity framing, never as a payout proposal.
>
> **De-pool is fixed and does not change here.** Every member stakes their own money; complete → own
> stake back at multiplier 1.0; surrender → forfeit to the house; stakes are **never** pooled or
> redistributed. Everything below is the *blocking / fairness / social* layer on top of that invariant.

---

## 0. Why this doc exists (the three problems)

Once group sessions are real (they are — see the plan doc), three founder questions are open:

1. **Equity.** Members block *different* apps and have *different* baseline usage. Is a 30-min/day user
   "competing" fairly against an 8-hr/day user? What does fair even mean when nobody's money pools?
2. **Anticheat.** This is a money product. Users can bypass app blocks via Safari, by deleting the app,
   by using a second phone, by idling. How much of this do we stop, and where do we honestly draw the line?
3. **Cadence + testing.** Daily vs weekly sessions, blank-scheduler problem, a no-money "zen" mode — and,
   practically, how does a solo dev with 5 spare phones and few phone numbers actually test all of this.

A useful reframe up front: **because we de-pooled, "fairness" is no longer a money problem.** No member's
completion changes another member's payout. So equity is purely a *social / motivation / honesty* concern
(the leaderboard, the "are we really both trying" feeling), not a settlement concern. That dramatically
lowers the stakes on getting the equity model "perfect" and is the single most important thing to internalize.

---

## 1. Group equity / fairness — the "everyone blocks different apps" problem

### 1.1 The problem, concretely

Member A blocks Instagram + TikTok + YouTube (their actual time-sinks). Member B blocks a news app they
open twice a week. Both "complete" the session. The leaderboard (completion-rate ranked — see plan doc
Phase 3) shows them as equals, but A clearly did harder work. Light users can look identical to heavy users.

This is the same heavy-vs-light mismatch the [old cap-target doc](./group-equity.md) tried to solve — but
that doc solved it by *redistributing a pool toward the harder workers*, which is exactly the mechanic the
de-pool removed (and the mechanic that re-opens the gambling-classification question). So we cannot reuse it.

### 1.2 How the production apps handle it

None of the leaders attach money to group competition, so they sidestep the settlement version entirely —
but their social designs are instructive:

- **Jomo — "Focus Club" / "Jomo Squad."** Leaderboard shows friends' *raw total screen time* and lets you
  set screen-time *challenges* with friends/family/colleagues. Ranking is on **raw hours**, i.e. pure
  meritocracy — no handicap. A naturally low-usage friend always "wins." Accepted because no money rides on it.
  ([Jomo App Store][jomo], [comparison][unhookd])
- **Opal.** Sessions are personal; the social layer is light. "Smart Schedules" and streaks are
  **per-user, against your own history** — closer to a Strava-style personal-baseline framing than a
  cross-user race. ([Opal Sessions FAQ][opal-sessions], [Opal screentime][opal-screentime])
- **ScreenZen.** No competition at all — "mental speed bumps," purely individual. ([comparison][unhookd])

Takeaway: the market's two coherent positions are **(a) rank on raw hours and accept that light users win**
(Jomo), or **(b) don't rank cross-user at all; rank yourself against yourself** (Opal). Nobody ships a
*handicapped cross-user money race*, because the moment you do, the "harder worker should get more money"
logic pulls you straight back toward a pool.

### 1.3 The options for the *block-set* question (what each member blocks)

This is the narrower, shippable version of the equity question: not "how do we score," but "what do we
require each member to block so the session feels symmetric." Three options:

| Option | What it means | Pros | Cons |
| --- | --- | --- | --- |
| **A. Everyone blocks N apps** | Session requires each member to select ≥ N apps (e.g. N=3). Which apps is personal. | Symmetric in *count*, personal in *content*. Cheap. Matches what FamilyControls can actually enforce (tokens are device-local). | A member can pick 3 apps they never open. Count ≠ effort. |
| **B. Everyone blocks a fixed list** | Proposer defines the blocked set (e.g. "IG, TikTok, YT"); all members block exactly that. | Truly symmetric. Easy to reason about. | **Impossible to enforce** server-side: `ApplicationToken`s are opaque + device-local (plan doc, correction #2). "Instagram" on A's phone is a different token than on B's; you cannot verify two members blocked "the same app." Also unfair to a member who doesn't even have that app. |
| **C. Top-N by each member's own screen time** | Each member blocks their own *top-N most-used* entertainment apps (surfaced from `DeviceActivityReport` averages). | Personalized **and** symmetric in count; targets each person's actual time-sinks; hardest to game (you're blocking what you actually use). | Needs a baseline (24h+ of report data); a brand-new install has nothing to rank. Requires the redesigned app-selection screen to show per-app daily averages. |

**Recommendation: ship A now, evolve toward C; never B.**

- **B is off the table** — opaque device-local tokens make a "same fixed list" literally unverifiable
  cross-device. This is already established in the plan doc.
- **A is what's effectively shipped today** — Phase 4's start-gate already requires *every member to have a
  non-empty selection* and shows each member's `appBlockSummary` ("Sarah: 6 apps · Social, Video") in the
  waiting room. Tighten "non-empty" to "≥ N" (config knob, default N=3) and you have option A with almost
  no new code.
- **C is the right north star** — it's the de-pool-safe descendant of the old cap-target idea: instead of
  *redistributing money* by baseline, you *personalize the block requirement* by baseline. Everyone blocks
  their own top-3 time-sinks → symmetric effort, no pool, no payout math. The baseline read already exists
  (`getScreenTimeBaseline()`, [group-equity.md](./group-equity.md) §Verification) and is sandbox-trusted.
  Gate C behind "has 24h+ baseline; otherwise fall back to A."

### 1.4 The "App Competitor Matrix" (waiting-room confirmation)

The founder's idea: before a group session starts, the waiting room / ticket shows **what each member is
blocking**, **flags risky *unblocked* entertainment apps** (a member has TikTok installed but didn't block
it), and **requires all members to confirm** before start.

This is a strong, de-pool-safe honesty mechanism and it's a small delta on what already exists:

- The **per-member summary already renders** in `app/session/waiting-room.tsx` (Phase 4:
  `appBlockSummary` → "Blocking 6 apps · Social, Video" / "No apps selected yet").
- **New piece — the "risky unblocked" flag.** `DeviceActivityReport` already knows each member's top apps
  by usage. Cross-reference: *(member's top entertainment apps) − (member's blocked selection) = exposed
  apps.* Surface as a soft warning on that member's row ("⚠ TikTok is one of Sarah's top apps and isn't
  blocked this session"). Show the **category/summary**, not raw token internals — same human-readable
  pattern Phase 4 uses. This is computed on-device per member and passed up as a summary; no token plumbing,
  consistent with correction #2.
- **New piece — explicit all-confirm gate.** Today the start-gate is "every member has a non-empty
  selection." Add a per-member **"I'm ready"** acknowledgement so each member has *seen the matrix* and
  confirmed. Proposer can't start until all green. This converts a silent gate into a social contract,
  which is the whole point of the matrix.

Recommendation: **build the matrix as a display + all-confirm layer, not an enforcement layer.** It makes
defection visible and socially costly (the real deterrent in an accountability group) without pretending we
can cryptographically verify block sets we provably cannot.

### 1.5 The meritocracy-vs-equity tradeoff (and the recommendation)

- **Meritocracy (raw hours):** rank purely on least screen time. Honest, simple, Jomo's model. **Cost:**
  the light user always wins; a heavy user grinding from 8h→4h looks worse than a light user idling at 1h,
  which is demotivating for exactly the people who most need the product.
- **Equity (handicapped / baseline-relative):** rank on *improvement vs your own baseline* (Strava-style).
  Rewards the heavy user's effort. **Cost:** harder to explain, gameable by inflating your baseline week,
  and — critically — *the more you handicap, the more it smells like a redistributive scoring system, which
  is the gambling-classification edge the de-pool was built to stay away from.*

**Recommendation for the leaderboard metric: keep completion-rate as the headline rank (already shipped,
de-pool-safe, money-neutral), and add baseline-relative "improvement" only as a *non-ranking, personal
stat* ("you cut your blocked-app time 38% vs your average").** That gives heavy users the dignity of seeing
their effort without turning the leaderboard into a handicapped money race. Equity shows up as *personal
progress*, meritocracy stays out of the money entirely. This is the cleanest reconciliation of the tradeoff
that doesn't reopen the legal question.

---

## 2. Anticheat — it's a money app, so this matters

**Framing:** the stake is the user's *own* money and the failure mode of cheating is *the user keeps their
own money they would otherwise have completed honestly to keep anyway.* There is **no other user to defraud**
(de-pool) and **no pool to drain.** So a cheat costs the *house* at most one forfeit it would have otherwise
collected — it does **not** let an attacker extract value from victims. That ceiling is what makes "good
enough" anticheat genuinely good enough here, and it's worth stating loudly because it changes the whole
risk calculus versus a pooled/PvP product.

### 2.1 Safari / web bypass (use instagram.com instead of the app)

**The hole:** block the Instagram *app* and the user opens `instagram.com` in Safari. App shield ≠ web shield.

**The fix — and it's already wired in this codebase.** Apple's `ManagedSettings` shields web domains the
same way it shields apps: `FamilyActivitySelection` carries `webDomainTokens` (and category tokens)
alongside `applicationTokens`, and you assign them to `store.shield.webDomains`. This is how Opal and one sec
block sites — both explicitly use `FamilyControls` + `ManagedSettings` + `DeviceActivity`, and one sec
documents Safari/Chrome website blocking via exactly this path. ([dev guide][devguide],
[one sec website blocking][onesec-web], [Opal web/domains FAQ][opal-domains])

In Niyah this is **already implemented** — the native module and both extensions shield web domains:

- `modules/niyah-screentime/ios/NiyahScreenTimeModule.swift:265` —
  `self.managedStore.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens`
- `targets/monitor/DeviceActivityMonitorExtension.swift:74-75` — same web-domain shield in the monitor.
- `targets/shieldconfig/ShieldConfigurationExtension.swift:95` + `targets/shieldaction/ShieldActionExtension.swift:37`
  — custom shield UI + action handling for `WebDomain` / `WebDomainToken`.

**So the bypass is mostly closed *if the user selects the website* in the picker.** The real gaps, both
documented limitations of Apple's API, not Niyah bugs:

- **Per-domain only, Safari-centric.** `webDomains` shields specific domains the user picked in the
  `FamilyActivityPicker`; there's no robust "all of category X across every browser" web shield. A user who
  blocks the IG *app* but never adds `instagram.com` is still exposed. **Mitigation:** the App Competitor
  Matrix (§1.4) should flag "you blocked the app but not the website" as a risky-unblocked warning, and the
  Top-N selection flow (§1.3 option C) should auto-suggest the matching domain when a user blocks an app
  that has an obvious web equivalent.
- **Private Relay / other browsers / private browsing** weaken domain shielding (Opal documents disabling
  Safari Private Browsing to make blocks stick). Out of scope to fully close — see §2.5.

### 2.2 Delete-the-app mid-session

**The hole:** the user deletes Niyah while a session is active. The app extensions are *bundled with the
app*, so deleting the app removes the extensions → `ManagedSettingsStore` shields stop being maintained →
blocks effectively lift. Reinstall later. (This is the same class of bypass kids use against parental
Screen Time — delete/reinstall — documented widely.) ([kids bypass screen time][jellies])

**Mitigations (two layers, neither perfect, both worth it):**

1. **Warn on delete intent (client, soft).** iOS doesn't give a reliable "app is being deleted" callback,
   so a true pre-delete interstitial isn't possible. What *is* possible: a prominent in-session warning in
   the active-session UI ("Session active — deleting Niyah forfeits your stake") and a re-open path that
   immediately re-asserts the shield and detects "you were gone." This is deterrence, not prevention.
2. **Server-side forfeit-on-heartbeat-loss (server, the real teeth).** Treat *the device going silent* as a
   surrender. The active client periodically checks in ("heartbeat"); if check-ins stop for longer than a
   grace window, a scheduled function treats the session as surrendered and forfeits the stake — the exact
   outcome the user was trying to dodge by deleting.

   **Build note — this does not exist yet.** The closest existing thing is
   `autoTimeoutGroupSessions` (`functions/src/index.ts:6507`, `every 5 minutes`), but it only times out
   sessions still in **`ready`** (pre-start) state and *refunds* them. There is **no** watchdog that
   forfeits an **active** session on heartbeat loss. To add it:
   - Active client writes `lastHeartbeatAt` (serverTimestamp) on an interval (e.g. every 60s) — for solo
     sessions on the session doc, for group on `participants.{uid}`.
   - New `onSchedule` watchdog: find active sessions whose `lastHeartbeatAt` is older than
     `sessionEndAt`-bounded grace (e.g. > 3–5 min stale **and** still within the session window) and route
     them through the **existing** forfeit path (`handleSessionForfeit` / the surrender branch in
     `reportSessionStatus`, `functions/src/index.ts:5949`). Reuse the existing idempotent forfeit logic;
     do **not** write a second money path.
   - Guardrail: this touches the money path → `/vibe-security` before commit, idempotency key per
     forfeit, and a grace window generous enough that a backgrounded app or flaky network doesn't wrongly
     forfeit an honest user (false-forfeit on a money product is worse than a missed cheat).

   This converts "delete the app" from a *free escape* into *the thing you were already going to lose
   anyway*, which removes the incentive entirely.

### 2.3 Idle / second-phone cheating & FamilyControls limits

- **Second phone.** User blocks IG on phone A (running the session) and scrolls IG on phone B. FamilyControls
  is **per-device** — Niyah can only shield the device it's installed on. There is no cross-device account
  shield. This is uncloseable on iOS and every competitor has the same hole.
- **Idle / leave the phone.** User just sets phone A down and uses a laptop / another device. The cap-target
  doc already flagged this ("a user could complete by switching to a laptop," [group-equity.md][ge] §Open
  questions). Same ceiling: they kept their own money; nobody else lost.
- **Picture-in-Picture / backgrounding** can under-count usage on Apple's own Screen Time accounting
  (documented bypass), which affects any *usage-threshold* feature (less relevant to us since we shield
  rather than meter, but relevant if we ever rank on measured minutes).
- **Toggling Screen Time API access in Settings.** A user can revoke the FamilyControls authorization in iOS
  Settings, which neuters any third-party blocker. Documented as the fundamental weakness of the framework
  for self-control (vs parent-locked) use. ([API can be disabled][riedel], [Apple forum][appleforum])
  **Detectable:** the client can observe authorization status flip to denied → treat as a heartbeat-class
  event (warn, and feed the same forfeit-on-tamper logic as §2.2).

### 2.4 The honest reality + "good enough" definition

App blocking on a user's *own* device, where the user *wants* (in the moment of weakness) to defeat it, is
**defeatable infinitely.** This is an accepted, openly-documented truth across the category — one sec's own
docs concede the API's limitations make some bypasses impossible to fully prevent; the framework can be
toggled off in Settings; delete/reinstall always works. ([one sec API issues][onesec-issues],
[riedel.wtf][riedel]) Niyah should not pretend otherwise internally.

**"Good enough" anticheat for *this* money product, in scope:**

1. **Both surfaces shielded** — apps **and** web domains (done; §2.1). No trivial Safari bypass for a
   selected app's site.
2. **Going dark = forfeit** — heartbeat-loss / auth-revocation / delete are routed to the existing forfeit
   path (§2.2 — to build). Removes the *incentive* to bypass, which matters more than blocking the *mechanism*.
3. **Defection is visible** — the App Competitor Matrix + violation push (`member_app_opened`, already wired,
   plan doc Phase 2) make cheating socially costly in a group. Social cost is the strongest real deterrent.
4. **Honest-by-default friction** — the point is to make the *easy* path the honest one and the cheat path
   annoying enough that a motivated-but-weak user (our actual user) doesn't bother.

**Explicitly out of scope (and why it's acceptable):**

- Second-device usage, laptop/desktop usage, jailbreak, revoking the entitlement and reinstalling — all
  uncloseable on iOS and shared by every competitor.
- The reason it's acceptable is the de-pool ceiling (§2 framing): **a cheater can only fail to lose their
  own stake; they cannot take anyone else's money and cannot drain a pool.** The maximum adversary payoff
  is "kept my own money," which is not an attack worth engineering against. Document this in the threat
  model so nobody over-invests later.
- **Where we *would* invest more:** any path that lets a user extract *house* money or *Earned* balance they
  didn't legitimately earn (withdrawal abuse, refund abuse). That's a different threat class, already
  defended (withdrawal eligibility gate: 5 completed sessions + 2 distinct friends; new-account farming
  guard, [group-equity.md][ge] §Anti-cheat) and is where security effort belongs — not in chasing the
  uncloseable on-device blocking bypasses.

### 2.5 Anticheat — summary table

| Vector | Closeable? | Niyah status / action |
| --- | --- | --- |
| Safari/web instead of app | Mostly (per-domain) | **Shipped** — `webDomains` shield in module + monitor + shield extensions. Gap: user must select the domain → Matrix flags "app blocked, site open." |
| Delete app mid-session | Incentive-closeable | **To build** — warn in-session + server forfeit-on-heartbeat-loss via existing forfeit path (no watchdog exists yet). |
| Revoke Screen Time auth in Settings | Detectable, not preventable | Detect auth flip → treat as forfeit-class event (warn + forfeit logic). |
| Second phone / laptop | No (per-device API) | **Out of scope.** De-pool ceiling makes it low-value. Document in threat model. |
| Idle phone, use other device | No | **Out of scope**, same reasoning. |
| Withdraw/refund abuse | Yes — and we do | **Defended** — eligibility gate + farming guard. This is where anticheat effort actually belongs. |

---

## 3. Session cadence

### 3.1 Daily vs weekly

**Recommendation: daily sessions as the primitive, rolled up into a weekly view.** The
instant-gratification loop is the product's engine — a money session you complete *today* gives a same-day
hit (streak grows, stake returns, daily stat ticks). This is exactly the loop Opal leans on with daily
streaks and gems ("every day you stay focused, your streak grows"). ([Opal screentime][opal-screentime])

- **Daily = the unit of commitment and the unit of the dopamine payoff.** Running daily stats (sessions
  completed today, blocked-app time avoided today, today's streak) roll up into a **weekly standings view**
  for the group (the Phase-3 completion-rate leaderboard, aggregated over the week).
- **Weekly** works as the *competition window / settlement summary*, not the commitment unit — "this week
  Sarah completed 6/7, you completed 5/7." Don't make the user wait a week for their first reward.

Each daily session is still independently de-pooled (stake → complete → own stake back); "weekly" is purely
a *view* over daily results, never a separate money event. This keeps the legal model untouched.

### 3.2 The blank-scheduler problem → default templates

A blank scheduler is a conversion killer — Opal's whole "Smart Schedules" pitch is "set it once and forget
it; we block automatically so you don't have to remember." ([Opal screentime][opal-screentime]) Niyah should
**never** show an empty time picker as the first experience. Ship **default schedule templates** the user
taps once:

- **Workday (9–5)** — block during standard work hours, weekdays.
- **Deep morning (6–11am)** — protect the morning block.
- **Opal-style focus blocks** — a couple of short recurring deep-work sessions.
- **Custom** — the blank picker, but as the *last* option, not the default.

Templates reduce the cold-start to one tap and teach the mental model ("sessions are scheduled commitments")
without a form. (Note: Opal gates *recurring* schedules behind Pro — a monetization signal worth remembering,
but the *templates* themselves should be free or the cold-start problem just moves behind a paywall.)

### 3.3 "Wild West / Zen mode" — tracking-only, no shield

A **tracking-only mode** that ranks members by *least screen time* with **no blocking shield** is a good
low-friction on-ramp (mirrors Jomo's Focus Club raw-screen-time leaderboard and ScreenZen's lightweight
ethos). It lets skittish users join the social loop before they trust the app to block anything.

**Hard guardrail (legal):** Zen mode is fine **only as long as no money pools between users.** Under de-pool
that's automatically true — but it must be stated and enforced because a *scored, money-attached, ranked*
mode is precisely the construct that reopens the gambling-classification question
([group-equity.md][ge] header). So:

- **Zen mode = no stake, or stake stays strictly de-pooled (your own money, your own completion).** Ranking
  on least-screen-time is allowed; ranking that *moves money between rankers* is not.
- Keep Zen-mode ranking as **bragging-rights only** (the completion-rate / screen-time leaderboard), never
  as a payout input. If money is ever attached to a Zen session, it must be the same solo de-pool contract
  (complete your own goal → your own stake back), not "lowest screen time takes the pot."

---

## 4. Solo-dev multi-phone testing framework

Goal: let Fardeen test **multi-user group sessions** across his ~5 spare iPhone 13/14s, with **limited phone
numbers**, on a **TestFlight beta** build, and run a repeatable **cross-phone live-session** loop (exceed
screen time on phone B, watch it surface on phone A).

### 4.1 The core constraint: don't fork accounts off one phone number or one Gmail

Niyah's account model **merges on verified contact** (phone/email): per the account-merge work, phone/email
are locked on the profile after create and merge uses auth-verified contacts. **Consequence:** if you sign
two phones into accounts that share the *same verified phone number or the same verified Gmail*, Firebase
will treat them as the **same user** (or merge them), and you will *not* have two distinct members for a
group test. You need **N genuinely distinct identities for N phones.**

The clean way to get distinct identities **without N phone numbers**:

- **Use Sign in with Apple, one distinct Apple ID per phone.** Sign in with Apple needs an Apple ID, **not a
  phone number**, to authenticate the app — so each phone signed into its own Apple ID gives you a distinct,
  phone-number-free Niyah identity. ([Apple ID / SIWA][siwa])
- **Use Hide My Email per account** so each Apple ID yields a unique `@privaterelay.appleid.com` address →
  Firebase sees a **distinct verified email per phone**, no merge, no real inbox to manage. (Requires iCloud+
  on the Apple IDs.) ([Hide My Email][hidemyemail])
- **Avoid** phone-SMS OTP for the test fleet — that's the path that burns your scarce phone numbers and
  triggers the merge-on-phone behavior. Reserve SMS-OTP testing for one or two phones where you specifically
  need to exercise that auth path.

Practical Apple-ID note: each spare phone should ideally be signed into **its own Apple ID at the iOS
Settings level** (not just inside TestFlight) so Sign in with Apple / Hide My Email is frictionless on that
device. Label the phones physically (P1…P5) and keep a local-only scratch list mapping
*phone → Apple ID → Niyah display name* so you don't lose track mid-test.

### 4.2 Install path: TestFlight (internal)

- Add each tester Apple ID as an **internal tester** in App Store Connect (internal testers are team members
  with a role; up to 100; they get builds without the external review delay). Each distinct Apple ID gets
  its own TestFlight invite. ([TestFlight][testflight])
- A single Apple ID can run the build on multiple of *its own* devices, but for a multi-*user* test you want
  **one Apple ID per phone** (see 4.1) — so send/accept a separate invite per phone.
- Install the TestFlight app on each phone → accept that phone's invite → install the Niyah beta build.
- For pure *flow* iteration (UI, navigation, session state machine) you don't even need TestFlight — a
  `pnpm build:local` dev-client build on a USB-tethered phone is faster. Use TestFlight for the fleet test
  where you need the real distribution build behaving as users will get it.

### 4.3 DEMO_MODE build for flow testing

For fast multi-user *flow* testing without burning real money or waiting on real timers, build with
`EXPO_PUBLIC_DEMO_MODE=true` (`src/constants/config.ts:70`):

- Real Firebase auth (so distinct accounts + invites are real), **short session timers**, **$50 starting
  balance**, and **Cloud Function money calls skipped** (CLAUDE.md §Demo Mode, [features.md]). This lets you
  run a full invite → accept → start → complete/surrender loop across phones in seconds, repeatedly, with no
  Stripe movement.
- Note: `SHORT_TIMERS` is also independently toggleable (`EXPO_PUBLIC_SHORT_TIMERS=true`,
  `src/constants/config.ts:74`) if you want real money paths but fast timers.
- **Do the money-path (live Stripe) cross-phone test only once flow is solid**, and only on accounts you're
  willing to run through real charges/refunds — and never on the **frozen drifted test account
  `cMtHvQkJJZOgU6pgYARj8nN5Wpf1`** (CLAUDE.md gotcha).

### 4.4 Resetting an account between test runs

Two very different operations — know which you want:

- **Sign out (reversible, the default for iteration).** Signs the phone out of the Niyah identity; the
  account, balance, and history **persist** server-side. Use this to hand a phone to a different test
  identity, or to re-test the sign-in flow. **No money is touched.** This is your everyday reset.
- **Delete account with refund (IRREVERSIBLE, live money).** The in-app account-deletion path fires a **live
  Stripe refund** and tears down the account — per CLAUDE.md, deletion/withdrawal are *irreversible live
  paths* on a `sk_live_` key. **Do not use this as a routine reset.** Only exercise it deliberately when the
  thing under test *is* the deletion/refund flow, on a throwaway account, knowing the money moves for real.
- **Cleanest repeatable reset:** prefer **DEMO_MODE accounts** (no real money) for loops, and **sign-out**
  to recycle a phone. Reserve real delete-with-refund for one-off verification of that specific flow.
- For a fully fresh identity without deleting: create a **new Apple ID + Hide My Email** (4.1) → new distinct
  Niyah account, old one left intact. This is the "spin up a clean tester" move when you've dirtied an account.

### 4.5 The repeatable loop (invites + live cross-phone session monitoring)

Concrete, step-by-step. Assume P1 (your "watcher") and P2 (your "cheater"), extend to P3–P5 for bigger groups.

**One-time setup (per phone):**
1. Sign each phone into its **own Apple ID** at iOS Settings level (P1…P5), iCloud+ on for Hide My Email.
2. Install **TestFlight**, accept that phone's **internal** invite, install the Niyah beta (DEMO_MODE build
   for flow loops; live build only for money verification).
3. In Niyah, **Sign in with Apple → Hide My Email** on each phone → distinct account. Set a recognizable
   display name (P1, P2, …). Confirm in your scratch list that each is a *distinct* uid (no merge).
4. On each phone, grant **Screen Time / FamilyControls** permission and pre-select a block list in the picker
   (include at least one **website domain**, e.g. add `instagram.com`, so you can test the §2.1 web shield).

**Per test run (group invite + cross-phone monitoring):**
5. **P1 proposes** a group session, selects its apps, sets a (short, in DEMO_MODE) duration, and **invites P2**
   (and P3–P5). Invite goes out via the real invite path (`groupInvites`).
6. **P2 accepts** the invite. Watch the **waiting room** on both phones: each member's `appBlockSummary`
   renders, and the **start-gate** stays disabled until *every* member has a non-empty selection (Phase 4).
   This is your check that the App Competitor Matrix / start-gate works across real devices.
7. **P1 starts** the session once all members are ready. Confirm the shield activates on each phone
   (try opening a blocked app *and* `instagram.com` in Safari → both should hit the custom shield).
8. **Cross-phone live monitoring (the headline test):** on **P2**, tap through to a blocked app / blocked
   site to trigger the shield. The shield-action path records a violation
   (`niyah_shield_violations`, plan doc Phase 2) → 2s poll → `reportShieldViolation` CF →
   `member_app_opened` push. **On P1**, confirm the **violation push arrives** and the standing/leaderboard
   reflects it. This is the "exceed on B, watch on A" loop. *(Phase 2 is a native change — needs a
   `build:local`/TestFlight build that includes the `ShieldActionExtension` fix; it won't appear in a JS-only
   hot-reload.)*
9. **End states:** have **P2 surrender** (confirm `session_surrender` push → P1 nav to active session, plan
   doc Phase 1/4a) and **P1 complete** (confirm de-pool: P1 gets its own stake back at 1.0×; P2's surrender
   does **not** change P1's outcome — the core de-pool invariant, verify it holds on real devices).
10. **Reset for next run:** in DEMO_MODE just start a new session (balances are demo). To recycle a phone for
    a different identity, **sign out** (4.4) — never delete-with-refund as a routine reset.

**What this loop validates end-to-end:** distinct multi-user accounts (no merge), real invite/accept,
waiting-room start-gate + per-member summaries, app **and web** shielding, cross-phone violation push,
surrender push + nav, and the de-pool payout invariant — all the moving parts of group sessions, on the
real distribution build, without burning phone numbers or real money.

---

## 5. Recommendations at a glance

| Area | Recommendation |
| --- | --- |
| **Block-set equity** | Ship **option A** (everyone ≥ N apps — tiny delta on shipped start-gate); north-star **option C** (each member's own top-N by usage). **Never B** (fixed list is unverifiable: opaque device-local tokens). |
| **App Competitor Matrix** | Build as **display + all-member confirm**, not enforcement. Flag risky *unblocked* top apps (incl. "app blocked, site not"). Social visibility is the deterrent. |
| **Leaderboard metric** | Keep **completion-rate** as the rank (shipped, de-pool-safe). Add baseline-relative *improvement* only as a **personal, non-ranking stat** — gives heavy users dignity without a handicapped money race. |
| **Web bypass** | **Already shipped** (`webDomains` shield). Gap: user must select the domain → Matrix flags it; auto-suggest matching domain in selection. |
| **Delete / go-dark** | **Build** server **forfeit-on-heartbeat-loss** via the *existing* forfeit path (no watchdog exists for active sessions yet) + in-session warning. Detect auth revocation the same way. `/vibe-security` the diff. |
| **Anticheat ceiling** | Second-phone/laptop/idle are **out of scope** — uncloseable on iOS, and de-pool caps the adversary payoff at "kept own money." Invest security effort in **withdrawal/refund abuse** instead (already gated). |
| **Cadence** | **Daily** commitment + same-day reward; **weekly** as the rollup/standings *view*. Each daily session independently de-pooled. |
| **Scheduler** | **Default templates** (Workday 9–5, Deep morning 6–11, Opal-style blocks, Custom last). Never a blank picker first. |
| **Zen mode** | Tracking-only, least-screen-time ranking = fine **only** as bragging rights with **no money pooling**. If money is attached, it must be the same solo de-pool contract. |
| **Multi-phone testing** | One **Apple ID + Hide My Email per phone** (no phone numbers, no merge) → Sign in with Apple → internal **TestFlight** → **DEMO_MODE** for flow loops → **sign-out** to recycle (never delete-with-refund routinely). |

---

## Sources

- [A Developer's Guide to Apple's Screen Time APIs (FamilyControls / ManagedSettings / DeviceActivity)][devguide]
- [one sec — blocking Safari/Chrome websites][onesec-web] · [one sec — Screen Time API issues][onesec-issues]
- [Opal — web/domains FAQ][opal-domains] · [Opal — Sessions][opal-sessions] · [Opal — screentime/Smart Schedules][opal-screentime]
- [Jomo — App Store][jomo] · [Social-media blocker comparison (Jomo/ScreenZen)][unhookd]
- [Screen Time API can be disabled / state-of-the-API 2024 (riedel.wtf)][riedel] · [Apple Developer Forum — API toggle][appleforum]
- [How kids bypass Screen Time (delete/reinstall, PiP)][jellies]
- [Sign in with Apple — Hide My Email][hidemyemail] · [What is Sign in with Apple][siwa] · [TestFlight][testflight]
- Internal: [docs/group-equity.md][ge] · [docs/plan-2026-06-02-group-blocking-leaderboard.md](./plan-2026-06-02-group-blocking-leaderboard.md)

[devguide]: https://medium.com/@juliusbrussee/a-developers-guide-to-apple-s-screen-time-apis-familycontrols-managedsettings-deviceactivity-e660147367d7
[onesec-web]: https://one-sec.app/blog/blocking-safari-websites/
[onesec-issues]: https://tutorials.one-sec.app/en/articles/3036354
[opal-domains]: https://opalapp.com/help/can-i-add-my-own-websites-domains
[opal-sessions]: https://opalapp.com/help/what-are-sessions
[opal-screentime]: https://opalapp.com/screentime
[jomo]: https://apps.apple.com/us/app/jomo-screen-time-blocker/id1609960918
[unhookd]: https://unhookd.app/blog/social-media-blocker-comparison
[riedel]: https://riedel.wtf/state-of-the-screen-time-api-2024/
[appleforum]: https://developer.apple.com/forums/thread/727291
[jellies]: https://jelliesapp.com/blog/kids-bypassing-screen-time/
[hidemyemail]: https://support.apple.com/en-us/105078
[siwa]: https://support.apple.com/en-us/102609
[testflight]: https://developer.apple.com/testflight/
[ge]: ./group-equity.md
