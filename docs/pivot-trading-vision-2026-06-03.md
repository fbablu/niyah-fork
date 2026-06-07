# Pivot / Trading-Vision Strategy — "Prediction Market for Your Own Behavior"

> **Internal strategy doc. NOT user-facing. NOT app or landing copy.**
> This doc analyzes gambling / derivatives / prediction-market regulation **by name** because
> it is an internal regulatory analysis. None of this language may leak into the app, the
> landing site, the pitch, App Store metadata, or any user-facing surface. The shipped product
> stays **de-pooled, de-gambled, Productivity-category** (see [docs/legal.md](legal.md)).
>
> **Authored:** 2026-06-03 (for the NY Tech Week "Founder Idol" 60-sec pitch, 2026-06-03 evening).
> **Audience:** Fardeen (founder) + anyone briefing him before the pitch.
> **One-line thesis:** You can *sell the big vision* ("a prediction market for your own
> behavior") **honestly** while *shipping the safe product* (the de-pooled commitment contract).
> The two are different legal entities, different products, and different timelines — and saying
> so out loud is the strength, not the weakness.

---

## 0. The bottom line up front (read this if you read nothing else)

1. **Anything where money pools or moves between users on an outcome is one of three things in
   the US: gambling, an unregistered derivatives exchange, or unlicensed money transmission.**
   All three are felonies-adjacent if done without the right license. None can bolt onto Niyah's
   current de-pooled v1. None can ship on the App Store under Productivity.

2. **The companies that "made pooling legal" did it the only two ways it can be done:** Kalshi
   spent **~5 years and a federal license** to become a CFTC-regulated exchange where users trade
   against *each other* (Kalshi is the venue, not the house). Polymarket went **offshore, on
   crypto rails, geofenced US users out**, ate a **$1.4M CFTC fine in 2022**, and only got back
   into the US in late 2025 by **buying a CFTC-licensed exchange for $112M**. There is no third
   "just turn it on" path.

3. **For Niyah, the parlay/prediction direction is a SEPARATE, SEPARATELY-INCORPORATED,
   SEPARATELY-REGULATED future company** — not a feature flag on the current app. Treat it as a
   v3 spin-out, not a v1 toggle.

4. **Never store a raw SSN.** The Tea app breach (July 2025, ~72k IDs / 13k selfies + driver's
   licenses leaked from a misconfigured Firebase bucket) is the cautionary tale. Use a
   third-party IDV/KYC vendor (Persona / Stripe Identity / Plaid IDV) and dedup on a token or a
   salted hash you never have to defend in a breach.

5. **The AI moat (effective-stake calibration) is real but has a hard prerequisite:** the
   **variable-stake lever must ship first** (stakes are fixed presets today). A richer
   stake/outcome dataset would supercharge calibration — but you can't calibrate a constant.
   Don't pitch the AI as live; pitch it as the *flywheel the dataset turns into*.

6. **Tonight's job is to sell ambition without lying.** Shipped = de-pooled commitment contract
   in TestFlight beta. Vision = the behavioral prediction market. Say both. The honesty is
   differentiating in a room full of vaporware.

---

## 1. How Kalshi actually achieves volume + "pooling" — it bought the hardest license in fintech

**Kalshi is not the house. Kalshi is the *exchange*.** That distinction is the whole game.

- Kalshi is a **CFTC-regulated Designated Contract Market (DCM)** — the same legal category as a
  futures exchange. The CFTC **designated KalshiEX LLC as a contract market in November 2020**;
  it launched to the public in **July 2021**. ([CFTC press release](https://www.cftc.gov/PressRoom/PressReleases/8302-20),
  [Kalshi: how regulated](https://kalshi.com/market-integrity/regulation))
- **How the "pool" actually works — it's a central limit order book (CLOB), not a pool.** Users
  trade event contracts **against each other**. Every YES buyer is matched to a NO buyer (or a
  YES seller); in a binary market a *YES bid at price X* is mechanically a *NO ask at $1.00 − X*.
  Orders match on **price-time priority — the exact matching logic of every major stock
  exchange.** Kalshi runs a **fully centralized CLOB on its own servers** and **does not take the
  other side of the trade** — it facilitates the match and collects fees. That's why it can have
  "pooled-looking" liquidity without being a casino: the money flows **peer-to-peer through a
  licensed venue**, never user→house→user. ([defirate: how order books work](https://defirate.com/prediction-markets/how-order-books-work/),
  [Kalshi: the orderbook](https://help.kalshi.com/markets/markets-101/the-orderbook))
- **Liquidity is engineered, not assumed.** Kalshi waives fees on many **maker** orders (those
  that add resting liquidity) to bribe traders into quoting tight markets — standard exchange
  market-structure design. ([Kalshi maker-order program filing](https://www.cftc.gov/sites/default/files/filings/orgrules/23/05/rules0525232209.pdf))

**What the DCM license actually costs (the part founders underestimate):**

- **Time:** Kalshi's own arc was roughly **2018 founding → Nov-2020 designation → Jul-2021
  launch** — call it **~2-3 years of dedicated regulatory work just to get designated**, on top
  of company-building. ([Kalshi designation](https://news.kalshi.com/p/kalshi-designation))
- **Capital:** A DCM applicant must show **financial resources sufficient to cover >12 months of
  operating expenses** and file audited financials, plus stand up self-regulatory machinery
  (market surveillance, rule enforcement, recordkeeping, a compliance org). The CFTC publishes
  **no fixed application fee**, but charges **ongoing oversight fees** for rule-enforcement
  reviews. ([Katten: So you want to be a DCM](https://katten.com/so-you-want-to-apply-to-become-a-cftc-registered-designated-contract-market-dcm-heres-what-you-should-know),
  [CFTC DCM oversight fees](https://www.federalregister.gov/documents/2025/12/15/2025-22807/fees-for-reviews-of-the-rule-enforcement-programs-of-designated-contract-markets-and-registered))
- **Legal:** This is a **federal exchange license** — comparable seriousness to running a futures
  market. It is a multi-million-dollar legal + compliance build, which is exactly why the
  fast-followers (Robinhood, Polymarket) **bought existing DCMs instead of applying from
  scratch** (see §2). ([defirate: prediction-market land grab](https://defirate.com/news/prediction-market-land-grab-dcms-fcms-and-the-race-to-control-the-stack/))

**Takeaway for Niyah:** Kalshi-style "pooling" requires *being a regulated exchange*. That is a
company, not a feature. It is the **right north-star architecture** for the vision (peer-to-peer
through a licensed venue = not the house = not gambling), but it's a 7-figure, multi-year build.

---

## 2. How Polymarket does it — offshore, crypto, geofenced, fined, then *bought a license*

Polymarket is the cautionary-tale-then-redemption-arc version of the same story.

- **Mechanics:** Offshore exchange, settled in **USDC on the Polygon blockchain**, using an
  **AMM + order book** hybrid for liquidity. Same peer-to-peer-contract idea as Kalshi, but on
  **crypto rails outside US regulation.** ([defirate](https://defirate.com/prediction-markets/how-order-books-work/))
- **It was illegal for US persons.** In **January 2022 the CFTC fined Polymarket $1.4M** for
  operating an **unregistered facility for trading binary-options/swap contracts** (no DCM, no
  SEF registration) and ordered it to **cease serving US customers and wind down US operations.**
  ([CFTC press release 8478-22](https://www.cftc.gov/PressRoom/PressReleases/8478-22))
- **Geofencing is hard and imperfect.** Post-settlement Polymarket **blocked US IPs** but kept
  its HQ in NYC; regulators and reporters repeatedly noted that **IP blocking alone (defeated by
  VPNs) may not be sufficient compliance**, and a further probe followed in 2024.
  ([CoinDesk: blocking US users and their VPNs](https://www.coindesk.com/policy/2024/11/14/polymarkets-probe-highlights-challenges-of-blocking-us-users-and-their-vpns))
- **The only legal way back into the US was to buy a license.** In **July 2025 Polymarket
  acquired QCEX — a CFTC-licensed DCM + clearinghouse (DCO) — for $112M**, and by **November 2025
  received an Amended Order of Designation from the CFTC**, finally letting it operate as a
  regulated US platform. ([PRNewswire: $112M QCEX acquisition](https://www.prnewswire.com/news-releases/polymarket-acquires-cftc-licensed-exchange-and-clearinghouse-qcex-for-112-million-302509626.html),
  [Regulatory Oversight: CFTC approval for US re-entry](https://www.regulatoryoversight.com/2025/12/cftc-approval-allows-polymarket-to-reenter-the-u-s-market/))

**Takeaway for Niyah:** The offshore/crypto path is **not a shortcut** — it's the path that ends
in a CFTC enforcement action, a US ban, and eventually having to pay $112M for the license you
skipped. Do not pitch "we'll just go offshore." It signals you don't understand the rules.

---

## 3. The legal reality for Niyah if money pools/redistributes on an outcome

**The moment a forfeiter's money can land in a completer's pocket — or anyone bets on someone
else's screen-time outcome — Niyah stops being a commitment contract and becomes one (or more)
of three regulated things.** Today's de-pool exists *specifically* to avoid this (see
[docs/legal.md §De-Pooled Model](legal.md)). Pooling re-arms every risk the de-pool disarmed.

### The three-element gambling test, re-applied to a pooled product

Today (de-pooled): consideration YES, prize = your *own* stake back (house-funded multiplier),
chance NO → **not gambling.** Flip on pooling and: **prize** becomes "money won from other
players" and, the moment you let people stake on *someone else's* outcome or screen-time number,
**chance** creeps in (you don't control the other person). That's the textbook definition of
gambling — and simultaneously **player-vs-player money movement = money transmission**, and
**a venue for trading outcome contracts = an unregistered derivatives exchange.** One pivot, three
exposures.

### The only three legal structures that exist, with rough cost/time

| # | Structure | What it is | Rough cost | Rough time | Verdict for Niyah |
|---|---|---|---|---|---|
| **A** | **CFTC registration (be Kalshi)** | Become / acquire a **Designated Contract Market**; users trade outcome contracts peer-to-peer through your licensed venue; you're the exchange, not the house | **$Multi-million** legal+compliance to build; **~$112M** to *buy* an existing DCM (Polymarket's price); must show **>12 months opex** in capital | **~2-3 yrs** to get designated from scratch; faster only by acquisition | The **architecturally correct** north star (peer-to-peer through a licensed venue = not gambling). **Cannot** bolt onto v1; it's a new federally-regulated company. |
| **B** | **State gambling / gaming licensing (be DraftKings)** | License as a gaming operator **state by state**; accept that it *is* gambling and regulate accordingly | **$50k–$10M per state** in license fees (MI ~$50k → PA ~$10M); **15 of 37** betting states also require a **surety bond up to $5M** | **6-18 months per state**, repeated for every state | Brutal: 50 separate processes, and it **brands the product as gambling** — kills App Store Productivity, kills Apple/Stripe, contradicts the entire Niyah thesis. Avoid. |
| **C** | **Offshore + geofence (be 2022-Polymarket)** | Incorporate offshore, run on crypto rails, **block all US users** | "Cheap" to stand up; **expensive to be wrong** — Polymarket paid **$1.4M** and got banned from the US | Fast to launch, then **years** of enforcement overhang | A trap. **Illegal for US persons**, VPN-leaky, invites a CFTC action. Niyah's users are **US-only** today — this structure *excludes your entire market.* Do not pitch it. |

**Sources:** [Katten DCM guide](https://katten.com/so-you-want-to-apply-to-become-a-cftc-registered-designated-contract-market-dcm-heres-what-you-should-know),
[PRNewswire $112M](https://www.prnewswire.com/news-releases/polymarket-acquires-cftc-licensed-exchange-and-clearinghouse-qcex-for-112-million-302509626.html),
[LegalPilot gambling-license cost](https://legalpilot.com/how-much-is-a-gambling-license-cost/),
[SuretyNow sports-wagering bond](https://www.suretynow.com/bond/sports-wagering-bond),
[CFTC 8478-22 (Polymarket)](https://www.cftc.gov/PressRoom/PressReleases/8478-22).

### State it plainly (this is the load-bearing conclusion)

> **None of A/B/C can bolt onto the current de-pooled v1, and none can ship on the App Store
> under Productivity.** A pooled/parlay product is a **separately incorporated, separately
> capitalized, separately regulated company** — most likely a **CFTC-registered exchange
> spin-out (Structure A)** — that would NOT be in the App Store's Productivity category and would
> need its own entity, its own counsel, its own raise. The current Niyah app stays exactly as it
> is: de-pooled, your-own-money, Productivity. The vision is the *next company the data unlocks*,
> not a setting in this one.

---

## 4. The SSN / identity-dedup question (1 SSN = 1 user) — never hold the raw SSN

The "wild west track-only mode" and any future pooled product create pressure for **identity
dedup** (one human = one account, to stop multi-accounting / Sybil abuse / and to KYC for any
money-movement structure). The naive instinct — "collect everyone's SSN, dedup on it" — is the
single most dangerous thing you could build.

### The lesson: the Tea app breach (July 2025)

The dating-safety app **Tea** required ID verification, then **stored the verification images in
a misconfigured Firebase storage bucket**. In **July 2025** an anonymous 4chan post exposed
**~72,000 images, including ~13,000 selfies and government-issued IDs (driver's licenses,
passports)**, plus tens of thousands of user messages. Root cause: **legacy data migrated into
new infra with broken ACL/IAM permissions**, and — critically — **the IDs were retained
indefinitely when verification is a one-time step and the data should have been deleted right
after.** ([Security.org](https://www.security.org/identity-theft/breach/tea-app/),
[ABA: cloud-misconfiguration analysis](https://www.americanbar.org/groups/intellectual_property_law/resources/newsletters/cloud-misconfiguration-private-right-of-action-tea-app-data-breach/),
[NPR](https://www.npr.org/2025/08/02/nx-s1-5483886/tea-app-breach-hacked-whisper-networks))

**Note the uncomfortable parallel:** Niyah's stack is Firebase. Tea's breach was a Firebase
bucket. **If you ever hold raw IDs/SSNs, you are one misconfigured rule away from being Tea.**
The only winning move is to **not hold the raw identifier at all.**

### The right approach: outsource the raw identity to an IDV/KYC vendor

Use a **third-party identity-verification / KYC vendor** so the raw SSN, the document image, and
the selfie **live in the vendor's vault, never in Niyah's Firestore.** Options:

- **Persona** — orchestration + IDV/KYC, workflow builder.
- **Stripe Identity** — document + selfie verification on Stripe's KYC tech; already in the
  payments stack you use. ([stripe.com/identity](https://stripe.com/identity))
- **Plaid Identity Verification** — verifies name/DOB/address/ID number against trusted
  databases; notably the **quickstart sends only the *last 4* of the SSN**, not the full number.
  ([Plaid IDV](https://plaid.com/products/identity-verification/),
  [Plaid IDV quickstart](https://github.com/plaid/idv-quickstart))
- **CLEAR-style** reusable identity for a frictionless re-verify.

### How to dedup identity WITHOUT holding the raw SSN

1. **Vendor does the verification.** The user's SSN/ID goes to Persona/Plaid/Stripe, not to you.
2. **You receive a *verification token / vendor person-ID*, not the SSN.** Store *that*.
3. **Dedup on the vendor's stable identity reference** (most IDV vendors expose a per-person
   identifier or an explicit duplicate/known-person signal). One verified human → one vendor
   person-ID → one Niyah account. You enforce "1 identity = 1 user" on the **token**, never the
   SSN.
4. **If you must dedup yourself, dedup on a *salted hash*, never the raw value.** A one-way
   **HMAC/SHA-256 of (SSN + server-side secret salt)** lets you detect "same SSN already
   registered" by comparing hashes, while the plaintext SSN is never stored and a breach yields
   only useless hashes. The salt lives in **Firebase Secret Manager**, never in Firestore.
   (Prefer option 3 — let the vendor own this — over rolling your own.)
5. **Retention = zero for raw IDs.** Verification is one-time; the raw artifacts should be deleted
   the instant the vendor returns a pass. That single discipline is what Tea skipped.
6. **Never log it. Never put it in a client-readable doc. Never let it touch the device-synced
   Firestore.** (Aligns with Niyah's existing SSL-pin / `ageAttested18`-server-written posture.)

> **One-liner for the pitch room if asked:** "We'd never store SSNs — that's how you become the
> Tea app. Identity verification is outsourced to a KYC vendor; we only ever hold a verification
> token, and we dedup on that."

---

## 5. The AI tie-in — richer outcome data feeds the moat, but the lever ships first

The pooled/parlay/track-only directions would generate a **vastly richer (context → stake →
outcome) dataset** than solo sessions alone: more outcomes per user, more variation in what's
staked, social/competitive context, and — in a track-only mode — outcome data even when no money
moves. That is exactly the fuel the **effective-stake-calibration moat** runs on
(see [docs/ai-integration.md](ai-integration.md)).

**But the dependency from the AI doc is non-negotiable and must be stated honestly:**

- The moat is **personalized "minimum effective stake"** — the smallest amount that still makes a
  given person follow through (harm-reduction by construction:
  `reward = completed − λ · stake_risked`).
- **You cannot learn a dose-response curve from a constant dose.** Stakes are **fixed cadence
  presets today** → zero variation → the stake→completion slope is **unlearnable** until stakes
  vary. ([ai-integration.md §4](ai-integration.md))
- **Therefore the prerequisite is Phase 1: the variable-stake lever** (continuous, recommendable
  stake amount) — *no AI in it at all*. Only after that can controlled variation (a bandit) and
  then personalization land. A richer pooled dataset **amplifies** the moat but **does not
  substitute** for building the lever first.

**Honest framing:** "More data → better calibration" is true and compounding. But "we have an AI
that finds your minimum effective stake" is **not** true today and must not be claimed as live.
The correct pitch verb is **future/conditional**: *every session teaches us a person's
loss-aversion threshold; the richer the outcome data, the sharper that gets* — said as the
flywheel thesis, not a shipped feature.

---

## 6. The 60-second pitch — aggressive vision, zero false claims

**Constraints baked in (do not violate):**
- Shipped product = **de-pooled commitment contract, in TestFlight beta** (NOT "live on the App
  Store," NOT "launched").
- **No fabricated traction, no fabricated backing** (NOT "backed by a16z," no invented user/revenue
  numbers, no "$5/$5 match").
- The **app/landing** never says bet/wager/gamble/win/pool. **This pitch is spoken founder
  vision**, so it may *name* "prediction market" as the *future direction* — but keep the
  *shipped product* described in clean stake/commitment/complete language, and clearly mark the
  prediction-market part as **where this goes**, not what's shipped.

### Draft script (~60 seconds, ~150 words)

> "Self-control is the scarcest resource of our generation, and willpower doesn't scale — but
> **money does.** Niyah is a focus app where you put your *own* money on the line for a focus
> session. Finish, you get it all back. Quit early, you forfeit it. Your money never pools with
> anyone else's, never moves to another user — so it's a **commitment contract, not gambling.**
> It's in **TestFlight beta** now, built on real payments.
>
> Here's the bigger idea. Every session is a data point on one question: **what's the smallest
> amount that actually makes *you* follow through?** We're building toward a system that learns
> each person's exact threshold — *minimum effective stake*, harm-reduction by design.
>
> Long term, that's a **prediction market for your own behavior** — you, against your future
> self. We start as the safe commitment contract. The dataset is the moat. **That's Niyah.**"

**Why every line survives a fact-check:**
- "in TestFlight beta now" — true; never says App Store / launched.
- "your own money… never pools… commitment contract, not gambling" — exactly the shipped model.
- "we're building toward… we're building toward a prediction market" — explicitly **future
  tense / vision**, never claimed as live or legal-today.
- "minimum effective stake / harm-reduction by design" — the real moat thesis, framed as
  direction, not a shipped AI feature.
- No backer named, no metric invented, no match offer.

### Optional one-liner closers (pick one if you have ~5s)

- "We're the commitment contract today, the behavioral exchange tomorrow."
- "Beeminder meets a dataset no competitor can copy in a weekend."
- "Loss aversion is the most reliable force in behavioral economics. We're the first to price it
  per person."

---

## 7. Cheat-sheet — safe to say vs landmine (tape this to the inside of your eyelids)

### Green — say freely tonight

- "It's a **commitment contract**, not gambling — you stake **your own** money, get it back when
  you finish, forfeit it if you quit. **Nothing pools, nothing moves between users.**"
- "It's in **TestFlight beta**, running on real payments (Stripe + Plaid)."
- "Built on **real Firebase auth + live payment rails**." (true)
- "The **vision** is a prediction market for your own behavior — you vs. your future self." (as
  *vision/future*, clearly labeled)
- "The **moat is the behavioral dataset** — every session teaches us each person's loss-aversion
  threshold; we're building toward a **minimum-effective-stake** model that's **harm-reduction by
  construction.**" (framed as building-toward)
- "**US residents, 18+**, identity verified at money-out."
- "Same legal model as **stickK and Beeminder**, ten-plus years legal."

### Yellow — only with the right framing, never as a present-tense claim

- "Prediction market / parlay / friends competing" → **always tagged "the future direction"**,
  and immediately followed by "the shipped product is the de-pooled commitment contract." Never
  imply the pooled version exists or is legal today.
- "AI that sizes your stake" → say "**we're building toward**" calibration; never "we have an AI
  that does this." (It's not built; stakes are fixed presets.)
- "We'll verify identity / one person one account" → fine, but pair with "**via a KYC vendor — we
  never store SSNs.**"
- "We could be the Kalshi of behavior" → only as analogy for the *architecture* (peer-to-peer
  through a licensed venue), and only if you can immediately note it'd be a **separate
  CFTC-regulated entity**, not this app.

### Red — landmines, do not say

- ❌ "**Live on the App Store**" / "we launched." → It's TestFlight beta. (False claim.)
- ❌ "**Backed by a16z**" / any investor or accelerator you don't have. (False claim.)
- ❌ Any **made-up user count, revenue, retention, or growth number.** (False claim.)
- ❌ "**You bet / wager / gamble on** your screen time" / "**win** money / **win** other people's
  money." (Re-classifies as gambling *and* breaks the no-bet-language rule.)
- ❌ "Friends **pool** their money and the winner takes it" / "winner-take-all." (That IS gambling
  + money transmission; it's the exact thing the de-pool removed.)
- ❌ "We'll **just go offshore / use crypto** to allow betting." (Signals you don't understand the
  rules; that's the path to a CFTC fine — Polymarket paid $1.4M and got US-banned.)
- ❌ "We'll **flip on pooling** in the app next quarter." (Implies it's a feature toggle; it's a
  separate regulated company — saying this can spook anyone who knows the space.)
- ❌ "We **store users' SSNs** to dedup." (After the Tea breach, this reads as a liability bomb.)
- ❌ "$5/$5 match" or any specific promo offer. (No promo claims.)

---

## 8. Appendix — sources

**Kalshi / DCM structure & cost**
- CFTC — Designates KalshiEX as a Contract Market: https://www.cftc.gov/PressRoom/PressReleases/8302-20
- Kalshi — How is Kalshi regulated: https://kalshi.com/market-integrity/regulation
- Kalshi — Designation announcement: https://news.kalshi.com/p/kalshi-designation
- defirate — How order books work (Kalshi vs Polymarket): https://defirate.com/prediction-markets/how-order-books-work/
- Kalshi — The Orderbook: https://help.kalshi.com/markets/markets-101/the-orderbook
- Kalshi — Maker Order Protections filing: https://www.cftc.gov/sites/default/files/filings/orgrules/23/05/rules0525232209.pdf
- Katten — So You Want to Apply to Become a CFTC-Registered DCM: https://katten.com/so-you-want-to-apply-to-become-a-cftc-registered-designated-contract-market-dcm-heres-what-you-should-know
- CFTC — DCM oversight fees (Federal Register): https://www.federalregister.gov/documents/2025/12/15/2025-22807/fees-for-reviews-of-the-rule-enforcement-programs-of-designated-contract-markets-and-registered
- defirate — Prediction-market land grab (DCMs/FCMs): https://defirate.com/news/prediction-market-land-grab-dcms-fcms-and-the-race-to-control-the-stack/

**Polymarket / offshore / re-entry**
- CFTC — $1.4M penalty (8478-22): https://www.cftc.gov/PressRoom/PressReleases/8478-22
- CoinDesk — Blocking US users and their VPNs: https://www.coindesk.com/policy/2024/11/14/polymarkets-probe-highlights-challenges-of-blocking-us-users-and-their-vpns
- PRNewswire — Polymarket acquires QCEX for $112M: https://www.prnewswire.com/news-releases/polymarket-acquires-cftc-licensed-exchange-and-clearinghouse-qcex-for-112-million-302509626.html
- Regulatory Oversight — CFTC approval for US re-entry: https://www.regulatoryoversight.com/2025/12/cftc-approval-allows-polymarket-to-reenter-the-u-s-market/

**State gambling licensing**
- LegalPilot — Gambling license cost 2026: https://legalpilot.com/how-much-is-a-gambling-license-cost/
- SuretyNow — Sports wagering bond: https://www.suretynow.com/bond/sports-wagering-bond

**Tea app breach / IDV / KYC**
- Security.org — Tea app breach: https://www.security.org/identity-theft/breach/tea-app/
- ABA — Cloud misconfiguration & private right of action (Tea): https://www.americanbar.org/groups/intellectual_property_law/resources/newsletters/cloud-misconfiguration-private-right-of-action-tea-app-data-breach/
- NPR — Tea app breach: https://www.npr.org/2025/08/02/nx-s1-5483886/tea-app-breach-hacked-whisper-networks
- Stripe Identity: https://stripe.com/identity
- Plaid Identity Verification: https://plaid.com/products/identity-verification/
- Plaid IDV quickstart (sends last-4 SSN only): https://github.com/plaid/idv-quickstart

**Internal**
- [docs/legal.md](legal.md) — de-pooled commitment-contract model, gambling test, App Store strategy
- [docs/ai-integration.md](ai-integration.md) — effective-stake-calibration moat + variable-stake prerequisite
