# Niyah - Project Guide

> **De-pooled commitment-contract** focus app. Users deposit their **own** money and stake it on a
> focus session; complete → get your stake back, quit early → forfeit it to the house. Stakes are
> **never** pooled, shared, or redistributed between users. NOT gambling (see Legal below).
>
> **Current status (read first):** [docs/STATUS.md](docs/STATUS.md)
> **Detailed docs**: [Architecture](docs/architecture.md) | [Development](docs/development.md) | [Features](docs/features.md) | [Native Modules](docs/native-modules.md) | [Security](docs/security.md) | [Roadmap](docs/roadmap.md) | [Payments](docs/payments.md) | [Legal](docs/legal.md) | [UI & Animation](docs/ui-animation.md)

## Tech Stack

- **Framework**: React Native 0.81 + Expo SDK 54 (New Architecture)
- **Language**: TypeScript (strict mode)
- **Navigation**: Expo Router (file-based routing, typed routes)
- **State**: Zustand (one store per domain)
- **Styling**: StyleSheet, SF Pro Rounded, dark/light theme
- **Build**: EAS Build (production), `expo-dev-client` (dev) -- NOT Expo Go
- **Backend**: Firebase Auth + Firestore via `@react-native-firebase/*`
- **Auth**: Google Sign-In, Apple Sign-In, Email magic link, Phone SMS OTP
- **Payments**: Stripe + Plaid (`@stripe/stripe-react-native`, Cloud Functions backend)
- **Testing**: Jest + jest-expo (client) + functions test suite
- **Linting**: ESLint 9 + Prettier
- **Package Manager**: pnpm

## Quick Reference

```bash
pnpm install           # Install deps
pnpm start             # Dev server (build dev client first)
pnpm build:local       # iOS build to USB device
pnpm test              # Run all tests
pnpm run ci            # lint + typecheck + test
pnpm typecheck         # TypeScript check
```

Full command list: [docs/development.md](docs/development.md)

## Project Layout

```
app/              # Expo Router screens (file-based routing)
  (auth)/         #   Sign-in, onboarding, profile setup
  (tabs)/         #   Dashboard, session, friends, profile
  session/        #   Session flow (select, confirm, active, surrender, complete)
  user/           #   Public user profiles
src/
  components/     # Reusable UI (Balance, Button, Card, Timer, NumPad, ...)
  config/         # Firebase, Cloud Functions client, Screen Time wrapper, SSL pinning
  store/          # Zustand stores (auth, session, wallet, partner, group, social, theme)
  hooks/          # useCountdown, useColors, useScreenProtection
  types/          # TypeScript type definitions
  constants/      # Colors, spacing, config (DEMO_MODE, cadences)
  utils/          # Formatting, payout algorithm, logger
modules/          # Custom native Expo module (niyah-screentime: Swift bridge)
targets/          # iOS app extensions via @bacons/apple-targets (monitor, report,
                  #   shieldaction, shieldconfig, widget) — Screen Time + Live Activity
functions/        # Firebase Cloud Functions (~40 exports)
plugins/          # Expo config plugins (Firebase frameworks/services, build fixes)
firebase/         # Firestore rules + indexes (config plists gitignored)
landing-pg/       # niyah.live marketing site + hosted /legal (Next.js, GitHub Pages)
docs/             # Detailed documentation (STATUS, architecture, roadmap, security, ...)
```

Full tree: [docs/architecture.md](docs/architecture.md)

## Key Conventions

### TypeScript

- Strict mode. Types in `src/types/index.ts`
- Prefer interfaces over types for object shapes

### Components

- Functional only, hooks for state/effects
- Keep under 150 lines. Props interface above component.

### Styling

- `StyleSheet.create()` at bottom of file
- `useColors()` for theme colors. 8px spacing grid (`Spacing.*`).
- `Font.regular/medium/semibold/bold/heavy` for font weights

### State (Zustand)

- One store per domain, keep flat
- Stores call each other via `getState()`. Lazy `require()` for circular deps.
- Firestore writes are fire-and-forget (local state = source of truth)

### Navigation

- File-based routing in `app/`. Groups for layouts.
- `router.push()` to navigate, `router.replace()` for auth redirects
- Typed routes: `experiments.typedRoutes: true`

### Native Modules

- Custom module in `modules/niyah-screentime/`, Swift via ExpoModulesCore
- Config in `expo-module.config.json`, referenced via `nativeModulesDir: "modules"` in `app.config.js`
- iOS app extensions live in `targets/` (registered by `@bacons/apple-targets`), NOT in plugins. See [docs/native-modules.md](docs/native-modules.md).

## Config & Secrets

| What                  | Where                                   |
| --------------------- | --------------------------------------- |
| Client env vars       | `.env` (see `.env.example`)             |
| Stripe secret/webhook | Firebase Secret Manager                 |
| Firebase config files | `firebase/` (gitignored, local only)    |
| EAS cloud builds      | Upload config files as EAS file secrets |

`app.config.js` reads env vars at build time. No secrets hardcoded in source. See [docs/security.md](docs/security.md).

## Current Phase

**Launch — App Store submission.** Working branch is `wallet-ledger` (de-pooled v1). Full
current state, "remaining to submit," and post-submit dormant flips live in **[docs/STATUS.md](docs/STATUS.md)
— read that first in a new session.** Phases/history: [docs/roadmap.md](docs/roadmap.md).

## Gotchas (don't get burned)

- **`STRIPE_SECRET_KEY` is LIVE (`sk_live_`)** — real money moves. Deletion/withdrawal are irreversible live paths.
- **Keep `APP_CHECK_ENFORCED=false`** until App Check Metrics ≥ 99% verified, or users lock out.
- **Run `/vibe-security`** on auth/payments/rules diffs before commit; fix Critical + High first.
- **Fardeen runs all git/deploy/outward actions** — supply commit messages only; never push/merge/deploy.
- **Commit style:** one-liner subject, no body, no Co-Authored-By trailer.
- **Drifted test account `cMtHvQkJJZOgU6pgYARj8nN5Wpf1` stays frozen** — don't reuse for clean tests.
- **No VAIL / Dr. White references** — purged, never re-add.

## Demo Mode

`DEMO_MODE` is env-var driven (`EXPO_PUBLIC_DEMO_MODE=true`). Real Firebase auth, short session timers, $50 starting balance, Cloud Function calls skipped. See [docs/features.md](docs/features.md#demo-mode).

## Legal

Niyah is a **commitment contract** app, NOT gambling. Same model as stickK and Beeminder.

- Avoid: "bet," "wager," "gamble," "win"
- Use: "stake," "commitment," "goal," "complete"
- App Store category: Productivity

Full analysis: [docs/legal.md](docs/legal.md)

## Contacts

- **Technical**: 40AU (Logan & Andrew)
