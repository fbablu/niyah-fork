# UI & Animation

> Animation libraries, onboarding architecture, and visual plans.
> See also: [Architecture](./architecture.md) | [Roadmap](./roadmap.md)

## Design North Star — Native SwiftUI Feel

**Goal:** the app should feel indistinguishable from a hand-built SwiftUI app —
**zero perceptible delays, no animation jank, native gestures and transitions.**
Every screen should hold 60/120fps, navigate instantly, and never show a spinner
where a skeleton or optimistic update would do. This is a **Phase-4 polish track
(post-submit)** — captured here so the work has a home; it does NOT block the
launch keystone (deploy → submit).

Levers, highest native-fidelity first:

1. **`@expo/ui/swift-ui`** — render _actual_ SwiftUI views (pickers, lists,
   sections, gauges) from RN. Highest-fidelity path to a native look for stock
   controls. Skill: `expo-ui-swift-ui`. (Android twin: `@expo/ui/jetpack-compose`.)
   ⚠️ Native dep — new/evolving API, needs a config-plugin + EAS rebuild, not a
   drop-in JS lib. Adopt screen-by-screen, not a big-bang rewrite.
2. **Native navigation** — Expo Router native-stack + native tabs (already on
   `react-native-bottom-tabs`): platform transitions, large titles, swipe-back.
   Skill: `building-native-ui`.
3. **Reanimated everywhere** — finish migrating the legacy `Animated` components
   (table below) to UI-thread Reanimated so nothing janks on the JS thread.
4. **No data-delay** — React Query / SWR + Expo Router loaders so screens paint
   from cache instantly and refresh in the background (never block paint on a fetch).
   Skill: `native-data-fetching`.
5. **Measure it** — `expo-observe` for cold/warm launch, TTI, TTR, and frameRate;
   gate "no delays" on real numbers, not vibes. Skill: `expo-observe`.

## Expo Skills (agent tooling for native UI)

Official Expo AI-agent skills (installed via the `expo` plugin) this design work
should lean on. Install once:

```sh
/plugin marketplace add expo/skills
/plugin install expo
```

**Design-critical** — use these for the native-feel push:

| Skill                     | Use it for                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `expo-ui-swift-ui`        | Real SwiftUI components (`@expo/ui/swift-ui`) — pickers, lists, gauges. Top native-look lever. |
| `expo-ui-jetpack-compose` | Android equivalent (`@expo/ui/jetpack-compose`, Material 3) when we add Android.             |
| `building-native-ui`      | Expo Router fundamentals: styling, native tabs, navigation, animations, patterns.           |
| `native-data-fetching`    | fetch / React Query / SWR + Router loaders → no spinner stalls, instant cached paint.        |
| `expo-observe`            | Measure cold/warm launch, TTI, TTR, navigation TTR, frameRate — quantify "no delays."       |
| `expo-tailwind-setup`     | Optional: NativeWind v5 / Tailwind v4 (we use `StyleSheet` today — only if we migrate).      |

**Build / ship / debug** — partly already in our flow:

| Skill                 | Use it for                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| `expo-deployment`     | App Store / Play / web / API-route deploys.                                 |
| `expo-dev-client`     | Build + distribute dev clients (local or TestFlight).                       |
| `eas-update-insights` | OTA update health: crash rate, install/launch, embedded-vs-OTA split.       |
| `expo-cicd-workflows` | `.eas/workflows/` CI YAML (build-on-PR, deploy automation).                 |
| `upgrading-expo`      | SDK upgrades + dependency fixes.                                            |
| `expo-module`         | Authoring native modules — our `niyah-screentime` Swift bridge lives here.  |
| `expo-api-routes`     | API routes in Expo Router on EAS Hosting.                                   |
| `add-app-clip`        | iOS App Clip target (URL-invoked lightweight clip) — possible growth lever. |
| `expo-brownfield`     | Embed RN into an existing native app (not needed today).                    |
| `use-dom`             | Run web code in a webview on native (e.g. embed a chart).                   |

> Skills are agent instruction files — an agent auto-selects the right one from a
> prompt like "add a SwiftUI picker to the stake screen." Source: expo/skills.

## Styling Conventions

- `StyleSheet.create()` for all styles, defined at bottom of file
- `useColors()` hook for current theme colors (dark/light)
- Colors: `src/constants/colors.ts` (`DarkColors`, `LightColors`)
- 8px spacing grid: `Spacing.xs/sm/md/lg/xl/xxl`
- Fonts: `Font.regular/medium/semibold/bold/heavy` (SF Pro Rounded on iOS)
- Radius: `Radius` constants for border radii

## Installed Animation Libraries

| Library                        | Version | Status                                       |
| ------------------------------ | ------- | -------------------------------------------- |
| `react-native-reanimated`      | 4.1.7   | Installed, used in some onboarding scenes    |
| `react-native-gesture-handler` | 2.28.0  | Installed, used internally by expo-router    |
| `expo-linear-gradient`         | 15.0.8  | In use (blob avatars, backgrounds, profile)  |
| `react-native-svg`             | 15.15.5 | In use (Timer, onboarding SVG blobs)         |
| `expo-haptics`                 | 15.0.8  | In use (Button, Card, NumPad press feedback) |

