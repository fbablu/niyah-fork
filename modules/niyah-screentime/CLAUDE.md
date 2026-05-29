# modules/niyah-screentime — Screen Time native module

- **Custom Expo module** (Swift via ExpoModulesCore). JS side: `src/{index,NiyahScreenTimeModule,types}.ts`. Swift side: `ios/{NiyahScreenTimeModule,AppPickerHostingController,NiyahActivityAttributes}.swift`.
- **The app extensions are NOT here.** Shield/monitor/report/widget live in top-level `targets/` and are registered by `@bacons/apple-targets` (via `targets/*/expo-target.config.json`), **not** by config plugins. Don't recreate the old `withScreenTimeExtensions`/entitlement plugins.
- **Module ↔ extensions talk via App Group `UserDefaults`** (module writes/reads, extensions read/write). Live Activity start/end methods are on `NiyahScreenTimeModule.swift` (not a separate module).
- **FamilyControls Distribution** is approved for all 5 extension bundle IDs (2026-05-16). Apple's DeviceActivity API keeps raw per-app usage on-device (opaque tokens) — don't try to exfiltrate it.
- **Native changes require a rebuild** (`pnpm build:local`); JS-only edits hot-reload.
- Reference: [docs/native-modules.md](../../docs/native-modules.md).
