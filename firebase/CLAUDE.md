# firebase/ — Firestore rules & indexes

- **Tracked:** `firestore.rules`, `firestore.indexes.json`. The `GoogleService-Info.plist` / `google-services.json` config files are **gitignored** (local + EAS file secrets only).
- **Rules are the access-control boundary — money-adjacent.** Run `/vibe-security` on rule changes; fix Critical+High first.
- **Wallet rule nuance:** clients **can** `create` a zero-balance wallet (`balance == 0 && pendingBalance == 0`); all balance mutations are **admin-SDK only**. Don't "fix" this to a blanket deny.
- **Protected user fields** (KYC, Stripe IDs, phone, email, merge state, `legalAccepted*`, `ageAttested18`) are client-immutable via an `affectedKeys().hasAny([...])` denylist — server writes only. Add new sensitive fields to the denylist.
- **Default-deny** for unmatched collections; server-managed collections (`transactions`, `groupSessions`, `revenue`, `walletAudits`, …) are admin-only.
- **Deploy:** `firebase deploy --only firestore:rules` (Fardeen runs it). Full breakdown: [docs/security.md](../docs/security.md), [docs/security-deploy-checklist.md](../docs/security-deploy-checklist.md).
