// Session configurations
//
// Commitment-contract model (NOT a wager pool). Every session is INDIVIDUAL
// stakes — solo and group settle identically:
//   - A completer gets their OWN stake back.
//   - A non-completer forfeits their stake to the house.
//   - Stakes are NEVER redistributed between participants. Pooling a loser's
//     stake onto winners would be a wager — a Stripe/Apple gambling-
//     classification risk and strict-state gambling exposure.
// Mirrors the authoritative server settlement in
// functions/src/security.ts `calculateGroupSessionPayouts`.

// House-funded completion multiplier applied to a completer's returned stake.
// 1.0 = stake returned, no surplus — ships DORMANT for the pilot. A value > 1
// is house-funded surplus, gated like earned balance and capped; do NOT raise
// it until the server-side cap lands (docs/may-26-resume.md, Step 7).
export const SOLO_COMPLETION_MULTIPLIER = 1;
export const CADENCES = {
  // ── Short sessions (for testing + quick use) ──────────────────────────────
  test: {
    id: "test",
    name: "Test",
    duration: 60 * 1000, // 1 minute
    demoDuration: 10 * 1000, // 10 seconds for demo
    stake: 100, // $1.00 in cents
  },
  focus: {
    id: "focus",
    name: "Focus",
    duration: 25 * 60 * 1000, // 25 minutes (Pomodoro)
    demoDuration: 15 * 1000, // 15 seconds for demo
    stake: 200, // $2.00 in cents
  },
  hour: {
    id: "hour",
    name: "Hour",
    duration: 60 * 60 * 1000, // 1 hour
    demoDuration: 30 * 1000, // 30 seconds for demo
    stake: 500, // $5.00 in cents
  },
  // ── Long sessions (real commitments) ──────────────────────────────────────
  daily: {
    id: "daily",
    name: "Daily",
    duration: 24 * 60 * 60 * 1000, // 24 hours in ms
    demoDuration: 10 * 1000, // 10 seconds for demo
    stake: 500, // $5.00 in cents - each partner stakes this
  },
  weekly: {
    id: "weekly",
    name: "Weekly",
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    demoDuration: 60 * 1000, // 60 seconds for demo
    stake: 2500, // $25.00 in cents
  },
  monthly: {
    id: "monthly",
    name: "Monthly",
    duration: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    demoDuration: 90 * 1000, // 90 seconds for demo
    stake: 10000, // $100.00 in cents
  },
} as const;

export const SHORT_CADENCES: readonly string[] = ["test", "focus", "hour"];
export const LONG_CADENCES: readonly string[] = ["daily", "weekly", "monthly"];

// Demo mode: driven by env var so production builds can't accidentally ship demo.
// Set EXPO_PUBLIC_DEMO_MODE=true in .env for development; omit or set false for production.
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
// Short timers: use demo durations (10s/60s/90s) with real backend + payments.
// Set EXPO_PUBLIC_SHORT_TIMERS=true in .env for quick testing without demo mode.
export const USE_SHORT_TIMERS =
  DEMO_MODE || process.env.EXPO_PUBLIC_SHORT_TIMERS === "true";
export const INITIAL_BALANCE = 5000; // $50.00 in cents

// Per-user daily stake cap (in cents). Mirrored server-side in Cloud Functions
// (DAILY_STAKE_CAP_CENTS in functions/src/index.ts). Limits total money a user
// can have at risk across solo + group sessions within a UTC day. Defaults to
// $25/day for campus launch. Raise after 3 clean days of real-money operation.
export const DAILY_STAKE_CAP_CENTS = 2500;

// Per-transaction deposit ceiling (in cents). Mirrors the server's
// MAX_DEPOSIT_CENTS (functions/src/index.ts, env-overridable, default 50000).
// Anti-fraud: caps a stolen card to one $500 charge. NOT a balance/earnings
// cap — users can top up again (rate-limited to 3 deposits / 10 min) and their
// earned + withdrawable balance is uncapped. Used client-side to block an
// over-limit deposit before it round-trips to Stripe and fails.
export const MAX_DEPOSIT_CENTS = 50000;

