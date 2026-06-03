export type CadenceType =
  | "test"
  | "focus"
  | "hour"
  | "daily"
  | "weekly"
  | "monthly";

export interface PublicProfile {
  uid: string;
  name: string;
  reputation: { score: number; level: string; referralCount: number };
  currentStreak: number;
  totalSessions: number;
  completedSessions: number;
}

export type SessionStatus = "active" | "completed" | "surrendered";

// Reputation levels based on payment reliability
export type ReputationLevel = "seed" | "sprout" | "sapling" | "tree" | "oak";

export interface User {
  id: string; // Firebase UID
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  balance: number; // in cents
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  completedSessions: number;
  totalEarnings: number; // in cents
  createdAt: Date;
  // Reputation/Social Credit
  reputation: UserReputation;
  profileImage?: string;
  blobAvatar?: {
    colorPreset: "sunset" | "ocean" | "forest" | "berry" | "lemon" | "coral";
    shapePreset: "peach" | "wave" | "petal";
    eyesPreset: "classic" | "happy" | "wink" | "sleepy" | "surprised";
  };
  phoneNumber?: string;
  authProvider?: "email" | "google" | "apple" | "phone";
  // Firebase-backed profile
  profileComplete?: boolean;
  // Stripe
  stripeAccountId?: string;
  stripeCustomerId?: string;
  stripeAccountStatus?: "pending" | "active" | "restricted";
  // Native KYC intake (collected in-app before Stripe hosted form).
  // DOB / address not mirrored to Firestore — Stripe is source of truth.
  legalFirstName?: string;
  legalLastName?: string;
  stripeKycProvidedAt?: Date;
  // Plaid bank connection
  linkedBank?: {
    institutionName: string;
    bankName: string;
    mask: string;
  };
  // Legal acceptance
  legalAcceptanceVersion?: string;
  legalAcceptedAt?: Date;
  // Self-attested 18+ at legal acceptance. No DOB stored — Stripe KYC verifies
  // actual age at money-out. Server-written via acceptLegalTerms; rules keep it
  // client-immutable, same as legalAccepted* above.
  ageAttested18?: boolean;
  // First-surrender forgiveness ($5 refund on first-ever surrender)
  firstSurrenderForgiven?: boolean;
  firstSurrenderForgivenAt?: Date;
  // Campus-launch finals promo (one-time $5 credit on gate unlock)
  finalsPromoAwarded?: boolean;
  finalsPromoAwardedAt?: Date;
  // Onboarding intake (quality/UX data collected once during signup)
  intake?: {
    focusGoalHoursPerDay?: number; // 1, 2, 3, 4, 6+
    distractionReasons?: string[]; // multi-select
    triedApps?: string[]; // multi-select (opal, brick, present, screentime, delete, none)
    completedAt?: Date;
  };
}

// Social credit system - tracks payment reliability
export interface UserReputation {
  score: number; // 0-100, starts at 50
  level: ReputationLevel;
  paymentsCompleted: number; // Times user paid when they lost
  paymentsMissed: number; // Times user didn't pay (flaky)
  totalOwedPaid: number; // Total amount user has paid when losing (cents)
  totalOwedMissed: number; // Total amount user failed to pay (cents)
  lastUpdated: Date;
  referralCount?: number; // Successful referrals; each adds a persistent score boost
}

// Partner relationship
export interface Partner {
  id: string;
  oderId: string; // The other user's ID
  name: string;
  email: string;
  profileImage?: string;
  reputation: UserReputation;
  connectedAt: Date;
  totalSessionsTogether: number;
  // For the money plant visualization
  isActive: boolean; // Currently in a session together
  tag?: string; // Optional label e.g. "Your Referrer"
}

/**
 * Structured reason a user gives when surrendering (AI Phase-0 data capture —
 * see docs/ai-integration.md). Pure analytics; carries NO money meaning.
 */
export type SurrenderReason =
  | "distracted"
  | "interrupted"
  | "too_long"
  | "lost_motivation"
  | "emergency"
  | "other";

// Solo session (Phase 2 — stickK model for now; will use SOLO_COMPLETION_MULTIPLIER later)
export interface Session {
  id: string;
  cadence: CadenceType;
  stakeAmount: number; // in cents
  potentialPayout: number; // in cents — currently equals stake (stickK); Phase 2: stake × multiplier
  startedAt: Date;
  endsAt: Date;
  status: SessionStatus;
  completedAt?: Date;
  actualPayout?: number; // in cents
  // ── AI Phase-0 capture (analytics only; no money meaning) ──
  startedAtLocalHour?: number; // 0–23, user-local hour at start
  dayOfWeek?: number; // 0 (Sun) – 6 (Sat), user-local at start
  surrenderReason?: SurrenderReason;
  surrenderNote?: string; // optional free text (capped)
}

export interface Transaction {
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "stake"
    | "payout"
    | "forfeit"
    | "forgiveness"
    | "refund"
    | "bonus"
    | "credit";
  amount: number; // in cents (positive for credit, negative for debit)
  description: string;
  sessionId?: string;
  createdAt: Date;
}

/**
 * Wallet ledger (Firestore `wallets/{uid}`). Server-owned: clients may only
 * create a zero-balance wallet; all mutations go through Cloud Functions.
 *
 * INVARIANT: balance === depositedBalance + earnedBalance + bonusBalance +
 * creditBalance, and balance === signed sum of the user's `transactions`.
 * The nightly reconcile job freezes any wallet that violates this.
 *
 * Buckets partition the balance by source so withdrawal/deletion treat funds
 * differently:
 *   depositedBalance  card money — always withdrawable; refunds to source card
 *   earnedBalance     completion surplus / winnings — withdrawable after the engagement gate
 *   bonusBalance      promo + forgiveness giveaways — withdrawable after the gate; stakeable
 *   creditBalance     dev/manual/test credit — NEVER withdrawable, never refundable, always forfeited
 *
 * withdrawableBalance is DERIVED, never stored:
 *   depositedBalance + (gateMet ? earnedBalance + bonusBalance : 0)
 */
