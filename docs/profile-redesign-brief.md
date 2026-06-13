# Profile tab redesign — brief (Figma → code)

> Durable spec for the profile-tab redesign so any session can pick this up without the original
> conversation. Sources: two Figma frames (links below, **access verified via Figma MCP
> 2026-06-11**), 8 design comments (transcribed **verbatim** below; screenshots in
> [`docs/profile-redesign/`](./profile-redesign/)), and the Clout scoring spec.
> Written 2026-06-11. Status: **implemented 2026-06-11** (all 9 checklist items; gates green —
> see open decisions: shape-picker vs generative conflict, custom-color swatch deferral,
> balance-ticker data source). Pending: on-device visual review via Release build.

## Figma sources

| Frame                                   | Node      | Link                                                                              |
| --------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `profile-tab-normal` (402×874)          | `352:320` | <https://www.figma.com/design/GXxiG7IYSw0o6WGc9UHwzn/Niyah?node-id=352-320&m=dev> |
| `profile-tab-blob-customizer` (402×874) | `401:106` | <https://www.figma.com/design/GXxiG7IYSw0o6WGc9UHwzn/Niyah?node-id=401-106&m=dev> |

- File key: `GXxiG7IYSw0o6WGc9UHwzn` (file: **Niyah**, page: `updated-screens`).
- Re-pull with Figma MCP: `get_design_context` / `get_screenshot` / `get_variable_defs` with the
  fileKey + nodeId above. **Always steer output to React Native + StyleSheet** (the tool defaults
  to React + Tailwind) and map values onto `src/constants/colors.ts` tokens — see
  [figma-design-rules.md](./figma-design-rules.md).
- Comments live on the Figma file too (REST `GET /v1/files/GXxiG7IYSw0o6WGc9UHwzn/comments`,
  `file_comments:read` scope) but everything posted as of 2026-06-10 is transcribed below — no API
  call needed.

## Frame anatomy (from MCP metadata, real node IDs)

**`profile-tab-normal` (352:320)** top→bottom:

- Header card (`Rectangle 17`): "First Last" (377:580), `example@email.com` (377:582), and
  `0 Following | 0 Partners` counters (370:558/562/567/569).
- Blob on green platform (`Group 19`, 352:322) — the mascot/avatar zone; platform has **happy eyes**
  in normal mode.
- **Balance** (378:643): `$1,234.56` (378:639) in a pill (378:641) + a `+/-` liquid-glass button
  (378:640). See comment 6.
- **Clout** label (370:560) + progress bar (`Rectangle 16`, 373:572) + (i) info button. See
  comment 7 — replaces "social credit."
- Month nav `month-and-arrows-grouped` (400:45): `chevron.left` / "June" / `chevron.right`
  (SF Symbols as text layers).
- **Streaks counter**: circle (`Ellipse 37`, 400:58) + count "3" (400:62), right of the month nav.
  See comment 3.
- **Calendar** (`Mask group`, 399:489): 1 `header cell` instance row (S M T W T F S) + 5 `row`
  frames of 7 `cell` frames (40.43px square), each `cell > inner > <date text>`. Trailing-month
  dates are `hidden="true"` text nodes.
- Blob **stamps on the calendar**: `Group 26` (399:481, blue blob, day 1), `yellow-stone` (400:51,
  day 2), `Ellipse 36` dot (400:57, day 3). See comments 4–5.
- Footer buttons: `Rectangle 22` (378:656, **Log out**) + `Rectangle 23` (384:11, **Delete
  account**) — destructive red, unchanged from current app.

**`profile-tab-blob-customizer` (401:106)** — same screen with the customizer sheet up
(`Group 28` 401:276, sheet bg `Rectangle 1`, grab bar `Line 12` 401:277):

- Blob preview zone (`blobs` 362:386) scaled up in the foreground; the platform behind it gets
  **sleepy/sad flipped eyes** (comment 1).
- Row 1 — **eye shapes** (`blob-eyes-grouped` 401:104): `semicircle-top`, `semicircle-top` (small),
  `circle`, `line`, `semicircle-bot`; selected option sits in a highlight circle.
- Row 2 — **colors** (`Frame 24` 368:422): 4 swatches + custom-color (`SF Pro • paintpalette.fill`
  368:431).
