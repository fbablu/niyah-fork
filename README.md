**Put your money where your mind is.**

## Problem

You want to stop doomscrolling. Screen time apps don't work because there's no real consequence. Willpower alone isn't enough.

## Solution

Stake your **own** money on a focus session as a commitment device. Complete it → get your stake
back. Quit early → forfeit it. The financial consequence is what willpower alone lacks. This is a
**commitment contract** (same model as stickK/Beeminder), **not** gambling — see [docs/legal.md](docs/legal.md).

**Solo**: Deposit money, block distracting apps, stake on a focus session. Complete → stake returned; surrender early → stake forfeited to the house.

**Group**: Focus together — but **de-pooled**. Every participant stakes their **own** money individually; completers get their own stake back, non-completers forfeit to the house. Stakes are never pooled, shared, or redistributed between users.

## Development Setup

### Prerequisites

- **Node.js** v20+ (Expo SDK 54 + CI floor; Cloud Functions run on Node 22)
- **pnpm** (`npm install -g pnpm`)
- **Xcode** (iOS) -- install from Mac App Store, then `xcode-select --install`

### Install Dependencies

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in values:

```
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

You also need Firebase config files (not in repo):

- `firebase/GoogleService-Info.plist` -- download from Firebase Console > Project Settings > iOS

### Build & Run

This project uses `expo-dev-client`, **NOT** Expo Go. You must build a dev client first.

**iOS (physical device via USB):**

```bash
pnpm build:local    # Build + install on device
pnpm start          # Start dev server (phone on same WiFi)
```

**iOS Simulator:**

```bash
pnpm build:local:sim  # Build for Simulator
pnpm start
# Press 'i' to open on iOS Simulator
```

For subsequent runs after building, just start the dev server:

```bash
pnpm start
# Press 'i' for iOS Simulator
```

**Rebuild only when:** native dependencies change (new Swift code, new native packages). All JS/TS changes are live via hot-reload.

### Testing & Code Quality

```bash
pnpm test        # Run all client tests (Jest)
pnpm typecheck   # TypeScript strict mode check
pnpm lint        # ESLint
pnpm ci          # Full CI: lint + typecheck + test
```

---

## Teammate Setup (Windows + iPhone, no Mac needed)

The Mac owner builds the app once and shares an install link. Teammates install it on their iPhones and code with live hot-reload from their Windows laptops.

### 1. Install the app on your iPhone

- Open the install link you received in **Safari** on your iPhone
- Tap **Install** when prompted
- Go to **Settings > General > VPN & Device Management** > tap the developer certificate > **Trust**

### 2. Set up your dev environment (one-time)

Install WSL2: `wsl --install` from PowerShell, then restart. Inside WSL:

```bash
# Install Node.js 20+ and pnpm, then:
git clone <repo-url>
cd niyah
pnpm install
```

Set up config files (never commit these):

- `.env` — copy `.env.example`, fill in values from [Firebase Console](https://console.firebase.google.com/) and [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- `firebase/GoogleService-Info.plist` — Firebase Console > Project Settings > Your Apps > iOS > download

You need to be added to the Firebase project first — ask the team lead.

### 3. Network setup (every Windows restart)

Open **PowerShell as Administrator** on the Windows side:

```powershell
.\scripts\wsl_dev_setup.ps1
```

Note the Wi-Fi IP it prints at the end.

### 4. Start coding

```bash
pnpm start   # inside WSL
```

Open the Niyah app on your iPhone. Enter the Metro URL: `http://<your-wifi-ip>:8081`

All JS/TS code changes hot-reload instantly on your phone.

---

## Building for Team Distribution (Mac owner only)

### Option A: EAS Cloud (easiest)

```bash
set -a && source .env && set +a
eas build --profile development-device --platform ios
```

EAS gives you an install link at the end. Share it with teammates.

### Option B: Local via Xcode (no queue)

```bash
npx expo prebuild --platform ios
cd ios && pod install && cd ..
open ios/Niyah.xcworkspace
```

In Xcode:

1. Set destination to **Any iOS Device (arm64)**
2. **Product > Archive**
3. **Distribute App > Release Testing > Export**
4. Upload the `.ipa` to [diawi.com](https://diawi.com) and share the link

### Registering new devices

```bash
eas device:create   # generates URL — send to teammate to open on their iPhone
```

After registering, rebuild and redistribute.

---

### Troubleshooting

**Clear cache:**

```bash
npx expo start --clear
```

**Reinstall node_modules:**

```bash
rm -rf node_modules
pnpm install
```

**iOS rebuild:**

```bash
rm -rf ios
npx expo prebuild --platform ios --clean
npx expo run:ios
```

**Clean everything:**

```bash
rm -rf node_modules ios .expo
pnpm install
npx expo prebuild --clean
npx expo run:ios
```

**Metro won't connect on Windows:**

- Make sure `wsl_dev_setup.ps1` ran after last restart
- Check that phone and laptop are on the same WiFi
- Try entering the URL manually: `http://<wifi-ip>:8081`

---

## Documentation

Detailed docs are in the [`docs/`](docs/) directory:

- [STATUS](docs/STATUS.md) -- **current launch state, what's left to submit, post-submit flips (read first)**
- [Architecture](docs/architecture.md) -- project structure, directory tree
- [Development](docs/development.md) -- full command reference, env vars, Cloud Functions
- [Features](docs/features.md) -- auth, sessions, wallet, social, demo mode
- [Native Modules](docs/native-modules.md) -- Firebase, Screen Time, config plugins
- [Security](docs/security.md) -- SSL pinning, key management, Firestore rules
- [Roadmap](docs/roadmap.md) -- current status, phases, blockers
- [Payments](docs/payments.md) -- Stripe, wallet ledger, de-pooled solo/group payout
- [Legal](docs/legal.md) -- commitment contract framing, App Store strategy
- [UI & Animation](docs/ui-animation.md) -- animation libraries, onboarding plans