// Reputation thresholds
export const REPUTATION_LEVELS = {
  seed: { min: 0, max: 20, label: "Seed", description: "New to Niyah" },
  sprout: { min: 21, max: 40, label: "Sprout", description: "Growing trust" },
  sapling: {
    min: 41,
    max: 60,
    label: "Sapling",
    description: "Reliable partner",
  },
  tree: { min: 61, max: 80, label: "Tree", description: "Trusted member" },
  oak: {
    min: 81,
    max: 100,
    label: "Oak",
    description: "Pillar of the community",
  },
} as const;

// Legal versioning
// Bump this when Terms or Privacy content changes to re-prompt all users.
// 2.0.0: de-pooled session/payment terms (no peer-to-peer settlement, stakes
// never shared between participants) + explicit 18+ affirmation. Re-prompting
// every user also backfills the ageAttested18 record.
export const CURRENT_LEGAL_VERSION = "2.0.0";

// Hosted full legal text. The in-app acceptance overlay shows a short summary
// and links out to these for the complete Terms / Privacy Policy.
export const LEGAL_TERMS_URL = "https://niyah.live/legal/terms";
export const LEGAL_PRIVACY_URL = "https://niyah.live/legal/privacy";
// Legal index — links to both the full Terms and Privacy Policy. The in-app
// acceptance overlay points its single "Learn more" link here.
export const LEGAL_INDEX_URL = "https://niyah.live/legal";

// Referral system
// Each accepted referral permanently boosts the new user's social credit score by this amount.
// e.g. a brand-new user (score 50) who joins via referral starts at 60.
export const REFERRAL_REPUTATION_BOOST = 10; // points added to score per referral (max 100)
export const PENDING_REFERRAL_KEY = "niyah_pending_referral"; // SecureStore key — alphanumeric/._- only (no @ or /, which throw "Invalid key")
// Group-invite sessionId stashed from a /join deep link, resumed after auth.
export const PENDING_JOIN_KEY = "niyah_pending_join"; // SecureStore key — alphanumeric/._- only

// Hide phone auth button. Set EXPO_PUBLIC_DISABLE_PHONE_AUTH=true to disable
// phone sign-in when APNs Auth Key isn't yet registered in Firebase Console
// (otherwise phone auth falls back to reCAPTCHA web flow, which is brittle).
export const PHONE_AUTH_DISABLED =
  process.env.EXPO_PUBLIC_DISABLE_PHONE_AUTH === "true";

// ── AI / data-flywheel flags (see docs/ai-integration.md) ──
// AI_DATA_CAPTURE_ENABLED gates Phase-0 in-app capture: structured surrender
// reason + session time-of-day. Analytics only — NO money-path effect, never
// changes a stake or a payout. Default ON: starts the behavioral dataset the
// stake-calibration moat needs. AI_STAKE_CALIBRATION_ENABLED is a placeholder
// for the later money-side phases (variable stake + bandit) — stays OFF until
// the lever + model + counsel sign-off exist.
export const AI_DATA_CAPTURE_ENABLED =
  process.env.EXPO_PUBLIC_AI_DATA_CAPTURE_ENABLED !== "false"; // default true
export const AI_STAKE_CALIBRATION_ENABLED = false;

// Lane B (DeviceActivityReport + LiveActivity) runtime feature flag.
//
// Extensions ALWAYS register at build time now (via @bacons/apple-targets in
// app.config.js). This flag only gates user-facing surfaces: the new
// screentime-priorities onboarding screen + Live Activity start calls in
// the session stores. Lets us soft-roll the feature even when the binary
// already ships with the targets compiled.
export const LANE_B_ENABLED = process.env.EXPO_PUBLIC_LANE_B_ENABLED === "true";