- Row 3 — **blob shapes** (`Frame 25` 368:520): `plum-blob-body`, `blue-blob-body`, `peach-blob`,
  `white-blob-body` + **shuffle** (`SF Pro • shuffle` in `new-blob-shape` 368:518).
- Die icon (top-left of blob zone) = randomize-all; collapse arrows (top-right) = slingshot back.
  See comment 2.

## Design comments (verbatim, typos preserved)

Screenshots: [`docs/profile-redesign/`](./profile-redesign/). All by Fardeen Bablu, 2026-06-09/10.

### 1. Platform sleepy eyes — `comment-1-platform-sleepy-eyes.png`

> Please note that when the user is in the advanced blob customizer mode, the green, previously
> happy eyes platform has its eyes flipped vertically, making it look sad or sleep (I want to keep
> this detail)!

### 2. Blob customizer slingshot — `comment-2-blob-customizer-slingshot.png`

> Goal is to have a slingshot style of movement with the blob.
>
> When the user on profile tab normal clicks the expand arrow button, it brings the blob in the
> foreground, scaling it up and making it bigger, with a clean animated rubber banding.
>
> This advanced customization will have side scroll wheels for each time of customization the blob
> can have (eye shape, color + custom color, blob shape). The die icon simply spins and randomizes
> all of these choices (ensuring it "looks right" and centered properly on the blob body.
>
> When the user is done customizing, they can either move the modal down with the small white bar
> on top, or click the collapse button, which then slingshots the blob back onto the green platform
> and into the foreground with any changes made saved.

### 3. Streaks outline — `comment-3-streaks-blob-outline.png`

> Streaks (outline simple shape right now, ideally outline of user's current chosen blob is better

### 4. Calendar blob stamps — `comment-4-calendar-blob-stamps.png`

> Adding streaks calendar feature, and after use opens app with the scheduled sessions, they get an
> animation / stamp style placement of a blob, blinking and being animated, onto the calendar. I've
> added 2 so far, but ideally these are unique blobs the user gets to basically collect after each
> given session.

### 5. Session receipt modal — `comment-5-session-receipt-modal.png`

> Each completed session should be clickable and open into a modal of session receipt; more details
> and specifics of app usage separated by app category and amount of times opened

### 6. Balance ticker + deposit/withdraw — `comment-6-balance-ticker.png`

> Current balance (maybe some ticker / labels indicating if the user is all time up or down,
> similar to how stick tickers allow users to view day, week, month, 5month, and then ytd view, not
> as a line graph in this case, but rather simply as a ^ or down arrow, with ^ being green and
> showing % up, and the down arrow being red and showing % user is down.
>
> in addition, we have the +/- icon in liquid glass; this is simply another way for deposit /
> withdraw for users; a new screen for this isn't really needed, as it can be borrowed from the
> home screen deposit / withdrawal UI really, but kept as a single routed button instead.

### 7. Clout (replaces social credit) — `comment-7-clout.png`

> we're gonna be changing the social credit bar and information into Clout, which serves a similar
> purpose but is overall just a cleaner representation for a user's ability to commit and finish
> sessions ( considers session completed, how many of those were staked, how many weren't staked,
> how many were done with friends, number of friends that it has been completed with ) and weighted
> to determine an optimal Clout Score; higher clout score == early access to features, including
> future v2 solo staked to earn mode, which I plan to add AFTER getting some users overall.
>
> Score should be simple, and custom weighting applied to specific, encouraged habits:
>
> n = sessions completed
> solo_none = non staked session, still good, but not ideal
> solo_stake = staked session, heavily weighted and favored, shows trust with user
> group_none = group session without stakes, weighted over a solo_staked since it incldues friends;
> even one more person is better than jsut a solo stake version, i beleive? unless a solo_staked
> shows a lot of interest and a loyal user?
>
> group_staked = best potential outcome, with multiple people AND stakes within it (>= 2)
>
> With all of this, come up with an equation that lets allows for an appropriate clout score, AND
> create an informational graphic modal popup from the bottom for users that click the (i) info
> small button.

### 8. Layer-rename reference — `figma-rename-dialog.png`

Figma's bulk-rename dialog over the profile frame; calendar layers were normalized to the
`row` / `cell` / `inner` hierarchy visible in the node metadata above.

## Clout scoring — proposed model (weights awaiting Fardeen sign-off)

Only **completed** sessions earn (quitting earns nothing — self-balancing, no punitive term):

```
Clout = 1·solo_none + 3·solo_stake + 4·group_none + 8·group_staked
        + round(4 · √(distinctFriendsFinishedWith))
```

| Counter                                          | Weight    | Rationale                                 |
| ------------------------------------------------ | --------- | ----------------------------------------- |
| `solo_none` — completed, unstaked, alone         | 1         | baseline                                  |
| `solo_stake` — completed, staked, alone          | 3         | skin in the game = trust                  |
| `group_none` — completed with friends, unstaked  | 4         | social > solo (per comment 7's lean)      |
| `group_staked` — completed, ≥2 people AND staked | 8         | best outcome: social + trust              |
| distinct friends completed-with                  | `√` bonus | rewards breadth; stops one-friend farming |

- **Open knob:** `solo_stake` (3) vs `group_none` (4) ordering — comment 7 is explicitly unsure;
  it's a single-constant swap.
- **Tiers** (tunable): 0–49 Newcomer · 50–149 Committed · 150–399 Trusted (feature betas) ·
  400+ Inner Circle (first access to v2 solo-stake-to-earn).
- **(i) info modal** (bottom sheet): title "What is Clout?"; one-liner "Clout reflects how
  consistently you commit to and finish focus sessions — and how often you bring friends along.";
  the four weighted rows as `+pts` chips with mini bars; footer "Higher Clout unlocks early access
  to new features." **Copy must stay legal-safe: stake/commit/finish — never bet/wager/gamble/win.**
- Today's code has a `reputation`/social-credit concept (authStore optimistic update; CFs are the
  authoritative writer) — Clout replaces its **presentation**; audit whether the stored counters
  needed above exist before wiring (likely needs per-type completion counters).

## Feature checklist (what "done" means)

1. Profile header — name/email/Following/Partners per `352:320` (existing data).
2. Blob + platform zone — platform happy-eyes normal / sleepy-eyes while customizer is open (1).
3. Balance row — amount + up/down ticker (green `^` % up / red `v` % down, all-time) + `+/-` button
   reusing home deposit/withdraw UI as a routed action, no new screen (6).
4. Clout row — bar + (i) → bottom-sheet info modal; scoring model above (7).
5. Month calendar — header row + 5×7 grid, month nav chevrons; collectible blob stamps animate in
   ("stamp" + blink) for completed scheduled sessions; unique-per-session blobs ideal (4).
6. Stamp tap → session-receipt modal: app usage by category + open counts (5) — data exists via
   shield-violation category tallies (App Group `niyah_shield_violations_by_category`).
7. Streaks counter — count in an outlined circle; ideal: outline of the user's current blob (3).
8. Blob customizer sheet (`401:106`) — slingshot open/close (rubber-band scale to foreground;
   collapse slingshots back onto platform, saving), side scroll-wheel rows (eye shape / color +
   custom / shape), die = randomize-all with "looks right" centering (2). Builds on the existing
   `BlobMakerSheet` + seed-generative shapes.
9. Log out / Delete account — unchanged (destructive paths; Delete is live-money adjacent).

## Constraints

- Legal language sweep applies to ALL new copy (stake/commitment/complete; never bet/wager/win).
- Existing money paths (deposit/withdraw/delete) are **live Stripe** — reuse, don't fork.
- Dark/light themes + reduced-motion variants required (Reanimated; respect `useReducedMotion`).
- Component conventions: see [figma-design-rules.md](./figma-design-rules.md) (tokens, scaffolds,
  `makeStyles(Colors)`, <150-line components).

## v2 feedback round (2026-06-12, after build 24 on-device review)

Fardeen's verdict on v1: *"the profile concept and vision looks REALLY bad compared to what I
created and designed on figma… The animations, color scheme, background and calendar all look not
so great, compressed, smaller, and the animations are way too exaggerated and not good looking."*

**Updated Figma frames** (structurally identical to the originals — the spec didn't change, the
implementation diverged):

| Frame | Node | Link |
| --- | --- | --- |
| `profile-tab-normal` v2 | `429:186` | <https://www.figma.com/design/GXxiG7IYSw0o6WGc9UHwzn/Niyah?node-id=429-186&m=dev> |
| `profile-tab-blob-customizer` v2 | `429:347` | <https://www.figma.com/design/GXxiG7IYSw0o6WGc9UHwzn/Niyah?node-id=429-347&m=dev> |

### Root causes of v1's look

1. **Palette:** the design is a full-bleed GREEN brand screen — bg `#1b4332` (== `Colors.primaryDark`),
   surfaces `#2d6a4f` (== `Colors.primary`), customizer sheet `#40916c` (== `Colors.primaryLight`),
   white text/borders, translucent glass overlays. v1 instead rendered onto the standard
   dark-earth/cream background tokens (the design-rules "map greens to nearest semantic key" note
   was over-applied). Because primary/primaryDark/primaryLight are IDENTICAL across themes, the
   green screen is automatically theme-stable.
2. **Proportions:** components sat inside the scaffold's standard padding plus their own → smaller/
   "compressed" vs the design's widths. Correct proportions (of the 402-wide frame): header card
   372 (92.5%), balance pill 325 (80.8%), clout bar 300 (74.6%), calendar grid 283 (70.4%,
   centered), footer pills 324 (80.6%), cells perfectly square (`aspectRatio: 1`).
3. **Motion:** overshoot springs everywhere (slingshot damping 12, stamp 1.5→1, die 360° spin)
   read exaggerated/cartoonish. v2 = subtle iOS feel (see motion spec below).

### v2 exact values (from Figma-generated reference code, node 429:186 / 429:347)

- **Tokens added** for the glass layers: `Colors.glassLight` rgba(217,217,217,0.25),
  `Colors.glassMid` rgba(217,217,217,0.5), `Colors.glassDark` rgba(0,0,0,0.5).
- Header card: `glassLight`, radius ~23; name 33 bold white, email 15 white, counters 19 bold
  white over 12 labels, hairline white divider between Following|Partners.
- Balance: "Balance" 29 bold white centered; amount 47 bold white; `+/-` ~25 bold on a glass pill —
  `+` green / `-` red at low alpha (liquid glass), routes deposit/withdraw.
- Clout: label 16 white; track `#d9d9d9` 11px tall radius 22.
- Month nav: "June" 22 bold white + SF chevrons 17 white; streak = white circle (~19pt) with
  15 bold BLACK count, top-right of calendar.
- Calendar: grid bg `primary`, 1px WHITE borders, header row ~27 tall w/ ~13 bold white S-M-T-W-T-F-S,
  date numerals small bold white pinned top-right of each cell (inset inner frame), trailing-month
  dates hidden.
- Footer: Log out / Delete account pills 44 tall radius 55 `glassDark`.
- Customizer sheet (429:347): top radius ~57, bg `primaryLight`, dimmed `glassDark` above it with
  the platform (sleepy eyes) visible; white grab bar (~52 wide); option rows 77.5 tall radius 33 bg
  `primary`; selected-option circle 64 radius 26 `glassMid`; color swatches 32 radius full
  (#caa23e, #7cf799, #ec6b6b, #4947be + gradient paintpalette custom slot — custom color still
  rules-deferred, render the slot disabled or omit).

### v2 motion spec (subtle, iOS-native feel — kill the overshoots)

- Calendar stamp: opacity 0→1 + scale 1.12→1, `withTiming` ~280ms `Easing.out(Easing.cubic)`,
  ~60ms stagger; blink = tiny, rare (≥6s apart), latest stamp only.
- Customizer sheet: rise with house spring `{damping: 20, stiffness: 180}` (NO overshoot);
  hero blob 0.92→1; close ~220ms timing.
- Die: one ≤180° rotation, ~350ms ease-out, gentle pop — no 360° spin.
- Platform eye flip: ~180ms timing. Press feedback stays the standard 0.97 spring.
- Where it genuinely fits, prefer SwiftUI-hosted polish via `@expo/ui/swift-ui` (Fardeen's explicit
  ask): the liquid-glass `+/-` pill is the first candidate. Native dep → needs a rebuild; keep an
  RN fallback and a jest mock.
- Everything stays `useReducedMotion`-aware.
