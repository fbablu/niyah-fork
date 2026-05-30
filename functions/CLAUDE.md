# functions/ — Firebase Cloud Functions

- **Money path. Treat every change as high-stakes.** `STRIPE_SECRET_KEY` is LIVE (`sk_live_`); real refunds/charges/transfers fire. Run `/vibe-security` on diffs here before commit; fix Critical+High first.
- **npm, not pnpm** (`package-lock.json`), **Node 22**. Most logic lives in `src/index.ts` (~40 exports) + `src/wallet.ts` (pure bucket helpers).
- **Type-check / lint:** `cd functions && npm run lint` (`tsc --noEmit`). Build: `npm run build`. Tests live beside source (`src/*.test.ts`) and run under jest. **Don't** run `firebase deploy` — Fardeen does that.
- **Auth + App Check:** validate `context.auth.uid`; money-path CFs call `assertAppCheck` (gated by `APP_CHECK_ENFORCED`, currently false). Admin HTTP CFs require `ADMIN_API_KEY` (constant-time compared).
- **Wallet writes** go through buckets (`deposited`/`earned`/`bonus`/`credit`) via `wallet.ts`; use `FieldValue.increment` inside a transaction, idempotency keys on every transfer. Earn-more multiplier is **dormant** (`SOLO_PAYOUT_MULTIPLIER` default 1.0).
- **De-pooled:** no pool redistribution, no peer-to-peer transfers. See [docs/payments.md](../docs/payments.md), [docs/security.md](../docs/security.md), [docs/STATUS.md](../docs/STATUS.md).
