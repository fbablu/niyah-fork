# Tech-Week Launch Runbook — NYC, 2026-06-01 → 06-07

> **Goal:** a **usable, installable Niyah** in attendees' hands at NYC Tech Week — distributed via a
> printed **sticker + QR**, looking **professional** (deep QA + real animation polish, not slop).
> Dual track: **(1) LIVE-money external TestFlight** (public join link → the QR) **and (2) kick off
> the full App Store submission** (same binary, slower review track).
>
> Read alongside **[STATUS.md](./STATUS.md)** (canonical build state) and
> **[smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)** (the post-deploy money-path checklist).
> Product/legal context: **[legal.md](./legal.md)**.

## Guardrails (carry into every session)

- **Fardeen runs ALL git / deploy / EAS / Firebase / ASC / outward actions.** Claude supplies exact
  commands only — never executes them.
- Commit style: one-liner subject, no body, no trailer.
- `/vibe-security` on any auth / payments / rules diff; fix Critical + High before commit.
- **No** bet / wager / gamble / win / pool language in app or legal (stake / commitment / goal /
  complete / Earned).
- Keep `APP_CHECK_ENFORCED=false` until App Check Metrics ≥ 99%.
- **`STRIPE_SECRET_KEY` is LIVE (`sk_live_`)** — deposits/withdrawals/deletion move real money and
  are irreversible. This build goes to **strangers**: treat every money-path + deploy step as
  high-stakes.

---

## ⚠️ Read first — the live-money-with-strangers risk

A public build handed to strangers with live `sk_live_` money is real exposure. Make it legible
before the sticker ships:

- **No engagement gate is effectively live for deposits** — deposits are always withdrawable. The
  only currently-gated house money is the **$5 first-surrender forgiveness bonus**. Keep
  `FINALS_PROMO_CENTS=0` / `serverFlags.promoCents=0` (confirmed green). **Do not** hand out a
  "deposit $5 / earn $5" promo before the engagement gate ships.
- **Known open edge:** withdrawal idempotency keys by the minute → two same-amount withdrawals in
  one minute can double-debit the wallet but fire one Stripe transfer (mitigated by 3/hr rate
  limit, **not** fixed). A motivated stranger is a different threat model than a campus cohort.
- **Mitigations to decide before the QR goes out:**
  - Low deposit cap for the public build.
  - Watch **Stripe** + **Firestore** live during the event.
  - Keep the **billing kill-switch** (`serverFlags.billingKillSwitchEnabled`) ready to flip.
- **Lower-risk day-1 fallback (recommended safety net):** also cut a `EXPO_PUBLIC_DEMO_MODE=true`
  build — real auth/onboarding/blob/screen-time/session UX, **fake** money, short timers (full
  stake → complete → confetti in ~30s; great for a 2-min booth demo), phone-auth off (dodges the
  APNs blocker), **frictionless** Beta review. The demo QR can be live on day 1 while the live-money
  build clears review mid-week.

---

## Critical path & honest timeline

Today is the start; NYC is **6/1–6/7**. What gates what:

```
LIVE-MONEY EXTERNAL TESTFLIGHT (public QR):
  functions deploy (Fardeen, live, irreversible)        ─┐
  APNs .p8 → Firebase Cloud Messaging (phone auth/push)  ├─ must precede a usable live build
  controlled real-$ smoke pass (smoke-test-2026-05-30)  ─┘
        ↓
  pnpm build:production (iOS)  →  eas submit (→ App Store Connect → TestFlight)
        ↓
  ASC: add build to EXTERNAL group  →  Beta App Review (~24–48h, lighter than App Store)
        ↓
  public testflight.apple.com/join link  →  QR on sticker

FULL APP STORE SUBMIT (separate, slower track, same binary):
  same build  →  ASC App Store review (~1–2 wk, HIGH first-pass rejection for real-money)
```

