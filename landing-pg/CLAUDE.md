# landing-pg/ — niyah.live marketing site + hosted legal

- **Next.js 16 App Router**, static export (`output: "export"`), Tailwind v4 + shadcn/ui. **Separate workspace** from the app — its own `package.json` + lockfile; run commands with `-C landing-pg`.
- **Hosted legal lives here:** `app/legal/{privacy,terms}/page.tsx` + shared `legal/layout.tsx` → served at `niyah.live/legal/privacy` and `/legal/terms` (clean URLs, no `.html`). Keep these in sync with in-app `src/components/LegalContentView.tsx`; bump `CURRENT_LEGAL_VERSION` in the app if terms change materially.
- **Deploy is automatic:** `.github/workflows/deploy-landing.yml` → GitHub Pages on push to **`main`** touching `landing-pg/**`. CNAME = `niyah.live`. The Pages environment only allows `main` — a merge is what publishes.
- **Build-verify before merge:** `pnpm -C landing-pg build` → emits `out/legal/{privacy,terms}.html`.
- **Also hosts** the `niyah.live/stripe/return` → `niyah://stripe-return` bounce. (TODO: `apple-app-site-association` for universal links.)
- Governing law in Terms = **Delaware**; contact = `support@niyah.live`. See [docs/legal.md](../docs/legal.md).
