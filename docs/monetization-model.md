# Niyah monetization + reward + abuse-prevention model (v1.1 design)

> Synthesized 2026-06-08 from the `niyah-monetization-model` workflow (W1): 3 grounded fact-maps,
> 5 candidate models, each adversarially stress-tested on 5 lenses (abuse, legal, App Store,
> unit-economics, user-value) = 25 verdicts. The workflow's synthesis step stalled on rate limits;
> this doc is the synthesis written from its 33 completed agent results. **This is a design
> recommendation — the model choice is Fardeen's call.** Companion: the engineering feasibility in
> [post-1.0x-engineering-plan.md](./post-1.0x-engineering-plan.md).

## The founder's question, answered

> "Do users just lose money or get the same back — why would anyone use this?"

That reaction comes from people who **don't need the product** — they already have self-control. The
customer is the person who has bounced off every free blocker (Opal, one-sec, Brick) because free
blockers have **no teeth**: you just disable them. The stake **is** the teeth. The entire
commitment-contract category (stickK, Beeminder, Forfeit) is built on exactly "get your own money
back on success, lose it on failure," and it works *because* the threat of loss is the mechanism.
The "win" is: **you kept your $50 AND got the hours back AND extended the streak.**

The dangerous instinct is to add **financial upside** ("earn money by not using your phone"). That
single axis is what (a) bleeds the house, (b) invites every abuse vector, and (c) creates real legal
exposure. The stress-test confirmed it from five angles. **Reward users, yes — but not with house
cash and not with other users' money.**

## What the stress-test killed (and why)

