# Figma design discovery — all-tabs redesign (U0)

> Generated 2026-06-12 by the U0 discovery agent (overnight redesign loop,
> `docs/redesign-all-tabs-progress.md`). File key: `GXxiG7IYSw0o6WGc9UHwzn`.
> Method: `get_metadata` on the document root + every page; subtree inspection of all
> ambiguous frames. Read-only — canvas untouched.

## Verdict

**The Figma file contains NO designs for any app screen beyond the profile tab.**
The only real screen designs are `profile-tab-normal` and `profile-tab-blob-customizer`
(already captured in this folder as `render-429-186.png` / `render-429-347.png` and the four
`design-context-*.md` files). Everything else is onboarding-carousel art, brand/logo assets,
or Opal-app reference screenshots. Therefore:

- **Real designs exist for:** profile tab only (v2 restyle — already shipped as build 25).
- **U1 (dashboard), U2 (schedule), U3 (friends/public profile), U4–U5 (session flow),
  U6 (money screens), U7 (shared components) must ALL derive from the design language** —
  `docs/profile-redesign-brief.md` § "v2 feedback round" + `docs/figma-design-rules.md` —
  not from Figma frames.
- The `opal` page (and copies of the same shots on the onboarding_3/4 pages) holds ~170
  iPhone screenshots of the Opal app (`IMG_2168`–`IMG_2339`) — competitive reference only.
  Per positioning guidance (moat = stakes, not blocking), use for layout inspiration at most.
- Onboarding/auth screens have their own pinned illustrated design and are out of scope for
  U1–U7 (per progress-doc note "Auth/onboarding screens left as-is").

## Pages

| Page id | Name | Contents (summary) |
| --- | --- | --- |
| 0:1 | onboarding_1 | Onboarding carousel v1 frames + brand/logo assets + Colors-palette text node |
| 266:34 | onboarding_2 | Iteration copy of onboarding_1 (same frames, 266:* ids) |
| 277:1220 | onboarding_3 | ~171 Opal screenshots + onboarding iterations + purple-blob variants + profile frames 352:320 / 401:106 |
| 429:575 | onboarding_4 | Near-duplicate of onboarding_3 (429:* ids) + design-direction note 429:1714 |
| 267:534 | opal | ~180 Opal app reference screenshots (IMG_2168–IMG_2339), nothing else |
| 429:185 | updated-screens | ONLY the two profile frames + loose annotation nodes (Log out / Delete account labels, SF-symbol glyphs) |

## Frame inventory

Rendered = a PNG exists in `docs/profile-redesign/`. Unit map per
`docs/redesign-all-tabs-progress.md` ladder (U1 dashboard, U2 schedule, U3 friends,
U4/U5 session, U6 money, U7 shared components).

| Page | Frame | Node id | Size | Rendered | Unit map |
| --- | --- | --- | --- | --- | --- |
| updated-screens | profile-tab-normal | 429:186 | 402x874 | yes (render-429-186.png, prior unit) | profile (done — build 25) |
| updated-screens | profile-tab-blob-customizer | 429:347 | 402x874 | yes (render-429-347.png, prior unit) | profile (done — build 25) |
| updated-screens | loose annotations (info.circle, "Log out", "Delete account", trash, figure.walk) | 429:554–558 | text nodes | no | profile (annotations for 429:186) |
| onboarding_3 | profile-tab-normal (copy) | 352:320 | 402x874 | yes (render-352-320.png, prior unit) | profile (duplicate of 429:186) |
| onboarding_3 | profile-tab-blob-customizer (copy) | 401:106 | 402x874 | yes (render-401-106.png, prior unit) | profile (duplicate of 429:347) |
| onboarding_4 | profile-tab-normal (copy) | 429:869 | 402x874 | no (duplicate) | profile (duplicate) |
| onboarding_4 | profile-tab-blob-customizer (copy) | 429:1030 | 402x874 | no (duplicate) | profile (duplicate) |
| onboarding_1 | onboarding-1 | 9:2 | 402x874 | no | no match (auth/onboarding, out of scope) |
| onboarding_1 | onboarding-2 | 16:229 | 402x874 | no | no match (auth/onboarding) |
| onboarding_1 | onboarding-3 | 16:287 | 402x874 | no | no match (auth/onboarding) |
| onboarding_1 | onboarding-4 (x2) | 16:311, 156:2 | 402x874 | no | no match (auth/onboarding) |
| onboarding_1 | brand assets (stones, niyah-icon, niyah-logo, niyah-light-logo, niyah-slip-dark, Frame 1/2/3) | 58:641, 149:5/6, 165:5/6, 169:24/33, 206:2, 207:25 | various | no | no match (brand/marketing) |
| onboarding_2 | onboarding-1..4 + same brand assets (iteration copies) | 266:83–266:528 | 402x874 / various | no | no match (auth/onboarding + brand) |
| onboarding_3 | onboarding-1 copies | 277:1424, 315:522, 315:181 | 402x874 | no | no match (auth/onboarding) |
| onboarding_3 | purple-blob-1 / purple-blob-2 | 314:2, 314:34 | 402x874 | no | no match — verified by subtree: onboarding-1 "Welcome to Niyah" screen with purple-blob color treatment, NOT a tab/session screen |
| onboarding_3 | onboarding-2 copies | 314:67, 315:212 | 402x874 | no | no match (auth/onboarding) |
| onboarding_3 | onboarding-3 / onboarding-4 | 315:273, 315:493 | 402x874 | no | no match (auth/onboarding) |
| onboarding_3 | Frame 1 | 315:621 | 960x320 | no | no match — verified by subtree: blob/stone asset cluster, not a screen |
| onboarding_3 | IMG_2168–IMG_2339 (~171 shots) | 277:1221–277:1391 | 402x874 | no | no match (Opal reference) |
| onboarding_4 | same set as onboarding_3 (onboarding copies, purple-blob 429:807/838, Frame 1 429:1644, ~171 IMG shots) | 429:747–429:1699 | various | no | no match |
| onboarding_4 | design-direction note ("Proper onboarding order: Select blob → hero journey → soften earning language") | 429:1714 | text | no | no match (onboarding plan note) |
| opal | IMG_2168–IMG_2339 (~180 shots) | 271:1045–271:1215 | 585x1266 | no | no match (Opal reference) |

## Notes for U1–U7

- Zero dashboard/home, schedule, friends, session (select/confirm/active/surrender/complete),
  deposit/withdraw, or modal designs anywhere in the file. Searched all 6 pages' full
  top-level inventories; ambiguous frames (purple-blob-1/2, Frame 1) were resolved by
  subtree inspection.
- The Colors-palette text node (old earth-tone `#1A1714`/`#2D6A4F` export) appears on
  onboarding_1/2/3/4 pages — it is the ORIGINAL palette draft, superseded by the v2 green
  spec in `docs/profile-redesign-brief.md`; do not treat it as current truth.
- Asset URLs inside the existing `design-context-*.md` files expire ~2026-06-18.
