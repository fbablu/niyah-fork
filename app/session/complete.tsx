import React, { useRef, useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  Card,
  Button,
  Confetti,
  BlobAvatar,
  SessionScreenScaffold,
  withErrorBoundary,
} from "../../src/components";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../src/store/authStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { formatMoney } from "../../src/utils/format";
import { logger } from "../../src/utils/logger";
import { updateSession } from "../../src/config/firebase";
import { AI_DATA_CAPTURE_ENABLED } from "../../src/constants/config";
import type { GroupSessionDoc, SurrenderReason } from "../../src/types";
import {
  generateBlobAvatarPreset,
  type BlobAvatarEyesPreset,
} from "../../src/constants/blobAvatar";
import { scheduleRetentionReminder } from "../../src/config/notifications";

// AI Phase-0 capture (analytics only; no money meaning) — see docs/ai-integration.md.
const REASON_OPTIONS: { value: SurrenderReason; label: string }[] = [
  { value: "distracted", label: "Distracted" },
  { value: "interrupted", label: "Interrupted" },
  { value: "too_long", label: "Too long" },
  { value: "lost_motivation", label: "Lost motivation" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      marginTop: 0,
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: Typography.headlineSmall,
      ...Font.bold,
      color: Colors.text,
    },
    subtitle: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.sm,
    },
    resultsCard: {
      marginBottom: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    participantLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      flex: 1,
    },
    participantName: {
      fontSize: Typography.bodySmall,
      ...Font.medium,
      color: Colors.text,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    badgeCompleted: {
      backgroundColor: Colors.gainLight,
    },
    badgeFailed: {
      backgroundColor: Colors.lossLight,
    },
    statusBadgeText: {
      fontSize: Typography.labelSmall,
      ...Font.semibold,
    },
    badgeTextCompleted: {
      color: Colors.gain,
    },
    badgeTextFailed: {
      color: Colors.loss,
    },
    badgePending: {
      backgroundColor: Colors.backgroundTertiary,
    },
    badgeTextPending: {
      color: Colors.textSecondary,
    },
    payoutValue: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
    },
    payoutGain: {
      color: Colors.gain,
    },
    payoutNeutral: {
      color: Colors.textMuted,
    },
    paymentsSection: {
      marginBottom: Spacing.sm,
    },
    noPaymentsCard: {
      alignItems: "center",
      paddingVertical: Spacing.md,
      backgroundColor: Colors.backgroundCard,
    },
    noPaymentsText: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    noPaymentsSubtext: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    statsGrid: {
      flexDirection: "row",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    statCard: {
      flex: 1,
      alignItems: "center",
    },
    statDivider: {
      width: 1,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.md,
    },
    statValue: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.text,
    },
    statLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: Spacing.xs,
    },
    motivationCard: {
      backgroundColor: Colors.primaryMuted,
      borderWidth: 1,
      borderColor: Colors.primary,
      marginBottom: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    motivationText: {
      fontSize: Typography.bodySmall,
      color: Colors.text,
      textAlign: "center",
      lineHeight: 18,
    },
    forgivenessCard: {
      backgroundColor: Colors.gainLight,
      borderWidth: 1,
      borderColor: Colors.gain,
      marginBottom: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    forgivenessTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.bold,
      color: Colors.gain,
      marginBottom: Spacing.xs,
    },
    forgivenessBody: {
      fontSize: Typography.bodySmall,
      color: Colors.text,
      lineHeight: 18,
    },
    receiptCard: {
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    receiptTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    receiptBody: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    reasonCard: {
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    reasonTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.sm,
    },
    reasonChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.xs,
    },
    reasonChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundTertiary,
    },
    reasonChipText: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      ...Font.medium,
    },
  });

// ─── FirestoreResultsCard ─────────────────────────────────────────────────────

interface FirestoreResultsCardProps {
  session: GroupSessionDoc;
  userId: string | undefined;
  styles: ReturnType<typeof makeStyles>;
}

