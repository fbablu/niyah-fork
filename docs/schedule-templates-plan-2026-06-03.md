# Schedule / weekly templates — implementation plan (2026-06-03)

> Opal-style recurring focus blocks. Decisions (Fardeen, 2026-06-03): **Schedule tab**,
> **auto-start (OS-enforced)**, **per-template optional stake**, presets **Work day 9–5 /
> Morning 6–11 / Study evening 6–10 / Custom**.

## Phase 1 — SHIPPED 2026-06-03 (client-only, free blocks, tested)

- `src/types/index.ts` — `ScheduledTemplate` + `Weekday`.
- `src/constants/scheduleTemplates.ts` — 3 presets + `CUSTOM_TEMPLATE_DEFAULT`, pure helpers
  (`presetToTemplate`, `formatWindow`, `formatDays`).
- `src/store/scheduleStore.ts` — AsyncStorage-persisted templates; CRUD; arms/clears the OS
  schedule via `startScheduledBlocking`/`stopScheduledBlocking`; `syncNative()` re-arms on launch.
- `app/(tabs)/schedule.tsx` + tab registered (`calendar` SF Symbol) — list, enable/disable,
  inline day chips, delete, add-from-preset + Custom.
- Tests: `src/__tests__/unit/store/scheduleStore.test.ts` (8 ✓). Full suite green; tsc/eslint clean.

**Visual polish is Fardeen's lane** (the screen is functional, not final).

## Phase 1.5 — weekday-specific enforcement (needs native rebuild)

The native wrapper `startScheduledBlocking(startHour, startMin, endHour, endMin, activityName)`
applies a **daily** repeating window — it ignores `days`. So "Work day = Mon–Fri" currently arms a
daily 9–5 block. Real weekday enforcement needs the native `DeviceActivitySchedule` to carry
weekday `DateComponents` (one schedule per weekday, or an `intervalStart/End` with weekday).
- Touch: `modules/niyah-screentime` (Swift) + the `startScheduledBlocking` signature.
- Requires an EAS rebuild. Until then the UI lets users pick days but enforcement is daily — make
  that honest in copy if shipping before this lands.

## Phase 2 — per-template auto-stake (needs a Cloud Function + deploy + /vibe-security)

`stakeCents > 0` is **inert** today (the store arms a free block and logs a warning). Auto-staking on
a schedule moves real money while the user is away, so it must run server-side:
- New CF (e.g. `createScheduledStakedSession`) triggered at the window start (DeviceActivityMonitor
  extension fires → app/CF), which debits the wallet + creates the session atomically (same path as
  `createSoloSession`). Idempotent per (uid, templateId, calendar-day).
- Guardrails: respect `DAILY_STAKE_CAP_CENTS`; never auto-stake more than the wallet holds; clear
  user consent at template-create time; honour the billing kill-switch.
- `/vibe-security` on the diff; needs `firebase deploy`. **Cannot ship from a JS-only build.**
- Then surface the stake field in the Schedule tab editor.

## Also deferred
- Full time editor (hour/minute pickers) — Phase 1 uses presets + a 9–5 Custom default + inline day
  chips. Add `@react-native-community/datetimepicker` (or a custom wheel) for arbitrary times.
- Firestore sync of templates across devices (Phase 1 is local/AsyncStorage only).
