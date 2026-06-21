# Staking Wizard — Dial + Line Plot Handoff (next session)

> **Pick up here.** Read this doc, then `CLAUDE.md`, `docs/STATUS.md`, and
> `docs/staking-wizard-plan.md` (the full spec), plus the three dial source files listed below.
> This is a temporary handoff — delete it once the work below lands.

## Status — what's DONE and committed

The reusable session **Dial** (Milestone 1) is finished and committed:

- `src/components/session/Dial.tsx` — a **native `ScrollView` picker** (`snapToInterval` +
  `decelerationRate="fast"` + plain `onScroll` for ticks/haptics). Apple side-scroll physics:
  flick → decelerate → snap, with a per-detent selection haptic during drag **and** the native
  coast, and an impact on settle. **DO NOT re-tune the dial physics — they're dialed in.**
- `src/components/session/RollingNumber.tsx` — odometer readout: per-digit 0–9 columns, keyed by
  place value, shortest-ring roll (`9→0` ticks `+1`, new leading digit rolls in from 0 → "09→10").
- `src/components/session/dialMath.ts` — pure helpers (`clampPosition`, `indexForOffset`,
  `indexOfValue`, `maxIndexForCap`, `ringDelta`, `nearestRingIndex`, `rangeValues`), all unit-tested.
- Tests: `src/__tests__/unit/components/{Dial,RollingNumber,dialMath}.test.ts(x)`; reanimated mocks in
  `jest.setup.ts`. `react-native-wagmi-charts` is installed (for the line plot). Gates green
  (`pnpm typecheck`, `pnpm test`, `eslint`).

**Dial API:** `{ values: number[], value, onChange, format, label, accessibilityLabel,
disabledAbove?, subline? }`. `values` are ascending; `format(v)=>string` renders the readout;
`disabledAbove` is a max selectable VALUE (detents above render dimmed and snap back). A11y is
`accessibilityRole="adjustable"` with increment/decrement.

## Locked decisions (founder, 2026-06-20)

1. **One dial, `$0 = free`.** The stake dial runs `$0 → $25`. `$0` = a free / non-staked session;
   `≥$2` = staked. The amount **is** the choice — no separate free/stake toggle or buttons.
   ($1 is skipped; server min stake is $2.)
2. **Everything on one "ticket-stub" screen** — people dial + stake dial + friends (when >1) +
   app-block + start, all on one card.
3. **People dial:** `1 = solo`, `2–5 = group` (reveals the friend picker).
4. **Line plot → Profile `BalanceSection`, replacing `AllTimeTicker`.**

## Build scope

### 1. Unified "ticket-stub" create-session screen
Replaces the dashboard's 3 CTAs (`app/(tabs)/index.tsx` ~967–1002), the stake **numpad**, and the
**staked-vs-non-staked split**. One screen:
- **People dial** (values `1–5`): 1 = solo; 2–5 = group → reveal the friend picker (reuse
  `propose.tsx`'s partners+following dedup list + its empty state).
- **Stake dial**: values in cents `[0, 200, 300, …, 2500]`; `format` shows **"Free"** at 0, else
  `"$X"`. `$0` + 1 person → free solo (quick-block path). `≥$2` → staked. Clamp the stake dial to
  wallet balance + remaining daily cap via `disabledAbove`.
- **App-block + start** fold into the same flow — reuse `validateAndPromptForAppSelection` and
  `confirm.tsx`'s hard-won gate-before-charge + `startingRef` double-tap guard + `SlideToConfirm`.

### 2. Profile line plot
In `src/components/profile/BalanceSection.tsx`, **replace `AllTimeTicker`** with a
`react-native-wagmi-charts` scrubbable balance-trend sparkline + the `RollingNumber`: drag → number
rolls + selection haptic per point + green ▲ / red ▼ vs the period open; line colored by trend. Data
= a **running balance derived from the wallet transaction ledger** (`walletStore` / transactions).
If a clean series isn't readily derivable, use a documented placeholder and flag it.

## Money path — constraints + the ONE open decision

- **Group** custom stake ($1–$100) is **already supported** by `createGroupSession` — wire to it.
- **Solo** custom stake is an **OPEN money-path decision — ASK Fardeen, do NOT decide:**
  - **Option A:** extend `createSoloSession` with `stakeCents`+`durationMs` (reviewed pass +
    real-money smoke).
  - **Option B:** snap solo to the existing cadence ladder (no server change, ships now).
  - Default to **B** for a UI-first build; confirm before touching the CF.
- **Do NOT touch** the deferred C1/C2/H1/M1 money P0s. Run **`/vibe-security`** on any money-adjacent
  diff (group debit, solo stake).

## Conventions / gates / git
- Components <150 lines where reasonable; `useColors()`; 8px `Spacing` grid; green-world tokens;
  motion near-static elsewhere (the dial is the one flowy exception, already done).
- Tests pin contracts (no count-padding; cross-validate paths that must agree).
- **`pnpm typecheck` AND `pnpm test` must be green before declaring done.**
- **Fardeen runs all git** — supply one-line commit messages only (no body, no trailer); never
  push/merge/deploy. Work on the current `redesign-green-world` branch (no worktrees).

## Running on device (build gotchas)
- Dev client: **`pnpm build:local`** (now builds RN from source via `RCT_USE_PREBUILT_RNCORE=0` —
  required on Xcode 26, else the prebuilt React core fails to link expo-dev-menu). First build is
  slow; afterwards `pnpm start` + reload for JS-only changes. Haptics need a real phone.
- After changing deps, pnpm re-hashes `.pnpm/` dirs → Metro can throw `JsonFileError … ENOENT` for
  a stale hashed path. Fix: `pnpm install` → `pnpm start -c` → swipe-kill + relaunch the app.
- A dev-only `GO_BACK was not handled` red-box = stale persisted nav state from a removed route;
  swipe-kill + relaunch clears it.

## First step for the new session
Confirm the git state (`git log --oneline -3` should show the dial commit), then **present an
implementation plan** for the one-stub screen (file layout; how `$0=free` maps to the free vs
`createGroupSession`/`createSoloSession` paths; the `BalanceSection` line-plot wiring) and **confirm
the solo-stake Option A/B with Fardeen** before writing any money-adjacent code.

> Memory: see "Staking Wizard Direction" and "Local iOS Build Gotchas".
