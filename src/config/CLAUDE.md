# src/config/ — clients & native wrappers

- **Files:** `firebase.ts` (auth + Firestore helpers), `functions.ts` (callable CF client), `appCheck.ts`, `notifications.ts` (FCM + notifee), `screentime.ts` (Swift module JS bridge), `sslPinning.ts`, `sentry.ts`.
- **No secrets here.** Only `EXPO_PUBLIC_*` config (embedded in the bundle). True secrets live in Firebase Secret Manager (server-side only).
- **Native wrappers must fail gracefully:** lazy `require()` + try/catch, no-op in `__DEV__` / on web (pattern set by `sslPinning.ts` + `screentime.ts`). Don't let a missing native module crash JS.
- **App Check** (`appCheck.ts`) attests App Attest/DeviceCheck; server enforcement is flag-gated — keep `APP_CHECK_ENFORCED=false` until Console Metrics ≥99%.
- **Screen Time** bridges `modules/niyah-screentime`; iOS extensions live in `targets/` (see [modules/niyah-screentime/CLAUDE.md](../../modules/niyah-screentime/CLAUDE.md), [docs/native-modules.md](../../docs/native-modules.md)).
- **Scoped test:** `pnpm test` (root). `firebase.ts` is money/auth-adjacent → `/vibe-security` on changes.
