# Legal & Regulatory

> Legal framing, gambling analysis, and App Store strategy.
> Reflects the **de-pooled commitment-contract** model shipped on `wallet-ledger` (2026-05).
> See also: [Payments](./payments.md) | [Features](./features.md) | hosted docs in [`/legal`](../legal/)

## Commitment Contract, Not Gambling

Niyah is a **commitment contract** app. Users stake their **own** money as a motivational device to hit focus goals. Same legal model as stickK and Beeminder (10+ years).

### Three-Element Gambling Test

1. **Consideration** (payment) — YES
2. **Prize** (something to win) — minimal: you get your **own** stake back on completion. Any completion reward or promo is **house-funded**, not won from other players.
3. **Chance** (luck-based outcome) — **NO. Outcome is 100% the user's own effort.**

**Verdict**: Not gambling — no element of chance, and no player-vs-player pool.

### Precedents

| App       | Model                          | Status                                |
| --------- | ------------------------------ | ------------------------------------- |
| stickK    | Stakes → charity if you fail   | Legal, 10+ years                      |
| Beeminder | Stakes → company if you fail   | Legal, 10+ years                      |
| DietBet   | Pool split among winners       | Legal, but needs explicit skill framing + higher risk |

Niyah follows the **stickK/Beeminder forfeit-to-company** model (forfeit → house), **not** DietBet's pool-split.

## De-Pooled Model (CURRENT — replaces the old pool/duo design)

**Solo *and* group sessions are individual stakes.** Each participant:

- stakes their **own** money,
- gets their **own** stake back on completion (× a house-funded completion multiplier, currently **1.0× / dormant**),
- forfeits their **own** stake to the house (Niyah, Inc.) on surrender.

**No pooling. No redistribution. No peer-to-peer payments. No Venmo.** A forfeiter's stake never moves to a completer.

> ⚠️ The old "Pool/Duo mode + Venmo honor-settlement + Stripe-escrow phases" design is **REMOVED**. Do not reintroduce peer-to-peer settlement — that re-creates a zero-sum pool (the gambling-classification + money-transmission risk the de-pool eliminated).

## Money Transmission / MSB Posture

Posture (not counsel — revisit at scale):

- All fund movement (charges, refunds, payouts) runs through **Stripe** (licensed); bank linking via **Plaid**. Niyah never custodies funds or moves money between users.
- House-funded rewards + **no player pools** → no money transmission between users.
- **MSB / state MTL** classification deferred as a *regulator-at-scale* risk, not a *gatekeeper-now* risk.
- **Gatekeeper-now** risks (Stripe/Apple gambling classification) are handled by: de-pool + de-gamble language + commitment-contract framing.

## Eligibility & KYC

- **18+ self-attestation** at legal acceptance (`ageAttested18`, server-written, client-immutable; **no DOB stored**).
- Real age/identity verified by **Stripe KYC at money-out** (withdrawal).
- **US residents only.**
- **Withdrawal geo-gate**: refused for **FL + HI** (env `WITHDRAWAL_EXCLUDED_STATES=FL,HI`) — strict skill-gaming states; env-tunable so counsel can add states without a code change.

## Completion Rewards & Promotions (posture for the post-approval flip)

- Completion surplus ("earned") and promo credits ("bonus") are **house-funded**, withdrawable only **after an engagement gate** (the anti-fraud lever).
- Framed as **rewards/credits**, never "winnings won from others."
- Ship **dormant** at launch (1.0×, promo off); flipped server-side **post-approval** ([STATUS.md](./STATUS.md) → "submit now, flip in days").

## App Store Strategy

- **Category**: Productivity (NOT Games).
- **Avoid words**: "bet," "wager," "gamble," "win." **Use**: "stake," "commitment," "goal," "complete," "Earned."
- **Real money via Stripe, not IAP**: deposits/stakes/withdrawals are the user's **own funds**, not digital content unlocking app features — so external payment (Stripe) is correct, not Apple IAP. Be ready to explain this in App Review notes.
- **Mandatory privacy-policy URL** → hosted `legal/privacy.html`.
- **Account deletion** in-app (Profile) satisfies guideline **5.1.1(v)**.
- **Custom EULA** must carry Apple's minimum terms (Apple not a party; third-party-beneficiary clause) — included in `legal/terms.html`.

## Legal Docs — Status

- ✅ **In-app ToS/Privacy**: de-pooled, 18+, commitment-contract (`src/components/LegalContentView.tsx`); `CURRENT_LEGAL_VERSION = 2.0.0` (re-prompts all users, backfills `ageAttested18`).
- ✅ **Hosted ToS/Privacy**: Next.js routes `landing-pg/app/legal/{privacy,terms}/page.tsx` + shared `legal/layout.tsx` → live at `niyah.live/legal/privacy` + `/legal/terms` (plain-language, Niyah-specific + Apple clauses; **build-verified**). Auto-deploys via `.github/workflows/deploy-landing.yml` on merge to `main`. Contact = `support@niyah.live`. **Before submit**: fill `[STATE]`/`[VENUE]` in the Terms + counsel review; paste the privacy URL into App Store Connect.

## Required Legal Disclaimer

```
COMMITMENT CONTRACT DISCLAIMER

Niyah provides commitment contract services, not gambling services.
The outcome of each focus session is determined solely by the user's
personal effort and action - not by chance, luck, or random events.

Users stake funds as a commitment device to help achieve their goals.
Successful completion is entirely within the user's control.

Niyah is not a gambling, gaming, lottery, or betting service.
```

## Outstanding Legal Actions

- [x] Governing law/venue = **Delaware** (C-Corp), filled in the Terms.
- [ ] Merge to `main` to deploy the legal pages; complete App Privacy labels; confirm `niyah.live/legal/privacy` is live before submitting (URL already entered in App Store Connect).
- [ ] Counsel review (esp. binding-arbitration decision).
- [x] Support email = `support@niyah.live` (create the Workspace alias).
- [x] De-pool + de-gamble language (2026-05).
- [x] 18+ self-attestation at acceptance.
- [x] Commitment-contract disclaimer in app (LegalContentView).

## Contacts

- **Technical consulting**: 40AU (Logan & Andrew)