function FirestoreResultsCard({
  session,
  userId,
  styles,
}: FirestoreResultsCardProps) {
  const participants = Object.entries(session.participants);
  return (
    <Card style={styles.resultsCard}>
      <Text style={styles.sectionTitle}>Results</Text>
      {participants.map(([uid, p]) => {
        const completed = p.completed === true;
        const surrendered = p.surrendered === true;
        const inProgress = !completed && !surrendered;
        const payout = session.payouts?.[uid];
        return (
          <View key={uid} style={styles.participantRow}>
            <View style={styles.participantLeft}>
              <Text style={styles.participantName}>
                {uid === userId ? "You" : p.name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  completed
                    ? styles.badgeCompleted
                    : inProgress
                      ? styles.badgePending
                      : styles.badgeFailed,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    completed
                      ? styles.badgeTextCompleted
                      : inProgress
                        ? styles.badgeTextPending
                        : styles.badgeTextFailed,
                  ]}
                >
                  {completed
                    ? "Completed"
                    : inProgress
                      ? "In Progress"
                      : "Surrendered"}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.payoutValue,
                completed ? styles.payoutGain : styles.payoutNeutral,
              ]}
            >
              {completed
                ? payout != null
                  ? `+${formatMoney(payout)}`
                  : "Pending"
                : inProgress
                  ? "–"
                  : "Forfeited"}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function CompleteScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const user = useAuthStore((state) => state.user);
  const { groupSessionHistory, activeSession: firestoreSession } =
    useGroupSessionStore();
  const soloHistory = useSessionStore((s) => s.sessionHistory);
  const lastForgivenCents = useSessionStore((s) => s.lastForgivenCents);
  const isSolo = params.type === "solo";
  const lastSolo = soloHistory[0];
  const [reasonSaved, setReasonSaved] = useState<SurrenderReason | null>(null);

  // Legacy local history (demo/legacy sessions)
  const lastSession = groupSessionHistory[0];
  const myParticipant = lastSession?.participants.find(
    (p) => p.userId === user?.id,
  );

  // Firestore fallback: used when legacy history is empty (new group session flow)
  const firestoreMyParticipant =
    user?.id && firestoreSession
      ? firestoreSession.participants[user.id]
      : null;
  const didComplete = isSolo
    ? lastSolo?.status === "completed"
    : myParticipant?.completed || firestoreMyParticipant?.completed;

  const isSoloSession =
    isSolo ||
    (lastSession
      ? (lastSession.participants.length ?? 0) <= 1
      : Object.keys(firestoreSession?.participants ?? {}).length <= 1);

  // Only celebrate if the current user actually completed.
  // Initialized to false because the Firestore snapshot confirming completion
  // may arrive after the screen first renders (CF writes → snapshot is async).
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiStartedRef = useRef(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, scaleAnim]);

  // Start confetti once didComplete becomes true (may be after initial render).
  useEffect(() => {
    if (didComplete && !confettiStartedRef.current) {
      confettiStartedRef.current = true;
      setShowConfetti(true);
      // Success feedback fires only on a confirmed completion (never a surrender),
      // and waits for the async Firestore confirmation that flips didComplete.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Extra celebratory pulse when crossing a streak milestone.
      const s = user?.currentStreak ?? 0;
      if (s === 3 || s === 5 || s === 10 || s >= 30) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      // Retention: remind them ~22h out so a live streak doesn't lapse. notifee
      // replaces by id; the per-day guard caps it to one/day. Read-only over the
      // streak — notification-only, no money/session writes.
      if (s >= 1) {
        scheduleRetentionReminder({
          reason: "streak_at_risk",
          fireAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
          title: `Keep your ${s}-day streak alive`,
          body: "A quick focus session today keeps it going.",
        }).catch(() => {});
      }
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [didComplete, user?.currentStreak]);

  // Wallet balance now auto-syncs via onSnapshot listener in walletStore.
  // No manual hydrate needed on session completion.

  // AI Phase-0: capture the solo surrender reason post-hoc (analytics only; no
  // money meaning). All surrender paths funnel to this screen, so it's the
  // universal, zero-money-path-risk capture point. Fire-and-forget to the
  // sessions doc (rule-allowlisted keys).
  const handlePickReason = (reason: SurrenderReason) => {
    Haptics.selectionAsync();
    setReasonSaved(reason);
    if (lastSolo?.id) {
      updateSession(lastSolo.id, { surrenderReason: reason }).catch((err) =>
        logger.warn("Failed to persist surrender reason:", err),
      );
    }
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.dismissAll();
  };

  const getStreakMessage = () => {
    const streak = user?.currentStreak || 0;
    if (streak === 1) return "Great start! Keep the streak alive.";
    if (streak >= 10) return "Incredible! Your focus streak is on fire.";
    if (streak >= 5) return "Amazing streak! You're becoming an Oak.";
    if (streak >= 3) return `${streak}-day streak! Momentum is building.`;
    return `${streak}-day streak! Keep it going!`;
  };

  const currentStreak = user?.currentStreak || 0;
  const blobConfig =
    user?.blobAvatar ?? generateBlobAvatarPreset(user?.id || "guest");
  // Personalize the payoff: the user's own blob reacts to the outcome + streak.
  const celebrationEyes: BlobAvatarEyesPreset = !didComplete
    ? "sleepy"
    : currentStreak >= 30
      ? "surprised"
      : currentStreak >= 7
        ? "wink"
        : "happy";

  return (
    <>
      {showConfetti && <Confetti count={60} />}
      <SessionScreenScaffold
        headerVariant="none"
        scrollable={false}
        stickyFooter={true}
        footer={<Button title="Done" onPress={handleDone} size="medium" />}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <View style={{ marginBottom: Spacing.sm }}>
            <BlobAvatar
              size={84}
              config={{ ...blobConfig, eyesPreset: celebrationEyes }}
              seed={user?.id}
              animated
            />
          </View>
          <Text style={styles.title}>Session Complete</Text>
          <Text style={styles.subtitle}>
            {didComplete
              ? isSoloSession
                ? "You stayed focused — stake returned!"
                : "You stayed focused!"
              : "Session ended"}
          </Text>
        </Animated.View>

        {/* Results: who completed and what they earned */}
        {isSolo && lastSolo ? (
          <>
            <Card style={styles.resultsCard}>
              <Text style={styles.sectionTitle}>Results</Text>
              <View style={styles.participantRow}>
                <View style={styles.participantLeft}>
                  <Text style={styles.participantName}>You</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      didComplete ? styles.badgeCompleted : styles.badgeFailed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        didComplete
                          ? styles.badgeTextCompleted
                          : styles.badgeTextFailed,
                      ]}
                    >
                      {didComplete ? "Completed" : "Surrendered"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.payoutValue,
                    didComplete ? styles.payoutGain : styles.payoutNeutral,
                  ]}
                >
                  {didComplete
                    ? `${formatMoney(lastSolo.actualPayout ?? lastSolo.stakeAmount)} returned`
                    : `${formatMoney(lastSolo.stakeAmount)} forfeited`}
                </Text>
              </View>
            </Card>
            {!didComplete && lastForgivenCents && lastForgivenCents > 0 ? (
              <Card style={styles.forgivenessCard}>
                <Text style={styles.forgivenessTitle}>
                  First surrender forgiven
                </Text>
                <Text style={styles.forgivenessBody}>
                  {`We put ${formatMoney(lastForgivenCents)} back in your wallet so you can try again. Next time the stake is real.`}
                </Text>
              </Card>
            ) : !didComplete ? (
              <Card style={styles.receiptCard}>
                <Text style={styles.receiptTitle}>Where your stake went</Text>
                <Text style={styles.receiptBody}>
                  {`${formatMoney(lastSolo.stakeAmount)} forfeited to Niyah. You staked this money so your future self couldn't weasel out — that's what keeps the commitment real.`}
                </Text>
              </Card>
            ) : null}
            {AI_DATA_CAPTURE_ENABLED && !didComplete && lastSolo.id ? (
              <Card style={styles.reasonCard}>
                <Text style={styles.reasonTitle}>
                  {(reasonSaved ?? lastSolo.surrenderReason)
                    ? "Thanks — that helps us tune your stake."
                    : "What made you stop? (optional)"}
                </Text>
                {!(reasonSaved ?? lastSolo.surrenderReason) && (
                  <View style={styles.reasonChipRow}>
                    {REASON_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => handlePickReason(opt.value)}
                        style={styles.reasonChip}
                      >
                        <Text style={styles.reasonChipText}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Card>
            ) : null}
          </>
        ) : lastSession ? (
          <Card style={styles.resultsCard}>
            <Text style={styles.sectionTitle}>Results</Text>
            {lastSession.participants.map((p) => (
              <View key={p.userId} style={styles.participantRow}>
                <View style={styles.participantLeft}>
                  <Text style={styles.participantName}>
                    {p.userId === user?.id ? "You" : p.name}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      p.completed ? styles.badgeCompleted : styles.badgeFailed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        p.completed
                          ? styles.badgeTextCompleted
                          : styles.badgeTextFailed,
                      ]}
                    >
                      {p.completed ? "Completed" : "Surrendered"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.payoutValue,
                    p.completed ? styles.payoutGain : styles.payoutNeutral,
                  ]}
                >
                  {p.completed
                    ? isSoloSession
                      ? `${formatMoney(p.payout ?? p.stakeAmount)} returned`
                      : `+${formatMoney(p.payout ?? p.stakeAmount)}`
                    : "Forfeited"}
                </Text>
              </View>
            ))}
          </Card>
        ) : firestoreSession ? (
          <FirestoreResultsCard
            session={firestoreSession}
            userId={user?.id}
            styles={styles}
          />
        ) : null}

        {/* Payment status — solo sessions have no settlement step. Stakes are
            de-pooled: returned or forfeited individually via Stripe, never paid
            between participants. */}
        {!isSolo && (
          <View style={styles.paymentsSection}>
            <Text style={styles.sectionTitle}>Payments</Text>

            {firestoreSession?.payouts ? (
              <Card style={styles.noPaymentsCard}>
                <Text style={styles.noPaymentsText}>Settled via Stripe</Text>
                <Text style={styles.noPaymentsSubtext}>
                  {firestoreSession.payouts[user?.id ?? ""]
                    ? `${formatMoney(firestoreSession.payouts[user?.id ?? ""] ?? 0)} credited to your balance.`
                    : "Your stake was forfeited."}
                </Text>
              </Card>
            ) : (
              <Card style={styles.noPaymentsCard}>
                <Text style={styles.noPaymentsText}>No payments needed</Text>
                <Text style={styles.noPaymentsSubtext}>
                  Everyone's stake has been settled automatically.
                </Text>
              </Card>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user?.currentStreak || 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {user?.reputation?.score || 50}
            </Text>
            <Text style={styles.statLabel}>Rep Score</Text>
          </View>
        </View>

        {/* Motivation */}
        <Card style={styles.motivationCard}>
          <Text style={styles.motivationText}>{getStreakMessage()}</Text>
        </Card>
      </SessionScreenScaffold>
    </>
  );
}

const CompleteScreen = withErrorBoundary(CompleteScreenInner, "complete");
export default CompleteScreen;
