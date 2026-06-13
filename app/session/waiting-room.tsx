import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { View, Text, StyleSheet, Share, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  withErrorBoundary,
  StatusBanner,
  HoldToConfirmModal,
} from "../../src/components";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useAuthStore } from "../../src/store/authStore";
import { useWalletStore } from "../../src/store/walletStore";
import { formatMoney, formatTime } from "../../src/utils/format";
import { getFunctionErrorMessage } from "../../src/utils/errors";

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    // Full-bleed green brand field (docs/redesign-all-tabs-progress.md).
    container: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    header: {
      alignItems: "center",
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.white,
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      marginTop: Spacing.xs,
    },
    sessionInfoRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.lg,
      marginTop: Spacing.md,
    },
    sessionInfoItem: {
      alignItems: "center",
    },
    sessionInfoLabel: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      marginBottom: Spacing.xs,
    },
    sessionInfoValue: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
    },
    // Participant seats: glassLight card, glassDark avatar circles.
    participantsCard: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    participantsTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.md,
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    participantAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    participantInitial: {
      fontSize: Typography.titleSmall,
      ...Font.bold,
      color: Colors.white,
    },
    participantDetails: {
      flex: 1,
    },
    participantName: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.white,
    },
    participantBlocks: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
      marginTop: Spacing.xs,
    },
    participantBlocksMissing: {
      fontSize: Typography.labelSmall,
      color: Colors.loss,
      marginTop: Spacing.xs,
    },
    // Ready-state pills: ready = white pill + primaryDark flip; waiting
    // states = glassDark + white hierarchy; "You" = brand surface.
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      alignSelf: "flex-start",
      marginTop: Spacing.xs,
    },
    badgeInvited: {
      backgroundColor: Colors.glassDark,
    },
    badgeAccepted: {
      backgroundColor: Colors.glassDark,
    },
    badgeReady: {
      backgroundColor: Colors.white,
    },
    badgeYou: {
      backgroundColor: Colors.primary,
      borderWidth: 1,
      borderColor: WHITE_25,
    },
    badgeTextInvited: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: WHITE_55,
    },
    badgeTextAccepted: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: WHITE_70,
    },
    badgeTextReady: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.primaryDark,
    },
    badgeTextYou: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.white,
    },
    progressCard: {
      alignItems: "center",
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    progressText: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.white,
    },
    progressBar: {
      width: "100%",
      height: 6,
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.full,
      overflow: "hidden",
      marginTop: Spacing.md,
    },
    progressFill: {
      height: "100%",
      backgroundColor: Colors.white,
      borderRadius: Radius.full,
    },
    // Auto-timeout countdown keeps its semantic warning colors.
    countdownCard: {
      alignItems: "center",
      backgroundColor: Colors.warningLight,
      borderWidth: 1,
      borderColor: Colors.warning,
      borderRadius: Radius.xl,
      marginBottom: Spacing.md,
    },
    countdownLabel: {
      fontSize: Typography.labelMedium,
      color: WHITE_70,
      marginBottom: Spacing.xs,
    },
    countdownValue: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.warning,
    },
    footer: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: WHITE_25,
      backgroundColor: Colors.primaryDark,
    },
    startHint: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      textAlign: "center",
    },
    cancelRow: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    cancelButton: {
      flex: 1,
    },
    shareButton: {
      flex: 1,
    },
    // Shared Buttons restyled via public style/textStyle props only.
    pillButton: {
      borderRadius: Radius.full,
    },
    outlineButton: {
      borderRadius: Radius.full,
      borderColor: WHITE_55,
    },
    outlineButtonText: {
      color: Colors.white,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      marginTop: Spacing.md,
    },
  });

// ─── Component ────────────────────────────────────────────────────────────────

function WaitingRoomScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const userId = useAuthStore((state) => state.user?.id);
  const hydrateWallet = useWalletStore((state) => state.hydrate);

  const {
    activeSession,
    subscribeToSession,
    markOnline,
    startSession,
    cancelSession,
  } = useGroupSessionStore();

  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Prevent calling markOnline more than once per session (set only on success).
  const hasMarkedOnlineRef = useRef(false);
  // Prevents re-entry while a markOnline call is in flight.
  const markOnlineInFlightRef = useRef(false);

  // Subscribe to Firestore session on mount.
  // subscribeToSession manages its own unsubscribe token in the store;
  // calling it again tears down the previous subscription automatically.
  useEffect(() => {
    if (!sessionId) return;
    subscribeToSession(sessionId);
  }, [sessionId, subscribeToSession]);

  // markOnlineForSession CF requires status === "ready" (all participants accepted).
  // Call it when the session first reaches "ready" status, not on mount — the session
  // may still be "pending" (awaiting other accepts) when we first land here.
  // Retries with backoff so a transient CF failure doesn't leave the user
  // permanently "accepted but not online" — previously the ref was flipped
  // before success, so a single failure locked the retry out.
  useEffect(() => {
    if (activeSession?.status !== "ready") return;
    if (!sessionId) return;
    if (hasMarkedOnlineRef.current) return;
    if (markOnlineInFlightRef.current) return;

    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryMark = async () => {
      if (cancelled || hasMarkedOnlineRef.current) return;
      markOnlineInFlightRef.current = true;
      attempts += 1;
      try {
        await markOnline(sessionId);
        if (!cancelled) hasMarkedOnlineRef.current = true;
      } catch {
        if (!cancelled && attempts < 5) {
          timeoutId = setTimeout(tryMark, 1000 * attempts);
        }
      } finally {
        markOnlineInFlightRef.current = false;
      }
    };

    tryMark();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeSession?.status, sessionId, markOnline]);

  // Use .getTime() so the effect compares by value, not by reference.
  // parseGroupSessionDoc creates a new Date object on every snapshot even if
  // the underlying timestamp is unchanged, which would otherwise reset the
  // interval on every Firestore update.
  const autoTimeoutAtMs = activeSession?.autoTimeoutAt?.getTime();

  // Countdown timer for auto-timeout
  useEffect(() => {
    if (autoTimeoutAtMs == null) {
      setCountdownMs(null);
      return;
    }

    const tick = () => {
      const remaining = autoTimeoutAtMs - Date.now();
      setCountdownMs(remaining > 0 ? remaining : 0);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [autoTimeoutAtMs]);

  // React to session status changes
  useEffect(() => {
    if (!activeSession) return;

    if (activeSession.status === "cancelled") {
      if (userId) hydrateWallet(userId);
      StatusBanner.show({
        severity: "warn",
        message: "This session was cancelled.",
        durationMs: 3500,
      });
      router.dismissAll();
    }

    if (activeSession.status === "active") {
      router.replace("/session/active");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.status, router, userId, hydrateWallet]);

  // Derived state
  const participants = activeSession
    ? Object.entries(activeSession.participants)
    : [];
  const totalCount = participants.length;

  // Count name occurrences so duplicates can be disambiguated with a UID suffix
  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [, p] of participants) {
      counts[p.name] = (counts[p.name] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length, activeSession?.id]);

  const acceptedCount = participants.filter(([, p]) => p.accepted).length;

  const onlineCount = participants.filter(([, p]) => p.online).length;

  const allOnline = totalCount > 0 && onlineCount === totalCount;

  // Block-selection gate: every member blocks their OWN apps (tokens can't
  // cross devices), so we require each to have shared a non-empty block summary
  // before the session can start — otherwise a member could "focus" with
  // nothing actually shielded.
  const hasBlockSelection = (p: (typeof participants)[number][1]): boolean =>
    !!p.appBlockSummary &&
    p.appBlockSummary.appCount + p.appBlockSummary.categoryCount > 0;
  const blockReadyCount = participants.filter(([, p]) =>
    hasBlockSelection(p),
  ).length;
  const everyoneHasBlockSelection =
    totalCount > 0 && blockReadyCount === totalCount;

  const isProposer = activeSession?.proposerId === userId;

  const handleStart = useCallback(async () => {
    if (!sessionId) return;
    if (isStarting) return;
    setIsStarting(true);
    try {
      await startSession(sessionId);
      // Leave isStarting=true until the status effect navigates away — prevents
      // a double-tap after a successful CF call but before Firestore snapshot
      // updates the subscription and triggers router.replace.
    } catch (err) {
      setIsStarting(false);
      StatusBanner.show({
        severity: "error",
        message: getFunctionErrorMessage(
          err,
          "Could not start session. Please try again.",
        ),
      });
    }
  }, [sessionId, startSession, isStarting]);

  const handleCancel = useCallback(() => {
    if (!sessionId) return;
    setCancelModalVisible(true);
  }, [sessionId]);

  const handleConfirmCancel = useCallback(async () => {
    if (!sessionId || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelSession(sessionId);
    } catch (err) {
      StatusBanner.show({
        severity: "error",
        message: getFunctionErrorMessage(
          err,
          "Could not cancel session. Please try again.",
        ),
      });
    } finally {
      setIsCancelling(false);
      setCancelModalVisible(false);
    }
  }, [sessionId, cancelSession, isCancelling]);

  const handleShare = useCallback(async () => {
    if (!sessionId) return;
    try {
      await Share.share({
        // Query form (?s=) so the static niyah.live/join page can read it
        // client-side; Universal Link opens the app directly for installed
        // friends and routes everyone else to install.
        message: `Join my Niyah focus session! https://niyah.live/join?s=${sessionId}`,
      });
    } catch {
      // User cancelled share sheet
    }
  }, [sessionId]);

  const getStatusBadge = (
    participantId: string,
    participant: { accepted: boolean; online: boolean },
  ) => {
    if (participantId === userId) {
      return (
        <View style={[styles.badge, styles.badgeYou]}>
          <Text style={styles.badgeTextYou}>You</Text>
        </View>
      );
    }
    if (participant.online) {
      return (
        <View style={[styles.badge, styles.badgeReady]}>
          <Text style={styles.badgeTextReady}>Ready</Text>
        </View>
      );
    }
    if (participant.accepted) {
      return (
        <View style={[styles.badge, styles.badgeAccepted]}>
          <Text style={styles.badgeTextAccepted}>Accepted</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeInvited]}>
        <Text style={styles.badgeTextInvited}>Invited</Text>
      </View>
    );
  };

  // Loading state
  if (!activeSession) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </SafeAreaView>
    );
  }

  const progressPercent = totalCount > 0 ? (onlineCount / totalCount) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Waiting Room</Text>
          <Text style={styles.subtitle}>Waiting for everyone to be ready</Text>
          <View style={styles.sessionInfoRow}>
            <View style={styles.sessionInfoItem}>
              <Text style={styles.sessionInfoLabel}>Stake</Text>
              <Text style={styles.sessionInfoValue}>
                {formatMoney(activeSession.stakePerParticipant)}
              </Text>
            </View>
            <View style={styles.sessionInfoItem}>
              <Text style={styles.sessionInfoLabel}>Duration</Text>
              <Text style={styles.sessionInfoValue}>
                {formatTime(activeSession.duration)}
              </Text>
            </View>
            <View style={styles.sessionInfoItem}>
              <Text style={styles.sessionInfoLabel}>Total staked</Text>
              <Text style={styles.sessionInfoValue}>
                {formatMoney(activeSession.poolTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Participant List */}
        <Card style={styles.participantsCard}>
          <Text style={styles.participantsTitle}>Participants</Text>
          {participants.map(([participantId, participant]) => (
            <View key={participantId} style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantInitial}>
                  {(participant.name ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.participantDetails}>
                <Text style={styles.participantName}>
                  {participant.name}
                  {nameCounts[participant.name] > 1
                    ? ` · ${participantId.slice(0, 4)}`
                    : ""}
                </Text>
                {getStatusBadge(participantId, participant)}
                <Text
                  style={
                    hasBlockSelection(participant)
                      ? styles.participantBlocks
                      : styles.participantBlocksMissing
                  }
                  numberOfLines={1}
                >
                  {hasBlockSelection(participant)
                    ? `Blocking ${participant.appBlockSummary?.label}`
                    : "No apps selected yet"}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Progress Indicator */}
        <Card style={styles.progressCard}>
          <Text style={styles.progressText}>
            {allOnline
              ? "Everyone is ready!"
              : acceptedCount < totalCount
                ? `${acceptedCount} of ${totalCount} accepted`
                : `${onlineCount} of ${totalCount} online`}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </Card>

        {/* Countdown Timer */}
        {activeSession.autoTimeoutAt && countdownMs !== null && (
          <Card style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>Auto-cancels in</Text>
            <Text style={styles.countdownValue}>
              {formatCountdown(countdownMs)}
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        {isProposer && allOnline && (
          <>
            <Button
              title={isStarting ? "Starting..." : "Start Session"}
              onPress={handleStart}
              size="large"
              loading={isStarting}
              disabled={isStarting || !everyoneHasBlockSelection}
              style={styles.pillButton}
            />
            {!everyoneHasBlockSelection && (
              <Text style={styles.startHint}>
                Waiting for everyone to pick apps to block ({blockReadyCount}/
                {totalCount} ready).
              </Text>
            )}
          </>
        )}
        <View style={styles.cancelRow}>
          <View style={styles.shareButton}>
            <Button
              title="Share Invite"
              onPress={handleShare}
              variant="outline"
              size="medium"
              style={styles.outlineButton}
              textStyle={styles.outlineButtonText}
            />
          </View>
          {isProposer && (
            <View style={styles.cancelButton}>
              <Button
                title="Cancel Session"
                onPress={handleCancel}
                variant="danger"
                size="small"
                style={styles.pillButton}
              />
            </View>
          )}
        </View>
      </View>

      <HoldToConfirmModal
        visible={cancelModalVisible}
        title="Cancel this session?"
        body={`Everyone in the waiting room will be refunded and notified. ${
          activeSession.poolTotal
            ? `All ${formatMoney(activeSession.poolTotal)} in stakes will be returned.`
            : ""
        }`}
        holdLabel={isCancelling ? "Cancelling…" : "Hold to cancel session"}
        cancelLabel="Keep Waiting"
        onCancel={() => setCancelModalVisible(false)}
        onConfirm={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}

const WaitingRoomScreen = withErrorBoundary(
  WaitingRoomScreenInner,
  "waiting-room",
);
export default WaitingRoomScreen;
