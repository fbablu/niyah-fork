# Figma → code design-system rules

> Operating rules for implementing Figma designs in this codebase (via the Figma MCP or by hand).
> Grounded against the real code 2026-06-11. Companion: [profile-redesign-brief.md](./profile-redesign-brief.md).

## Non-negotiables (read first)

1. **Target React Native 0.81 + Expo SDK 54, `StyleSheet.create` — NEVER React/Tailwind/HTML.**
   `get_design_context` defaults to React + Tailwind; always steer it (`clientFrameworks:
"react-native"`, `clientLanguages: "typescript"`) and treat its JSX/Tailwind output as a
   _measurement source_ (sizes, colors, spacing), not code to paste.
2. **Map raw values onto tokens — never hardcode.** Figma px → nearest `Spacing`/`Radius`/
   `Typography` token; Figma hex → semantic `Colors.*` key via `useColors()`. A hardcoded hex or
   px in a new component is a review defect (decorative SVG art is the one exception).
3. **Every screen must work in BOTH themes** (dark + light) and honor **reduced motion**.
4. **Legal language:** copy uses _stake / commitment / goal / complete_ — never _bet / wager /
   gamble / win_. Applies to ALL generated UI text.
5. **Reuse the component library** (below) before generating anything new. The scaffolds,
   `Button`, `Card`, `Balance`, `BlobAvatar` cover most Figma primitives.

## 1. Design tokens — single file: `src/constants/colors.ts`

Exports: `DarkColors`, `LightColors`, `Theme`, `ThemeColors`, `ThemeColorMap`, `Spacing`,
`Typography`, `Font`, `BaseFontFamily`, `Radius`. No shadow token group (see Card for the one
canonical shadow). No token-transformation pipeline — plain TS constants.

**Spacing (8px grid):** `xs:4 · sm:8 · md:16 · lg:24 · xl:32 · xxl:48`
**Radius:** `xs:4 · sm:8 · md:12 · lg:16 · xl:24 · full:9999`
**Typography (px):** `displayLarge:56 · displayMedium:44 · displaySmall:36 · headlineLarge:32 ·
headlineMedium:28 · headlineSmall:24 · titleLarge:22 · titleMedium:18 · titleSmall:16 ·
bodyLarge:17 · bodyMedium:15 · bodySmall:13 · labelLarge:14 · labelMedium:12 · labelSmall:11`

**Font — SF Pro Rounded via the iOS system `ui-rounded` family** (no font files, no expo-font):

```ts
const ROUNDED = Platform.OS === "ios" ? "ui-rounded" : undefined;
export const Font = {
  regular: { fontFamily: ROUNDED, fontWeight: "500" }, // names skew ONE step
  medium: { fontFamily: ROUNDED, fontWeight: "600" }, // heavier than the
  semibold: { fontFamily: ROUNDED, fontWeight: "700" }, // literal weight
  bold: { fontFamily: ROUNDED, fontWeight: "800" },
  heavy: { fontFamily: ROUNDED, fontWeight: "900" },
};
```

Usage is a **style spread**: `{ fontSize: Typography.titleSmall, ...Font.semibold }`. When Figma
says "SF Pro Rounded Semibold (600)", that's `Font.medium` here — match by weight number, not name.

**Colors — semantic keys, identical key set in both themes.** Brand: deep forest green
`primary #2D6A4F` (+ `primaryDark #1B4332`, `primaryLight #40916C`, `primaryMuted` rgba). Accents:
`accent #5C415D`, `accentBlue #1B3A4B`, `accentClay #8B2500`, `accentGold #B8860B` (same both
themes). Dark backgrounds are deep earth (`background #1A1714` → `backgroundTertiary #4A4035`);
light are warm cream (`background #f5ead8ff` → `backgroundTertiary #D9CEC0`). Text hierarchy
`text/textSecondary/textTertiary/textMuted`. Money: `gain`/`gainLight` (green) and `loss`/
`lossLight` (clay red) — **use these for the balance up/down ticker**, not `success`/`danger`.
Also: `warning(+Light)`, `danger(+Light)`, `info(+Light)`, `buttonPrimary/Secondary/Disabled`,
`border/borderLight/borderFocused`, `overlay/overlayLight`, `shimmer`, `skeleton`, `white`.

**Figma-green note:** the file's greens ARE the brand tokens — `#1b4332` = `primaryDark`,
`#2d6a4f` = `primary`, `#40916c` = `primaryLight` — and the profile tab is a FULL-BLEED green
screen: `primaryDark` background, `primary` surfaces, white text/borders, `glassLight`/`glassMid`/
`glassDark` translucent overlays (identical in both themes). Do NOT substitute the standard
`background*` tokens when the design shows the green world — that mistake caused the v1 profile
rework (see profile-redesign-brief.md "v2 feedback round").