**Reality:** a public **live-money** QR by literal 6/1 is very tight — the deploy + smoke +
Beta-review chain must start ~24h ahead to be live mid-week (~6/3–6/5). The **App Store** version
will **not** be publicly live during the event; submit it to _start the clock_ and babysit review.
The scannable thing at the booth is the **external TestFlight build** (or the demo build day 1).

---

## The five lanes (each self-contained — pick up any one)

### Lane A — Money-path go-live _(Fardeen-gated; the long pole)_

1. Pre-flight already **green** (secrets, `serverFlags`, Plaid prod, webhooks — see STATUS).
2. `cd functions && npm install` →
   `firebase deploy --only functions,firestore:rules,firestore:indexes` (**live, irreversible**).
   Activates the bucket ledger + the legal-acceptance idempotency fix + the deposit-idempotency /
   PII-leak fixes (`d81eb93`, `5c95f12`).
3. **APNs Auth Key (.p8)** → Firebase Console → Project Settings → Cloud Messaging → upload
   (Team ID `4R55F73KCP`). Required for phone auth + push on a non-demo build. (Or set
   `EXPO_PUBLIC_DISABLE_PHONE_AUTH=true` and ship Google/Apple-only to defer.)
4. Run **[smoke-test-2026-05-30.md](./smoke-test-2026-05-30.md)** on a fresh clean account
   (**NOT** frozen `cMtHvQ…`). Tiny real $. Watch in-app / Firestore / Stripe / webhook deliveries.
   Fix → **redeploy** loop (no client rebuild).
5. Device re-test the **solo complete → payout** path (the race fix needs the deploy to take effect).

**Verify:** smoke checklist all ✓; invariant `balance == Σbuckets` holds; webhook deliveries 200;
no `earned>0` in v1; gate held; solo complete returns exact stake on device.

### Lane B — Build + submit _(Fardeen runs EAS/ASC)_

- `eas.json` `production` profile is already store-distribution + `autoIncrement` → **TestFlight /
  App Store ready as-is** (no edit needed). Version `1.0.0`, build auto-increments.
- Build iOS: `eas build --profile production --platform ios` (or `pnpm build:production`).
- Submit: `eas submit --platform ios --profile production` → lands in **ASC → TestFlight** (first
  submit prompts for ASC credentials/API key).
- **Internal** testers (add Apple IDs in ASC) install instantly, no review — for your own devices.
- **External** public link: ASC → TestFlight → create external group → enable public link →
  triggers **Beta App Review** on the first build. The join URL → the sticker QR.
- **App Store submit:** same build → ASC App Store tab → fill metadata → Submit for Review. Review
  notes must explain: **Stripe (not IAP)** because deposits/stakes/withdrawals are the **user's own
  funds**; **commitment-contract, not gambling**; **Productivity** category.
- ASC metadata still owed (STATUS "Remaining to submit"): **Publish** App Privacy (10 data types,
  Linked=true / Tracking=false), account-deletion + support URLs, `support@niyah.live` reply-from,
  screenshots, description, keywords.

**Verify:** build succeeds on EAS; `eas submit` lands in TestFlight; internal install works on your
phone; external public link generates after Beta review; App Store build "Waiting for Review."

### Lane C — Deep manual QA _(you walk device in demo mode; Claude fixes)_

Run `EXPO_PUBLIC_DEMO_MODE=true` (fake $, short timers, no Stripe) and exercise **every** screen;
Claude fixes breakages.

- Auth ×3 (Google / Apple / phone) → **legal gate fires before profile-setup** → profile → tabs.
- Onboarding carousel (welcome → how-it-works → screen-time math → screentime-setup).
- Session loop: select → (group: propose → partner → confirm → waiting-room) → active →
  complete / surrender. Quick-block (no-money).
- Friends (contacts import/search/invite/follow); Profile (theme, legal modal, bank, **delete
  account**); **logout → re-auth reset** (wallets/sessions/social clear, theme persists).