## Components Using Legacy Animated API

These should be migrated to Reanimated for better performance:

| Component                      | Current                              | Target                                          |
| ------------------------------ | ------------------------------------ | ----------------------------------------------- |
| `Button.tsx`                   | `Animated.spring` scale 1->0.97      | `useSharedValue` + `Gesture.Tap` + `withSpring` |
| `Card.tsx`                     | `Animated.timing` fade + press scale | `withTiming` entrance + `withSpring` press      |
| `Confetti.tsx`                 | `Animated` particle system           | Reanimated shared values                        |

## Blob System (avatars)

In-house, zero-dep procedural blobs (blobmaker.app-style) — `src/constants/blobAvatar.ts`:

- **Generator** — `generateBlobPoints(seed)` (FNV-1a → mulberry32, 7 control points on a jittered
  circle) + worklet `pointsToBlobPath(pts)` (Catmull-Rom → cubic-bézier). `generateBlobPath` is the
  composition; the split exists so the path can be rebuilt per-frame on the UI thread. Procedural
  blobs are always centered in a 100×100 box, so eyes/skins/shadows align by construction (no
  per-shape hand-tuned coordinates like the named `SHAPES` presets need).
- **`BlobAvatar`** — static renderer; named presets + procedural "unique" (seeded by
  `config.shapeSeed ?? uid`). Opt-in `animated` breathing idle (hero avatars only).
- **`MorphingBlob`** — animates between generated shapes on the UI thread: spring-driven point
  interpolation (`useDerivedValue` → `useAnimatedProps` on the Path `d`), overshoot = jelly wobble,
  dual-gradient color crossfade, blink + squash mid-morph. Reduced-motion jump-cuts.
- **Blob Maker onboarding** — `app/(auth)/blob-maker.tsx` (profile-setup → blob-maker → intake):
  blob on an SVG podium, shuffle button + tap-to-shuffle, 5-slot history row. Each shuffle mints a
  `uid:nonce` `shapeSeed` (expo-crypto) — an account-bound visual fingerprint, never a credential.
- **Palettes** — `BLOB_PALETTES` is the single source of truth (BlobAvatar, MorphingBlob,
  ProfileHeader swatches). Live Activity asset names couple to `colorPreset` (`blob_${color}`) —
  adding a palette requires shipping matching native images in `targets/`.
- **Tests** — `blobAvatar.test.ts` (determinism, bounds, clamp, generator-split cross-validation,
  shapeSeed normalize) + `MorphingBlob.test.tsx` (first-paint parity with BlobAvatar).

## Onboarding

### Current State

4 scene components in `src/components/onboarding/` (exported from `index.ts`):

- `BlobsScene.tsx` -- SVG blob characters
- `ContinuousScene.tsx`
- `Onboarding2Scene.tsx`, `Onboarding3Scene.tsx`

### Architecture Goal

One shared value (gesture progress) drives every animation through `interpolate()`:

```
PanGesture -> progress (0 to N pages)
  |- Background color interpolation
  |- Scene scale/rotation transforms
  |- Parallax layer offsets
  +- Text opacity/translateY
```

### Migration Plan

1. Convert all onboarding scenes to Reanimated shared values
2. Implement gesture-driven page transitions
3. Polish timing curves and spring configs

## 3D Gem Onboarding (Post-Launch)

Replace flat SVG blob characters with photorealistic 3D gemstones via SceneKit:

| Blob     | Color   | Gem Type | Material                          |
| -------- | ------- | -------- | --------------------------------- |
| plum     | #5C415D | Amethyst | Deep purple glass, high clearcoat |
| blue     | #329DD8 | Sapphire | Blue glass, strong specular       |
| red      | #E07A5F | Sunstone | Warm peach glass, inner glow      |
| yellow   | #B8860B | Topaz    | Golden glass, metallic tint       |
| offWhite | #F2EDE4 | Diamond  | Near-clear, rainbow caustics      |
| green    | #40916C | Emerald  | Deep green glass                  |

## Tooling Summary

| Tool                         | Role                        | Cost            | Status                      |
| ---------------------------- | --------------------------- | --------------- | --------------------------- |
| Firebase (Auth + Firestore)  | Backend, auth, data         | Free tier       | Implemented (RNFB)          |
| Firebase Cloud Functions     | Server-side logic, payments | Free tier       | ~40 exports deployed        |
| EAS Build                    | iOS/Android builds          | Free tier       | Configured and in use       |
| react-native-reanimated      | Animations                  | Free            | Partially used (onboarding) |
| react-native-gesture-handler | Gesture tracking            | Free            | Used by router              |
| react-native-svg             | SVG illustrations           | Free            | In use                      |
| expo-haptics                 | Tactile feedback            | Free            | In use                      |
| Jest + jest-expo             | Testing                     | Free            | ~742 client tests passing   |
| ESLint 9 + Prettier          | Linting + formatting        | Free            | Configured, 0 errors        |
| Stripe                       | Payments                    | Per-transaction | Integrated (live keys)      |
