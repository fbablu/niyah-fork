import React, { useRef, useMemo, useEffect, useState } from "react";
import BlobsBackground from "../../src/components/BlobsBackground";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter, type RelativePathString } from "expo-router";
import { Typography, Spacing, Radius, Font } from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import * as Haptics from "expo-haptics";
import {
  Card,
  Balance,
  Button,
  BlobAvatar,
  withErrorBoundary,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { useWalletStore } from "../../src/store/walletStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { useScheduleStore } from "../../src/store/scheduleStore";
import { formatMoney, formatRelativeTime } from "../../src/utils/format";
import { getActiveScheduledBlock } from "../../src/utils/scheduledBlock";
import { formatWindow } from "../../src/constants/scheduleTemplates";
import { MIN_STAKE_CENTS } from "../../src/constants/config";
import { generateBlobAvatarPreset } from "../../src/constants/blobAvatar";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  variant = "primary",
}) => {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionButton: {
          backgroundColor: Colors.primary,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.sm + 2,
          borderRadius: Radius.full,
        },
        actionButtonSecondary: {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: Colors.border,
        },
        actionButtonText: {
          color: Colors.background,
          ...Font.semibold,
          fontSize: Typography.bodySmall,
        },
        actionButtonTextSecondary: {
          color: Colors.text,
        },
      }),
    [Colors],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.actionButton,
          variant === "secondary" && styles.actionButtonSecondary,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text
          style={[
            styles.actionButtonText,
            variant === "secondary" && styles.actionButtonTextSecondary,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, color }) => {
  const Colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        statCard: {
          width: "48%",
          flexGrow: 1,
          backgroundColor: Colors.backgroundCard,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          alignItems: "center",
        },
        statValue: {
          fontSize: Typography.headlineSmall,
          ...Font.bold,
          color: Colors.text,
        },
        statLabel: {
          fontSize: Typography.labelSmall,
          color: Colors.textSecondary,
          marginTop: Spacing.xs,
        },
      }),
    [Colors],
  );

  // Pop the value in on mount and re-pop whenever it changes (e.g. the streak
  // ticks up after a completed session) so the stat feels alive, not static.
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    scale.setValue(0.8);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, scale, opacity]);

  return (
    <View style={styles.statCard}>
      <Animated.Text
        style={[
          styles.statValue,
          color ? { color } : null,
          { opacity, transform: [{ scale }] },
        ]}
      >
        {value}
      </Animated.Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

function DashboardScreenInner() {
  const Colors = useColors();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const balance = useWalletStore((state) => state.balance);
  const { activeGroupSession, groupSessionHistory, pendingInvites } =
    useGroupSessionStore();
  const activeSoloSession = useSessionStore((s) => s.currentSession);
  const scheduledTemplates = useScheduleStore((s) => s.templates);

  // Tick a clock so the "scheduled block running" indicator turns on/off as the
  // window opens/closes without the user reopening the app. 30s is snappy enough
  // for a block boundary and cheap.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const activeScheduledBlock = useMemo(
    () => getActiveScheduledBlock(scheduledTemplates, now),
    [scheduledTemplates, now],
  );
  // A real (running) session always takes visual precedence over a scheduled
  // block; the block indicator + CTA-gating only apply when neither is running.
  const hasRunningSession = !!activeGroupSession || !!activeSoloSession;
  const showScheduledBlock = !hasRunningSession && !!activeScheduledBlock;

  const completionRate =
    user && user.totalSessions > 0
      ? Math.round((user.completedSessions / user.totalSessions) * 100)
      : 0;

  const totalEarnings = user?.totalEarnings || 0;

  // First-run onboarding callout: visible until the user has completed at
  // least one session. Steps tick as the user progresses through deposit →
  // session → completion, so cold installs have a clear path from zero.
  // "Deposited" for onboarding means "has enough to actually stake" — a $1
  // deposit can't fund the $2 minimum stake, so don't tick the step on balance
  // alone. Keeps the checklist honest with the min-stake floor.
  const hasDeposited = balance >= MIN_STAKE_CENTS;
  const hasStartedSession =
    !!activeSoloSession ||
    !!activeGroupSession ||
    (user?.totalSessions ?? 0) > 0;
  const hasCompletedSession = (user?.completedSessions ?? 0) > 0;
  // Hide the getting-started checklist while a scheduled block is enforcing —
  // the user is mid-focus; the Start CTAs are gated below for the same reason.
  const showGettingStarted = !hasCompletedSession && !showScheduledBlock;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: Colors.background,
        },
        safeArea: {
          flex: 1,
        },
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.xxl,
        },

        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: Spacing.lg,
        },
        greeting: {
          fontSize: Typography.bodyMedium,
          color: Colors.textSecondary,
        },
        name: {
          fontSize: Typography.headlineMedium,
          ...Font.bold,
          color: Colors.text,
          marginTop: 2,
        },
        balanceCard: {
          alignItems: "center",
          paddingVertical: Spacing.xl,
          marginBottom: Spacing.md,
        },
        balanceLabel: {
          fontSize: Typography.labelMedium,
          color: Colors.textSecondary,
          marginBottom: Spacing.sm,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        balanceChange: {
          marginTop: Spacing.sm,
        },
        changeText: {
          fontSize: Typography.bodySmall,
          ...Font.medium,
        },
        changePositive: {
          color: Colors.gain,
        },
        changeNegative: {
          color: Colors.loss,
        },
        balanceActions: {
          flexDirection: "row",
          gap: Spacing.sm,
          marginTop: Spacing.lg,
        },
        activeSessionCard: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: Colors.primaryMuted,
          borderColor: Colors.primary,
          borderWidth: 1,
          marginBottom: Spacing.md,
          overflow: "hidden",
        },
        activeSessionIndicator: {
          width: 4,
          height: "100%",
          backgroundColor: Colors.primary,
          position: "absolute",
          left: 0,
        },
        activeSessionContent: {
          flex: 1,
          paddingLeft: Spacing.sm,
        },
        activeSessionLabel: {
          fontSize: Typography.labelSmall,
          color: Colors.primary,
          ...Font.bold,
          letterSpacing: 1,
        },
        activeSessionText: {
          fontSize: Typography.bodyLarge,
          ...Font.semibold,
          color: Colors.text,
          marginTop: 2,
        },
        activeSessionPayout: {
          fontSize: Typography.bodySmall,
          color: Colors.textSecondary,
          marginTop: 2,
        },
        activeSessionArrow: {
          fontSize: Typography.bodySmall,
          ...Font.semibold,
          color: Colors.primary,
        },
        ctaCard: {
          alignItems: "center",
          paddingVertical: Spacing.xl,
          marginBottom: Spacing.md,
        },
        ctaTitle: {
          fontSize: Typography.titleLarge,
          ...Font.bold,
          color: Colors.text,
        },
        ctaSubtitle: {
          fontSize: Typography.bodyMedium,
          color: Colors.textSecondary,
          marginTop: Spacing.xs,
          marginBottom: Spacing.lg,
          textAlign: "center",
        },
        onboardingCard: {
          marginBottom: Spacing.md,
          padding: Spacing.lg,
        },
        onboardingHeader: {
          marginBottom: Spacing.md,
        },
        onboardingTitle: {
          fontSize: Typography.titleLarge,
          ...Font.bold,
          color: Colors.text,
          marginBottom: Spacing.xs,
        },
        onboardingSubtitle: {
          fontSize: Typography.bodySmall,
          color: Colors.textSecondary,
        },
        onboardingStep: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.sm,
          gap: Spacing.md,
        },
        onboardingStepInner: {
          flex: 1,
        },
        onboardingStepLabel: {
          fontSize: Typography.bodyMedium,
          ...Font.semibold,
          color: Colors.text,
        },
        onboardingStepLabelDone: {
          color: Colors.textMuted,
          textDecorationLine: "line-through",
        },
        onboardingStepHint: {
          fontSize: Typography.labelSmall,
          color: Colors.textSecondary,
          marginTop: 2,
        },
        onboardingStepNumber: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: Colors.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        onboardingStepNumberDone: {
          backgroundColor: Colors.gainLight,
        },
        onboardingStepNumberText: {
          fontSize: Typography.labelMedium,
          ...Font.bold,
          color: Colors.primary,
        },
        onboardingStepNumberTextDone: {
          color: Colors.gain,
        },
        onboardingStepChevron: {
          fontSize: Typography.bodyLarge,
          color: Colors.primary,
          ...Font.bold,
        },
        plantSection: {
          marginBottom: Spacing.lg,
        },
        plantCard: {
          padding: Spacing.md,
        },
        inviteCard: {
          backgroundColor: Colors.primaryMuted,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Colors.primaryLight,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
        },
        inviteCardContent: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        inviteCardTitle: {
          fontSize: Typography.titleSmall,
          ...Font.semibold,
          color: Colors.text,
        },
        inviteCardSubtitle: {
          fontSize: Typography.labelSmall,
          color: Colors.textSecondary,
          marginTop: 2,
        },
        inviteBadge: {
          backgroundColor: Colors.primary,
          borderRadius: Radius.full,
          paddingVertical: 4,
          paddingHorizontal: Spacing.md,
        },
        inviteBadgeText: {
          fontSize: Typography.labelLarge,
          ...Font.bold,
          color: Colors.white,
        },
        statsSection: {
          marginBottom: Spacing.lg,
        },
        sectionTitle: {
          fontSize: Typography.titleSmall,
          ...Font.semibold,
          color: Colors.text,
          marginBottom: Spacing.md,
        },
        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Spacing.sm,
        },
        recentSection: {
          marginBottom: Spacing.lg,
        },
        activityCard: {
          marginBottom: Spacing.sm,
          padding: Spacing.md,
        },
        activityRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        activityInfo: {
          flex: 1,
        },
        activityTitle: {
          fontSize: Typography.bodyMedium,
          ...Font.semibold,
          color: Colors.text,
        },
        activityDate: {
          fontSize: Typography.labelSmall,
          color: Colors.textTertiary,
          marginTop: 2,
        },
        activityResult: {
          alignItems: "flex-end",
        },
        activityEarned: {
          fontSize: Typography.bodyMedium,
          ...Font.bold,
          color: Colors.gain,
        },
        activityLost: {
          fontSize: Typography.bodyMedium,
          ...Font.bold,
          color: Colors.loss,
        },
        statusBadge: {
          backgroundColor: Colors.gainLight,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 2,
          borderRadius: Radius.xs,
          marginTop: 4,
        },
        statusBadgeFailed: {
          backgroundColor: Colors.lossLight,
        },
        statusSuccess: {
          fontSize: Typography.labelSmall,
          color: Colors.gain,
          ...Font.medium,
        },
        statusFailed: {
          fontSize: Typography.labelSmall,
          color: Colors.loss,
          ...Font.medium,
        },
      }),
    [Colors],
  );

  return (
    <View style={styles.container}>
      {/* Full-screen blob background sits OUTSIDE SafeAreaView so it fills all
          the way to the screen edges. The green blob (bottom: -30) ends up
          directly behind the tab bar, giving the UITabBar liquid-glass blur
          something colorful to refract. */}
      <BlobsBackground />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.name}>{user?.name || "there"}</Text>
            </View>
            <BlobAvatar
              size={56}
              config={
                user?.blobAvatar ??
                generateBlobAvatarPreset(user?.id || "guest")
              }
              onPress={() => router.push("/(tabs)/profile")}
            />
          </View>

          {/* Balance Card */}
          <Card style={styles.balanceCard} variant="elevated">
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Balance amount={balance} size="display" />
            <View style={styles.balanceChange}>
              <Text
                style={[
                  styles.changeText,
                  totalEarnings >= 0
                    ? styles.changePositive
                    : styles.changeNegative,
                ]}
              >
                {totalEarnings >= 0 ? "+" : ""}
                {formatMoney(totalEarnings)} all time
              </Text>
            </View>
            <View style={styles.balanceActions}>
              <ActionButton
                label="Add Funds"
                onPress={() => router.push("/session/deposit")}
              />
              <ActionButton
                label="Withdraw"
                onPress={() => router.push("/session/withdraw")}
                variant="secondary"
              />
            </View>
          </Card>

          {/* Getting Started (first-run onboarding) */}
          {showGettingStarted && (
            <Card style={styles.onboardingCard}>
              <View style={styles.onboardingHeader}>
                <Text style={styles.onboardingTitle}>Get started</Text>
                <Text style={styles.onboardingSubtitle}>
                  Deposit, stake, complete — keep your money.
                </Text>
              </View>

              <Pressable
                style={styles.onboardingStep}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!hasDeposited) router.push("/session/deposit");
                }}
              >
                <View
                  style={[
                    styles.onboardingStepNumber,
                    hasDeposited && styles.onboardingStepNumberDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.onboardingStepNumberText,
                      hasDeposited && styles.onboardingStepNumberTextDone,
                    ]}
                  >
                    {hasDeposited ? "✓" : "1"}
                  </Text>
                </View>
                <View style={styles.onboardingStepInner}>
                  <Text
                    style={[
                      styles.onboardingStepLabel,
                      hasDeposited && styles.onboardingStepLabelDone,
                    ]}
                  >
                    Add at least {formatMoney(MIN_STAKE_CENTS, false)} to your
                    wallet
                  </Text>
                  <Text style={styles.onboardingStepHint}>
                    Staked money you get back when you complete.
                  </Text>
                </View>
                {!hasDeposited && (
                  <Text style={styles.onboardingStepChevron}>→</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.onboardingStep}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!hasDeposited) {
                    router.push("/session/deposit");
                  } else if (!hasStartedSession) {
                    router.push(
                      "/session/select?type=solo" as RelativePathString,
                    );
                  }
                }}
              >
                <View
                  style={[
                    styles.onboardingStepNumber,
                    hasStartedSession && styles.onboardingStepNumberDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.onboardingStepNumberText,
                      hasStartedSession && styles.onboardingStepNumberTextDone,
                    ]}
                  >
                    {hasStartedSession ? "✓" : "2"}
                  </Text>
                </View>
                <View style={styles.onboardingStepInner}>
                  <Text
                    style={[
                      styles.onboardingStepLabel,
                      hasStartedSession && styles.onboardingStepLabelDone,
                    ]}
                  >
                    Start a solo focus session
                  </Text>
                  <Text style={styles.onboardingStepHint}>
                    Stake $2 – $25. Apps get blocked. Timer runs.
                  </Text>
                </View>
                {hasDeposited && !hasStartedSession && (
                  <Text style={styles.onboardingStepChevron}>→</Text>
                )}
              </Pressable>

              <Pressable style={styles.onboardingStep}>
                <View style={styles.onboardingStepNumber}>
                  <Text style={styles.onboardingStepNumberText}>3</Text>
                </View>
                <View style={styles.onboardingStepInner}>
                  <Text style={styles.onboardingStepLabel}>
                    Complete it — keep your stake
                  </Text>
                  <Text style={styles.onboardingStepHint}>
                    Surrender early and the stake is forfeit.
                  </Text>
                </View>
              </Pressable>
            </Card>
          )}

          {/* Active Session Banner */}
          {activeGroupSession && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/session/active");
              }}
            >
              <Card style={styles.activeSessionCard}>
                <View style={styles.activeSessionIndicator} />
                <View style={styles.activeSessionContent}>
                  <Text style={styles.activeSessionLabel}>
                    {activeGroupSession.participants.length <= 1
                      ? "SESSION IN PROGRESS"
                      : "DUO SESSION IN PROGRESS"}
                  </Text>
                  <Text style={styles.activeSessionText}>
                    {activeGroupSession.cadence.charAt(0).toUpperCase() +
                      activeGroupSession.cadence.slice(1)}{" "}
                    {activeGroupSession.participants.length <= 1
                      ? "Focus Session"
                      : `Focus with ${activeGroupSession.participants.find((p) => p.userId !== user?.id)?.name ?? "Partner"}`}
                  </Text>
                  <Text style={styles.activeSessionPayout}>
                    Stake: {formatMoney(activeGroupSession.stakePerParticipant)}
                  </Text>
                </View>
                <Text style={styles.activeSessionArrow}>View</Text>
              </Card>
            </Pressable>
          )}

          {/* Active Solo Session Banner */}
          {!activeGroupSession && activeSoloSession && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(
                  "/session/active?mode=solo_staked" as RelativePathString,
                );
              }}
            >
              <Card style={styles.activeSessionCard}>
                <View style={styles.activeSessionIndicator} />
                <View style={styles.activeSessionContent}>
                  <Text style={styles.activeSessionLabel}>
                    SOLO SESSION IN PROGRESS
                  </Text>
                  <Text style={styles.activeSessionText}>
                    {activeSoloSession.cadence.charAt(0).toUpperCase() +
                      activeSoloSession.cadence.slice(1)}{" "}
                    Focus Session
                  </Text>
                  <Text style={styles.activeSessionPayout}>
                    Stake: {formatMoney(activeSoloSession.stakeAmount)}
                  </Text>
                </View>
                <Text style={styles.activeSessionArrow}>View</Text>
              </Card>
            </Pressable>
          )}

          {/* Scheduled focus block running — Opal-style indicator. A
              DeviceActivitySchedule isn't a currentSession, so without this the
              dashboard would still show Start CTAs during an enforced block.
              Tapping opens the Schedule tab to manage it. */}
          {showScheduledBlock && activeScheduledBlock && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/schedule");
              }}
            >
              <Card style={styles.activeSessionCard}>
                <View style={styles.activeSessionIndicator} />
                <View style={styles.activeSessionContent}>
                  <Text style={styles.activeSessionLabel}>
                    FOCUS BLOCK RUNNING
                  </Text>
                  <Text style={styles.activeSessionText}>
                    {activeScheduledBlock.name}
                  </Text>
                  <Text style={styles.activeSessionPayout}>
                    {formatWindow(activeScheduledBlock)}
                  </Text>
                </View>
                <Text style={styles.activeSessionArrow}>Manage</Text>
              </Card>
            </Pressable>
          )}

          {/* Quick Start CTA — hidden while a session OR a scheduled block is
              running (you're already focusing; don't offer to start another). */}
          {!activeGroupSession && !activeSoloSession && !showScheduledBlock && (
            <Card style={styles.ctaCard}>
              <Text style={styles.ctaTitle}>Ready to focus?</Text>
              <Text style={styles.ctaSubtitle}>
                Block distracting apps and stay productive
              </Text>
              <View style={{ gap: Spacing.sm, width: "100%" }}>
                <Button
                  title="Start a Focus Session (Free)"
                  onPress={() => router.push("/session/quick-block")}
                  size="large"
                />
                <Button
                  title="Stake a Solo Session"
                  onPress={() =>
                    router.push(
                      "/session/select?type=solo" as RelativePathString,
                    )
                  }
                  size="large"
                  variant="outline"
                />
                <Button
                  title="Stake a Group Session"
                  onPress={() => router.push("/session/propose")}
                  size="large"
                  variant="outline"
                />
              </View>
            </Card>
          )}

          {/* Pending Group Invites Banner */}
          {pendingInvites && pendingInvites.length > 0 && (
            <Pressable
              onPress={() =>
                router.push("/session/invites" as RelativePathString)
              }
              style={{ marginBottom: Spacing.md }}
            >
              <Card variant="elevated">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: Colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.background,
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {pendingInvites.length}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: Colors.text,
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Group Session{" "}
                      {pendingInvites.length === 1 ? "Invite" : "Invites"}
                    </Text>
                    <Text
                      style={{
                        color: Colors.textSecondary,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      Tap to view and respond
                    </Text>
                  </View>
                  <Text style={{ color: Colors.textTertiary, fontSize: 20 }}>
                    ›
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}

          {/* Invite Friends Card */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/invite" as never);
            }}
            style={styles.inviteCard}
          >
            <View style={styles.inviteCardContent}>
              <View>
                <Text style={styles.inviteCardTitle}>Invite Friends</Text>
                <Text style={styles.inviteCardSubtitle}>
                  Earn +10 social credit per referral
                </Text>
              </View>
              <View style={styles.inviteBadge}>
                <Text style={styles.inviteBadgeText}>+10</Text>
              </View>
            </View>
          </Pressable>

          {/* Stats Grid */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard
                value={user?.currentStreak || 0}
                label="Current Streak"
                color={user?.currentStreak ? Colors.primary : undefined}
              />
              <StatCard
                value={formatMoney(totalEarnings, false)}
                label="Total Earned"
                color={totalEarnings > 0 ? Colors.gain : undefined}
              />
              <StatCard value={`${completionRate}%`} label="Success Rate" />
              <StatCard value={user?.longestStreak || 0} label="Best Streak" />
            </View>
          </View>

          {/* Recent Activity */}
          {groupSessionHistory.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
              {groupSessionHistory.slice(0, 3).map((session) => {
                const me = session.participants.find(
                  (p) => p.userId === user?.id,
                );
                const sessionPartner = session.participants.find(
                  (p) => p.userId !== user?.id,
                );
                const didComplete = me?.completed ?? false;
                const isSolo = session.participants.length <= 1;
                return (
                  <Card key={session.id} style={styles.activityCard}>
                    <View style={styles.activityRow}>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityTitle}>
                          {session.cadence.charAt(0).toUpperCase() +
                            session.cadence.slice(1)}{" "}
                          {isSolo
                            ? "Solo Session"
                            : `with ${sessionPartner?.name ?? "Partner"}`}
                        </Text>
                        <Text style={styles.activityDate}>
                          {session.completedAt
                            ? formatRelativeTime(session.completedAt)
                            : "In progress"}
                        </Text>
                      </View>
                      <View style={styles.activityResult}>
                        {didComplete ? (
                          <>
                            <Text style={styles.activityEarned}>
                              {isSolo
                                ? `${formatMoney(me?.stakeAmount ?? session.stakePerParticipant)} returned`
                                : "Stake kept"}
                            </Text>
                            <View style={styles.statusBadge}>
                              <Text style={styles.statusSuccess}>
                                Completed
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.activityLost}>
                              -{formatMoney(session.stakePerParticipant)}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                styles.statusBadgeFailed,
                              ]}
                            >
                              <Text style={styles.statusFailed}>
                                Surrendered
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const DashboardScreen = withErrorBoundary(DashboardScreenInner, "dashboard");
export default DashboardScreen;
