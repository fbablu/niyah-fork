# Features

> Core app features and their implementation.
> See also: [Architecture](./architecture.md) | [Payments](./payments.md) | [Native Modules](./native-modules.md)

## Authentication

Four sign-in methods, all backed by Firebase Auth:

1. **Google Sign-In** -- native dialog via `@react-native-google-signin/google-signin`
2. **Apple Sign-In** -- native via `expo-apple-authentication` with nonce
3. **Email Magic Link** -- passwordless email link via Firebase
4. **Phone SMS OTP** -- Firebase phone auth with SMS verification code

**Flow**: `auth-entry.tsx` -> (phone: `phone-entry.tsx` -> `verify-phone.tsx`) -> (if new user) `profile-setup.tsx` -> `screentime-setup.tsx` -> tabs

Auth state managed by `authStore.ts`, which listens to Firebase `onAuthStateChanged` and hydrates user data from Firestore.

**Key files**: `src/config/firebase.ts` (auth helpers), `src/store/authStore.ts`, `app/(auth)/`

### Multi-Provider Account Linking

A returning user who first signed up by phone and later taps "Sign in with Google" must land on the same `uid` if the Google email matches the phone-owner's verified email. The auth store consults Firestore for an existing user whose verified `phoneNumber` or `email` matches before creating a new account, then calls Firebase `linkWithCredential` so all providers attach to the original user record. Source-of-truth profile fields (`displayName`, `email`, `phoneNumber`) are read directly from `firebase.auth().currentUser` on every profile save to keep the auth user and Firestore doc consistent. Migration of pre-link duplicates is handled by the admin-only `mergeDuplicateUsers` Cloud Function; merged wallets and `migrations/{date}` audit entry per merge.

Shipped in the Phase 4 auth lane — see [roadmap.md](./roadmap.md).

### Phone OTP Throttle

In addition to Firebase's server-side rate limits, the client persists `{ lastSentAt, sendCount, windowStart }` in secure storage. Five sends per phone per hour, then exponential backoff (30s → 2m → 5m). `auth/too-many-requests` errors get pinned in UI so a retry loop can't burn the user's Firebase quota. App Check is moving from soft-fail to enforce on auth-related Cloud Functions to reduce the abusive-traffic flags that triggered the testing-phase 15-minute lockouts.

## Session Modes

### Solo Session

**Store**: `sessionStore.ts` | **Screens**: `app/session/`

1. User selects cadence (Daily/Weekly/Monthly)
2. User confirms stake amount
3. Session starts, timer counts down
4. User can "surrender" early (lose stake) or complete (get stake back)

Sessions persist to Firestore `sessions` collection with crash recovery via `recoverActiveSession`. Cloud Function calls gated behind `DEMO_MODE`.

### Quick Block (Solo, No Stake)

**Screen**: `app/session/quick-block.tsx`

One-tap app blocking without money. User picks a duration (25 min / 1 hr / 2 hr / 4 hr / Until tonight), taps "Block Apps", and selected apps are shielded immediately. Reuses the active session timer view. Part of the April 15 sprint rearchitecture toward schedule-based blocking.

### Group Session (de-pooled)

**Store**: `groupSessionStore.ts` | **Screen**: `app/session/propose.tsx`

1. Proposer creates session, selects stake amount and invites friends
2. Invitees accept (own stake deducted) or decline
3. All participants mark online in waiting room, proposer starts session
4. Screen Time blocking activates on all devices, live leaderboard tracks progress
5. On complete: each completer gets their **own** stake back; each forfeiter's stake goes **to the house**. **No pool, no redistribution, no peer-to-peer payments.** Settlement is server-authoritative; payout credits the wallet (cash-out at withdrawal).

**Status**: Full stack complete — ~10 Cloud Functions, real-time Firestore listeners, live Stripe, custom shield blocking.

> A "duo" session is just a 2-person group session routed through `groupSessionStore`. The legacy
> `partnerStore` "loser pays winner via Venmo" flow is **removed** (dead code) — see [legal.md](./legal.md).

### Group Equity (Cap-Target Payout) — superseded design

> ⚠️ **Superseded by the de-pool.** This cap-target/handicap model assumed a redistributable pool,
> which no longer exists. Kept as a design reference only. Full doc: [group-equity.md](./group-equity.md).

### Live Activities (Lock Screen + Dynamic Island)

