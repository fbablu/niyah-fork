# Session Resume — 2026-05-30 (PM)

> Paste the block below into a new session to pick up where this left off.

---

## Copy-paste resume prompt

```
Resuming Niyah on branch wallet-ledger (== main == origin/main, the de-pooled v1).

DONE this session (2026-05-30): (1) gated the functions money-path tests in CI
(pnpm test:functions = node:test + tsx, wired into `pnpm run ci` + GitHub CI; 52/52);
(2) doc truth-ups; (3) the big one — merged wallet-ledger INTO main. main had been an
OLDER parallel launch line (no bucket ledger, no hosted legal); wallet-ledger was the
fuller v1. Reconciled with `git merge -s ours origin/main` then linear `--force-with-lease`
(main rewritten 756e4d9 -> 4bb9ae1, no merge commit). (4) De-pooled the landing site +
stripped all em-dashes + shipped via PR #7 -> main -> GitHub Pages -> niyah.live (live).

I'm now doing MANUAL QA before deploying. Do NOT deploy or push anything.

NEXT once QA passes (in order):
  1. Money-path deploy: `cd functions && npm install` then
     `firebase deploy --only functions,firestore:rules,firestore:indexes`
     (live sk_live_ Stripe — irreversible; pre-flight the secrets + flags first).
  2. build:production (EAS) -> binary -> smoke on device -> submit to App Store.

Guardrails: I run ALL git/deploy/push — you supply exact commands only, never execute.
Commit style: one-liner subject, no body, no trailer. /vibe-security on any
auth/payments/rules diff. No bet/wager/gamble/win language in the app or legal (the
landing site can keep a bit of edge). Keep APP_CHECK_ENFORCED=false until App Check >=99%.

Read docs/session-2026-05-30-resume.md and docs/STATUS.md first.
```

---

## What shipped this session

1. **CI gating of functions tests.** `pnpm test:functions` (`node --import tsx --test functions/src/*.test.ts`) added and wired into `pnpm run ci` + `.github/workflows/ci.yml`. They use Node's built-in runner, not jest, so they were silently un-run before. 52/52 pass. `tsx` added to devDeps.
2. **Doc truth-ups** in `docs/STATUS.md`, `docs/development.md` (`pnpm run ci`, not bare `pnpm ci`), `functions/CLAUDE.md`.
3. **wallet-ledger → main cutover (canonical).** `origin/main` had diverged into an older launch line (4 commits incl `bf12a0f` launch hardening) with **no `wallet.ts` bucket ledger, no hosted legal**, ~1000 fewer lines in `index.ts`. Local `wallet-ledger` was a strict superset (identical 41 CF exports, strict-superset rules). Reconciled via `git merge -s ours origin/main` → reset to linear → `git push --force-with-lease origin wallet-ledger:main` (needed a one-off branch-protection bypass). **Backup tags:** `backup/main-pre-merge` (756e4d9), `backup/wl-local-pre-merge` (4bb9ae1), `backup/origin-wl-2260137` (the stale remote wallet-ledger + its test commit).
4. **Landing de-pool sweep + slop removal + deploy.** Found the live landing still selling the OLD pooled model (contradicting the de-pooled Terms): `how-it-works` "shared pool / pool redistributes / earn more than you staked", `faq` "redistributed to people who stayed focused" + Venmo + "is the competition fair", `bento-grid` "Normalized competition" card, `features` "Fair competition". All rewritten de-pooled (own stake, forfeit to the house, never to another user). Stripped **every user-facing em-dash** (both legal pages + all components). Added the `/legal` index (was 404), footer Privacy/Terms links, legal-header wordmark (dropped the N box), hero "First 100" → "First 1,000". Shipped via **PR #7 (squash) → main → Pages → niyah.live**.

## Current state

- `main` == `wallet-ledger` == `origin/main` == the de-pooled v1. niyah.live updated.
- **Prod money path is still the OLD launch functions** — the new bucket ledger is on main but NOT deployed. That's step 2 below.
- Branch protection: `fbablu/niyah-fork` main ruleset = **no merge commits + PR required**. It was disabled during the cutover bypass — **confirm it's re-enabled (Active)**.

## Open loose ends (none blocking QA)

- [ ] Confirm the branch-protection ruleset is **Active** (Settings → Rules).
- [ ] **In-app legal** (`src/components/LegalContentView.tsx`) likely still has em-dashes + possibly stale pooled copy — sweep to match the hosted pages (`fix/appstore-copy` worktree exists for this; bump `CURRENT_LEGAL_VERSION` only if wording changes materially).
- [ ] 2 em-dashes left in **code comments** (`app/globals.css`, `app/stripe/return/page.tsx`) — cosmetic, not rendered.
- [ ] Port `2260137`'s helper tests (`readBuckets`/`drawDown`/`toComposition`/legacy-seed/negative-clamp) into the current `functions/src/wallet.test.ts` (preserved at `backup/origin-wl-2260137`).
- [ ] `cd functions && npm install` before the functions deploy — main's `8c2a8cd` lockfile refresh was dropped in the cutover.
- [ ] Clean up the 4 worktree branches (`chore/dead-code`, `chore/docs`, `feat/ux-onboarding`, `fix/appstore-copy`) + `launch` + the `backup/*` tags once deploy is confirmed.
- [ ] 11 Dependabot alerts (6 high, 5 moderate) on niyah-fork.

## Next steps (in order)

1. **Manual QA** ← current focus. Exercise the de-pooled money path on device(s): deposit, solo stake → complete → withdraw, group stake (each own stake back, nothing pooled), surrender/forfeit, delete-account refund split, withdrawal gate.
2. **Money-path deploy.** `cd functions && npm install`, then `firebase deploy --only functions,firestore:rules,firestore:indexes`. Pre-flight: `STRIPE_SECRET_KEY` (sk_live_) + webhook secret present, `APP_CHECK_ENFORCED=false`, `FINALS_PROMO_CENTS=0`. **Live, irreversible.**
3. **build:production** (EAS) → binary → smoke test on device → submit to App Store.
