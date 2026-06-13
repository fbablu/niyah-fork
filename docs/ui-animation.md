# UI & Animation

> The design-system narrative for the **green world**: palette, glass tokens, text
> hierarchy, proportional sizing, the screen scaffolds, the single-theme decision, and
> the near-static motion spec. The *rules* for implementing designs live in
> [figma-design-rules.md](./figma-design-rules.md); the profile spec + Clout model live
> in [profile-redesign-brief.md](./profile-redesign-brief.md) — this doc cross-references
> both rather than duplicating them.
> See also: [Architecture](./architecture.md) | [Roadmap](./roadmap.md)

## The Green World (current design language)

A whole-app **green-world** redesign shipped to TestFlight this cycle (builds 25–28, latest
**28**). Every surface — all four tabs (dashboard / schedule / friends / profile), all 16
session screens, the money screens, `app/blocked.tsx`, `app/user/[uid].tsx`, and the shared
components — now resolves to a **single brand theme** instead of the old earth/cream palette:

- **Full-bleed `Colors.primaryDark` (`#1B4332`) fields** — the page background is brand green,
  not a neutral.
- **`Colors.primary` (`#2D6A4F`) surfaces** — cards, rows, headers sit one step lighter.
- **`Colors.primaryLight` (`#40916C`) sheets** — bottom sheets / raised affordances.
- **White text hierarchy** — `white` (primary) / `white @ 0.7` (secondary) / `white @ 0.55`
  (tertiary), readable on the green field. (The earth-tone `text*` tokens are not used here.)
- **Proportional sizing** — percentage widths and `aspectRatio` cells, never absolute px, so
  layouts scale across device sizes.
- **Translucent glass overlays** — the new glass token group below.

> The greens ARE the brand tokens (`#1b4332`/`#2d6a4f`/`#40916c` = `primaryDark`/`primary`/
> `primaryLight`). Do **not** substitute the standard `background*` tokens on a green screen —
> that mistake caused the v1 profile rework. See figma-design-rules.md §1 "Figma-green note."
> The overnight all-tabs conversion is logged historically in
> `docs/redesign-all-tabs-progress.md`.

### Glass tokens

NEW translucent-overlay tokens in `src/constants/colors.ts`, **identical in both palettes** —
they layer on the brand greens, which never change with theme, so they don't need a per-theme
variant:

| Token        | Value                       | Use                                            |
| ------------ | --------------------------- | ---------------------------------------------- |
| `glassLight` | `rgba(217,217,217,0.25)`    | Faint frosted fill (pills, inactive chips)     |
| `glassMid`   | `rgba(217,217,217,0.5)`     | Stronger frosted fill (active/raised glass)    |
| `glassDark`  | `rgba(0,0,0,0.5)`           | Scrim / dim overlay on green                   |
| `glassSolid` | `#D9D9D9`                   | Opaque light chip when no translucency wanted  |
| `black`      | `#000000`                   | True black (alongside existing `white`)        |

Blob line-art ink is consolidated as `BLOB_INK = "#120505"` in `src/constants/blobAvatar.ts`
(was 21 duplicated literals).

### Single theme — dark-pinned, toggle removed

The dark/light toggle was **removed from Profile settings** (founder decision 2026-06-12). The
app now runs one theme. The mechanism is the same `ThemeOverrideContext` the `(auth)` group
already used: `app/(tabs)/_layout.tsx`, `app/session/_layout.tsx`, `app/user/[uid].tsx`, and
`app/blocked.tsx` each wrap their subtree in `<ThemeOverrideContext.Provider value="dark">` so
any theme-driven child (`Balance`, `Card`, …) resolves dark on the green field.

The `themeStore` machinery is **retained** — `toggleTheme` / `setTheme` stay exported and the
store seeds `"dark"` — so a future light variant is a settings re-add, not a rebuild. Only the
UI toggle is gone. (`src/store/themeStore.ts`, `src/hooks/useColors.ts`.)

## Native-feel polish track (post-submit)

**Goal:** the app should feel indistinguishable from a hand-built SwiftUI app —
**zero perceptible delays, no animation jank, native gestures and transitions.**
Every screen should hold 60/120fps, navigate instantly, and never show a spinner
where a skeleton or optimistic update would do. This is a **Phase-4 polish track
(post-submit)** — captured here so the work has a home; it does NOT block the
launch keystone (deploy → submit).

