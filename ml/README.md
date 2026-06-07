# Niyah ML — Minimum Effective Stake (offline research artifact)

> **This is a self-contained, OFFLINE research prototype.** All data is **synthetic** and generated
> on the fly. There is **no network access**, **no Firebase**, **no Stripe**, and **no connection to
> the live app**. The live `sk_live_` Stripe key is never touched and cannot be touched from here.
> Nothing in `ml/` is imported by the React Native app, the Cloud Functions, or any build. The
> parent project excludes `ml/` from app bundles (via `.easignore`).

## Why this exists

Niyah is a **de-pooled commitment-contract** focus app. A user stakes **their own** money on a focus
session: complete it and the stake comes back; quit early and it is forfeited to the house. Stakes are
**never pooled or redistributed** between users. This is a commitment contract (same family as stickK
and Beeminder), **not** gambling.

The product moat is the **personalized minimum effective stake**: the *smallest* stake that still
makes a given user follow through on a given session. Too small and the commitment has no teeth; too
large and we (a) extract more of the user's money than harm-reduction requires and (b) push the user
into **high-stake avoidance** — they simply do not start the session. The objective is therefore
**harm reduction**, baked into the model and the reward, not bolted on afterward.

```
effective stake  ~=  user sensitivity  ×  session difficulty
minimum effective stake(user, context, target)  =  smallest s with P(complete | user, context, s) >= target
```

## Mapping to the real Niyah fields

The prototype is written against the *shape* of fields the app already records, so the math ports
cleanly later. (Names from `src/types/index.ts` and `functions/`.)

| Research variable        | Real Niyah field                                  | Notes                                                     |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| `stake` (cents)          | `Session.stakeAmount` / `stakePerParticipant`     | Capped server-side at `DAILY_STAKE_CAP_CENTS = 2500`.     |
| `outcome` (0/1)          | `SessionStatus` `completed` vs `surrendered`      | The supervised label.                                     |
| `difficulty` proxy       | `screenTime` (ms) + `violationCount`              | Higher screen pull / more violations ⇒ harder session.    |
| `cadence`                | `CadenceType` (`focus`/`hour`/`daily`/…)          | Longer cadence ⇒ structurally harder; a difficulty input. |
| time-of-day              | `startedAtLocalHour`                              | Late-night sessions are harder (proxy feature).           |
| day-of-week              | `dayOfWeek`                                       | Weekend vs weekday context.                               |
| `user_id`                | Firebase `uid`                                     | Grouping variable for partial pooling.                    |

`difficulty` is a single scalar in the prototype that stands in for a learned combination of
`screenTime`, `violationCount`, `cadence`, `startedAtLocalHour`, and `dayOfWeek`. In production this
scalar would be a small calibrated feature transform; the dose-response structure above it is unchanged.

## The generative model (what `simulate.py` draws from)

Per user `u` we draw a latent **sensitivity** `s_u` from a population prior (partial-pooling target).
For each session we draw a **difficulty** `d` (proxy for screen-time / violation pull, cadence, hour).
The true completion probability is a **monotone non-decreasing** dose-response in the stake:

```
logit P(complete) = baseline(user) + sensitivity(user) * stakeEffect(stake) - difficulty * d
stakeEffect(stake) is monotone non-decreasing in stake (more skin in the game never hurts follow-through)
```

The **ground-truth minimum effective stake** for each user/context is computed by inverting this true
curve at the target. `simulate.py` emits both the observations and the ground truth so the methods can
be scored against an oracle.

## Two methods

### Method 1 — Hierarchical Bayesian monotonic dose-response (`model.py`)

`P(complete | user, difficulty, stake)`, constrained **monotone non-decreasing in stake** (loss
aversion: more stake never *lowers* modeled follow-through). Monotonicity is enforced **by
construction**: the stake effect is built as a cumulative sum of **non-negative increments**
(`softplus`/`exp` of latent parameters) over a stake grid, so it is monotone regardless of the
posterior draw — no rejection, no penalty term.

Per-user effects are **partially pooled** toward a population prior:

- **Cold start** (0 sessions): a user's predictive is the **population prior predictive** — centered on
  the population mean curve but **integrating the hierarchical spread** (`sd_baseline`, `sd_sens`), so it
  is deliberately **wide**. The wide cold-start posterior is what makes the bandit explore new users.
- As sessions accrue, the posterior **shrinks from the population predictive toward the personal estimate**;
  noisy users with little data stay near the population, prolific users get a sharp personal curve.

Inference is **NumPyro NUTS** (full Bayesian posterior over population + per-user effects). We expose:

- `posterior_complete_prob(...)` — posterior predictive `P(complete)`.
- `minimum_effective_stake(user, context, target=0.80)` — smallest stake on the cents grid with
  posterior-mean `P(complete) >= target`, clamped to the cap.

> **High-stake avoidance ceiling (separate note).** The *completion* curve is monotone in stake, but
> the *start* probability is **not** — past a user-specific threshold, raising the stake lowers the
> chance the user starts at all (they avoid the commitment). This is modeled and reported **separately**
> from the completion dose-response so the two effects are never conflated. The minimum-effective-stake
> solver chooses the *smallest* qualifying stake precisely to stay below this avoidance ceiling.

Constraint-by-construction follows the constrained-monotonic-network literature:

- Runje & Shankaranarayana, *Constrained Monotonic Neural Networks*, ICML 2023.
- Wehenkel & Louppe, *Unconstrained Monotonic Neural Networks (UMNN)*, NeurIPS 2019.

### Method 2 — Thompson-sampling contextual bandit (`bandit.py`)

