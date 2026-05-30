# Parallel Work Lanes — App Store Submission Sprint (2026-05-29)

> **Status (2026-05-30): sprint landed — `wallet-ledger` is fully merged into `main` (0 commits ahead; de-pooled money path live on `main`). `docs/STATUS.md` exists. This doc is now a historical snapshot kept for reference; the kickoff prompts and counts below are the instructions as given at kickoff, not current truth.**
>
> Temporary coordination doc for running multiple Claude Code sessions in parallel without collisions.
> Lane D may fold/archive this once the docs are consolidated.
>
> **Locked context (every lane):** Ship **de-pooled commitment-contract v1** now. Gambling/pool/parlay = deferred to a licensed v2 (do NOT re-pool). Branch off `wallet-ledger`.

## How to run them (git worktrees — one folder + branch per lane)

Multiple CC sessions in the **same folder** corrupt each other's uncommitted working tree. Give each lane its own worktree:

```bash
# from the main repo (/Users/fardeenb/Documents/Projects/niyah)
git worktree add -b chore/docs        ../niyah-docs      wallet-ledger
git worktree add -b chore/dead-code   ../niyah-deadcode  wallet-ledger
git worktree add -b fix/appstore-copy ../niyah-appstore  wallet-ledger
git worktree add -b feat/ux-onboarding ../niyah-ux       wallet-ledger
# then open a CC session in each:  cd ../niyah-docs && claude   (etc.)
```

Each worktree branches from `wallet-ledger`'s last commit. **Lane A (security) is being done live in the main repo working tree and is uncommitted** — worktrees won't see it, which is fine (file-disjoint). Commit Lane A in the main tree when ready.

## Lane ownership + status

| Lane | Branch | Owns (only edit these) | Status |
|---|---|---|---|
| **A · Security/money-path** | `wallet-ledger` (main tree) | `functions/src/index.ts`, `firebase/firestore.rules`, `src/config/firebase.ts`, `src/store/authStore.ts` | **(–) WIP — live in another CC session. DO NOT TOUCH these 4 files.** |
| **B · App Store copy** | `fix/appstore-copy` | `src/components/LegalContentView.tsx`, `app/session/waiting-room.tsx`, `src/config/functions.ts` | open |
| **C · Dead code** | `chore/dead-code` | `src/types/index.ts`, `src/store/partnerStore.ts` | open |
| **D · Docs + CLAUDE.md** | `chore/docs` | `docs/**`, root `CLAUDE.md`/`README.md`/`PLAN.md`, new subdir `CLAUDE.md` files, `.claude/settings.json` | open |
| **E · UX / onboarding anim** | `feat/ux-onboarding` | `src/components/onboarding/**`, `app/(auth)/welcome.tsx`, `app/session/select.tsx`, new Lottie/anim assets | open |

**Do-not-touch matrix (avoid merge conflicts):**
- Nobody touches Lane A's 4 files.
- Lane E does **not** touch `app/session/waiting-room.tsx` (Lane B owns it).
- Lane C does **not** touch `src/components/onboarding/**` (Lane E owns it, incl. deleting legacy scenes).
- Lane D is docs-only and conflicts with nothing.

## Merge order (back into `wallet-ledger`, then `wallet-ledger` → `main`)

`D → C → B → A → E`. Run `pnpm ci` (lint+typecheck+test) after each merge. Run `/vibe-security` before merging A (money path). Manual QA after E. Then `wallet-ledger` → `main` → `firebase deploy --only firestore:rules,functions` → `pnpm build:production` → submit.

**Hard constraints (all lanes):** no commit/push/merge/deploy without Fardeen's explicit go; no "bet/wager/gamble/win/pool" in user-facing copy (use stake/commitment/goal/complete/Earned); keep `APP_CHECK_ENFORCED=false`; `STRIPE_SECRET_KEY` is LIVE.

---

## Kickoff prompts (paste into each session)

### Lane B — App Store copy/submission fixes
```
You are Lane B of a parallel sprint to submit Niyah (de-pooled commitment-contract focus app) to
the App Store. Read docs/lanes.md. You own ONLY: src/components/LegalContentView.tsx,
app/session/waiting-room.tsx, src/config/functions.ts. Do not touch any other file.

Tasks:
1. LegalContentView.tsx: replace support@niyah.app → support@niyah.live (lines ~43, 62, 71). Remove
   the "Placeholder copy / must be reviewed by counsel before release" comment (~lines 11-12). Sync
   the in-app terms to the hosted version: add the Apple App Store EULA paragraph (Apple not a party,
   third-party beneficiary) and bump "Last updated" to May 27, 2026 — match landing-pg/app/legal/terms/page.tsx.
2. app/session/waiting-room.tsx (~line 427): the share link uses https://niyah.app/join/... — confirm
   that domain resolves; if not, switch to niyah.live. (Ask Fardeen which domain is live for invites.)
3. src/config/functions.ts (~line 338): drop the dead "venmo" member from the withdrawal method union
   ("standard" | "instant" | "venmo" → "standard" | "instant").

No "bet/wager/gamble/win/pool" language. Run `pnpm typecheck` + `pnpm test`. Do NOT commit/push —
list the suggested commit(s) for Fardeen to run. Report what you changed with file:line.
```

