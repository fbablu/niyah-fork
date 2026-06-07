"""Synthetic generative model (DGP) for Niyah's minimum-effective-stake research.

OFFLINE. No network, no real data, no Firebase, no Stripe. Everything here is
drawn from a seeded RNG and is purely synthetic.

The DGP mirrors the shape of the real app's fields (see README "Mapping to the
real Niyah fields"):

  - per user `u`: a latent SENSITIVITY s_u and BASELINE b_u drawn from a
    population prior (this is the partial-pooling target),
  - per session: a DIFFICULTY d (a scalar proxy for screen-time pull,
    violationCount, cadence, hour-of-day, day-of-week),
  - a STAKE in cents (chosen by some behavior policy),
  - an OUTCOME (completed 0/1) drawn from the TRUE monotone dose-response.

It also emits the GROUND-TRUTH minimum effective stake per user/context by
inverting the true curve at the target — so the learned methods can be scored
against an oracle.

Run as a script to write `ml/data/sim.npz` (+ a small CSV preview).

    python ml/simulate.py
    python ml/simulate.py --n-users 40 --sessions-per-user 25 --out ml/data/sim.npz
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass, asdict

import numpy as np

# ─── Shared configuration (imported by model / bandit / train / evaluate) ────

# Real server-side cap. A suggested or simulated stake is never allowed above this.
DAILY_STAKE_CAP_CENTS = 2500  # $25.00, matches functions/ DAILY_STAKE_CAP_CENTS

# The cents grid over which curves are evaluated and the min-effective-stake is
# searched. $1 resolution keeps NUTS + grid eval fast and matches realistic
# stake granularity for a $0–$25 range.
STAKE_GRID_CENTS = np.arange(0, DAILY_STAKE_CAP_CENTS + 1, 100, dtype=np.float32)  # 0,100,...,2500

# Default completion target the product wants to hit ("you should follow through
# ~80% of the time at the suggested stake").
DEFAULT_TARGET = 0.80

# Harm-reduction price of a dollar at risk, used by the bandit reward.
DEFAULT_LAMBDA = 0.04

# Cents <-> dollars helpers (the reward is in dollars so lambda is interpretable).
def cents_to_dollars(c):
    return np.asarray(c, dtype=np.float32) / 100.0


# ─── True population parameters of the synthetic world ───────────────────────
# These are the "physics" the methods must recover. Chosen so that a typical
# user needs a modest, non-zero stake to clear the target, and harder sessions
# need more — i.e. there is a real, learnable minimum effective stake.


@dataclass(frozen=True)
class TrueWorld:
    # Population baseline (logit completion at zero stake, average difficulty).
    # Negative => without skin in the game, the average user follows through
    # well under half the time. This is what the stake has to fix, so the
    # dose-response carries real signal.
    pop_baseline_mean: float = -1.6
    pop_baseline_sd: float = 0.8
    # Population sensitivity to stake (how steeply stake helps). Positive => more
    # stake never hurts; drawn positive via softplus so the curve is monotone up.
    # Spread so users genuinely differ in how much stake they need.
    pop_sens_mean: float = 1.2
    pop_sens_sd: float = 0.7
    # Difficulty effect: harder sessions lower completion. Difficulty is ~N(0,1).
    difficulty_coef: float = 1.1
    # Saturating stake transform: log1p(stake_dollars) so early dollars matter
    # most and the curve flattens (diminishing returns of skin-in-the-game).
    # This is the TRUE monotone dose-response shape.
    # High-stake avoidance (start probability) — modeled SEPARATELY from
    # completion (see README note). Above this $ threshold the user starts to
    # avoid the session. Not used to generate the completion label; emitted so
    # downstream code can report the avoidance ceiling.
    avoid_threshold_dollars_mean: float = 22.0
    avoid_threshold_dollars_sd: float = 4.0


WORLD = TrueWorld()


def _softplus(x):
    return np.log1p(np.exp(-np.abs(x))) + np.maximum(x, 0.0)


def true_stake_effect(stake_cents):
    """TRUE monotone non-decreasing stake transform (saturating).

    log1p of dollars: monotone increasing, concave (diminishing returns). The
    learned model does NOT assume this shape — it learns a free monotone curve —
    so recovering it is a real test.
    """
    return np.log1p(cents_to_dollars(stake_cents))


def true_complete_prob(baseline, sensitivity, difficulty, stake_cents):
    """TRUE P(complete) for given (per-user params, context, stake)."""
    logit = baseline + sensitivity * true_stake_effect(stake_cents) - WORLD.difficulty_coef * difficulty
    return 1.0 / (1.0 + np.exp(-logit))


def ground_truth_min_effective_stake(baseline, sensitivity, difficulty, target, grid=STAKE_GRID_CENTS):
    """Smallest stake on the grid with TRUE P(complete) >= target (clamped to cap).

    Returns the cap if even the max stake does not reach the target.
    """
    probs = true_complete_prob(baseline, sensitivity, difficulty, grid)
    ok = np.where(probs >= target)[0]
    if ok.size == 0:
        return float(grid[-1])
    return float(grid[ok[0]])


# ─── Simulation ──────────────────────────────────────────────────────────────


@dataclass
class SimData:
    user_id: np.ndarray          # (N,) int — index into per-user arrays
    difficulty: np.ndarray       # (N,) float — session difficulty proxy ~N(0,1)
    stake_cents: np.ndarray      # (N,) float — observed stake offered/chosen
    outcome: np.ndarray          # (N,) int   — completed (1) / surrendered (0)
    # per-user ground truth
    true_baseline: np.ndarray    # (U,)
    true_sensitivity: np.ndarray # (U,)
    true_avoid_threshold_cents: np.ndarray  # (U,)
    # ground-truth min effective stake per user at AVERAGE difficulty (d=0)
    gt_min_stake_cents: np.ndarray          # (U,)
    target: float
    n_users: int

    def as_npz_dict(self):
        d = asdict(self)
        return {k: np.asarray(v) for k, v in d.items()}


def simulate(
    n_users: int = 30,
    sessions_per_user: int = 20,
    target: float = DEFAULT_TARGET,
    seed: int = 7,
    behavior_stake_jitter: float = 0.5,
) -> SimData:
    """Draw a synthetic session dataset + per-user ground truth.

    Behavior policy for the OBSERVED stake: each user has a personal "default"
    stake loosely correlated with their own ground-truth need (mild confounding,
    on purpose — see README limitations), plus jitter, clamped to [0, cap].
    """
    rng = np.random.default_rng(seed)

    # Per-user latent params from the population prior.
    true_baseline = rng.normal(WORLD.pop_baseline_mean, WORLD.pop_baseline_sd, size=n_users)
    # sensitivity drawn positive (softplus of a normal) => monotone-up guaranteed.
    raw_sens = rng.normal(WORLD.pop_sens_mean, WORLD.pop_sens_sd, size=n_users)
    true_sensitivity = _softplus(raw_sens)
    true_avoid_threshold_cents = np.clip(
        rng.normal(WORLD.avoid_threshold_dollars_mean, WORLD.avoid_threshold_dollars_sd, size=n_users)
        * 100.0,
        500.0,
        DAILY_STAKE_CAP_CENTS,
    )

    # Ground-truth min effective stake per user at average difficulty.
    gt_min_stake = np.array(
        [
            ground_truth_min_effective_stake(true_baseline[u], true_sensitivity[u], 0.0, target)
            for u in range(n_users)
        ]
    )

    user_ids, difficulties, stakes, outcomes = [], [], [], []
    for u in range(n_users):
        # personal default stake correlates with the user's true need (confounding)
        personal_default = gt_min_stake[u]
        for _ in range(sessions_per_user):
            d = rng.normal(0.0, 1.0)
            # observed stake = personal default scaled by jitter, clamped to grid range
            mult = np.exp(rng.normal(0.0, behavior_stake_jitter))
            stake = float(np.clip(personal_default * mult, 0.0, DAILY_STAKE_CAP_CENTS))
            # snap to $1 grid (realistic granularity)
            stake = float(round(stake / 100.0) * 100.0)
            p = true_complete_prob(true_baseline[u], true_sensitivity[u], d, stake)
            y = int(rng.random() < p)
            user_ids.append(u)
            difficulties.append(d)
            stakes.append(stake)
            outcomes.append(y)

    return SimData(
        user_id=np.asarray(user_ids, dtype=np.int32),
        difficulty=np.asarray(difficulties, dtype=np.float32),
        stake_cents=np.asarray(stakes, dtype=np.float32),
        outcome=np.asarray(outcomes, dtype=np.int32),
        true_baseline=true_baseline.astype(np.float32),
        true_sensitivity=true_sensitivity.astype(np.float32),
        true_avoid_threshold_cents=true_avoid_threshold_cents.astype(np.float32),
        gt_min_stake_cents=gt_min_stake.astype(np.float32),
        target=float(target),
        n_users=int(n_users),
    )


# ─── CLI ─────────────────────────────────────────────────────────────────────


def _write_csv_preview(sim: SimData, path: str, n: int = 20):
    """Tiny human-readable preview of the first n session rows."""
    lines = ["user_id,difficulty,stake_cents,outcome"]
    for i in range(min(n, sim.user_id.shape[0])):
        lines.append(
            f"{sim.user_id[i]},{sim.difficulty[i]:.4f},{sim.stake_cents[i]:.0f},{sim.outcome[i]}"
        )
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser(description="Generate synthetic Niyah session data (offline).")
    ap.add_argument("--n-users", type=int, default=30)
    ap.add_argument("--sessions-per-user", type=int, default=20)
    ap.add_argument("--target", type=float, default=DEFAULT_TARGET)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=str, default=os.path.join(os.path.dirname(__file__), "data", "sim.npz"))
    args = ap.parse_args()

    sim = simulate(
        n_users=args.n_users,
        sessions_per_user=args.sessions_per_user,
        target=args.target,
        seed=args.seed,
    )

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    np.savez(args.out, **sim.as_npz_dict())
    csv_path = os.path.splitext(args.out)[0] + "_preview.csv"
    _write_csv_preview(sim, csv_path)

    n_sessions = sim.user_id.shape[0]
    comp_rate = float(sim.outcome.mean())
    print(f"[simulate] users={sim.n_users} sessions={n_sessions} target={sim.target}")
    print(f"[simulate] overall completion rate = {comp_rate:.3f}")
    print(
        f"[simulate] ground-truth min-effective-stake (cents): "
        f"min={sim.gt_min_stake_cents.min():.0f} "
        f"median={np.median(sim.gt_min_stake_cents):.0f} "
        f"max={sim.gt_min_stake_cents.max():.0f}"
    )
    print(f"[simulate] wrote {args.out}")
    print(f"[simulate] wrote {csv_path}")


if __name__ == "__main__":
    main()