`NiyahLiveActivity` widget extension renders the running session on the lock screen (timer + blob + top-3 leaderboard with status dots & violation counts) and in Dynamic Island (compact: timer + blob; expanded: 3-row leaderboard). Wired from `sessionStore` / `groupSessionStore` — start on session begin, update on every Firestore session-doc tick, end on complete or surrender. See [native-modules.md](./native-modules.md#niyahliveactivity).

### Screen-Time Baseline + Priorities

Onboarding moves past Apple's stock `FamilyActivityPicker`: users pick all categories to monitor, then 24h later return to `screentime-priorities.tsx` where they see ranked apps (top usage first, "8h avg" badge style) and assign each one a mode — "block hard / block sometimes / track only". Persisted to `users/{uid}.screenTimeProfile`. Powered by the `NiyahDeviceActivityReport` extension and `getScreenTimeBaseline()` bridge.

### Per-App Shield Variants

`targets/shieldconfig/ShieldConfigurationExtension.swift` detects variant via `detectVariant(bundleID:categoryName:)` (branching on `application.bundleIdentifier` / `category.localizedDisplayName`) with category-matched pep-talk copy; quote selection rotates by `Int(Date().timeIntervalSince1970 / 60) % quotes.count`. Shield surrender is two-step: tap "Open Niyah" → land in-app → confirm sheet (HoldToConfirmModal). Removes the single-tap forfeit footgun. (Per-app visual variants B4 are still partly deferred — see [roadmap.md](./roadmap.md).)

## Wallet & Transactions

**Store**: `walletStore.ts` | **Screens**: `deposit.tsx`, `withdraw.tsx`

- Balance tracked in cents across four buckets (`deposited`/`earned`/`bonus`/`credit`)
- Transaction types: `deposit`, `withdrawal`, `stake`, `payout`, `forfeit`, `bonus`, `credit`, `refund`, `forgiveness`
- Demo mode starts with $50 balance (`INITIAL_BALANCE`)
- Non-demo mode hydrates from Firestore `wallets/{uid}`

See [Payments](./payments.md) for the wallet ledger, Stripe/Plaid integration, and payout structure.

## Social Features

**Store**: `socialStore.ts` | **Screens**: `app/(tabs)/friends.tsx`, `app/user/[uid].tsx`

- **Following/Followers** -- backed by Firestore `userFollows` collection
- **Public Profiles** -- view other users' stats and reputation
- **Contacts Integration** -- `expo-contacts` for friend discovery via `findContactsOnNiyah` Cloud Function, cached in `socialStore` with 5-min staleness check

### Reputation System

5 tiers based on payment reliability + referral bonuses:

| Tier    | Score Range |
| ------- | ----------- |
| Seed    | 0-20        |
| Sprout  | 21-40       |
| Sapling | 41-60       |
| Tree    | 61-80       |
| Oak     | 81-100      |

### Referral System

- Deep link invites via `app/invite.tsx`
- Reputation boost for both inviter and invitee
- Partner auto-connect on referral acceptance

## Theme System

**Store**: `themeStore.ts` | **Hook**: `useColors()`

- Dark/light theme persisted to AsyncStorage
- Colors defined in `src/constants/colors.ts` (`DarkColors`, `LightColors`)
- Access via `useColors()` hook which returns `ThemeColors`

## Demo Mode

Controlled by env var (`EXPO_PUBLIC_DEMO_MODE=true`):

| Area        | Behavior                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Auth        | Real Firebase authentication (Google, Apple, Email, Phone)                                                                           |
| Profile     | Real Firestore persistence (reads + writes)                                                                                          |
| Sessions    | Short timers (10s daily, 60s weekly, 90s monthly). Persisted to Firestore with crash recovery. Cloud Function calls skipped.         |
| Wallet      | Starts at $50. Non-demo hydrates from Firestore.                                                                                     |
| Screen Time | Module production-quality, onboarding + session lifecycle wired.                                                                     |
| Payments    | Cloud Function calls skipped; virtual balance only. **Non-demo runs on live Stripe + Plaid.**                                        |

## Payments Model

Non-demo builds run on **live Stripe Connect + Plaid production** — real deposits, refunds, and
withdrawals. `DEMO_MODE=true` only short-circuits Cloud Function calls and uses a virtual balance for
local testing. There is **no honor-based / Venmo settlement** — that pre-April-15 model is removed
(see [legal.md](./legal.md), [payments.md](./payments.md)).