### Lane C — Dead code cleanup
```
You are Lane C of a parallel sprint. Read docs/lanes.md. You own ONLY: src/types/index.ts and
src/store/partnerStore.ts. Do not touch onboarding components (Lane E) or any other file.

The app was de-pooled (no peer-to-peer money). Remove the leftover P2P/settlement ghost code:
1. src/types/index.ts (~112-130): the DuoSession interface (comment "both partners stake, loser pays
   winner", fields settlementStatus/amountOwed) is fully unused — remove it. Also remove the
   "settlement_paid"/"settlement_received" transaction types (~157-158) — they imply inter-user money
   movement that no longer exists.
2. src/store/partnerStore.ts (~24-30): remove the unused methods startDuoSession, completeDuoSession,
   markSettlementPaid, markSettlementReceived (and their impls). Keep the partners-list functionality.

BEFORE removing: grep the whole repo to confirm each symbol is truly unreferenced (it should be).
Run `pnpm typecheck` + `pnpm test` — must stay green. Do NOT commit/push — list suggested commits.
Report with file:line.
```

### Lane D — Docs consolidation + CLAUDE.md hierarchy
```
You are Lane D of a parallel sprint. Read docs/lanes.md and docs/doc-audit-2026-05-19.md. You own
ONLY: docs/**, root CLAUDE.md/README.md/PLAN.md, new subdirectory CLAUDE.md files, .claude/settings.json.

Goal: apply Anthropic's large-codebase doc best practices. Ground truth: branch is wallet-ledger
(21 ahead of main, NOT "launch"); ~796 client + 38 functions tests (NOT 1018); ~40 Cloud Functions
(NOT 24); file is app.config.js (NOT .ts); the app is DE-POOLED commitment-contract (NOT pooled).

1. Create docs/STATUS.md = the single canonical "current status" doc. Fold in: may-26-resume.md (live
   half) + the 3 docs/session-*.md + may-16-progress.md. One "Right now" header (branch, commits,
   committed vs uncommitted, deployed), "Remaining to submit", "Post-submit dormant flips".
2. Trim root CLAUDE.md to pointers + gotchas ONLY. Remove volatile counts (1018 tests, 24 functions),
   fix app.config.ts→app.config.js, fix the plugins list. Replace "Current Phase/Shipped to launch"
   with a pointer to docs/STATUS.md.
3. Reconcile pool→de-pool in README.md ("Pool Mode" line 13, "earn even more" line 9), payments.md,
   features.md, group-equity.md (add superseded banner). Use docs/legal.md as the tone model.
4. Merge roadmap.md + post-demo-roadmap.md → one roadmap.md (mark shipped lanes shipped, drop dead dates).
5. Rewrite security.md (App Check done/flag-gated; correct the wallet rule: clients CAN create a
   zero-balance wallet). Keep security-deploy-checklist.md as the operator runbook; cross-link.
6. Create lean subdirectory CLAUDE.md files: functions/, src/store/, src/config/, modules/niyah-screentime/,
   landing-pg/, firebase/ — 4-6 bullets each (local conventions + scoped test/lint command). See the
   navigability proposals if available; keep them SHORT.
7. Add .claude/settings.json with permissions.deny (git push/commit, rm) + ignore globs (node_modules,
   ios/, android/, functions/lib, .next, .expo).
8. Move docs/misc/common_security_issues.md + docs/misc/ideas_megadoc.md OUT of docs/ (they're source
   material/scratch, not docs) — to docs/archive/ or a notes location. Archive (don't delete) historical
   docs: sprint-april15, lane-b-apple-targets-migration, ui-ux-remediation-plan, security-audit-2026-05-19,
   PLAN.md, and the folded session/resume docs → docs/archive/.

Do NOT commit/push — list suggested commits. Report the new docs/ tree.
```

### Lane E — UX polish + onboarding animations
```
You are Lane E of a parallel sprint. Read docs/lanes.md, docs/ui-animation.md, and
docs/misc/ideas_megadoc.md (Fardeen wants new onboarding animations before submit). You own ONLY:
src/components/onboarding/**, app/(auth)/welcome.tsx, app/session/select.tsx, and new animation assets.
Do NOT touch app/session/waiting-room.tsx (Lane B) or money/functions code.

Tasks (scope tight — submission window, "good enough not perfect"):
1. Onboarding animation upgrade: replace janky SVG with lottie-react-native (already evaluate if
   installed; if not, propose adding it) OR react-native-reanimated-driven motion. Keep the existing
   4-scene welcome carousel structure + blob characters + de-gambled copy. No "earn more/win/pool" text.
2. Delete the dead onboarding code (Lane E owns it): src/components/onboarding/{Garden,Stake,Shield,
   Growth}Scene.tsx + the _PeachBlobAnnoyed commented component in Onboarding2Scene.tsx + their exports
   in index.ts. Confirm unreferenced first.
3. app/session/select.tsx: add default time-block templates (9-5, 6-12) as one-tap presets so a no-money
   session isn't a buggy free-form picker (per ideas_megadoc). Keep it de-pooled.

Run `pnpm typecheck` + `pnpm test`. Test the onboarding flow visually if you can (/run or simulator).
Do NOT commit/push — list suggested commits. This is the highest-bug-risk lane → flag anything uncertain
for Fardeen's manual QA.
```
