import React, { useMemo, useEffect, useState } from "react";
import BlobsBackground from "../../src/components/BlobsBackground";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter, type RelativePathString } from "expo-router";
import { Typography, Spacing, Radius, Font } from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  Card,
  Balance,
  Button,
  BlobAvatar,
  Skeleton,
  withErrorBoundary,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { useWalletStore } from "../../src/store/walletStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { useScheduleStore } from "../../src/store/scheduleStore";
import { formatMoney, formatRelativeTime } from "../../src/utils/format";
import {
  getActiveScheduledBlock,
  getBlockProgress,
  formatBlockTimeLeft,
} from "../../src/utils/scheduledBlock";
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
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 220 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 220 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
          animatedStyle,
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
  loading?: boolean;
}

const StatCardBase: React.FC<StatCardProps> = ({
  value,
  label,
  color,
  loading = false,
}) => {
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
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = 0.8;
    scale.value = withSpring(1, { damping: 9, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [value, scale, opacity]);
  const valueAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.statCard}>
      {loading ? (
        <Skeleton
          width={44}
          height={24}
          radius={6}
          style={{ marginVertical: 2 }}
        />
      ) : (
        <Animated.Text
          style={[
            styles.statValue,
            color ? { color } : null,
            valueAnimatedStyle,
          ]}
        >
          {value}
        </Animated.Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

// Memoized: stat cards take only primitive props, so a dashboard re-render that
// doesn't change a card's value/label/color/loading skips re-rendering it.
const StatCard = React.memo(StatCardBase);
StatCard.displayName = "StatCard";

function DashboardScreenInner() {
  const Colors = useColors();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const balance = useWalletStore((state) => state.balance);
  const isWalletHydrated = useWalletStore((state) => state.isHydrated);
  // Granular selectors: the dashboard no longer re-renders on every unrelated
  // group-store mutation, only when one of these three fields changes.
  const activeGroupSession = useGroupSessionStore((s) => s.activeGroupSession);
  const activeGroupSessions = useGroupSessionStore(
    (s) => s.activeGroupSessions,
  );
  const subscribeToSession = useGroupSessionStore((s) => s.subscribeToSession);
  const groupSessionHistory = useGroupSessionStore(
    (s) => s.groupSessionHistory,
  );
  const pendingInvites = useGroupSessionStore((s) => s.pendingInvites);
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
        groupRecoveryRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        groupRecoveryTitle: {
          fontSize: Typography.bodyMedium,
          ...Font.semibold,
          color: Colors.text,
        },
        blockProgressTrack: {
          height: 3,
          backgroundColor: Colors.backgroundTertiary,
          borderRadius: Radius.full,
          overflow: "hidden",
          marginTop: Spacing.sm,
        },
        blockProgressFill: {
          height: "100%",
          backgroundColor: Colors.primary,
          borderRadius: Radius.full,
        },
        blockProgressLabel: {
          fontSize: Typography.labelSmall,
          color: Colors.textSecondary,
          marginTop: Spacing.xs,
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
        headerInviteBtn: {
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          marginRight: Spacing.sm,
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
            {/* Invite lives here as a quiet header action (the old "+10"
                dashboard card read as noise); the +10 explainer stays on the
                invite screen itself. */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/invite" as never);
              }}
              hitSlop={10}
              accessibilityLabel="Invite friends"
              accessibilityRole="button"
              style={styles.headerInviteBtn}
            >
              <Ionicons
                name="person-add"
                size={22}
                color={Colors.textSecondary}
              />
            </Pressable>
            <BlobAvatar
              size={56}
              config={
                user?.blobAvatar ??
                generateBlobAvatarPreset(user?.id || "guest")
              }
              seed={user?.id || "guest"}
              onPress={() => router.push("/(tabs)/profile")}
            />
          </View>

          {/* Balance Card */}
          <Card style={styles.balanceCard} variant="elevated">
            <Text style={styles.balanceLabel}>Total Balance</Text>
            {isWalletHydrated ? (
              <Balance amount={balance} size="display" />
            ) : (
              <Skeleton width={170} height={56} radius={12} />
            )}
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
          {showScheduledBlock &&
            activeScheduledBlock &&
            (() => {
              // Live remaining-time line (build-21 ask: "there's no timer, no
              // tracker"). The 30s `now` tick above keeps it fresh; no pause —
              // blocks are end-only by design.
              const { fraction, minutesLeft } = getBlockProgress(
                activeScheduledBlock,
                now,
              );
              return (
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
                      <View style={styles.blockProgressTrack}>
                        <View
                          style={[
                            styles.blockProgressFill,
                            { width: `${Math.round(fraction * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.blockProgressLabel}>
                        {formatBlockTimeLeft(minutesLeft)}
                      </Text>
                    </View>
                    <Text style={styles.activeSessionArrow}>Manage</Text>
                  </Card>
                </Pressable>
              );
            })()}

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

          {/* Group sessions waiting / recovering — the only surface that can
              re-enter a waiting room (or a live session this client lost
              track of) after a force-quit. Ported from the removed Focus tab. */}
          {activeGroupSessions &&
            activeGroupSessions.length > 0 &&
            activeGroupSessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (session.status === "active") {
                    // Subscribe so active.tsx can render on recovery
                    subscribeToSession(session.id);
                    router.push("/session/active");
                  } else {
                    router.push(
                      `/session/waiting-room?sessionId=${session.id}` as RelativePathString,
                    );
                  }
                }}
                style={{ marginBottom: Spacing.sm }}
              >
                <Card variant="interactive">
                  <View style={styles.groupRecoveryRow}>
                    <Text style={styles.groupRecoveryTitle}>
                      {session.status === "active"
                        ? "Session Active"
                        : `Group Session ${session.status === "ready" ? "Ready" : "Pending"}`}
                    </Text>
                    <Text style={{ color: Colors.primary }}>View →</Text>
                  </View>
                </Card>
              </Pressable>
            ))}

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

          {/* Stats Grid */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard
                value={user?.currentStreak || 0}
                label="Current Streak"
                color={user?.currentStreak ? Colors.primary : undefined}
                loading={!user}
              />
              <StatCard
                value={formatMoney(totalEarnings, false)}
                label="Total Earned"
                color={totalEarnings > 0 ? Colors.gain : undefined}
                loading={!user}
              />
              <StatCard
                value={`${completionRate}%`}
                label="Success Rate"
                loading={!user}
              />
              <StatCard
                value={user?.longestStreak || 0}
                label="Best Streak"
                loading={!user}
              />
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
