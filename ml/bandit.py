"""Method 2 — Thompson-sampling contextual bandit for stake selection.

OFFLINE. No network, no real data.

Each round we draw ONE sample from the posterior (Thompson sampling => one
"sampled world"), build the implied monotone dose-response, and pick the
SMALLEST stake <= DAILY_STAKE_CAP_CENTS whose sampled P(complete) >= target.

Harm-reduction reward (so the optimum IS the lowest effective stake):

    reward = completed(0/1)  -  lambda * stake_risked_dollars

The completion term rewards follow-through; the - lambda * stake term penalizes
money put at risk. Maximizing it => smallest stake that still clears the target.

Cold start: a user with no history is scored at the POPULATION prior (wide
posterior => more exploration), warm-started from the population mean curve.

References:
  - Agrawal & Goyal, Thompson Sampling for Contextual Bandits w/ Linear Payoffs, ICML 2013
  - Riquelme et al., Deep Bayesian Bandits Showdown, ICLR 2018
  - Shen et al., SEEDA safe dose-finding, ICML 2020 (lowest dose that works, never overshoot)
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from simulate import (
    STAKE_GRID_CENTS,
    DAILY_STAKE_CAP_CENTS,
    DEFAULT_TARGET,
    DEFAULT_LAMBDA,
    cents_to_dollars,
)
from model import FittedModel


def harm_reduction_reward(completed: int, stake_cents: float, lam: float = DEFAULT_LAMBDA) -> float:
    """reward = completed - lambda * stake_risked_dollars.

    Higher completion is good; risking more of the user's money is bad. The
    bandit maximizes this, so it converges to the minimum effective stake.
    """
    return float(completed) - lam * float(cents_to_dollars(stake_cents))


def _smallest_stake_meeting_target(probs_over_grid, target, grid=STAKE_GRID_CENTS):
    """Smallest grid stake (cents) with prob >= target, clamped to the cap.

    Returns the largest within-cap stake if the target is unreachable (best
    available effort), so the bandit never proposes above the cap.
    """
    within_cap = grid <= DAILY_STAKE_CAP_CENTS
    g = grid[within_cap]
    p = np.asarray(probs_over_grid)[within_cap]
    ok = np.where(p >= target)[0]
    if ok.size == 0:
        return float(g[-1])  # cap: best we can do within the limit
    return float(g[ok[0]])


class ThompsonStakeBandit:
    """Thompson-sampling selector over a fitted hierarchical dose-response model.

    Stateless w.r.t. choices: the "learning" lives in the posterior held by the
    FittedModel. Refit periodically (warm-start) to tighten per-user posteriors.
    """

    def __init__(
        self,
        model: FittedModel,
        target: float = DEFAULT_TARGET,
        lam: float = DEFAULT_LAMBDA,
        grid=STAKE_GRID_CENTS,
        seed: int = 0,
    ):
        self.model = model
        self.target = target
        self.lam = lam
        self.grid = np.asarray(grid)
        self._rng = np.random.default_rng(seed)

    def select_stake(self, user_idx: Optional[int], difficulty: float) -> float:
        """Thompson-sample one posterior draw, return smallest qualifying stake.

        user_idx < 0 or None => cold start (population prior; wider draws =>
        more exploration). Returns stake in cents, always <= cap.
        """
        # Full posterior draws of P(complete) over the grid: (n_draws, n_grid).
        prob_samples = self.model.posterior_prob_samples(user_idx, difficulty)
        # Thompson step: pick ONE posterior draw at random.
        d = self._rng.integers(prob_samples.shape[0])
        sampled_curve = prob_samples[d]  # (n_grid,)
        return _smallest_stake_meeting_target(sampled_curve, self.target, self.grid)

    def expected_reward_curve(self, user_idx: Optional[int], difficulty: float):
        """Posterior-mean harm-reduction reward over the grid (diagnostic).

        E[reward(s)] = E[P(complete|s)] - lambda * dollars(s). Its argmax is the
        bandit's notion of the best stake; useful for plotting / regret.
        """
        probs = self.model.posterior_complete_prob(user_idx, difficulty)  # mean P
        dollars = np.asarray(cents_to_dollars(self.grid))
        within_cap = self.grid <= DAILY_STAKE_CAP_CENTS
        rewards = np.where(within_cap, probs - self.lam * dollars, -np.inf)
        return rewards

    def best_stake_by_expected_reward(self, user_idx: Optional[int], difficulty: float) -> float:
        """Greedy (exploit-only) stake: argmax posterior-mean reward. Within cap."""
        rewards = self.expected_reward_curve(user_idx, difficulty)
        return float(self.grid[int(np.argmax(rewards))])


def oracle_best_stake(
    true_baseline: float,
    true_sensitivity: float,
    difficulty: float,
    lam: float = DEFAULT_LAMBDA,
    grid=STAKE_GRID_CENTS,
) -> float:
    """Oracle stake: argmax of the TRUE harm-reduction reward (for regret).

    Uses the true DGP completion probs, so it knows the real optimum. Within cap.
    """
    from simulate import true_complete_prob  # local import: avoid cycle at import time

    grid = np.asarray(grid)
    within_cap = grid <= DAILY_STAKE_CAP_CENTS
    probs = true_complete_prob(true_baseline, true_sensitivity, difficulty, grid)
    dollars = np.asarray(cents_to_dollars(grid))
    rewards = np.where(within_cap, probs - lam * dollars, -np.inf)
    return float(grid[int(np.argmax(rewards))])


__all__ = [
    "harm_reduction_reward",
    "ThompsonStakeBandit",
    "oracle_best_stake",
]