- Money UI in demo: deposit, withdraw (gate + FL/HI geo-gate copy), invites.
- Known rough spots to verify/fix: portrait fit on <5.5" phones (NumPad / MoneyPlant sizing),
  occasional haptic double-fire, `app/session/propose.tsx` discover fallback (`// TODO post-demo`).

**Verify:** `pnpm typecheck` + `pnpm test` + `pnpm test:functions` green; every screen walked in
demo mode with no crash/dead-end; logout → re-auth reset verified.

### Lane D — Art / animation polish _(Claude writes code; you supply/refine assets)_

Session-complete confetti is already good — leave it. **DONE:** deposit + withdrawal now show a
celebratory `MoneySuccessOverlay` (confetti + spring checkmark + amount count-up;
`src/components/MoneySuccessOverlay.tsx`). Remaining demo-visible wins:

- **Onboarding is NOT blank — premise corrected.** `welcome.tsx` composes four real scenes:
  page 0 `BlobsScene`, page 1 `Onboarding2Scene` (opacity peaks at progress 1), page 2
  `Onboarding3Scene` (peaks at 2), page 3 the `ContinuousScene` money tree. Each page has detailed
  SVG art. The only dead code is `ContinuousScene` **Stages 1 & 2** (phone+coins, shield+timer+icons
  — all `opacity:0`, ~250 lines), fully superseded by Onboarding2/3Scene. That's an **optional
  cleanup** (remove dead SVG + the `timerAnim`/`drift` shared values if unused by the tree), **not** a
  visible fix. Onboarding polish here is refinement (timing/easing), not a rebuild.
- **Streak counter** — animate the number in (scale/slide / count-up) on home/profile.
- **Tab-bar icons** — quick audit they're branded (not default).

**Verify:** deposit/withdraw reward motion present; streak animates; 60fps on device; `pnpm test`
still green.

### Lane E — Marketing / event assets _(you design in Figma/iPad; Claude helps copy + wiring)_

- **Sticker + QR**: QR → external TestFlight join URL (or demo build URL day 1). Blob-forward art.
  `NEXT_PUBLIC_TESTFLIGHT_URL` already feeds the landing CTA — point it at the same link.
- **Deck**: problem → de-pooled commitment-contract → screen-time moat → traction / feedback ask.
- **Onboarding copy changes** — fold into Lane C/D so QA covers them.

**Verify:** QR resolves to the live install link on a real phone; deck renders; copy passes the
no-gambling-language rule.

---

## Animation tooling — the real answer

**The app has _no Lottie_.** Its motion is **Reanimated 3** + a custom **SVG blob system**
(`BlobAvatar.tsx`, `BlobsScene.tsx`) — and that's _good_, it's how top teams build feel. "Lottie" is
one tool, not the definition of pro animation. Two distinct categories:

