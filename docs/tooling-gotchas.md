# Tooling, CI, Build & Git Gotchas (lessons learned)

> Hard-won operational lessons from the **build-22 launch line (2026-06)**. Each of these
> cost real iteration. Read before touching CI, the toolchain, the git flow, or builds.
> Companion to [development.md](./development.md); current state in [STATUS.md](./STATUS.md).

## Node + pnpm version split

- **pnpm 11.5.2 (the repo `packageManager`) cannot run on Node < 22.13** — it imports
  `node:sqlite` → `ERR_UNKNOWN_BUILTIN_MODULE`. Run **every `pnpm` command on the default
  Node (≥22.13)**. Do NOT prepend the nvm Node-20 path before a `pnpm` command.
- **jest no longer needs Node 20.** The old `jest-worker` crash on Node 26 (~7 fake suite
  failures) is gone as of 2026-06-07 — `pnpm run ci` passes 828 client + 91 functions tests on
  the default Node. The `"A worker process has failed to exit gracefully"` line is a benign
  teardown warning, not a failure.
- `tsc --noEmit` is Node-agnostic — `pnpm typecheck` works on any Node.

## GitHub Actions / CI

- **Do NOT use `pnpm/action-setup@v4`.** Its self-installer is broken
  (`Error: Something went wrong, self-installer exits with code 1`, a registry bug —
  [pnpm/action-setup#135](https://github.com/pnpm/action-setup/issues/135)), *independent of
  Node version*. Install pnpm via **`npm install -g pnpm@11.5.2`** instead.
- **`setup-node@v4` (Node 22) must come BEFORE** installing pnpm (pnpm needs ≥22.13). We dropped
  `cache: pnpm` — it requires pnpm to exist before `setup-node`, a chicken-and-egg not worth it.
- **pnpm 11 native-build gate:** pnpm 11 refuses to run a dependency's build script unless
  allow-listed → `ERR_PNPM_IGNORED_BUILDS` (hit by `sharp@0.34.5`, pulled transitively by Next 16
  in `landing-pg/`). The fix has THREE traps:
  1. NOT `pnpm.onlyBuiltDependencies` in `package.json` — **pnpm 11 ignores the `pnpm` field in
     package.json** (`[WARN] no longer read`).
  2. NOT `onlyBuiltDependencies` in `pnpm-workspace.yaml` — that key was **renamed**.
  3. ✅ `allowBuilds: { <pkg>: true }` in **`pnpm-workspace.yaml`** (a name→bool map). See
     `landing-pg/pnpm-workspace.yaml`.
- **Verify any build-script / CI fix clean-room with the EXACT CI pnpm version** before pushing:
  `npx pnpm@11.5.2 -C <dir> install --frozen-lockfile` on a **fresh** node_modules (a temp copy
  works). A locally-installed older pnpm silently "passes" and hides pnpm-11 behavior — this
  cost ~6 failed CI rounds.
- All four workflows (`ci`, `deploy-landing`, `eas-preview`, `eas-production`) follow this
  pattern now. EAS builds are `--platform ios` (iOS-only since 2026-06-07).

## Git workflow — `main` is ruleset-protected

- `origin` is the personal fork **`fbablu/niyah-fork`** (no upstream remote).
- `main` has a **repository ruleset "protect main"** (id `16625651`): `required_linear_history`
  (no merge commits), `pull_request` (changes via PR), `non_fast_forward`, `deletion`. A direct
  `git push origin main` with a merge commit or as a non-PR push is rejected with `GH013`.
- **Fardeen (owner) is on the bypass list** (Repository admin role, "Always") → can push
  directly to `main`; the ruleset still guards bots/collaborators. This is the standing workflow.
- **Do NOT `git merge <branch>` into main locally** — that creates a merge commit that violates
  `required_linear_history`. To bring work to main: fast-forward, squash-PR, or admin-bypass
  direct push of linear commits.
- Rulesets are a *different* API from classic branch protection:
  `gh api repos/<owner>/<repo>/rulesets` (classic `branches/<b>/protection` returns 404).
- Squash-merging a PR makes the feature branch diverge from main (different SHAs, same content);
  resync with `git reset --hard origin/main` if you keep using the branch.

## Build types — what runs where (THERE IS NO OTA)

| | Dev client (`pnpm build:local`) | Release / TestFlight |
| --- | --- | --- |
| JS source | **Metro at runtime** | **baked in at build time** |
| Needs Metro running? | yes | no |
| Works offline (no Mac)? | no | yes (online via cellular for Firebase/Stripe) |
| Live reload? | yes | no |
| Gets new code via | save file | **rebuild + reinstall** |

- **No OTA channel exists** (`expo-updates` not installed). Code changes only reach an installed
  build via a **new build**. A given IPA's JS is frozen at build time — e.g. build
  `build-1780863322889.ipa` was cut *before* the Screen Time preview, so it does not contain it.
- For a **Metro-free demo phone**: `npx expo run:ios --device --configuration Release` installs a
  standalone app over USB (valid ~1 yr on a paid Apple account). Rebuild to refresh.

## SSL pinning discipline (the build-21 prod outage)

- `src/config/sslPinning.ts` pins **all four GTS roots** — roots only, **never intermediates**.
  Build 21 pinned the WE2 *intermediate*; Google rotated to WR2 and **every Cloud Function call
  in prod died** ("Network request failed": deposits, delete-account, legal acceptance). Safety
  valve `expirationDate: 2027-01-01` degrades to normal TLS rather than bricking.
- **Pinning is OFF in `__DEV__`.** The ONLY pre-TestFlight test of the real pin set is a
  **Release device build** (`expo run:ios --device --configuration Release` → exercise a Cloud
  Function, e.g. open the deposit PaymentSheet). A pin mismatch is invisible in every dev build.

## Dev loop / Metro

- Use **LAN**: `pnpm start` (no `--tunnel`). Same WiFi → dev client hits the LAN URL. `--tunnel`
  routes through ngrok, which is flaky/blocked on managed/campus networks (`Cannot read
  properties of undefined (reading 'body')`).
- expo-router `useLinkPreviewContext must be used within a LinkPreviewContextProvider` at the
  root `<Stack>` = Metro serving **duplicate module copies** (React context identity mismatch).
  Fix: clear Metro cache (`npx expo start --dev-client -c`); if it persists, `pnpm dedupe`.
