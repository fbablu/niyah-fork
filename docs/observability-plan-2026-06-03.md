# Observability & Click Analytics Plan — 2026-06-03

> **Goal:** Let the founder see "what users click" — funnels, drop-off, and per-event engagement —
> for UX iteration and to show traction to investors at NY Tech Week (NYC, ~June 1–7, 2026).
> **Constraint:** Solo dev, must ship **this week**. Lean toward fastest-to-value.
>
> **TL;DR recommendation:** Ship **PostHog (react-native)** tonight as the funnel/click product,
> wired as a thin second sink behind the **existing** `logEvent()` wrapper. Keep the current
> Firestore `analytics_events` write as-is (it already feeds `aggregateDailyMetrics`). Do **not**
> rip anything out. See [§3](#3-recommendation) for why PostHog over GA4/Amplitude.

---

## 1. What already exists (build on this — not greenfield)

There is a working analytics scaffold. Do not replace it; extend it.

- **Wrapper:** `src/utils/analytics.ts` — `logEvent(name, props)`. Fire-and-forget, never throws.
  Already does two useful things on every call:
  1. `addBreadcrumb("analytics", name, props)` → Sentry crash context.
  2. `addDoc(collection(db, "analytics_events"), { userId, name, props, createdAt })` → Firestore.
  Skips the Firestore write when `DEMO_MODE` is true.
- **Firestore rules:** `firebase/firestore.rules` (the `analytics_events/{eventId}` block) shape-locks
  writes to exactly `['name','userId','props','createdAt']`, caps `name` at 64 chars, and requires
  `request.auth != null`.
- **Index + rollup:** `firebase/firestore.indexes.json` has an `analytics_events` collection-group
  index; a Cloud Function `aggregateDailyMetrics` reads server-side into `metrics/{YYYY-MM-DD}`.
- **Events already instrumented today** (grep `logEvent` across `src` + `app`):

  | Event | Call site |
  | --- | --- |
  | `app_open` | `app/_layout.tsx` (fires in a top-level `useEffect`, **pre-auth**) |
  | `auth_complete` | `src/store/authStore.ts` |
  | `account_merge_queued` | `src/store/authStore.ts` |
  | `profile_complete` | `src/store/authStore.ts` |
  | `solo_session_started` / `solo_session_surrendered` / `solo_session_completed` | `src/store/sessionStore.ts` |
  | `deposit_initiated` / `deposit_completed` | `app/session/deposit.tsx` |
  | `withdrawal_requested` | `app/session/withdraw.tsx` |
  | `kyc_intake_submitted` / `kyc_connect_account_created` | `app/session/verify-identity.tsx` |

  > Naming is inconsistent (`solo_session_started` vs `deposit_initiated`). The new plan
  > standardizes on `noun_verb` (see [§5](#5-event-taxonomy)). Keep emitting the old names **and**
  > the new ones during the transition, or alias in the wrapper — don't break the rollup.

### 1a. The known bug: `logEvent failed: app_open [permission-denied]`

**Root cause (confirmed in the rules file):** the `analytics_events` create rule requires
`request.auth != null`. But `app_open` is fired in a top-level `useEffect` in `app/_layout.tsx`
**before the user signs in**, so `getAuth().currentUser` is `null` and there is no auth context on
the request → Firestore rejects with `permission-denied`. The wrapper's comment even claims
"`userId` may be null for pre-auth events," but the rule's `request.auth != null` gate contradicts
that — so every pre-auth event is silently dropped (logged as a `logger.warn`, not user-visible).

**This is exactly why a dedicated analytics product helps:** PostHog/GA4 capture pre-auth and
anonymous events natively (anonymous distinct-id, then alias on login), so your **top-of-funnel**
(install → app_open → first onboarding step) is measurable without fighting Firestore rules.

**Two fixes — do both:**

- **Option A (rules, optional):** allow unauthenticated create **only** when `userId == null`:
  ```
  // firebase/firestore.rules — analytics_events create
  allow create: if request.resource.data.keys().hasOnly(['name','userId','props','createdAt'])
    && request.resource.data.name is string
    && request.resource.data.name.size() <= 64
    && (
         (request.auth == null && request.resource.data.userId == null)
      || (request.auth != null &&
            (request.resource.data.userId == null
             || request.resource.data.userId == request.auth.uid))
       );
  ```
  > **Security note:** opening any unauthenticated write is abuse surface (storage/billing, rollup
  > pollution). The shape-lock + 64-char cap limit it, but this is a money-adjacent file — run
  > `/vibe-security` on the diff before Fardeen deploys, and confirm App Check covers anonymous
  > writes. If you'd rather not widen the rule at all, prefer **Option B** and just let pre-auth
  > `app_open` live in PostHog only. **Recommended: Option B alone for this week** — don't touch a
  > money-adjacent rules file under time pressure.
- **Option B (recommended this week):** route top-of-funnel events to **PostHog** (anonymous capture
  works out of the box) and let `analytics_events` keep only the authenticated events it already
  handles. No rules change, no deploy risk.

---

## 2. Options compared (solo dev, ship this week)

| | **Firebase Analytics / GA4** | **PostHog (recommended)** | **Amplitude** |
| --- | --- | --- | --- |
| New infra | None — you already have Firebase | One SDK + one project | One SDK + one project |
| RN/Expo support | `@react-native-firebase/analytics` (you already use RNFirebase v23) | `posthog-react-native` (Expo-friendly, no custom native beyond supported Expo packages) | `@amplitude/analytics-react-native` |
| Funnels UI | GA4 "Funnel exploration" — powerful but **GA4 reporting is slow/clunky**, events lag hours, UI is built for web | First-class funnels, **live**, click-through to session replays | Best-in-class funnels/retention (longest mobile track record) |
| Session replay | No | **Yes** (mobile replay, beta, RN ≥ 3.2.0) | Add-on |
| Event latency to dashboard | Hours (GA4 batch) — bad for a live demo | Minutes — good for "watch it update" in front of investors | Minutes |
| Free tier | Effectively unlimited events | 1M events/mo, 5,000 replays/mo, feature flags, error tracking | Starter: ~10K MTU / up to 2M events; pricing by Monthly Tracked Users |
| Pricing model | Free | Per-event (transparent, published) | Per-MTU (Growth/Enterprise = contact sales) |
| Time-to-first-funnel | ~½ day, but funnels are painful to read | **~1–2 hrs**, funnels readable immediately | ~½ day |
| Founder "show investors" fit | Weak (GA4 dashboards read as marketing, not product) | **Strong** (product-analytics dashboards + replays = "we know our users") | Strong, but slower to stand up tonight |

---

## 3. Recommendation

**Ship PostHog (`posthog-react-native`) tonight**, wired as a second sink behind the existing
`logEvent()` wrapper. Reasoning, given the hard constraint (ship this week, solo, already on Firebase):

1. **Fastest to a readable funnel.** PostHog funnels are usable within an hour of sending events;
   GA4's "Funnel exploration" is the slowest part of the Firebase stack and its data lags hours —
   bad when you want to demo "look, users moving through onboarding" at Tech Week.
2. **Anonymous / pre-auth capture is free and native** — directly solves the `app_open
   permission-denied` top-of-funnel gap without widening a money-adjacent Firestore rule under time
   pressure.
3. **Session replay** lets the founder literally watch "what users click" — exactly the ask — and
   each replay links from a funnel drop-off point.
4. **Generous free tier** (1M events/mo) is far beyond pilot/TestFlight volume; zero cost now.
5. **Keep Firebase too.** GA4 is "already there for free," but it's the *worst* of the three at the
   specific job asked (funnels/clicks fast). Don't choose it as the primary just because it's free —
   you keep the Firebase `analytics_events` rollup for server-side metrics regardless.

> If the founder specifically wants the most polished mobile retention/funnel charts and has a day,
> Amplitude is the runner-up. PostHog wins on *tonight* + *session replay* + *anonymous capture*.

---

## 4. Install & wiring (exact steps)

> All code below is for the **main session** to apply. This doc does not edit `app/` or `src/`.

### 4.1 Install

```bash
# Core SDK (+ peer deps Expo needs)
pnpm add posthog-react-native expo-file-system expo-application expo-device expo-localization

# Optional: mobile session replay (RN SDK >= 3.2.0). Adds a native module —
# rebuild the dev client after installing. Skip if you only want events tonight.
pnpm add posthog-react-native-session-replay
```

Add the PostHog key as a public env var (it's a write-only client key, safe to ship):

```bash
# .env  (and mirror in .env.example WITHOUT the value)
EXPO_PUBLIC_POSTHOG_KEY=phc_xxx_your_project_api_key
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

`app.config.js` already surfaces `EXPO_PUBLIC_*` to the client at build time — no extra config.
After adding the native replay package, rebuild the dev client (`pnpm build:local`); the events-only
path needs no rebuild beyond the JS bundle.

### 4.2 Provider (new file — main session creates it)

```tsx
// src/config/posthog.ts
import PostHog from "posthog-react-native";

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // We send events explicitly via logEvent(); don't double-count.
    captureAppLifecycleEvents: true, // app_open/backgrounded — free top-of-funnel
    // Privacy: never autocapture deposit amounts etc. We control the payload.
    disabled: process.env.EXPO_PUBLIC_DEMO_MODE === "true",
  },
);
```

Mount the provider once at the root (main session edits `app/_layout.tsx`):

```tsx
// app/_layout.tsx — wrap the existing tree
import { PostHogProvider } from "posthog-react-native";
import { posthog } from "../src/config/posthog";

// ...inside RootLayout return, wrap the top-level navigator:
<PostHogProvider client={posthog} autocapture={false}>
  {/* existing app tree */}
</PostHogProvider>;
```

> `autocapture={false}` on purpose: this app has money screens; we send a **curated** event set
> ([§5](#5-event-taxonomy)) rather than capturing every tap (avoids leaking amounts/PII and keeps
> funnels clean). Session replay (if installed) still records screens with masking.

### 4.3 Make `logEvent()` a fan-out (the one edit that matters)

Keep the public API identical so all existing call sites keep working. Add PostHog + identify.
**Main session applies this to `src/utils/analytics.ts`:**

```ts
// src/utils/analytics.ts  (additions only — keep existing Firestore write)
import { posthog } from "../config/posthog";

export async function logEvent(name: string, props: EventProps = {}): Promise<void> {
  addBreadcrumb("analytics", name, props);

  // 1) New: PostHog sink. Works pre-auth (anonymous distinct-id) — fixes the
  //    app_open top-of-funnel gap with zero rules changes.
  try {
    posthog.capture(name, props);
  } catch {
    /* never throw */
  }

  // 2) Existing: Firestore milestone write (unchanged). Tests + demo skip.
  if (DEMO_MODE) return;
  try {
    const uid = getAuth().currentUser?.uid ?? null;
    const db = getFirestore();
    await addDoc(collection(db, "analytics_events"), {
      userId: uid,
      name,
      props,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    logger.warn("logEvent failed:", name, err);
  }
}

// Call once right after sign-in (from authStore, in/near the existing
// auth_complete emit) so anonymous pre-auth events stitch to the real user.
export function identifyUser(uid: string, traits: EventProps = {}): void {
  try {
    posthog.identify(uid, traits);
  } catch {
    /* never throw */
  }
}

// Call on sign-out so the next user starts a fresh anonymous id.
export function resetAnalytics(): void {
  try {
    posthog.reset();
  } catch {
    /* never throw */
  }
}
```

Then in `src/store/authStore.ts`, next to the existing `logEvent("auth_complete", …)`, call
`identifyUser(uid, { authProvider })`; and in the sign-out path call `resetAnalytics()`.

> **Net effect:** every existing `logEvent(...)` call already in the codebase now *also* lands in
> PostHog with no per-call-site changes. You only need to **add** the missing events in [§5](#5-event-taxonomy).

---

## 5. Event taxonomy — the ~8–12 funnels/events to track

Naming convention: lowercase `noun_verb`, snake_case, ≤ 64 chars (Firestore rule cap). Props are
small scalars only (no PII, no raw amounts in event *names*). Amounts go in props as integer cents.

Aliases below keep the existing names working — emit both during transition where noted.

### 5.1 Onboarding funnel (step views + drop-off)

The onboarding screens (from `app/(auth)/`) in order: `welcome` → `auth-entry` →
`phone-entry`/`check-email` → `verify-phone` → `profile-setup` → `how-it-works` →
`screen-time-math` → `screentime-setup` → `screentime-baseline` → `intake`.

Fire one event per screen view so PostHog renders the drop-off funnel:

```ts
// In each onboarding screen's mount effect (main session adds these):
import { logEvent } from "../../src/utils/analytics";

// app/(auth)/welcome.tsx
useEffect(() => { logEvent("onboarding_step_viewed", { step: "welcome", index: 1 }); }, []);
// app/(auth)/auth-entry.tsx
useEffect(() => { logEvent("onboarding_step_viewed", { step: "auth_entry", index: 2 }); }, []);
// app/(auth)/profile-setup.tsx
useEffect(() => { logEvent("onboarding_step_viewed", { step: "profile_setup", index: 5 }); }, []);
// app/(auth)/screentime-setup.tsx
useEffect(() => { logEvent("onboarding_step_viewed", { step: "screentime_setup", index: 8 }); }, []);
// ...one per screen, incrementing `index`
```

> In PostHog, build a **funnel** on `onboarding_step_viewed` broken down by the `step` property
> (ordered). That single event powers the whole onboarding drop-off chart. `profile_complete`
> (already emitted) marks funnel completion.

### 5.2 Screen Time authorization (granted / denied)

This is the highest-stakes drop-off in the app (no Screen Time auth = no product). The native module
lives in `modules/niyah-screentime/`. Wrap the `requestAuthorization` result where it's called
(`app/(auth)/screentime-setup.tsx`):

```ts
// where the FamilyControls authorization promise resolves:
try {
  await NiyahScreenTime.requestAuthorization();
  logEvent("screentime_auth_granted");
} catch {
  logEvent("screentime_auth_denied"); // user declined the system prompt
}
```

App-selection completed (user picked apps to block):

```ts
// after the FamilyActivityPicker returns a non-empty selection:
logEvent("app_selection_done", { appCount: selection.applicationTokens.length });
```

### 5.3 Deposit funnel (start / success / fail)

Already partly instrumented in `app/session/deposit.tsx` — standardize and add the failure case:

```ts
logEvent("deposit_started", { amountCents: finalAmount });          // alias of existing deposit_initiated
logEvent("deposit_succeeded", { amountCents: finalAmount });        // alias of existing deposit_completed
// NEW — add in the catch / payment-failed branch:
logEvent("deposit_failed", { amountCents: finalAmount, reason: errorCode ?? "unknown" });
```

> Keep emitting `deposit_initiated`/`deposit_completed` too until the `aggregateDailyMetrics` rollup
> is updated, or the daily metrics doc loses those counts.

### 5.4 Session funnel (start / complete / surrender)

Already instrumented in `src/store/sessionStore.ts` as `solo_session_started` /
`solo_session_completed` / `solo_session_surrendered`. These work as-is for PostHog funnels — no new
code needed. (Optionally add `session_*` aliases later for naming consistency.) Build the funnel:
`solo_session_started` → `solo_session_completed`, with `solo_session_surrendered` as the drop step.

> Copy guardrail reminder: keep using **complete / surrender / stake / commitment** in any
> user-facing strings near these. Never bet/wager/gamble/win/pool.

### 5.5 Withdraw

Already emits `withdrawal_requested` in `app/session/withdraw.tsx`. Add success/fail to close the loop:

```ts
logEvent("withdraw_started", { amountCents });   // alias of existing withdrawal_requested
// in the Cloud Function callback resolve / reject:
logEvent("withdraw_succeeded", { amountCents });
logEvent("withdraw_failed", { amountCents, reason: code ?? "unknown" });
```

### 5.6 Invites (shared / opened)

The invite share UI is in `app/session/invites.tsx`; the deep-link landing pages are
`landing-pg/app/join/page.tsx` and `landing-pg/app/i/page.tsx`.

```ts
// app/session/invites.tsx — after the native Share sheet resolves "shared":
logEvent("invite_shared", { channel: "system_share" });

// On the deep-link accept screen (when the app opens from a /join or /i universal link):
logEvent("invite_opened", { source: "universal_link" });
```

### 5.7 Waitlist signup (landing site)

The landing form is `landing-pg/components/waitlist/waitlist-form.tsx` (Next.js — separate app, not
RN, so PostHog **web** snippet, not the RN SDK). Track conversion on the marketing site:

```tsx
// landing-pg — install posthog-js, init in a client provider, then on submit success:
posthog.capture("waitlist_signed_up", { source: "landing_hero" });
```

> The landing site is a separate codebase; if you only have time for the app tonight, do the RN
> events first and add `posthog-js` to `landing-pg` tomorrow. Keep landing copy clean (no
> bet/wager/win/pool; no "$5/$5 match"; it's TestFlight beta, not "live on the App Store").

### 5.8 Event summary table

| # | Event | Where | Status |
| --- | --- | --- | --- |
| 1 | `onboarding_step_viewed` (prop `step`) | each `app/(auth)/*` screen | **new** |
| 2 | `profile_complete` | `authStore.ts` | exists (funnel end for #1) |
| 3 | `screentime_auth_granted` / `screentime_auth_denied` | `screentime-setup.tsx` | **new** |
| 4 | `app_selection_done` | `screentime-setup.tsx` | **new** |
| 5 | `deposit_started` / `deposit_succeeded` / `deposit_failed` | `deposit.tsx` | exists (rename) + **fail new** |
| 6 | `solo_session_started` / `_completed` / `_surrendered` | `sessionStore.ts` | exists |
| 7 | `withdraw_started` / `_succeeded` / `_failed` | `withdraw.tsx` | exists (rename) + **succ/fail new** |
| 8 | `invite_shared` / `invite_opened` | `invites.tsx`, deep-link handler | **new** |
| 9 | `waitlist_signed_up` | `landing-pg` waitlist form | **new (web SDK)** |
| 10 | `app_open` | `_layout.tsx` | exists (now also PostHog, fixes pre-auth) |

That's 10 named events / 6 funnels — within the 8–12 ask, each one investor-meaningful.

---

## 6. Funnels to build in PostHog (for the investor view)

1. **Activation funnel:** `app_open` → `onboarding_step_viewed[welcome]` →
   `screentime_auth_granted` → `app_selection_done` → `deposit_succeeded` →
   `solo_session_started`. This is the one-slide "install → committed user" story.
2. **Onboarding drop-off:** funnel on `onboarding_step_viewed` by `step` (find the leakiest screen).
3. **Money funnel:** `deposit_started` → `deposit_succeeded` (conversion + fail reasons breakdown).
4. **Session integrity:** `solo_session_started` → `solo_session_completed` (vs `_surrendered`) —
   completion rate is the core product-efficacy metric.
5. **Virality loop:** `invite_shared` → `invite_opened` → `waitlist_signed_up` / `auth_complete`.

Pair funnel #1 and #2 with **session replays** on the drop-off step so the founder can watch the
exact taps where users bail — the literal "what users click" deliverable.

---

## 7. Privacy / security checklist before shipping

- PostHog project API key is **client-safe** (write-only ingest); fine as `EXPO_PUBLIC_*`.
- `autocapture={false}` + curated events = no accidental capture of deposit/withdraw amounts in
  free-text. Amounts only ever go in props as integer cents, never in event names.
- Enable **session replay masking** (mask all text inputs) so KYC/SSN/bank/card screens never render
  in a recording. Verify on `verify-identity.tsx`, `bank-setup.tsx`, `deposit.tsx` before sharing
  replays externally.
- `DEMO_MODE` disables PostHog (the provider `disabled` flag) — demo sessions don't pollute prod.
- Do **not** widen the `analytics_events` Firestore rule under deadline pressure (Option A). Use
  Option B (PostHog handles pre-auth) so no money-adjacent rules file is touched this week. If you
  do change the rule later, run `/vibe-security` on the diff and confirm App Check coverage first.
- Fardeen runs all deploys/git. This doc and any code changes are staged only.

---

## 8. Tonight's checklist (minimum viable, ~1–2 hrs)

1. Create PostHog project, copy project API key.
2. `pnpm add posthog-react-native` (+ peer deps). Add `EXPO_PUBLIC_POSTHOG_*` to `.env`.
3. Add `src/config/posthog.ts` + wrap root in `<PostHogProvider autocapture={false}>`.
4. Add the PostHog `capture()` fan-out + `identifyUser`/`resetAnalytics` to `src/utils/analytics.ts`
   (one file edit → all 10 existing call sites flow to PostHog immediately).
5. Add `onboarding_step_viewed` to each `(auth)` screen and the screentime granted/denied events —
   this is the funnel investors will actually look at.
6. Run a session on a device; confirm events appear in PostHog Live Events within minutes; build the
   Activation funnel ([§6](#6-funnels-to-build-in-posthog)).
7. (If time / after dev-client rebuild) add `posthog-react-native-session-replay` with input masking.

Deferred to later in the week: `deposit_failed`/`withdraw_*` success+fail, invite events, and the
landing-site `posthog-js` waitlist event.

---

## Sources

- [PostHog — React Native SDK docs](https://posthog.com/docs/libraries/react-native)
- [PostHog — React Native session replay installation](https://posthog.com/docs/session-replay/installation/react-native)
- [PostHog — Expo example app](https://github.com/PostHog/support-rn-expo)
- [PostHog vs Amplitude comparison](https://posthog.com/blog/posthog-vs-amplitude)
- [Amplitude pricing 2026](https://quackback.io/blog/amplitude-pricing)
- [React Native Firebase — Analytics usage](https://rnfirebase.io/analytics/usage)
- [Expo — React Native analytics SDKs](https://docs.expo.dev/guides/using-analytics/)
- [`@react-native-firebase/analytics` on npm](https://www.npmjs.com/package/@react-native-firebase/analytics)
