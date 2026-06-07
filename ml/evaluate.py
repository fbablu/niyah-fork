"""Online A/B simulation: FIXED preset stake vs CALIBRATED Thompson bandit.

OFFLINE. No network, no real data.

Streams synthetic sessions and compares two policies:
  A) FIXED  — everyone is offered a fixed preset stake (today's behavior).
  B) BANDIT — Thompson-sampling stake selector over the hierarchical model,
              periodically refit (warm-started from the population prior) so
              per-user posteriors tighten as sessions accrue.

Reports:
  - completion-rate lift          (bandit completion - fixed completion)
  - AVERAGE STAKE RISKED          (lower is better == harm reduction)
  - cumulative regret vs ORACLE   (true harm-reduction reward optimum)
  - cold-start curve              (bandit performance vs sessions seen)

Outputs (ml/figures/):
  - ab_summary.png        : completion + avg-stake-risked bars, both policies
  - regret.png            : cumulative regret vs oracle, both policies
  - cold_start.png        : rolling completion / avg-stake-risked as data accrues

Run:
    python ml/evaluate.py
    python ml/evaluate.py --n-users 24 --rounds 18 --refit-every 6
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from simulate import (
    simulate,
    true_complete_prob,
    cents_to_dollars,
    STAKE_GRID_CENTS,
    DAILY_STAKE_CAP_CENTS,
    DEFAULT_TARGET,
    DEFAULT_LAMBDA,
)
from model import fit
from bandit import ThompsonStakeBandit, harm_reduction_reward, oracle_best_stake

FIG_DIR = os.path.join(os.path.dirname(__file__), "figures")

# A typical FIXED preset offered today (one of the config cadence stakes).
FIXED_PRESET_CENTS = 1500  # $15


def _draw_outcome(rng, baseline, sens, difficulty, stake_cents):
    p = true_complete_prob(baseline, sens, difficulty, stake_cents)
    return int(rng.random() < float(p))


def run_ab(
    n_users: int = 24,
    rounds: int = 18,
    refit_every: int = 6,
    warmup_sessions_per_user: int = 4,
    target: float = DEFAULT_TARGET,
    lam: float = DEFAULT_LAMBDA,
    num_warmup: int = 350,
    num_samples: int = 350,
    seed: int = 11,
):
    """Stream `rounds` sessions per user under both policies; collect metrics."""
    rng = np.random.default_rng(seed)

    # Ground-truth world (true per-user params) — the simulator's TrueWorld.
    truth = simulate(n_users=n_users, sessions_per_user=1, target=target, seed=3)
    true_base = truth.true_baseline
    true_sens = truth.true_sensitivity

    # Seed the model with a small warm-start history so the population prior is
    # informed (cold-start users still collapse to it). This mimics launch with
    # a little aggregate data but very little per-user data.
    seed_sim = simulate(
        n_users=n_users, sessions_per_user=warmup_sessions_per_user, target=target, seed=99
    )
    hist_u = list(seed_sim.user_id)
    hist_d = list(seed_sim.difficulty)
    hist_s = list(seed_sim.stake_cents)
    hist_y = list(seed_sim.outcome)

    def refit():
        return fit(
            user_id=np.asarray(hist_u, dtype=np.int32),
            difficulty=np.asarray(hist_d, dtype=np.float32),
            stake_cents=np.asarray(hist_s, dtype=np.float32),
            outcome=np.asarray(hist_y, dtype=np.int32),
            n_users=n_users,
            target=target,
            num_warmup=num_warmup,
            num_samples=num_samples,
            seed=seed,
            progress_bar=False,
        )

    print("[evaluate] initial fit (warm start from seed history)...")
    model = refit()
    bandit = ThompsonStakeBandit(model, target=target, lam=lam, seed=seed)

    # per-round accumulators
    fixed_completions, fixed_stakes, fixed_rewards = [], [], []
    band_completions, band_stakes, band_rewards = [], [], []
    fixed_regret_cum, band_regret_cum = [], []
    f_reg, b_reg = 0.0, 0.0
    # track how many sessions the bandit has personally seen per user (cold start)
    seen_count = np.full(n_users, warmup_sessions_per_user, dtype=np.int32)
    coldstart_points = []  # (sessions_seen, bandit_completed, bandit_stake_dollars)

    for r in range(rounds):
        rc_f, rs_f, rr_f = [], [], []
        rc_b, rs_b, rr_b = [], [], []
        for u in range(n_users):
            difficulty = float(rng.normal(0.0, 1.0))

            # ── ORACLE (for regret): best true-reward stake & its expected reward
            o_stake = oracle_best_stake(true_base[u], true_sens[u], difficulty, lam=lam)
            o_p = float(true_complete_prob(true_base[u], true_sens[u], difficulty, o_stake))
            o_reward = o_p - lam * float(cents_to_dollars(o_stake))

            # ── FIXED preset policy
            f_stake = float(min(FIXED_PRESET_CENTS, DAILY_STAKE_CAP_CENTS))
            f_y = _draw_outcome(rng, true_base[u], true_sens[u], difficulty, f_stake)
            f_r = harm_reduction_reward(f_y, f_stake, lam)
            # expected reward under fixed (for regret, use true expected reward)
            f_p = float(true_complete_prob(true_base[u], true_sens[u], difficulty, f_stake))
            f_reg += o_reward - (f_p - lam * float(cents_to_dollars(f_stake)))
            rc_f.append(f_y); rs_f.append(f_stake); rr_f.append(f_r)

            # ── BANDIT policy (Thompson sample over posterior)
            b_stake = bandit.select_stake(u, difficulty)
            b_stake = float(min(b_stake, DAILY_STAKE_CAP_CENTS))  # server cap guard
            b_y = _draw_outcome(rng, true_base[u], true_sens[u], difficulty, b_stake)
            b_r = harm_reduction_reward(b_y, b_stake, lam)
            b_p = float(true_complete_prob(true_base[u], true_sens[u], difficulty, b_stake))
            b_reg += o_reward - (b_p - lam * float(cents_to_dollars(b_stake)))
            rc_b.append(b_y); rs_b.append(b_stake); rr_b.append(b_r)

            coldstart_points.append((int(seen_count[u]), b_y, float(cents_to_dollars(b_stake))))

            # bandit observes its OWN outcome -> feeds the next refit
            hist_u.append(u); hist_d.append(difficulty); hist_s.append(b_stake); hist_y.append(b_y)
            seen_count[u] += 1

        fixed_completions.append(np.mean(rc_f)); fixed_stakes.append(np.mean(rs_f)); fixed_rewards.append(np.mean(rr_f))
        band_completions.append(np.mean(rc_b)); band_stakes.append(np.mean(rs_b)); band_rewards.append(np.mean(rr_b))
        fixed_regret_cum.append(f_reg); band_regret_cum.append(b_reg)

        # periodic refit (warm start): posteriors tighten as the bandit learns
        if (r + 1) % refit_every == 0 and r + 1 < rounds:
            print(f"[evaluate] round {r+1}/{rounds}: refitting bandit posterior...")
            model = refit()
            bandit = ThompsonStakeBandit(model, target=target, lam=lam, seed=seed + r)

    return dict(
        fixed_completions=np.array(fixed_completions),
        fixed_stakes=np.array(fixed_stakes),
        fixed_rewards=np.array(fixed_rewards),
        band_completions=np.array(band_completions),
        band_stakes=np.array(band_stakes),
        band_rewards=np.array(band_rewards),
        fixed_regret_cum=np.array(fixed_regret_cum),
        band_regret_cum=np.array(band_regret_cum),
        coldstart_points=np.array(coldstart_points),
        rounds=rounds,
        n_users=n_users,
    )


def _plot_summary(res, path):
    f_comp = res["fixed_completions"].mean()
    b_comp = res["band_completions"].mean()
    f_stake = res["fixed_stakes"].mean() / 100.0
    b_stake = res["band_stakes"].mean() / 100.0

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 4))
    ax1.bar(["fixed", "bandit"], [f_comp, b_comp], color=["gray", "C0"])
    ax1.set_ylim(0, 1)
    ax1.set_ylabel("completion rate")
    ax1.set_title(f"Completion (lift = {b_comp - f_comp:+.3f})")

    ax2.bar(["fixed", "bandit"], [f_stake, b_stake], color=["gray", "C2"])
    ax2.set_ylabel("avg stake risked ($)  — lower is better")
    ax2.set_title(f"Harm reduction ({b_stake - f_stake:+.2f} $/session)")
    fig.suptitle("Fixed preset vs calibrated bandit")
    fig.tight_layout()
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def _plot_regret(res, path):
    x = np.arange(1, res["rounds"] + 1)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(x, res["fixed_regret_cum"], color="gray", label="fixed")
    ax.plot(x, res["band_regret_cum"], color="C0", label="bandit")
    ax.set_xlabel("round")
    ax.set_ylabel("cumulative regret vs oracle")
    ax.set_title("Cumulative regret (lower is better)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def _plot_cold_start(res, path, n_bins=8):
    pts = res["coldstart_points"]  # (M, 3): seen, completed, stake_dollars
    seen = pts[:, 0]
    comp = pts[:, 1]
    stake = pts[:, 2]
    edges = np.linspace(seen.min(), seen.max() + 1e-6, n_bins + 1)
    idx = np.clip(np.digitize(seen, edges) - 1, 0, n_bins - 1)
    xs, comp_y, stake_y = [], [], []
    for b in range(n_bins):
        m = idx == b
        if m.sum() == 0:
            continue
        xs.append(seen[m].mean())
        comp_y.append(comp[m].mean())
        stake_y.append(stake[m].mean())

    fig, ax1 = plt.subplots(figsize=(6.5, 4))
    ax1.plot(xs, comp_y, "o-", color="C0", label="completion rate")
    ax1.set_xlabel("sessions seen by user (cold → warm)")
    ax1.set_ylabel("completion rate", color="C0")
    ax1.set_ylim(0, 1)
    ax2 = ax1.twinx()
    ax2.plot(xs, stake_y, "s--", color="C2", label="avg stake risked ($)")
    ax2.set_ylabel("avg stake risked ($)", color="C2")
    ax1.set_title("Cold-start curve: bandit performance vs sessions seen")
    fig.tight_layout()
    fig.savefig(path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description="A/B sim: fixed preset vs calibrated bandit (offline).")
    ap.add_argument("--n-users", type=int, default=24)
    ap.add_argument("--rounds", type=int, default=18)
    ap.add_argument("--refit-every", type=int, default=6)
    ap.add_argument("--num-warmup", type=int, default=350)
    ap.add_argument("--num-samples", type=int, default=350)
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    os.makedirs(FIG_DIR, exist_ok=True)

    res = run_ab(
        n_users=args.n_users,
        rounds=args.rounds,
        refit_every=args.refit_every,
        num_warmup=args.num_warmup,
        num_samples=args.num_samples,
        seed=args.seed,
    )

    f_comp = res["fixed_completions"].mean()
    b_comp = res["band_completions"].mean()
    f_stake = res["fixed_stakes"].mean() / 100.0
    b_stake = res["band_stakes"].mean() / 100.0

    print("\n========== A/B REPORT (synthetic, offline) ==========")
    print(f"  completion rate   fixed={f_comp:.3f}   bandit={b_comp:.3f}   lift={b_comp - f_comp:+.3f}   (target={DEFAULT_TARGET:.2f})")
    print(f"  avg stake risked  fixed=${f_stake:.2f}  bandit=${b_stake:.2f}  delta={b_stake - f_stake:+.2f} $/session (lower=better)")
    print(f"  avg reward        fixed={res['fixed_rewards'].mean():.3f}  bandit={res['band_rewards'].mean():.3f}  (bandit's true objective; higher=better)")
    print(f"  final cum regret  fixed={res['fixed_regret_cum'][-1]:.2f}  bandit={res['band_regret_cum'][-1]:.2f} (vs oracle; lower=better)")
    print("  NOTE: a FIXED preset that over-stakes can buy a few extra completions,")
    print("        but at far higher money-at-risk. Harm reduction = hold completion")
    print("        near the target while cutting avg stake; read reward + regret, not")
    print("        raw completion lift, as the headline.")
    print("=====================================================\n")

    summary_path = os.path.join(FIG_DIR, "ab_summary.png")
    regret_path = os.path.join(FIG_DIR, "regret.png")
    cold_path = os.path.join(FIG_DIR, "cold_start.png")
    _plot_summary(res, summary_path)
    _plot_regret(res, regret_path)
    _plot_cold_start(res, cold_path)
    print(f"[evaluate] wrote {summary_path}")
    print(f"[evaluate] wrote {regret_path}")
    print(f"[evaluate] wrote {cold_path}")
    print("[evaluate] done.")


if __name__ == "__main__":
    main()