Levers, highest native-fidelity first:

1. **`@expo/ui/swift-ui`** — render _actual_ SwiftUI views (pickers, lists,
   sections, gauges, the liquid-glass `+/-` pill) from RN. Highest-fidelity path
   to a native look for stock controls. **Currently parked — DO NOT re-enable
   yet.** `@expo/ui` (`0.2.0-beta.10`) is installed but its **pod is excluded** via
   `package.json` → `expo.autolinking.exclude`; it does not compile against SDK 54's
   `expo-modules-core`. The SwiftUI glass pill is **hard-disabled**
   (`BalanceSection.tsx` `POD_INCLUDED = false`) after a **confirmed iOS-26 render
   crash** in builds 25/26 (missing `ExpoUI` Fabric view, no `.ips` log); build 27
   shipped the crash fix and the RN glass fallback ships in its place. Revisit at
   SDK 55. Skill: `expo-ui-swift-ui`. (Android twin: `@expo/ui/jetpack-compose`.)
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
- `useColors()` hook for current theme colors (returns dark, pinned — see above)
- Colors: `src/constants/colors.ts` (`DarkColors`, `LightColors`; brand greens +
  glass tokens identical across both)
- 8px spacing grid: `Spacing.xs/sm/md/lg/xl/xxl`
- Fonts: `Font.regular/medium/semibold/bold/heavy` (SF Pro Rounded on iOS)
- Radius: `Radius` constants for border radii
- Green-world surfaces: `primaryDark` field → `primary` surface → `primaryLight` sheet,
  white text hierarchy, glass overlays, **proportional** widths (`%` / `aspectRatio`)

The token reference, the full component-reuse table, the safe-area shells, and the
per-screen translation recipe are owned by
[figma-design-rules.md](./figma-design-rules.md) — not repeated here.

### Screen scaffolds

Three canonical shells; pick by route group (full table in figma-design-rules.md §6):

- **`AuthScreenScaffold`** (`app/(auth)/*`) — pinned dark, fade transitions; 36pt
  `Font.heavy` title, `marginTop:"auto"` footer; `KeyboardAware`/`scrollable` variants.
- **`SessionScreenScaffold`** (`app/session/*`, a `fullScreenModal`) — manual
  `insets.top/bottom`; header variants `back`/`centered`/`none`; `footer`/`stickyFooter`;
  optional `backgroundColor` override (e.g. `Colors.primaryDark`) for the green field.
- **Tab screens** (`app/(tabs)/*`) — `SafeAreaView edges={["top"]}` (the native tab bar
  owns the bottom); the subtree is dark-pinned at `app/(tabs)/_layout.tsx`.

## Installed Animation Libraries

| Library                        | Version | Status                                       |
| ------------------------------ | ------- | -------------------------------------------- |
| `react-native-reanimated`      | 4.1.7   | Installed, used in some onboarding scenes    |
| `react-native-gesture-handler` | 2.28.0  | Installed, used internally by expo-router    |
| `expo-linear-gradient`         | 15.0.8  | In use (blob avatars, backgrounds, profile)  |
| `react-native-svg`             | 15.15.5 | In use (Timer, onboarding SVG blobs)         |
| `expo-haptics`                 | 15.0.8  | In use (Button, Card, NumPad press feedback) |

## Motion — near-static (founder taste)

The green world is intentionally **near-static**. Build 28 stripped the bouncy/playful
motion the redesign briefly carried; the bar now is calm, fast, and almost imperceptible.
Default to **no animation**; when something must move, it fades.

**Do:**

- **Entrance fades** — `withTiming(1, { duration: ~200, easing: Easing.out(Easing.cubic) })`.
  Short, eased-out, no translate flourish beyond a small fade.
- **Reduced motion is mandatory** — every animation is `useReducedMotion()`-aware and
  jump-cuts to the end state (skip the tween, return the resting style).

**Don't (removed this cycle):**

- **No springs / overshoot / bounce / jelly** on general UI.
- **No spins, no stagger, no rubber-band/slingshot.**
- Removed: the **calendar stamp blink**; the customizer **slingshot / hero-spring** (now a
  plain ~220ms slide); the **die randomize spin** (now instant value swap + a 150ms opacity
  dip).

