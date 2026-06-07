# Architecture

> Project structure and how the pieces connect.
> See also: [Development](./development.md) | [Features](./features.md) | [Native Modules](./native-modules.md)

## Directory Tree

```
niyah/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root layout (Firebase auth listener, font loading)
│   ├── index.tsx                 # Entry redirect (auth or tabs)
│   ├── invite.tsx                # Referral/invite screen
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── welcome.tsx           # Onboarding/welcome
│   │   ├── auth-entry.tsx        # Sign-in options (Google, Apple, Email, Phone)
│   │   ├── phone-entry.tsx       # Phone number input for SMS OTP
│   │   ├── verify-phone.tsx      # OTP code verification
│   │   ├── check-email.tsx       # Magic link verification
│   │   ├── profile-setup.tsx     # First-time profile completion
│   │   └── screentime-setup.tsx  # Screen Time permissions + app picker onboarding
│   ├── (tabs)/                   # Main app tabs (authenticated)
│   │   ├── index.tsx             # Dashboard/Home
│   │   ├── session.tsx           # Start new session
│   │   ├── friends.tsx           # Friends list, social features
│   │   └── profile.tsx           # User profile & settings
│   ├── session/                  # Session flow (stack navigation)
│   │   ├── select.tsx            # Select cadence (daily/weekly/monthly)
│   │   ├── confirm.tsx           # Confirm stake
│   │   ├── active.tsx            # Active session with timer
│   │   ├── quick-block.tsx       # One-tap app blocking (no stake)
│   │   ├── surrender.tsx         # Surrender confirmation
│   │   ├── complete.tsx          # Session complete celebration
│   │   ├── partner.tsx           # Partner/duo session flow
│   │   ├── propose.tsx           # Group challenge proposal
│   │   ├── waiting-room.tsx      # Pre-session lobby (group)
│   │   ├── invites.tsx           # Pending group invites
│   │   ├── deposit.tsx           # Deposit funds
│   │   ├── withdraw.tsx          # Withdraw funds
│   │   ├── bank-setup.tsx        # Link bank via Plaid
│   │   └── stripe-onboarding.tsx # Stripe Connect KYC / payout setup
│   └── user/
│       └── [uid].tsx             # Public user profile (dynamic route)
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── Balance.tsx, Button.tsx, Card.tsx, Timer.tsx, NumPad.tsx, ...
│   │   ├── BlobsBackground.tsx   # Animated SVG blob background (3 variants)
│   │   ├── Confetti.tsx          # Celebration animation
│   │   ├── MoneyPlant.tsx        # Money plant visualization
│   │   ├── PeachAvatar.tsx       # Peach blob avatar
│   │   ├── profile/              # Profile sub-components
│   │   └── onboarding/           # Onboarding scene components (8 scenes)
│   ├── config/
│   │   ├── firebase.ts           # Firebase helpers (auth, Firestore, social)
│   │   ├── functions.ts          # Cloud Functions client (reads project ID from env)
│   │   ├── appCheck.ts           # App Check attestation (App Attest/DeviceCheck)
│   │   ├── notifications.ts      # FCM push notification helpers
│   │   ├── screentime.ts         # Screen Time API JS wrapper
│   │   ├── sentry.ts             # Sentry crash/error reporting init
│   │   └── sslPinning.ts         # SSL public key pinning for Cloud Functions
│   ├── store/                    # Zustand state stores (one per domain)
│   │   ├── authStore.ts          # Auth state, Firebase user, profile
│   │   ├── sessionStore.ts       # Solo session lifecycle
│   │   ├── walletStore.ts        # Balance, transactions, settlements
│   │   ├── partnerStore.ts       # Partner relationships, duo sessions
│   │   ├── groupSessionStore.ts  # N-person group sessions, de-pooled stake-back
│   │   ├── socialStore.ts        # Following/followers, public profiles
│   │   └── themeStore.ts         # Dark/light theme (AsyncStorage persistence)
│   ├── hooks/
│   │   ├── useCountdown.ts       # Countdown timer hook
│   │   ├── useColors.ts          # Current theme colors from themeStore
│   │   ├── useScreenProtection.ts # Prevent screenshots/screen recording
│   │   └── ScrollContext.tsx      # Shared scroll context
│   ├── types/index.ts            # All app type definitions
│   ├── constants/
│   │   ├── colors.ts             # DarkColors, LightColors, Spacing, Typography, Font, Radius
│   │   └── config.ts             # Cadences, DEMO_MODE, INITIAL_BALANCE, reputation levels
│   ├── utils/
│   │   ├── format.ts             # Formatting utilities
│   │   ├── logger.ts             # Logging utility
│   │   └── payoutAlgorithm.ts    # Solo & group payout calculation
│   └── __tests__/                # Test suites (unit + integration)
├── modules/
│   └── niyah-screentime/         # Custom Expo module for iOS Screen Time API
├── functions/                    # Firebase Cloud Functions (~40 exports)
│   └── src/index.ts              # All function definitions
├── plugins/                      # Expo config plugins (Firebase + build fixes only)
│   ├── withGoogleServicesPlist.js
│   ├── withFirebaseStaticFrameworks.js
│   ├── withResourceBundleSigning.js
│   ├── withFollyCoroutinesFix.js
│   └── withFmtConstevalFix.js
├── scripts/
│   ├── dev-doctor.sh             # Diagnose Mac+iPhone dev state (pnpm doctor)
│   ├── clean.sh / clean-deep.sh  # Reset build/Metro/pod caches
│   ├── print-dev-url.js
│   └── wsl_dev_setup.ps1
├── firebase/                     # Firestore rules + indexes (config plists gitignored)
│   ├── GoogleService-Info.plist  # iOS (gitignored, local only)
│   ├── firestore.rules           # Hardened security rules
│   └── firestore.indexes.json    # Composite index definitions
├── CLAUDE.md                     # AI assistant project guide
├── README.md                     # Public-facing setup guide
├── app.config.js                 # Dynamic Expo config (replaced app.json)
├── .env / .env.example           # Environment variables
├── package.json
├── tsconfig.json
├── jest.config.js / jest.setup.ts
└── eslint.config.mjs
```

## Key Architectural Decisions

### Dynamic Expo Config

`app.config.js` replaced `app.json`. It reads environment variables at build time so no secrets or project identifiers are hardcoded in source. See [Development > Environment Variables](./development.md#environment-variables).

### State Architecture

Zustand stores are the source of truth. Firestore writes are fire-and-forget (non-blocking cloud sync). Stores call each other directly via `getState()`. Lazy `require()` breaks circular dependencies (e.g., `authStore` -> `walletStore`).

### Navigation

Expo Router file-based routing in `app/`. Groups `(auth)` and `(tabs)` define layouts. Typed routes enabled via `experiments.typedRoutes: true`.

### Native Module Bridge

Custom Expo modules in `modules/` use Swift bridged via ExpoModulesCore. iOS **app extensions** (Screen Time + Live Activity) live in top-level `targets/` and are registered by `@bacons/apple-targets` (entitlements + target registration via `targets/*/expo-target.config.json`). Config plugins in `plugins/` only inject Firebase static-framework + build fixes. Module directory referenced via `nativeModulesDir: "modules"` in `app.config.js`.

### Firebase Config Files

`GoogleService-Info.plist` (iOS) is **gitignored** (removed from repo after key rotation). It lives on disk in `firebase/` and is injected by a config plugin at build time. For EAS cloud builds, upload it as a file secret. See [Security](./security.md).

### Build System

EAS Build for production/preview. `expo-dev-client` for development (NOT Expo Go). Native Firebase and Screen Time modules require custom builds.
