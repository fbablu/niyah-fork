# AI Integration — Design Doc

> **Status:** Proposal. Not started. Zero AI/ML in the codebase today (greenfield — swept
> `src/`, `functions/`, `app/`, `docs/`: no AI/ML/model/LLM/Core ML references).
> **Authored:** 2026-05-31 (ideation session).
> **Owner:** Fardeen.
> **Decisions locked this session** (see [§1](#1-decisions-locked)).

---

## How to use this doc (next session)

Suggested prompt to re-enter:

> "Read `docs/ai-integration.md`. Compare every proposed feature against the current state of
> the codebase, then triage into a sequenced, dependency-aware plan. The moat feature is
> **effective-stake calibration** — note that it depends on a **variable stake lever existing
> first** (today stakes are fixed cadence presets), so order the work accordingly. Flag anything
> in this doc that's now stale vs the code."

The one thing to get right in triage: **calibration cannot be built or learned until the stake
amount is a continuous, varied lever.** Today it is not (fixed presets). That prerequisite is
[Phase 1](#phase-1--variable-stake-plumbing-prerequisite-for-the-moat). Pattern coaching
([Phase 0](#phase-0--foundations--quick-win)) is independent and ships first.

---

## TL;DR

- **Moat is the stake mechanism, not features.** AI earns its place only if it makes the stake
  work *better per person*. Everything else (chatbot coach, AI quotes, hype-streaks) is a
  gimmick and is explicitly out of scope.
- **The moat feature:** personalized **"minimum effective stake"** — the *smallest* amount that
  still makes a given user follow through. Harm-reduction by construction.
- **The catch / sequencing crux:** stake is a *treatment*, not a feature. Stakes are fixed
  presets today → zero variation → the stake→completion curve is unlearnable until stakes vary.
  So the moat has a hard prerequisite: build the variable-stake lever first, then introduce
  controlled variation, *then* personalize.
- **Honest tooling:** small statistical models (hierarchical logistic + a contextual bandit) do
  the money math; an LLM only does language (parse "why I quit", phrase coaching). Not deep
  learning, and that's correct.
- **Ships-first value:** pattern coaching (time-of-day + why-you-quit) is cheap, low-risk,
  zero money-touch, and delivers the most value to *new* users. It also starts the data
  flywheel that the moat needs.

---

## 1. Decisions locked

From the 2026-05-31 ideation session:

| Question | Decision |
| --- | --- |
| How load-bearing should AI be? | **Core moat.** AI runs stake calibration; it's the data-moat story, not a side feature. |
| Comfortable with AI influencing stake size, given not-gambling positioning? | **Yes — as harm-reduction only.** Recommend the *lowest effective* stake, opt-in, advisory. Never auto-charge a different amount without explicit per-session consent. |
| Which directions to go deep on now? | **Stake calibration** (the moat) + **Pattern coaching** (ships first). |
| Deferred | Abandon-risk prediction (real, lower priority). Natural-language setup/reflection (gimmick-prone, only if it earns its keep). |

---

## 2. Idea triage (conviction + status)

| # | Direction | What it is | Conviction | Status |
| --- | --- | --- | --- | --- |
| A | **Stake calibration** | Personalized "minimum effective stake" per user/context | Highest — *the moat* | In scope. Has prerequisites ([§4](#4-the-critical-insight-stake-is-a-treatment-not-a-feature), [Phase 1](#phase-1--variable-stake-plumbing-prerequisite-for-the-moat)). |
| B | **Pattern coaching** | "You complete 90% of mornings, 40% of nights" — insights from own data | High — cheapest, lowest-risk, best for new users | In scope. **Ships first** ([Phase 0](#phase-0--foundations--quick-win)). |
| C | **Abandon-risk → intervention** | Predict imminent quit, intervene at the cliff (self-authored note, easier next cadence) | Medium — real retention play | Deferred. Lower legal risk than A; revisit after A/B exist. |
| D | **NL setup / reflection** | Conversational session setup or post-surrender reflection chat | Low — gimmick-prone | Out unless it demonstrably earns its keep. The *reflection categorizer* (LLM parsing "why I quit") is the only piece worth keeping, and it lives inside B. |
| — | Chatbot coach / AI quotes / hype-streaks | Generic AI persona features | None — dilutes the behavioral-finance story | **Explicitly out of scope.** |

---

## 3. Concept: what "effective stake" means

A stake is **effective** when fear of losing it beats the in-the-moment pull to quit. Mechanism
= loss aversion (losing $X hurts ~2× more than gaining $X feels good). The stake makes "quit
early" carry a felt cost larger than the distraction's tug.

Per-person dose-response curve:

- **Too low** → no behavior change; user quits as if there were no stake.
- **Effective band** → completion probability jumps.
- **Too high** → user won't press start (avoidance/anxiety); and if they *do* fail, real
  financial harm.

**Minimum effective dose** = the lowest point on that curve that hits a target completion
probability (e.g. ~80%). Below it, money is risked for nothing. Above it, more is risked than
needed. "Effective" is defined by the **completion outcome**, not by past stakes — past stakes
are how the threshold is *estimated*, not what defines it.

**Two inputs, two jobs:**

- **Stake history → the user's *sensitivity*.** What dollar amount moves *this* person (some
  flinch at $2, some need $20).
- **Screen-time / `violationCount` → the *difficulty* of this session.** How hard they fought
  the urge, which apps they tried to open — the temptation being staked against.

Effective stake ≈ **sensitivity × difficulty**. $5 is plenty for a low-pull 25-min morning
session; useless for a high-pull 2-hour night session.

---

## 4. The critical insight: stake is a treatment, not a feature

The naive plan — "predict completion from user-stats + stake, recommend the best stake" — fails
on current data because **stakes don't vary**. Solo stakes are fixed per cadence; the only
variation is users self-selecting different cadences, which is pure confounding (the
$100-monthly cohort ≠ the $2-focus cohort). With a constant treatment there is no slope to learn.

**Therefore the moat has a hard dependency chain:**

1. **Variable stake lever** must exist (continuous amount, not a fixed preset) — *plumbing*.
2. **Controlled variation** in what's offered (a band, chosen by a bandit) — so there's signal.
3. **Data capture** (difficulty + outcome + context) — so the signal is usable.
4. **Model** turns the accumulated (context, stake, outcome) tuples into a personalized curve.
5. **Proof** via A/B (preset vs calibrated).

This is why the user flagged "the stake thing may need to be done first." Correct: **§Phase 1
(variable-stake plumbing) is a precondition for the entire moat**, and it contains no AI at all.

**Elegant consequence — harm-reduction is the objective, not a bolt-on.** The bandit's reward
function is:

```
reward = completed(0/1)  −  λ · stake_risked
```

Maximizing it drives toward the *lowest* stake that still produces completion. The ethical
framing *is* the math. This is the part that holds up to both a technical investor and to legal.

---

## 5. Proposed architecture

- **Small models do the money math.**
  - Completion-probability: **hierarchical (Bayesian) logistic regression** over user features
    (recent completion rate, streak, cadence, time-of-day, difficulty signals).
  - Stake selection: **contextual bandit** (Thompson sampling / LinUCB) with the harm-reduction
    reward above. Naturally balances explore (learn the curve) vs exploit (use it).
  - *Not* deep learning. The right tool, and more defensible than an LLM near money.
- **LLM does language only.**
  - Parse free-text "why I quit" → structured distraction taxonomy.
  - Phrase the coaching insight in natural language.
  - Never sizes money.
- **Cloud-first.** Pooling + bandit need cross-user data → Firebase Cloud Functions. Keep AI
  recommendations advisory and server-validated against the hard cap.
- **On-device (Core ML) is a v2 privacy pitch**, not a v1 requirement — "your behavior never
  leaves the phone." Aligns with the existing SSL-pin / screen-protection posture. Defer.

---

## 6. Cold start (new-user value)

A new user mostly *contributes* data before *consuming* personalization. Honest. But not zero:

1. **"People like you" priors.** A new user is a draw from a population whose curve is known.
   Start at the population-average effective dose for their cadence — already better than one
   flat preset for everyone. Estimate shrinks crowd → personal as sessions accrue (same shape
   as a Spotify popularity prior).
2. **Onboarding weak priors.** 2–3 signup questions ("how often do you follow through on
   goals?", "have app blockers worked for you before?", "focusing on what?") place the user in
   the distribution. Noisy, overwritten quickly by real behavior.
3. **The bandit is the cold-start accelerator.** Thompson sampling explores more when uncertain
   (new user), less as it learns — designed to find the curve in the fewest sessions.

**Honest caveat:** day-1 benefit ≈ crowd default; true personalization lands after ~5–15
sessions. Stake calibration is a **tenure feature** (the moat compounds with retention). The
biggest day-1 predictor isn't stake at all — it's *whether the user shows up* — so a new user's
real immediate value is **pattern coaching** + completion-probability nudges. That's exactly why
Phase 0 ships first.

---

## 7. Sequencing / phased plan (dependency-aware)

### Phase 0 — Foundations & quick win
*No money risk. Independent of stake work. Ships value now and starts the data flywheel.*

- **Data capture (tiny schema work):**
  - Derive **time-of-day / day-of-week** from existing `startedAt` (free; just compute &
    persist or compute at read time).
  - Add **structured surrender reason** to the quit screen — one-tap chips (distracted /
    interrupted / too long / lost motivation / emergency) + optional free text. Today the quit
    screen only requires typing "QUIT"; the reason is solicited in copy but never persisted.
- **Pattern Coaching feature:** surface own-data insights (best time-of-day, completion by
  cadence, distraction patterns once reason data exists). LLM phrases it.
- **Outcome:** immediate user value, investor-legible demo, and the behavioral dataset begins
  accumulating for the moat.

### Phase 1 — Variable-stake plumbing (PREREQUISITE for the moat)
*Still no AI. Turns "stake" from a fixed preset into a continuous lever.*

- Extend the **solo** flow to accept a variable / recommended stake (today it's fixed by
  cadence — `app/session/select.tsx`). The **group** flow already accepts custom amounts
  (`app/session/propose.tsx`, `QUICK_STAKES` + free text), so partial plumbing exists there.
- Add a **recommendation surface** ("suggested for you: $X") — initially a static heuristic or
  the population default; the slot the bandit will later fill.
- Confirm the **server validates arbitrary amounts ≤ `DAILY_STAKE_CAP_CENTS`** on all paths
  (group custom already exercises this; verify solo).
- **Outcome:** stake is now a continuous, recommendable lever. Nothing can be calibrated before
  this exists.

### Phase 2 — Controlled variation + learning
*First AI. Learning begins.*

- Bandit (Thompson) picks the offered stake from a band around the population/cadence baseline
  (e.g. $4–6 around a $5 preset).
- Log every `(context, offered_stake, accepted_stake, outcome)` tuple.
- Train the population-level completion-probability model.
- **Outcome:** the stake→completion curve becomes estimable for the first time.

### Phase 3 — Personalization
- Hierarchical pooling: shrink each user from the crowd prior toward their personal estimate as
  data accrues.
- Onboarding priors feed cold-start.
- **Outcome:** the "minimum effective stake" recommendation becomes genuinely personal.

### Phase 4 — Proof & polish
- **A/B:** fixed preset vs calibrated stake → headline metric ("personalized stakes lifted
  completion X% → Y%"). Satisfies the roadmap's "metrics for pitch" item.
- Consider on-device Core ML (privacy pitch).
- **Multiplier synergy:** once the payout multiplier flips (`SOLO_COMPLETION_MULTIPLIER` > 1,
  surplus, deferred to post-approval), calibration sharpens — the model can *reward*
  hard-but-achievable commitments, not only avoid loss.

---

## 8. Current codebase state (grounding for triage)

> Line numbers are approximate — **verify against the code during triage.** Field/constant/file
> names are the stable anchors.

**Per-session data (exists):** `src/types/index.ts` (solo session ~L113), `src/config/firebase.ts`
(~L510) — `id`, `cadence`, `stakeAmount` (cents), `potentialPayout`, `startedAt`, `endsAt`,
`status` (active/completed/surrendered), `completedAt`, `actualPayout` (server-written),
`violationCount` (`src/store/sessionStore.ts` ~L189). Group sessions additionally store
per-participant `completed`, `screenTime` (ms), `surrendered`, `surrenderedAt`, `violationCount`.

**User aggregate stats (exists):** `src/types/index.ts` (~L23) — `currentStreak`,
`longestStreak`, `totalSessions`, `completedSessions`, `totalEarnings`, `balance`. Reputation
(~L85) — `score`, `level`, `paymentsCompleted`, `paymentsMissed`, `totalOwedPaid`,
`totalOwedMissed`, `referralCount`. **Completion rate is derivable** (`completedSessions /
totalSessions`) but not currently stored as a field.

**Stake config (exists):** `src/constants/config.ts` — cadence presets (~L18): focus 200¢/25min,
hour 500¢/60min, daily 500¢/24h, weekly 2500¢/7d, monthly 10000¢/30d. `DAILY_STAKE_CAP_CENTS =
2500` (~L81, mirrored server-side). `SOLO_COMPLETION_MULTIPLIER = 1` (1:1 refund, no surplus
yet). Group quick stakes `QUICK_STAKES = [500, 1000, 2500, 5000]` (`app/session/propose.tsx` ~L61).

**Stake selection (exists):** solo = fixed by cadence, no override (`app/session/select.tsx`);
group = quick buttons + custom dollar input (`app/session/propose.tsx`).

**Surrender flow (exists):** `app/session/surrender.tsx` (~L128) requires typing "QUIT";
`sessionStore.ts` surrender path (~L223) sets streak 0, calls `cloudForfeit()` (returns
`{ forgiven, refundedCents? }` — first-surrender forgiveness).

**Missing (must be added for AI):**

- `surrenderReason` — solicited in copy, **not persisted** (`app/session/surrender.tsx` ~L238).
- **Time-of-day / day-of-week** — not captured (derivable from `startedAt`).
- **Per-app violation breakdown** — only an aggregate `violationCount` + total `screenTime`
  (ms) exist; no per-app or timestamped detail. *(Optional / privacy-sensitive — Phase 2+.)*
- **No completion-rate / elasticity model**, no stake variation, no AI feature flags.

---

## 9. Data model changes required

| Change | Where | Phase |
| --- | --- | --- |
| Persist structured `surrenderReason` (enum chips) + optional free text | `src/types/index.ts`, `src/store/sessionStore.ts`, `app/session/surrender.tsx` | 0 |
| Capture/derive `startedAtLocalHour` / `dayOfWeek` | session write path (`src/config/firebase.ts`, `sessionStore.ts`) | 0 |
| Variable/recommended stake field on solo sessions + recommendation slot | `src/types/index.ts`, `app/session/select.tsx` | 1 |
| Bandit decision log `(context, offered, accepted, outcome)` | new Firestore collection + Cloud Function | 2 |
| AI feature flags (gate every stage; default off) | `src/constants/config.ts` | 0+ |
| (Optional) per-app violation breakdown | native Screen Time bridge + session schema | 2+ |

All new money-path Cloud Functions must respect the existing `APP_CHECK_ENFORCED` gate and the
`DAILY_STAKE_CAP_CENTS` hard ceiling.

---

## 10. Risks & guardrails

- **Confounding / no current variation** — the core blocker. *Mitigation:* Phase 1 + 2 introduce
  the lever and controlled variation before any curve is claimed.
- **Sample size** — per-user sessions are few; early personalization is weak. *Mitigation:*
  hierarchical pooling (crowd → personal); don't oversell day-one.
- **Gaming** — if users sense "failing → lower stakes," they may fail strategically.
  *Mitigation:* harm-reduction objective is fairly robust; monitor; cap downward drift.
- **Hard cap stays** — AI recommends *down*, never above `DAILY_STAKE_CAP_CENTS`; never
  auto-charges a different amount without explicit per-session consent.
- **Predatory optics is the real PR risk** — "AI charges vulnerable people more" is the attack.
  The *minimum-effective-dose / lowest-effective-stake* framing is the antidote and must be the
  **public narrative**, not a footnote.
- **Privacy** — feeding models means more behavioral/Screen-Time data (sensitive, Apple-strict).
  Cloud-first is fine; on-device Core ML is the v2 privacy story. Keep raw Screen Time local
  where possible.

---

## 11. Legal

Niyah is a **commitment contract**, not gambling (see [docs/legal.md](legal.md)). Dynamic
per-user stake sizing sits closer to the line than flat presets and near consumer-finance
personalization rules.

- Ship money-side AI **only** under the harm-reduction framing (recommend the lowest effective
  stake; opt-in; advisory).
- **Get counsel sign-off before any money-side AI ships.** Behavior-side (pattern coaching,
  Phase 0) carries no such risk and can proceed.
- Keep language consistent: stake / commitment / complete — never bet / wager / gamble / win.

---

## 12. Open decisions

- Target completion probability for "effective" (80%? per-cadence?).
- Width of the controlled-variation band, and downward-only vs symmetric.
- Cloud vs on-device timing (default: cloud now, Core ML v2).
- Onboarding prior question set (exact wording).
- Whether completion rate gets stored as a field or always derived.
- Per-app violation capture: worth the privacy/native cost? (Phase 2+ decision.)

---

## Appendix — investor framing

> "Niyah finds your **minimum effective stake** — the smallest amount that still makes you follow
> through. Every session teaches us each person's exact loss-aversion threshold. Competitors copy
> app-blocking in a weekend; they can't copy the behavioral dataset. And because we optimize for
> the *lowest* effective stake, the model is harm-reduction by construction — pro-wellbeing, not
> predatory."