**Kept (the two deliberate exceptions):**

- **Platform "sleepy-eye" vertical flip** — when the blob customizer opens, the platform's
  happy-arc eyes flip vertically to sleepy/sad (`scaleY` 1 → −1) over **180ms**. Founder-loved;
  `src/components/profile/BlobPlatform.tsx` (`EYE_FLIP_MS = 180`).
- **House press-scale springs** — tactile press feedback uses `{ damping: 15, stiffness: 220 }`
  to scale ~0.95. The one place a spring is still welcome (it reads as a button, not a bounce).

Both still honor reduced motion (jump to the resting state).

> The older "slingshot / jelly overshoot / MorphingBlob-style spring" guidance in
> figma-design-rules.md §6 predates this cull — for NEW work, follow the near-static spec
> here. The press-scale spring config is unchanged and still correct.

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
  dual-gradient color crossfade, blink + squash mid-morph. Reduced-motion jump-cuts. This is the
  one self-contained character animation that keeps a spring — it's the blob morph itself, not a
  general-UI transition (the near-static motion spec governs everything else).
- **Blob Maker onboarding** — `app/(auth)/blob-maker.tsx` (profile-setup → blob-maker → intake):
  blob on an SVG podium, shuffle button + tap-to-shuffle, 5-slot history row. Each shuffle mints a
  `uid:nonce` `shapeSeed` (expo-crypto) — an account-bound visual fingerprint, never a credential.
- **Palettes** — `BLOB_PALETTES` is the single source of truth (BlobAvatar, MorphingBlob,
  ProfileHeader swatches). Live Activity asset names couple to `colorPreset` (`blob_${color}`) —
  adding a palette requires shipping matching native images in `targets/`.
- **Tests** — `blobAvatar.test.ts` (determinism, bounds, clamp, generator-split cross-validation,
  shapeSeed normalize) + `MorphingBlob.test.tsx` (first-paint parity with BlobAvatar).

## Profile tab (v2 — green world)

The Profile tab was rebuilt around new components in `src/components/profile/` on the green
field. The **full spec, verbatim Figma comments, and the Clout scoring model live in
[profile-redesign-brief.md](./profile-redesign-brief.md)** — not duplicated here. In brief, the
v2 pieces are:

- **Clout** (`src/utils/clout.ts`) — replaces the Social-Credit / Reputation card **on this tab
  only** (`CloutCard` + `CloutInfoSheet` bottom sheet + `CloutWeightRow`). The reputation system
  is unchanged elsewhere: `ReputationCard` still ships on friends / `user/[uid]` screens; migrating
  those to Clout is a future product decision.
- **Session history** — `SessionCalendar` + `CalendarHeader` + `CalendarStampBlob` (one
  collectible blob stamp per completed session, seeded by `sessionId`), with
  `SessionReceiptSheet` + `ReceiptActivitySection` (per-session app-usage by category, captured
  at completion).
- **Balance** — `BalanceSection` + `AllTimeTicker` (green up / red down all-time %, fail-safe
  hidden when the ledger is incomplete; `src/utils/balanceDelta.ts`) + the liquid-glass `+/-`
  deposit/withdraw chooser pill. The SwiftUI pill is **hard-disabled** — RN glass fallback ships
  (see the native-feel track above).
- **Blob editor** — `BlobMakerSheet` v2 (partial `pageSheet`) + `BlobMakerStage` + `BlobOptionRows`
  + `BlobPlatform` (the sleepy-eye flip lives here), plus a rewritten `ProfileHeader`.

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
| Firebase Cloud Functions     | Server-side logic, payments | Free tier       | 43 exports deployed         |
| EAS Build                    | iOS/Android builds          | Free tier       | Configured and in use       |
| react-native-reanimated      | Animations                  | Free            | Partially used (onboarding) |
| react-native-gesture-handler | Gesture tracking            | Free            | Used by router              |
| react-native-svg             | SVG illustrations           | Free            | In use                      |
| expo-haptics                 | Tactile feedback            | Free            | In use                      |
| Jest + jest-expo             | Testing                     | Free            | ~957/963 passing (6 skips)  |
| ESLint 9 + Prettier          | Linting + formatting        | Free            | 0 errors / 0 warnings       |
| Stripe                       | Payments                    | Per-transaction | Integrated (live keys)      |
