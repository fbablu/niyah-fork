"""Fit the hierarchical monotonic dose-response model on simulated data and plot.

OFFLINE. No network, no real data.

Outputs (ml/figures/):
  - learned_curves.png    : learned per-user dose-response (posterior mean + band)
                            vs the TRUE curve, for a few example users + cold start
  - calibration.png       : reliability diagram (predicted vs observed completion)

Run:
    python ml/train.py
    python ml/train.py --n-users 30 --sessions-per-user 20 --num-warmup 500 --num-samples 500
"""

from __future__ import annotations

import argparse
import os

import jax
import jax.numpy as jnp
import numpy as np
import matplotlib

matplotlib.use("Agg")  # headless, no display required
import matplotlib.pyplot as plt

from simulate import (
    simulate,
    STAKE_GRID_CENTS,
    cents_to_dollars,
    true_complete_prob,
    DEFAULT_TARGET,
)
from model import fit

FIG_DIR = os.path.join(os.path.dirname(__file__), "figures")


def _plot_learned_curves(model, sim, example_users, path):
    """Learned posterior dose-response vs ground truth for example users + cold start."""
    grid_dollars = np.asarray(cents_to_dollars(STAKE_GRID_CENTS))
    n_panels = len(example_users) + 1
    ncols = min(3, n_panels)
    nrows = int(np.ceil(n_panels / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(4.5 * ncols, 3.6 * nrows), squeeze=False)

    panels = [(u, f"user {u}") for u in example_users] + [(-1, "cold start (population)")]
    for ax, (uidx, title) in zip(axes.flat, panels):
        # learned posterior P(complete) over the grid at average difficulty (d=0)
        prob_samples = model.posterior_prob_samples(uidx, 0.0)  # (D, n_grid)
        mean = prob_samples.mean(axis=0)
        lo = np.percentile(prob_samples, 5, axis=0)
        hi = np.percentile(prob_samples, 95, axis=0)
        ax.plot(grid_dollars, mean, color="C0", label="learned (post. mean)")
        ax.fill_between(grid_dollars, lo, hi, color="C0", alpha=0.2, label="90% credible")

        # ground truth (only for real users; cold start has no single truth)
        if uidx >= 0:
            tb = sim.true_baseline[uidx]
            ts = sim.true_sensitivity[uidx]
            true_p = true_complete_prob(tb, ts, 0.0, STAKE_GRID_CENTS)
            ax.plot(grid_dollars, true_p, "k--", label="true curve")
            mes = model.minimum_effective_stake(uidx, 0.0)
            ax.axvline(mes / 100.0, color="C3", ls=":", label=f"min-eff ${mes/100:.0f}")

        ax.axhline(DEFAULT_TARGET, color="gray", ls="-", lw=0.8, alpha=0.6)
        ax.set_title(title)
        ax.set_xlabel("stake ($)")
        ax.set_ylabel("P(complete)")
        ax.set_ylim(0, 1)
        ax.legend(fontsize=7, loc="lower right")

    # hide any unused panels
    for ax in axes.flat[n_panels:]:
        ax.axis("off")

    fig.suptitle("Learned monotonic dose-response vs ground truth", y=1.02)
    fig.tight_layout()
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def _plot_calibration(model, sim, path, n_bins=10):
    """Reliability diagram: predicted P(complete) vs observed completion frequency."""
    # posterior-mean predicted prob for each observed session
    ps = model.posterior_samples
    pop_curve = ps["pop_curve"]                          # (D, N_GRID)
    diff_coef = ps["diff_coef"][:, None]                 # (D, 1)
    user_base = ps["user_baseline"]                      # (D, U)
    user_sens = ps["user_sens"]                          # (D, U)

    from model import _interp_curve  # reuse the model's interpolation

    stake = jnp.asarray(sim.stake_cents)
    curve_at_stake = np.asarray(_interp_curve(pop_curve, stake))  # (D, N)
    base = np.asarray(user_base[:, sim.user_id])                  # (D, N)
    sens = np.asarray(user_sens[:, sim.user_id])                 # (D, N)
    diff = np.asarray(sim.difficulty)[None, :]                   # (1, N)
    logit = base + sens * curve_at_stake - np.asarray(diff_coef) * diff
    pred = np.asarray(jax.nn.sigmoid(jnp.asarray(logit))).mean(axis=0)  # (N,)

    obs = sim.outcome.astype(np.float32)
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(pred, bins) - 1, 0, n_bins - 1)
    xs, ys, ws = [], [], []
    for b in range(n_bins):
        m = idx == b
        if m.sum() == 0:
            continue
        xs.append(pred[m].mean())
        ys.append(obs[m].mean())
        ws.append(m.sum())

    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="perfect")
    sizes = 20 + 200 * np.asarray(ws) / max(ws)
    ax.scatter(xs, ys, s=sizes, color="C0", alpha=0.8, label="bins (size ∝ n)")
    ax.set_xlabel("predicted P(complete)")
    ax.set_ylabel("observed completion rate")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Calibration (reliability diagram)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def _report_min_eff_recovery(model, sim):
    """Print learned vs ground-truth minimum effective stake per user (MAE)."""
    learned = np.array([model.minimum_effective_stake(u, 0.0) for u in range(sim.n_users)])
    truth = np.asarray(sim.gt_min_stake_cents)
    mae = float(np.mean(np.abs(learned - truth)))
    print("[train] minimum-effective-stake recovery (cents):")
    print(f"        MAE = {mae:.0f}  (~${mae/100:.2f})")
    print(f"        learned  median = {np.median(learned):.0f}")
    print(f"        truth    median = {np.median(truth):.0f}")


def main():
    ap = argparse.ArgumentParser(description="Fit + plot the monotonic dose-response model (offline).")
    ap.add_argument("--n-users", type=int, default=30)
    ap.add_argument("--sessions-per-user", type=int, default=20)
    ap.add_argument("--target", type=float, default=DEFAULT_TARGET)
    ap.add_argument("--num-warmup", type=int, default=500)
    ap.add_argument("--num-samples", type=int, default=500)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    os.makedirs(FIG_DIR, exist_ok=True)

    print("[train] simulating data (offline, synthetic)...")
    sim = simulate(
        n_users=args.n_users,
        sessions_per_user=args.sessions_per_user,
        target=args.target,
        seed=7,
    )
    print(f"[train] {sim.user_id.shape[0]} sessions, {sim.n_users} users, "
          f"completion={sim.outcome.mean():.3f}")

    print("[train] running NUTS (this is the slow part; a few minutes on CPU)...")
    model = fit(
        user_id=sim.user_id,
        difficulty=sim.difficulty,
        stake_cents=sim.stake_cents,
        outcome=sim.outcome,
        n_users=sim.n_users,
        target=args.target,
        num_warmup=args.num_warmup,
        num_samples=args.num_samples,
        seed=args.seed,
        progress_bar=True,
    )

    # pick a few example users spanning low / mid / high need
    order = np.argsort(sim.gt_min_stake_cents)
    example_users = [int(order[1]), int(order[len(order) // 2]), int(order[-2])]

    curves_path = os.path.join(FIG_DIR, "learned_curves.png")
    calib_path = os.path.join(FIG_DIR, "calibration.png")
    _plot_learned_curves(model, sim, example_users, curves_path)
    _plot_calibration(model, sim, calib_path)
    _report_min_eff_recovery(model, sim)

    print(f"[train] wrote {curves_path}")
    print(f"[train] wrote {calib_path}")
    print("[train] done.")


if __name__ == "__main__":
    main()