**Theme switching** (`src/hooks/useColors.ts`, `src/store/themeStore.ts`): zustand + AsyncStorage
(`"niyah-theme"`); `ThemeOverrideContext` pins subtrees (whole `(auth)` group is pinned dark).
Canonical consumption:

```tsx
const Colors = useColors();
const styles = useMemo(() => makeStyles(Colors), [Colors]);
// ... at the bottom of the file:
const makeStyles = (Colors: ThemeColors) => StyleSheet.create({ ... });
```

## 2. Component library — `src/components/` (reuse before generating)

Barrel: `src/components/index.ts` (+ `profile/`, `session/`, `onboarding/` sub-barrels).
BlobsBackground and BottomTabs are NOT in the main barrel — import directly.

| Figma element             | Use this, don't regenerate                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any CTA / pill button     | `Button` — `variant: primary\|secondary\|danger\|ghost\|outline`, `size: small\|medium\|large`, `loading`, `fullWidth` (default true), Medium haptic + press-spring built in |
| Card surface              | `Card` — `variant: default\|elevated\|outlined\|interactive`, optional `onPress` (Light haptic), fade-in `animate`/`delay`                                                   |
| Money amount              | `Balance` / `CompactBalance` / `AnimatedDigit` — cents in, `color: "auto"` for gain/loss tinting                                                                             |
| Countdown / progress ring | `Timer` (`mode: ring\|scrubber`) / `InlineTimer`                                                                                                                             |
| Money-confirm gesture     | `SlideToConfirm`; destructive hold = `HoldToConfirmModal`                                                                                                                    |
| Amount entry              | `NumPad` + `AmountDisplay`                                                                                                                                                   |
| Loading placeholder       | `Skeleton` (reduced-motion aware)                                                                                                                                            |
| Toast / banner            | `useStatusBanner()` (global queued system)                                                                                                                                   |
| Celebration               | `Confetti`, `MoneySuccessOverlay`                                                                                                                                            |
| User avatar / mascot      | `BlobAvatar` (config-driven SVG blob); editor = `profile/BlobMakerSheet`; morph animation = `MorphingBlob`                                                                   |
| Profile pieces            | `profile/`: `ProfileHeader`, `ReputationCard` (→ becomes Clout), `ScreenTimeCard`, `NeverBlockCard`, `TransactionHistory`                                                    |

**Architecture rules:** functional + hooks only; props `interface` above the component; `useColors()`