export interface Wallet {
  balance: number; // cents — canonical total (= sum of the four buckets)
  pendingBalance: number; // cents — in-flight (e.g. processing withdrawals)
  depositedBalance: number; // cents
  earnedBalance: number; // cents
  bonusBalance: number; // cents
  creditBalance: number; // cents
  frozen?: boolean;
  frozenReason?: string;
  lastUpdated?: Date;
}

// ─── Group Session (N-person staked session) ────────────────────────────────

export interface SessionParticipant {
  userId: string;
  name: string;
  profileImage?: string;
  reputation: UserReputation;
  stakeAmount: number; // in cents — set from cadence config when session starts
  // Populated on completion
  completed?: boolean;
  screenTime?: number; // ms of usage during session (input to payout algorithm)
  payout?: number; // in cents — own stake back on completion (de-pooled, no redistribution)
}

export interface GroupSession {
  id: string;
  cadence: CadenceType;
  stakePerParticipant: number; // in cents
  poolTotal: number; // stakePerParticipant × participants.length
  startedAt: Date;
  endsAt: Date;
  status: SessionStatus; // from current user's perspective
  completedAt?: Date;
  participants: SessionParticipant[];
}

// ─── Group Session (Firestore-backed, server-authoritative) ─────────────────

export type GroupSessionStatus =
  | "pending" // invites sent, waiting for accepts
  | "ready" // all accepted, waiting for everyone to go online
  | "active" // timer running
  | "completed" // all participants reported, payouts distributed
  | "cancelled"; // proposer cancelled or auto-timeout

/**
 * Human-readable summary of a member's app-block selection, for the waiting-room
 * "what everyone's blocking" display + the start-gate. Derived from the native
 * AppSelectionToken — NO opaque FamilyControls tokens (they're device-local and
 * cannot be merged or enforced across members; see the group-blocking plan doc).
 */
export interface AppBlockSummary {
  appCount: number;
  categoryCount: number;
  /** e.g. "5 apps, 2 categories" — straight from the native selection label. */
  label: string;
}

export interface GroupSessionParticipant {
  name: string;
  profileImage?: string;
  reputation: UserReputation;
  accepted: boolean;
  online: boolean;
  completed?: boolean;
  surrendered?: boolean;
  surrenderedAt?: Date;
  violationCount?: number;
  /**
   * This member's own block selection summary. Each member blocks their OWN apps
   * on their OWN device; we share only this summary so the group can see that
   * everyone has something blocked (and gate the start until they do).
   */
  appBlockSummary?: AppBlockSummary;
  /** De-pool: every member stakes their own money. 'solo' is the only mode. */
  stakeMode?: "solo";
}

// The Firestore document shape for group sessions
export interface GroupSessionDoc {
  id: string;
  proposerId: string;
  status: GroupSessionStatus;
  cadence: CadenceType;
  stakePerParticipant: number; // cents
  customStake: boolean;
  duration: number; // ms
  participantIds: string[]; // for security rules / queries
  participants: Record<string, GroupSessionParticipant>;
  poolTotal: number;
  startedAt?: Date;
  endsAt?: Date;
  completedAt?: Date;
  payouts?: Record<string, number>; // userId -> payout in cents
  createdAt: Date;
  updatedAt: Date;
  autoTimeoutAt?: Date; // 30 min after all accept; null while pending
}

/**
 * One row of the computed group leaderboard (see getGroupLeaderboard CF).
 * De-pool: ranked by completion rate, NEVER earnings.
 */
export interface GroupLeaderboardEntry {
  userId: string;
  name: string;
  completed: number;
  surrendered: number;
  violations: number;
  sessions: number;
  completionRate: number; // 0..1
  isMe: boolean;
}

export type GroupInviteStatus = "pending" | "accepted" | "declined" | "expired";

export interface GroupInvite {
  id: string;
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserImage?: string;
  toUserId: string;
  stake: number; // cents
  cadence: CadenceType;
  duration: number; // ms
  status: GroupInviteStatus;
  createdAt: Date;
  respondedAt?: Date;
}

/** 0 = Sunday … 6 = Saturday (matches JS Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * A recurring, Opal-style scheduled focus block. OS-enforced auto-start via
 * DeviceActivitySchedule (see scheduleStore).
 *
 * Phase-1 caveats (tracked in docs/schedule-templates-plan-2026-06-03.md):
 * - `days` is stored, but the native wrapper currently applies a DAILY window;
 *   weekday-specific enforcement needs a native extension (rebuild).
 * - `stakeCents > 0` (per-template auto-stake) is INERT in Phase 1 — auto-debiting
 *   money on a schedule needs a server CF + /vibe-security + deploy (Phase 2).
 */
export interface ScheduledTemplate {
  id: string;
  name: string;
  days: Weekday[]; // weekdays the block runs
  startHour: number; // 0–23 (local)
  startMinute: number; // 0–59
  endHour: number; // 0–23 (local)
  endMinute: number; // 0–59
  stakeCents: number; // 0 = free block. >0 = auto-stake (Phase 2, inert now).
  enabled: boolean;
  createdAt: number; // epoch ms (number keeps AsyncStorage persistence simple)
}