| Model | Fatal flaw (lowest-lens verdict) |
| --- | --- |
| **Group-rake / peer-funded** (the friend's model) | **DEAD.** Redistributing quitters' forfeits to completers IS the pooling the de-pool deliberately removed — it crosses the gambling line (a HARD constraint, enforced in code + legal.md). Only a *house-funded* variant survives, and that variant collapses into the others. |
| **Subscription-gated Staked mode** | **App Store Guideline 3.1.1 (score 3):** a paid "Staked Pass" billed via Apple IAP that gates a real-money feature is an IAP violation — you can't sell access-to-a-Stripe-money-feature through IAP, and you can't sell it through Stripe either (Apple requires IAP for digital subscriptions). Also **funnel cannibalization**: free Zen and paid Staked produce the same user-visible outcome. |
| **Any service fee on the returned stake** | **User-value (score 3):** a 3% completion fee "directly breaks the product's load-bearing promise — every surface says *get your stake back*." Negative felt value. |
| **All "earn a small reward" variants** | **Abuse (score 3): the house-bleed round-trip** — deposit by card (house eats ~2.9%+$0.30), then withdraw to ACH (~$0.25); repeat to arbitrage the payment rails at the house's expense. Plus a **stake strawman** in the profit math: it assumed stake=$20, but the cheapest stakeable cadence is **$2** (`src/constants/config.ts`), so per-challenge margin is a fraction of the claim. |

Net: **legal scored highest (avg 5.4)** for the de-pooled models — the structure is sound. Every
*monetization* lens (abuse, App Store, economics, user-value) scored 3–4, i.e. each money-making
idea has a concrete hole. The holes all point the same way.

## Recommended model — "two clean rails"

Keep the two value rails **completely separated** so the cash side never bleeds and the reward side
never touches house cash or another user's money:

**Rail 1 — Cash (real money, Stripe): the pure 1.0× commitment contract that ships today.**
- Complete → your exact stake back. Quit → forfeit to the house. `SOLO_PAYOUT_MULTIPLIER = 1.0`
  stays. No fee on the returned stake. This is the binary that ships now — it's already built and
  legal-clean.
- The house's only structural cost here is **Stripe fees**, so close the round-trip leak: **pass the
  card deposit fee to the user** (or net it out of withdrawals) and keep the existing withdrawal
  rate-limit. Then deposit→withdraw is fee-neutral to the house and the arbitrage dies.

**Rail 2 — Reward (non-cash): "blobs," an affiliate/sponsor-funded loyalty layer.**
- Completing focus earns **blobs** (the avatar currency users already love) → cosmetics, streak
  flair, and **partner/gift-card perks funded by affiliate margin or sponsors, never by house cash
  and never redeemable for cash.** This gives the "I got something" dopamine without the financial-
  upside axis. Because blobs never convert to cash, there's nothing to farm and no gambling/MTL
  exposure.

**Monetization: a subscription that sells COSMETICS + a better free blocker — NOT access to the
money feature.** "Niyah+" unlocks premium blob cosmetics, advanced Zen schedules/themes, and stats.
It is billed via **Apple IAP** (correct — it's digital goods) and is **independent of staking**, so
it sidesteps the 3.1.1 trap (IAP never gates the Stripe money path). Free Zen mode (a genuinely
best-in-class blocker) remains the top-of-funnel.

**On a >1.0× "earn" reward:** the honest finding is that a cash multiplier funded by the house bleeds,
and one funded by peers is illegal. If a positive *cash* reward is ever introduced, it must be
**self-funded** (from subscription margin or sponsor budget, hard-capped at `min(1× net deposits,
$50)` — already built) and gated behind the full abuse stack below. Default recommendation: **don't
ship cash upside; ship blobs.**

## Corrected profit math

The founder's `P = RAKE% · p? · (m · u · u_stakes)`:
- **Drop `p?`** — a rake/fee is a transaction fee taken regardless of completion, not contingent on
  success.
- **Define the rake base** — in a de-pooled model there's no pool to rake; a fee can only land on
  the deposit or the payout, and **fee-on-payout breaks the "get your stake back" promise** (killed
  above).
- **Solo only "loses" if multiplier > 1** — at 1.0× the house is net-neutral on stake, minus Stripe
  fees. **Stripe fees are the real cost**, which is why Rail 1 must pass deposit fees through.
- The realistic revenue line is **subscription + affiliate margin**, not a rake: `Revenue ≈
  (subscribers × $/mo) + (affiliate_redemptions × margin)` — both positive after costs, neither
  bleeds, neither is gambling.

## Abuse prevention (the "just buy another phone" question)

At 1.0× there is **nothing to farm** (you only recover your own deposit), so the abuse stack is the
precondition for *ever* turning on cash upside — not needed for the shipping binary. Full technical
plan in [post-1.0x-engineering-plan.md](./post-1.0x-engineering-plan.md) Track 2; in brief:
- **Layer 0 (free now):** flip `APP_CHECK_ENFORCED=true` at ≥99% App Check metrics.
- **Layer 1 (before any >1.0×):** Stripe Identity selfie+document dedup = one verified human per
  withdrawable account — the only thing that defeats new-phone/new-Apple-ID farming. Do NOT add this
  friction at 1.0× (zero fraud upside, dark-pattern risk).
- **Layer 2 (fast-follow):** DeviceCheck two-bit per-device brake (survives reinstall).
- **Close the round-trip** (pass deposit fees through) regardless of multiplier.
- Reward "real focus"? The honest answer (W2 Track 3): iOS **cannot measure** focus vs an idle
  phone, so never reward phone-absence with cash; reward *completing a staked, friction-gated block*
  and keep the cash reward ≤ stake. Surface an honest "slips" (resisted-temptation) metric instead.

## Phased rollout

- **Build-23 / v1.0 (now):** Rail 1 pure 1.0× cash contract (already built). Optionally add the
  deposit-fee pass-through. Ship free Zen + the blob avatar as-is.
- **v1.1 (post-approval, mostly server/JS flips):** blobs-as-loyalty reward rail (affiliate perks);
  Niyah+ cosmetic subscription via IAP; App Check enforce flip.
- **v1.2+ (only if a cash reward is ever wanted):** the abuse stack (Stripe Identity + DeviceCheck) +
  the surplus cap + finalized engagement gate, THEN a self-funded, capped >1.0×.

## The decision for Fardeen

1. **Reward axis:** non-cash **blobs** (recommended) vs hold a self-funded capped cash reward for
   v1.2 vs cash upside now (not recommended — bleeds/illegal/abusable).
2. **Subscription:** ship "Niyah+" cosmetics-via-IAP in v1.1? (Keeps it clear of the 3.1.1 trap.)
3. **Deposit fee pass-through:** add to build-23 (closes the round-trip leak) or defer?
4. **Group mode:** keep de-pooled (each completer gets their own stake back, house keeps forfeits) —
   confirm we are NOT reintroducing any forfeit-redistribution.
