# src/store/ — Zustand stores

- **One store per domain, kept flat:** `authStore`, `sessionStore`, `walletStore`, `groupSessionStore`, `socialStore`, `partnerStore`, `themeStore`, `featureFlagsStore`, plus `resetCoordinator`. (`partnerStore` holds partners/friends + invites + referral bonuses — still live across the tabs/session screens; what de-pool killed is **pooled payout / peer-to-peer settlement**, not this store.)
- **Local state is the source of truth; Firestore writes are fire-and-forget.** Don't block UI on a write.
- **Cross-store calls via `getState()`**; use lazy `require()` for circular deps (e.g. session ↔ wallet).
- **Server owns money + status.** In non-DEMO mode, never write session `status` / wallet balances client-side — call the Cloud Function and let its transaction win (a past surrender-race bug came from a client status write).
- **De-pooled:** completion returns your **own** stake (`SOLO_COMPLETION_MULTIPLIER = 1`); `calculateTransfers → []`. No Venmo/peer-to-peer.
- **Scoped test:** `pnpm test:stores` (from repo root). Keep tests pinning real contracts, not count-padding.