1. **UI motion / micro-interactions** (transitions, springs, gestures, count-ups — the "premium
   feel" of Apple / Linear / Family): this is **code**, via **Reanimated 3 + Gesture Handler**
   (already in the app, free, OSS, Apache-2.0). **Highest ROI — keep investing here.** Most of what
   reads as "big-tech polish" is this, not illustrated animation.

2. **Illustrated / character animation** (the blob emoting, a celebratory sequence, delightful empty
   states):
   - **Rive** (rive.app) — **recommended for the living blob.** Free in-browser editor (no After
     Effects), open-source runtime (`rive-react-native`), **interactive state machines** (blob
     reacts to session state), tiny `.riv` binary. Most "2025 big-tech" answer; slight learning curve.
   - **Lottie** — `lottie-react-native` runtime is OSS (Apache-2.0); the format is open. Best **free**
     authoring for you: the **LottieFiles Figma plugin** (animate Figma layers → export Lottie JSON)
     — leverages your existing **Figma** skill, no After Effects. Also LottieLab (web, free tier) or
     community animations. Good for **one-shot** moments (deposit / streak / payout).

   **Recommendation:** **Reanimated for feel + Rive for the interactive blob, and/or Lottie-via-Figma
   for one-shot illustrated moments.** All free + open source.

**iPad + Apple Pencil:** the Pencil is for **drawing assets**, not the animation timeline. Pipeline:
**illustrate on iPad** (Figma iPad app w/ Pencil, or free Vectornator / Linearity Curve; Procreate
for raster) → **animate on desktop** (Rive editor, free, or the LottieFiles Figma plugin) → export
`.riv` / `.json` → drop into RN. Frame-by-frame iPad apps (Callipeg, RoughAnimator, FlipaClip) export
**GIF/video** — use those for the **sticker / marketing clip**, _not_ for in-app vector animation.

---

## Handoff prompt (paste into a fresh Claude Code session)

```
Niyah, branch wallet-ledger (== main == origin/main). Goal: ship an INSTALLABLE app for NYC Tech
Week (~June 1-7) — LIVE-MONEY external TestFlight (public QR on a sticker) AND kick off full App
Store submission. Quality bar: deep manual QA + real animation polish, NOT slop. Read first:
docs/STATUS.md, docs/techweek-2026-06-launch.md, docs/smoke-test-2026-05-30.md.

GUARDRAILS: I (Fardeen) run ALL git/deploy/EAS/Firebase/outward actions — give me exact commands,
never execute them. Commit style: one-liner subject, no body, no trailer. Run /vibe-security on any
auth/payments/rules diff (fix Critical+High first). No bet/wager/gamble/win/pool language in app or
legal. Keep APP_CHECK_ENFORCED=false. This is a LIVE sk_live_ money app going to strangers — treat
every money-path and deploy step as high-stakes and irreversible.

Work the five lanes (I'll tell you which to start; plan so I can jump between them):
  A) Money-path go-live (my steps): functions deploy -> APNs .p8 -> controlled real-$ smoke
     (smoke-test-2026-05-30.md) -> device re-test solo complete payout.
  B) Build + submit (my steps): eas build --profile production --platform ios -> eas submit ->
     ASC TestFlight external group + public link (Beta review) -> App Store submit. Help me with
     ASC metadata (Publish App Privacy, support/deletion URLs, review notes: Stripe=own funds,
     commitment-contract not gambling, Productivity).
  C) Deep manual QA: I walk every screen on device in EXPO_PUBLIC_DEMO_MODE=true; you fix what
     breaks. Cover auth x3 + legal gate order, onboarding, full session loop, friends, profile,
     delete-account, logout/reset, money UI. Keep typecheck + test + test:functions green.
  D) Art/animation polish (you write code, I supply assets):
     - DONE: deposit + withdrawal show MoneySuccessOverlay (confetti + count-up).
     - onboarding is NOT blank: welcome.tsx has 4 real scenes (BlobsScene p0, Onboarding2Scene p1,
       Onboarding3Scene p2, ContinuousScene tree p3). Only dead code = ContinuousScene Stages 1-2
       (opacity 0, superseded) -> optional cleanup, not a visible fix.
     - animate streak counter; audit tab-bar icons branded.
     Tooling: Reanimated for UI feel; Rive (free editor, rive-react-native, state machines) for the
     interactive blob; Lottie via the LottieFiles Figma plugin for one-shot moments. I design in
     Figma + have an iPad/Pencil (use it to illustrate, animate on desktop).
  E) Marketing assets: sticker QR -> the TestFlight join URL (NEXT_PUBLIC_TESTFLIGHT_URL); deck;
     onboarding copy.

Start by confirming Lane A pre-flight is still green, then tell me the exact deploy command and the
smoke-test order. Flag the live-money-with-strangers risks (no engagement gate, withdrawal-idempotency
double-debit edge, kill-switch) and how to cap exposure for a public build.
```