- memoized `makeStyles(Colors)`; `StyleSheet.create` at the bottom; keep components **<150 lines**
  (split, don't bloat); error containment at the **screen** level via
  `withErrorBoundary(ScreenInner, "label")`; haptics fire synchronously in `onPress`.
  Tests: `src/__tests__/unit/components/<Name>.test.tsx` — new components ship with one.

**Blob system** (`src/constants/blobAvatar.ts` is the single source of truth):
`BlobAvatarConfig = { colorPreset: sunset|ocean|forest|berry|lemon|coral, shapePreset:
peach|wave|petal|unique, eyesPreset: classic|happy|wink|sleepy|surprised, shapeSeed? }`.
"unique" shapes are seed-generated (`generateBlobPoints` — FNV-1a/mulberry32; **draw order is
determinism-load-bearing, never reorder**); `pointsToBlobPath` is a Reanimated worklet;
`normalizeBlobAvatarConfig` sanitizes the owner-writable Firestore field. The Figma customizer's
eye-shape rows map onto `eyesPreset`; "sleepy" already exists (the platform sad-eyes detail).

## 3. Frameworks & build

React Native 0.81 + Expo SDK 54 (New Architecture), TypeScript strict, Expo Router (typed routes),
Zustand, Reanimated v3 (+ react-native-svg, react-native-keyboard-controller, expo-haptics),
pnpm, EAS Build / `expo run:ios` (dev client — NOT Expo Go), Jest + jest-expo.
iOS-only in practice (`userInterfaceStyle: "dark"` at OS level; in-app theming is ours).

## 4–5. Assets & icons

- **Icons: `Ionicons` from `@expo/vector-icons` — the ONLY icon family in JS.** Kebab-case names
  (`close`, `pencil`, `person-add`, `shuffle`); literal sizes (14/22/24); color ALWAYS from
  `Colors.*`. Tab bar uses native SF Symbols via react-native-bottom-tabs
  (`tabBarIcon: () => ({ sfSymbol: "person" })`). Figma's `SF Pro • chevron.left`-style text
  layers → `Ionicons` equivalents (`chevron-back`/`chevron-forward`) in JS screens.
- **Custom art = react-native-svg primitives** (`Svg/Path/Circle/Defs/LinearGradient`), or
  hand-inlined SVG XML strings via `SvgXml`. **No metro SVG transformer — `.svg` files can't be
  imported.** Export Figma vectors as path data and inline them. Filters are unsupported — strip.
  Gradient convention: `x1="0.25" y1="0" x2="0.75" y2="1"`.
- **Bundled images:** static `require("../../assets/…")` only. `assets/onboarding2|3/` are design
  sources, never referenced from code. No Lottie.

## 6. Styling & layout patterns

**Safe areas — three canonical shells (pick by route group):**

- **Tab screens** (`app/(tabs)/*`): `SafeAreaView edges={["top"]}` (tab bar owns the bottom);
  `scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom:
Spacing.xxl }`. Decorative `BlobsBackground` sits OUTSIDE the SafeAreaView (dashboard only).
  Do NOT add `contentInsetAdjustmentBehavior="automatic"` (double-insets). Known outlier:
  `schedule.tsx` manual insets — migrate when touched.
- **Session screens** (`app/session/*` — the group is a `fullScreenModal`): wrap in
  `SessionScreenScaffold` (manual `insets.top/bottom`; header variants `back`/`centered`/`none`;
  `footer` or `stickyFooter`). `surrender`/`deposit`/`withdraw` are `presentation: "modal"` sheets.
- **Auth/onboarding** (`app/(auth)/*`, pinned dark, fade transitions): wrap in `AuthScreenScaffold`
  (36pt `Font.heavy` title, `marginTop:"auto"` footer).

**In-screen sheets** (the customizer pattern): RN `Modal` with `animationType="slide"
presentationStyle="pageSheet"` — see `BlobMakerSheet.tsx`.

**Motion — Reanimated v3 for ALL new work** (legacy `Animated` exists in old files; don't copy):

- Entrances: `withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })` (BlobMakerSheet
  hero zoom).
- Springs: named module-level configs — `MORPH_SPRING { damping:13, stiffness:110, mass:1 }`
  (jelly overshoot), press-scale `{ damping:15, stiffness:220 }` to 0.95, sheet rise
  `{ damping:18, stiffness:180 }`. The Figma "slingshot/rubber-band" = low-damping spring with
  overshoot, MorphingBlob-style.
- Loops: `withRepeat(withTiming(..., Easing.inOut(Easing.ease)))` (breathe 2600ms, pulse 500ms).
- **Reduced motion is mandatory:** `useReducedMotion()` from reanimated, then jump-to-end
  (`reducedMotion ? 1 : withSpring(1, …)`), skip the effect, or return `{}` from the style.

**Haptics convention:** Medium impact = primary CTA (built into Button) · Light = secondary
taps/cards/keys · `selectionAsync` = pickers/toggles · Success = completed action ·
Warning = validation · Error = destructive outcome (surrender only).

## 7. Project structure & state wiring

Screens → `app/` (file-based routes; groups `(auth)`/`(tabs)`/`session/`/`user/`). Reusable UI →
`src/components/`. Tokens → `src/constants/colors.ts`. Types → `src/types/index.ts`.

- **State:** one Zustand store per domain (`auth`, `session`, `wallet`, `groupSession`, `partner`,
  `social`, `schedule`, `theme`, `featureFlags`). Components read with **per-field selectors**
  (`useWalletStore((s) => s.balance)`); stores call each other via `getState()`.
- **Money is integer cents end-to-end**; display only via `formatMoney` (`src/utils/format.ts`,
  with `formatTime`/`formatDate`/`formatRelativeTime` etc.).
- **Writes:** local `set()` first, Firestore fire-and-forget `.catch(logger…)`. Money/status paths
  in prod go through Cloud Functions — never client-write those.
- **`DEMO_MODE`** (`src/constants/config.ts`): branch via the imported constant
  (`{DEMO_MODE && …}`), never read env vars in components.
- **Clout target (profile redesign):** today's social credit = `UserReputation` on
  `User.reputation` (+ `REPUTATION_LEVELS` in config.ts) rendered by `ReputationCard`
  ("Social Credit"), `ProfileHeader` badge, friends rows, `app/user/[uid].tsx`, and referral copy
  in `app/invite.tsx`/`InviteCTA` ("+10 social credit") — ALL of these change when Clout lands.
  Scoring spec: [profile-redesign-brief.md](./profile-redesign-brief.md).

## Figma MCP workflow recipe

1. `get_metadata` (fileKey `GXxiG7IYSw0o6WGc9UHwzn`) for structure → `get_screenshot` for visual
   truth → `get_design_context` for measurements (steered to react-native/typescript).
2. Scope pulls to ONE frame/section at a time (the profile frames are heavy).
3. Translate: px → `Spacing`/`Radius`/`Typography`, hex → `Colors.*`, text styles → `Font.*`
   spreads, SF-Symbol text layers → Ionicons, vectors → inline `Path` data.
4. Compose from the library table above; new components follow §2 architecture rules.
5. Gate: `pnpm typecheck && pnpm lint && pnpm test` before handing back; new copy passes the
   legal-language sweep.
