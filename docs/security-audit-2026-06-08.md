# Security audit — 2026-06-08 (overnight re-audit)

> `/vibe-security` pass over the `worktree-build-23-feedback` branch, cross-checked against
> [security.md](./security.md) + [security-deploy-checklist.md](./security-deploy-checklist.md).
> Scope: the whole client + `functions/` + `firestore.rules`, with extra focus on the build-23
> A/D diffs. **No code changes applied** — see "Why nothing was auto-fixed."

## Headline

**Posture is strong; no new Critical or High found.** This is a re-audit of a codebase that already
had a full money/auth/rules sweep (2026-05-30, 3 adversarial rounds — see security.md). The one
standing **Medium** (the `users` update rule has no doc-wide allowlist) is documented and
deliberately deferred to a reviewed rules pass. The build-23 A/D changes introduce no new
server-trust.

## Confirmed strong (spot-checked this pass)

- **Secrets:** zero hardcoded `sk_live_`/`AIza…`/PEM/token literals in `src/`, `app/`,
  `functions/src/`. `.env` is gitignored; only `.env.example` + config *plugins* are tracked (no
  real secrets). Live secrets live in Firebase Secret Manager (`defineSecret`).
- **Auth coverage:** 39 `verifyAuth`/auth assertions across 40 callable/onRequest handlers in
  `functions/src/index.ts`. Money paths additionally gate App Check (`assertAppCheck`, flag-gated).
- **Server-authoritative money:** stake + `endsAt` are **re-derived server-side** from
  `CADENCES_SERVER` (`functions/src/index.ts:457+`), not trusted from the client; `endsAt` is
  validated against the cadence window (blocks "mint a session with endsAt=1970 and complete for a
  payout"). Deposit crediting is idempotent; webhook verifies sig + IP.
- **Rules:** `users` protected fields (legal/KYC/Stripe/phone/email/stats/reputation/merge/referral)
  are client-immutable via an `affectedKeys().hasAny([...])` denylist; `blobAvatar` is shape- +
  size-validated (`validBlobAvatar`); `userPrivate`/`userPushTokens`/`wallets` balance-mutations are
  admin-SDK-only; `sessions` client update is field-restricted. Default-deny elsewhere.
- **Storage:** auth secrets (magic-link email, phone OTP refs) use `expo-secure-store`; only
  non-sensitive UX flags use AsyncStorage (retention dedup + the build-23 legal/onboarding markers).
- **Client trust:** SSL pinning (all 4 GTS roots, safety-valve expiry) is real in Release builds.

## Build-23 A/D diff review (this branch)

- **A (`authStore` legal marker + `onboardingComplete`)** — both markers are AsyncStorage,
  uid-scoped, and control **client routing/UX only**. They are NOT security boundaries: the
  authoritative legal acceptance (`legalAcceptanceVersion`, `ageAttested18`) is CF-written and
  rules-immutable, so faking the local marker skips the client prompt but grants no server-side
  acceptance. ✅ No new trust.
- **D (`BlobMakerSheet` → `setBlobAvatar`)** — writes `blobAvatar` only, which the rules validate
  (known keys, `shapeSeed` ≤ 64 chars). No injection / no protected-field write. ✅ Clean.

## Medium

**`firebase/firestore.rules` `users/{uid}` update — denylist without a doc-wide allowlist.**
The `allow write` (update) rule blocks all security-critical fields via `!affectedKeys().hasAny([…])`
but has no `hasOnly([…])` whitelist, so an owner can write **arbitrary non-denylisted fields** to
their own `users` doc. Because user docs are world-readable (any signed-in user can read any user
doc for contact/partner discovery), an attacker could write an unbounded junk field
(`users/{me}.junk = <1 MB string>`) that is then served on every cross-user read of their doc —
a storage/bandwidth abuse / soft-DoS vector. (Known display fields *are* size-capped; arbitrary new
fields are not.) Privilege escalation is **not** possible — the denylist covers every
money/identity/reputation field.

_Recommended fix (reviewed rules pass, NOT applied here):_ add a doc-wide
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...known client-writable keys...])`
to the `users` update rule (and an equivalent on create), then exercise it with `pnpm test:rules`
covering every legitimate client write (`stats`, `blobAvatar`, display names, `updatedAt`, …).

## Low / informational

- **Ineffective client `reputation` write.** `authStore.updateReputation` fire-and-forgets
  `updateUserDoc(uid, { reputation })`, but `reputation` is in the rules denylist → the server write
  always fails `permission-denied` (silently; local optimistic state still updates, CFs are the real
  writer). Not a security hole (the deny is correct), but it's dead-ish write traffic → flagged for
  the dead-code cleanup rung.
- **Operator/console items already tracked** (Fardeen's, not code): delete the orphaned Android GCP
  key, verify the iOS key bundle-ID restriction, the App Check enforce flip at ≥99% metrics, host the
  AASA file, email-enumeration protection + phone-SMS quota. See security-deploy-checklist.md.

## Why nothing was auto-fixed

The only code-level finding (the `users` allowlist) is a **rules** change that risks **false-denying
legitimate writes** if any client-written field is omitted from the whitelist — exactly the
"don't break functionality" line. It needs the emulator rules-test exercised against every real
write path, which is a reviewed pass (deferred per STATUS), not a blind overnight edit. Everything
else is already correct.