Online stake selection. Each round we **sample parameters from the posterior** (Thompson sampling),
build the implied dose-response, and pick the **smallest stake `<= DAILY_STAKE_CAP_CENTS (2500)`** whose
sampled `P(complete) >= target`. New users have a **wide** posterior (more exploration), **warm-started
from the population prior**; experienced users have a tight posterior (more exploitation).

**Harm-reduction reward** (so the optimum *is* the lowest effective stake):

```
reward = completed(0/1)  -  lambda * stake_risked_dollars
```

The `completed` term rewards follow-through; the `- lambda * stake` term penalizes putting the user's
money at risk. The reward is therefore maximized by the *smallest* stake that still clears the target —
exactly the minimum effective stake. `lambda` is the harm-reduction price of a dollar at risk.

> **Reading the A/B result.** The success criterion is **harm reduction**, not raw completion lift. A
> fixed preset that *over-stakes* (e.g. $15 when the median user needs ~$8) can buy a few extra
> completions — but at much higher money-at-risk. The win is **holding completion near the target while
> cutting average stake**, which shows up as higher harm-reduction **reward** and lower **regret vs the
> oracle**, even when raw completion ticks slightly down. `evaluate.py` prints completion next to the
> target and flags reward/regret as the headline metrics.

Bandit references:

- Agrawal & Goyal, *Thompson Sampling for Contextual Bandits with Linear Payoffs*, ICML 2013.
- Riquelme, Tucker & Snoek, *Deep Bayesian Bandits Showdown*, ICLR 2018.
- Shen et al., *Safe dose-finding (SEEDA) for safe and efficient dose escalation*, ICML 2020 — the
  "find the lowest dose that works, never overshoot" framing that maps directly to minimum effective
  stake.

## Cold start (population prior → personal)

With no history, every user is scored at the **population prior predictive** (centered on the
population-mean curve but widened by the hierarchical spread `sd_baseline`/`sd_sens` ⇒ the bandit
explores). Each completed/surrendered session updates the posterior; partial pooling pulls the personal
curve out of the population mean at a rate set by that user's data volume.
`evaluate.py` plots this explicitly as a **cold-start curve** (performance vs. sessions seen).

## Limitations

- **Synthetic data.** The DGP is a hypothesis, not the world. Real follow-through depends on factors we
  do not simulate (mood, sleep, social context, app-blocking friction).
- **Confounding.** Observational stake choices are confounded with motivation. Real deployment needs
  randomized stake offers (or careful causal adjustment) before the dose-response is trusted as causal.
- **Small per-user n.** Most users will have very few sessions; partial pooling helps but the personal
  curve stays uncertain for a long time. Treat individual minimum-effective-stake numbers as estimates
  with wide intervals, not point truth.
- **Stationarity.** Sensitivity drifts (habit formation, tolerance). A production model needs a slow
  forgetting / time-varying component not included here.

## Path to production (guardrails)

This is an **advisory** layer only. The model never moves money on its own.

1. **Advisory only.** The model *suggests* a stake; it never sets one silently.
2. **Server-validated cap.** Any suggested stake is clamped to `DAILY_STAKE_CAP_CENTS = 2500` on the
   server, independent of the model. The client never trusts a model-supplied stake.
3. **Per-session consent.** The user explicitly confirms the stake every session. No auto-charge, ever,
   without per-session consent.
4. **Counsel sign-off.** Because Niyah handles real money and must stay clearly on the
   commitment-contract (not gambling) side of the line, any change that lets the model influence stake
   amounts requires legal/counsel sign-off before shipping.
5. **Harm-reduction monitoring.** Ship behind a metric guard: average stake risked must trend *down*
   (or hold) while completion holds; if calibrated stakes raise average money-at-risk, roll back.

## Files

| File             | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `simulate.py`    | Synthetic generative DGP + ground-truth minimum effective stake. Writes npz/CSV. |
| `model.py`       | NumPyro hierarchical monotonic dose-response; `fit()`, posterior helpers, `minimum_effective_stake()`. |
| `bandit.py`      | Thompson-sampling stake selector; harm-reduction reward; grid solver; warm start. |
| `train.py`       | Fit on simulated data; plot per-user curves vs ground truth + calibration → `figures/`. |
| `evaluate.py`    | Online A/B sim: fixed preset vs calibrated bandit; completion (vs target), avg stake risked, harm-reduction reward, regret vs oracle, cold start. |
| `requirements.txt` | Pins (numpyro, jax, numpy, matplotlib, arviz).                               |

## Run it

```bash
pip install -r ml/requirements.txt
python ml/simulate.py     # optional: writes ml/data/sim.npz (+ .csv preview)
python ml/train.py        # fits model, writes ml/figures/*.png
python ml/evaluate.py     # A/B sim, writes ml/figures/*.png and prints a report
```

Everything is seeded and deterministic, CPU-only, and runs in a few minutes with the default counts.

## Citations

- Runje, D. & Shankaranarayana, S. M. *Constrained Monotonic Neural Networks*. ICML 2023.
- Wehenkel, A. & Louppe, G. *Unconstrained Monotonic Neural Networks*. NeurIPS 2019.
- Agrawal, S. & Goyal, N. *Thompson Sampling for Contextual Bandits with Linear Payoffs*. ICML 2013.
- Riquelme, C., Tucker, G. & Snoek, J. *Deep Bayesian Bandits Showdown: An Empirical Comparison of
  Bayesian Deep Networks for Thompson Sampling*. ICLR 2018.
- Shen, C. et al. *Learning for Dose Allocation (SEEDA): Safe and Efficient Dose Finding*. ICML 2020.
