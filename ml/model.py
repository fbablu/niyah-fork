"""Method 1 — Hierarchical Bayesian MONOTONIC dose-response model (NumPyro).

OFFLINE. No network, no real data.

Models  P(complete | user, difficulty, stake)  with the stake effect constrained
to be MONOTONE NON-DECREASING in stake (loss aversion: more skin in the game
never lowers modeled follow-through).

Monotonicity is enforced BY CONSTRUCTION, not by penalty/rejection:

    stake_effect(grid) = cumsum( non_negative_increments )

where the increments are softplus/exp of latent params. Any posterior draw is
therefore monotone non-decreasing on the stake grid. This is the
constrained-monotonic-network construction:
  - Runje & Shankaranarayana, Constrained Monotonic Neural Networks, ICML 2023
  - Wehenkel & Louppe, Unconstrained Monotonic Neural Networks (UMNN), NeurIPS 2019

Per-user effects (baseline + sensitivity scale on the monotone curve) are
PARTIALLY POOLED toward a population prior via a non-centered hierarchy:
  - cold start (0 sessions): a user collapses to the population mean curve,
  - as sessions accrue: posterior shrinks from population toward personal.

Inference: NumPyro NUTS.

Public API:
  fit(...) -> FittedModel
  FittedModel.posterior_complete_prob(...)   posterior predictive P(complete)
  FittedModel.minimum_effective_stake(...)   smallest stake on grid s.t. P>=target
  FittedModel.posterior_samples              raw MCMC samples (for the bandit)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import jax
import jax.numpy as jnp
import numpy as np
import numpyro
import numpyro.distributions as dist
from numpyro.infer import MCMC, NUTS

from simulate import STAKE_GRID_CENTS, DAILY_STAKE_CAP_CENTS, DEFAULT_TARGET, cents_to_dollars

numpyro.set_host_device_count(1)

# Number of monotone increments = number of gaps in the stake grid. The stake
# effect at grid point k is the cumulative sum of the first k non-negative
# increments, with effect[0] = 0 (zero stake => zero stake-effect, baseline only).
_N_GRID = STAKE_GRID_CENTS.shape[0]
_N_INCREMENTS = _N_GRID - 1

# Grid in dollars, used as the basis the model interpolates over.
_GRID_DOLLARS = np.asarray(cents_to_dollars(STAKE_GRID_CENTS))


def _stake_basis(stake_cents):
    """Map raw stake (cents) -> fractional index position on the stake grid.

    Returns (lower_idx, frac) for linear interpolation of the monotone grid
    curve at arbitrary stake values: the value at `stake` is
    curve[lower_idx] + frac * (curve[lower_idx + 1] - curve[lower_idx]).
    Pure jnp so it traces under JIT/NUTS.
    """
    dollars = stake_cents / 100.0
    grid = jnp.asarray(_GRID_DOLLARS)
    # searchsorted gives the insertion index; clamp to valid interp range.
    idx = jnp.clip(jnp.searchsorted(grid, dollars, side="right") - 1, 0, _N_GRID - 2)
    lo = grid[idx]
    hi = grid[idx + 1]
    frac = jnp.clip((dollars - lo) / (hi - lo + 1e-8), 0.0, 1.0)
    return idx, frac


def _interp_curve(curve_grid, stake_cents):
    """Linear-interpolate a per-grid-point curve (..., N_GRID) at stake values.

    curve_grid: (..., N_GRID) monotone non-decreasing along last axis.
    stake_cents: (M,) stake values.
    returns: (..., M)
    """
    idx, frac = _stake_basis(stake_cents)  # (M,), (M,)
    lo = jnp.take(curve_grid, idx, axis=-1)
    hi = jnp.take(curve_grid, idx + 1, axis=-1)
    return lo + frac * (hi - lo)


def dose_response_model(user_id, difficulty, stake_cents, outcome=None, n_users: int = 1):
    """NumPyro model for P(complete | user, difficulty, stake), monotone in stake.

    Args:
      user_id:    (N,) int   user index per session
      difficulty: (N,) float session difficulty proxy
      stake_cents:(N,) float stake offered/chosen
      outcome:    (N,) int   completed 0/1 (None for prior predictive)
      n_users:    number of distinct users
    """
    # ── Population (shared) parameters ──────────────────────────────────────
    pop_baseline = numpyro.sample("pop_baseline", dist.Normal(-0.4, 1.0))
    pop_sens_loc = numpyro.sample("pop_sens_loc", dist.Normal(0.0, 1.0))

    # Population monotone stake-effect SHAPE: non-negative increments via softplus.
    # raw_inc ~ Normal; softplus(raw_inc) >= 0 => cumulative sum is monotone up.
    pop_raw_inc = numpyro.sample(
        "pop_raw_inc", dist.Normal(jnp.full(_N_INCREMENTS, -0.5), 0.7).to_event(1)
    )
    pop_increments = jax.nn.softplus(pop_raw_inc)  # (N_INCREMENTS,) >= 0
    # effect at grid point 0 is 0; effect[k] = sum of first k increments.
    pop_curve = jnp.concatenate([jnp.zeros(1), jnp.cumsum(pop_increments)])  # (N_GRID,)

    # Difficulty coefficient (shared); positive prior mass via Normal centered >0.
    diff_coef = numpyro.sample("diff_coef", dist.Normal(1.0, 0.5))

    # ── Per-user partially-pooled effects (non-centered) ────────────────────
    sd_baseline = numpyro.sample("sd_baseline", dist.HalfNormal(0.7))
    sd_sens = numpyro.sample("sd_sens", dist.HalfNormal(0.7))

    with numpyro.plate("users", n_users):
        z_baseline = numpyro.sample("z_baseline", dist.Normal(0.0, 1.0))
        z_sens = numpyro.sample("z_sens", dist.Normal(0.0, 1.0))

    # user baseline = population mean + shrunk personal deviation
    user_baseline = pop_baseline + sd_baseline * z_baseline           # (n_users,)
    # user sensitivity SCALE on the monotone curve, kept POSITIVE so the curve
    # stays monotone non-decreasing per user. softplus of (pop_loc + dev).
    user_sens = jax.nn.softplus(pop_sens_loc + sd_sens * z_sens)      # (n_users,) >= 0

    numpyro.deterministic("user_baseline", user_baseline)
    numpyro.deterministic("user_sens", user_sens)
    numpyro.deterministic("pop_curve", pop_curve)

    # ── Likelihood ──────────────────────────────────────────────────────────
    # stake effect for each session = user_sens * interp(pop_curve, stake)
    curve_at_stake = _interp_curve(pop_curve[None, :], stake_cents)[0]  # (N,)
    sens_per_obs = user_sens[user_id]                                   # (N,)
    base_per_obs = user_baseline[user_id]                              # (N,)

    logit = base_per_obs + sens_per_obs * curve_at_stake - diff_coef * difficulty
    numpyro.sample("obs", dist.Bernoulli(logits=logit), obs=outcome)


@dataclass
class FittedModel:
    """Holds posterior samples + helpers for prediction and stake selection."""

    posterior_samples: dict          # name -> (n_draws, ...) jnp arrays
    n_users: int
    target: float = DEFAULT_TARGET
    grid_cents: np.ndarray = field(default_factory=lambda: STAKE_GRID_CENTS)
    # Seed for the cold-start prior-predictive z-draws (kept deterministic).
    _coldstart_seed: int = 12345

    # ── posterior predictive P(complete) ────────────────────────────────────
    def _logit_grid_for_user(self, user_idx: int, difficulty: float):
        """Posterior logits over the full stake grid for one user/context.

        Returns (n_draws, n_grid). Cold start: pass user_idx=-1 (or None) to use
        the POPULATION PRIOR PREDICTIVE for an unseen user, i.e. someone with no
        history. That predictive integrates the hierarchical spread
        (sd_baseline, sd_sens) by drawing a fresh per-user deviation z ~ N(0,1)
        for every posterior sample, so the cold-start posterior is WIDE (drives
        exploration in the bandit) and centered on the population mean — not the
        artificially narrow population-mean point estimate. As a user's own
        sessions accrue, the warm path (user_idx >= 0) shrinks from this
        population predictive toward the personal posterior (partial pooling).
        """
        ps = self.posterior_samples
        pop_curve = ps["pop_curve"]                       # (D, N_GRID)
        diff_coef = ps["diff_coef"][:, None]              # (D, 1)

        if user_idx is None or user_idx < 0:
            # cold start: population PRIOR PREDICTIVE for a brand-new user.
            # base = pop_baseline + sd_baseline * z ;  sens = softplus(pop_sens_loc + sd_sens * z)
            # with z ~ N(0,1) drawn fresh per posterior draw (deterministic seed).
            n_draws = pop_curve.shape[0]
            rng = np.random.default_rng(self._coldstart_seed)
            z_b = jnp.asarray(rng.standard_normal(n_draws))
            z_s = jnp.asarray(rng.standard_normal(n_draws))
            base = (ps["pop_baseline"] + ps["sd_baseline"] * z_b)[:, None]        # (D, 1)
            sens = jax.nn.softplus(ps["pop_sens_loc"] + ps["sd_sens"] * z_s)[:, None]  # (D, 1)
        else:
            base = ps["user_baseline"][:, user_idx][:, None]     # (D, 1)
            sens = ps["user_sens"][:, user_idx][:, None]         # (D, 1)

        # curve over the full grid (monotone by construction)
        curve = pop_curve                                  # (D, N_GRID)
        logit = base + sens * curve - diff_coef * difficulty
        return logit                                       # (D, N_GRID)

    def posterior_complete_prob(self, user_idx: Optional[int], difficulty: float):
        """Posterior-mean P(complete) over the stake grid for a user/context.

        Returns (n_grid,) numpy array of posterior-mean probabilities.
        """
        logit = self._logit_grid_for_user(user_idx, difficulty)
        probs = jax.nn.sigmoid(logit)
        return np.asarray(jnp.mean(probs, axis=0))

    def posterior_prob_samples(self, user_idx: Optional[int], difficulty: float):
        """Full posterior draws of P(complete) over the grid: (n_draws, n_grid).

        Used by the Thompson-sampling bandit (one draw == one sampled world).
        """
        logit = self._logit_grid_for_user(user_idx, difficulty)
        return np.asarray(jax.nn.sigmoid(logit))

    # ── minimum effective stake ─────────────────────────────────────────────
    def minimum_effective_stake(
        self,
        user_idx: Optional[int],
        difficulty: float,
        target: Optional[float] = None,
    ) -> float:
        """Smallest stake (cents) on the grid with posterior-mean P >= target.

        Clamped to DAILY_STAKE_CAP_CENTS. Returns the cap if the target is
        unreachable within the cap. user_idx<0 / None => cold-start (population).
        """
        tgt = self.target if target is None else target
        probs = self.posterior_complete_prob(user_idx, difficulty)  # (n_grid,)
        ok = np.where(probs >= tgt)[0]
        if ok.size == 0:
            return float(min(self.grid_cents[-1], DAILY_STAKE_CAP_CENTS))
        return float(min(self.grid_cents[ok[0]], DAILY_STAKE_CAP_CENTS))


def fit(
    user_id,
    difficulty,
    stake_cents,
    outcome,
    n_users: int,
    target: float = DEFAULT_TARGET,
    num_warmup: int = 500,
    num_samples: int = 500,
    num_chains: int = 1,
    seed: int = 0,
    progress_bar: bool = True,
) -> FittedModel:
    """Run NUTS on the hierarchical monotonic dose-response model.

    Modest warmup/samples keep it CPU-runnable in a few minutes. Deterministic
    given `seed`.
    """
    kernel = NUTS(dose_response_model, target_accept_prob=0.9)
    mcmc = MCMC(
        kernel,
        num_warmup=num_warmup,
        num_samples=num_samples,
        num_chains=num_chains,
        progress_bar=progress_bar,
    )
    mcmc.run(
        jax.random.PRNGKey(seed),
        user_id=jnp.asarray(user_id),
        difficulty=jnp.asarray(difficulty, dtype=jnp.float32),
        stake_cents=jnp.asarray(stake_cents, dtype=jnp.float32),
        outcome=jnp.asarray(outcome),
        n_users=n_users,
    )
    samples = mcmc.get_samples()
    return FittedModel(posterior_samples=samples, n_users=n_users, target=target)


__all__ = ["dose_response_model", "FittedModel", "fit"]
