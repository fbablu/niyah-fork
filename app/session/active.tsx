import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Typography, Spacing, Radius, Font } from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  Card,
  Button,
  Timer,
  SessionScreenScaffold,
  withErrorBoundary,
  HoldToConfirmModal,
  StatusBanner,
} from "../../src/components";
import * as Haptics from "expo-haptics";
import Animated, {
  LinearTransition,
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { useAuthStore } from "../../src/store/authStore";
import { useCountdown } from "../../src/hooks/useCountdown";
import { formatMoney } from "../../src/utils/format";
import { SOLO_COMPLETION_MULTIPLIER } from "../../src/constants/config";
import { optimisticGroupPayouts } from "../../src/utils/payoutAlgorithm";
import {
  startBlocking,
  stopBlocking,
  onShieldViolation,
  onSurrenderRequested,
  checkPendingSurrender,
  isScreenTimeAvailable,
  getAppSelectionStatus,
  setSessionContext,
  getViolationsByCategory,
} from "../../src/config/screentime";
import { reportShieldViolation as reportShieldViolationCF } from "../../src/config/functions";
import { logger } from "../../src/utils/logger";

type SessionMode = "solo_quick" | "solo_scheduled" | "solo_staked" | "group";

function ActiveSessionScreenInner() {
  const Colors = useColors();
  const params = useLocalSearchParams<{
    mode?: SessionMode;
    confirmSurrender?: string;
  }>();
  const mode: SessionMode = params.mode ?? "group";
  const isSoloStaked = mode === "solo_staked";
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          alignItems: "center",
          marginTop: Spacing.sm,
          marginBottom: Spacing.md,
        },
        statusBadge: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: Colors.gainLight,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.full,
          marginBottom: Spacing.md,
        },
        statusDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: Colors.gain,
          marginRight: Spacing.sm,
        },
        statusText: {
          fontSize: Typography.labelSmall,
          ...Font.bold,
          color: Colors.gain,
          letterSpacing: 1,
        },
        title: {
          fontSize: Typography.headlineMedium,
          ...Font.bold,
          color: Colors.text,
        },
        subtitle: {
          fontSize: Typography.bodySmall,
          color: Colors.textSecondary,
          marginTop: Spacing.xs,
        },
        timerSection: {
          alignItems: "center",
          marginBottom: Spacing.md,
        },
        payoutCard: {
          alignItems: "center",
          backgroundColor: Colors.gainLight,
          borderWidth: 1,
          borderColor: Colors.gain,
          paddingVertical: Spacing.md,
          marginBottom: Spacing.md,
        },
        payoutLabel: {
          fontSize: Typography.labelMedium,
          color: Colors.textSecondary,
          marginBottom: Spacing.xs,
        },
        payoutAmount: {
          fontSize: Typography.titleLarge,
          ...Font.bold,
          color: Colors.gain,
        },
        violationCard: {
          backgroundColor: Colors.lossLight,
          borderWidth: 1,
          borderColor: Colors.loss,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.md,
          borderRadius: Radius.lg,
        },
        violationRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        violationLabel: {
          fontSize: Typography.bodySmall,
          color: Colors.loss,
          ...Font.medium,
        },
        violationCount: {
          fontSize: Typography.titleMedium,
          ...Font.bold,
          color: Colors.loss,
        },
        violationBreakdown: {
          fontSize: Typography.labelSmall,
          color: Colors.textMuted,
          ...Font.medium,
          marginTop: 2,
        },
        tipsSection: {
          backgroundColor: Colors.backgroundCard,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          marginBottom: Spacing.md,
        },
        tipsTitle: {
          fontSize: Typography.bodyMedium,
          ...Font.semibold,
          color: Colors.text,
          marginBottom: Spacing.xs,
        },
        tipsList: {
          gap: 4,
        },
        tipRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          width: "100%",
        },
        tipBullet: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: Colors.textMuted,
          marginRight: Spacing.sm,
        },
        tipText: {
          flex: 1,
          fontSize: Typography.bodySmall,
          color: Colors.textSecondary,
          lineHeight: 16,
        },
        footerButtonsRow: {
          flexDirection: "row",
          gap: Spacing.sm,
        },
        footerButton: {
          flex: 1,
        },
        participantsCard: {
          backgroundColor: Colors.backgroundCard,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          marginBottom: Spacing.md,
        },
        participantsTitle: {
          fontSize: Typography.bodyMedium,
          ...Font.semibold,
          color: Colors.text,
          marginBottom: Spacing.sm,
        },
        participantRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.xs,
        },
        participantDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: Spacing.sm,
        },
        participantName: {
          flex: 1,
          fontSize: Typography.bodySmall,
          color: Colors.text,
          ...Font.medium,
        },
        participantStatus: {
          fontSize: Typography.labelSmall,
          color: Colors.textSecondary,
          ...Font.medium,
        },
        participantViolations: {
          fontSize: Typography.labelSmall,
          ...Font.semibold,
          color: Colors.loss,
          marginRight: Spacing.sm,
        },
        participantPayout: {
          fontSize: Typography.labelSmall,
          ...Font.semibold,
          color: Colors.gain,
          marginRight: Spacing.sm,
          fontVariant: ["tabular-nums"],
        },
        participantYouTag: {
          fontSize: Typography.labelSmall,
          color: Colors.textMuted,
          ...Font.medium,
        },
        warningText: {
          textAlign: "center",
          color: Colors.textMuted,
          fontSize: Typography.labelSmall,
        },
      }),
    [Colors],
  );
  const router = useRouter();
  const {
    activeGroupSession,
    completeGroupSession,
    activeSession,
    activeGroupSessions,
    reportCompletion,
    reportSurrender,
    subscribeToSession,
  } = useGroupSessionStore();
  const soloSession = useSessionStore((s) => s.currentSession);
  const soloViolationCount = useSessionStore((s) => s.violationCount);
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Tracks intentional navigation away (complete or surrender) so the
  // useEffect guard doesn't redirect home when activeGroupSession clears.
  const isNavigatingAwayRef = useRef(false);
  const [violationCount, setViolationCount] = useState(0);
  const [surrenderModalVisible, setSurrenderModalVisible] = useState(false);

  // Subtle ~1Hz pulse on the SESSION ACTIVE badge dot — the one piece of
  // motion on an otherwise still screen. Static under Reduce Motion.
  const reducedMotion = useReducedMotion();
  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(dotOpacity);
      dotOpacity.value = 1;
    };
  }, [reducedMotion, dotOpacity]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  // Per-category attempt breakdown ("Social ×3 · Video ×2") — refreshed from
  // the app group whenever the total ticks. Categories only; iOS privacy
  // never tells us which app was attempted.
  const totalViolations = Math.max(soloViolationCount, violationCount);
  const [violationsByCategory, setViolationsByCategory] = useState<
    Record<string, number>
  >({});
  useEffect(() => {
    if (totalViolations === 0) return;
    setViolationsByCategory(getViolationsByCategory());
  }, [totalViolations]);
  const violationBreakdown = useMemo(() => {
    const labels: Record<string, string> = {
      social: "Social",
      video: "Video",
      gaming: "Gaming",
      news: "News",
      other: "Other",
    };
    return Object.entries(violationsByCategory)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `${labels[key] ?? "Other"} ×${n}`)
      .join(" · ");
  }, [violationsByCategory]);

  // Two-step shield surrender (Lane B5): shield extension fires a push with
  // category SURRENDER_CONFIRM. Tapping the push deep-links here with
  // confirmSurrender=true; we open the hold-to-forfeit modal immediately so
  // the user always confirms intentionally before money moves.
  useEffect(() => {
    if (params.confirmSurrender === "true") {
      setSurrenderModalVisible(true);
    }
  }, [params.confirmSurrender]);

  // Only use activeSession if it's currently running. A stale completed/cancelled
  // session must not poison derived values — especially sessionEndsAtMs, which
  // would make the timer start at 0ms and fire onComplete immediately.
  const effectiveFirestoreSession =
    activeSession?.status === "active" ? activeSession : null;

  // Normalize data from whichever session source is active
  const sessionEndsAtMs = isSoloStaked
    ? soloSession?.endsAt?.getTime()
    : (effectiveFirestoreSession?.endsAt?.getTime() ??
      activeGroupSession?.endsAt?.getTime());
  const sessionStartedAtMs = isSoloStaked
    ? soloSession?.startedAt?.getTime()
    : (effectiveFirestoreSession?.startedAt?.getTime() ??
      activeGroupSession?.startedAt?.getTime());
  const stakeAmount = isSoloStaked
    ? (soloSession?.stakeAmount ?? 0)
    : (effectiveFirestoreSession?.stakePerParticipant ??
      activeGroupSession?.stakePerParticipant ??
      0);
  // Live leaderboard rows. For Firestore sessions we read participant status
  // (active/completed/surrendered) and violation counts directly from the
  // synced doc; legacy in-memory sessions just show the participant list.
  // Sort order: focused first, surrendered last; current user wins ties.
  const leaderboard = useMemo(() => {
    type Row = {
      userId: string;
      name: string;
      completed?: boolean;
      surrendered?: boolean;
      violationCount: number;
      isCurrentUser: boolean;
      estimatedPayout: number;
    };

    // Optimistic per-participant payout — drives the live share preview.
    const optimistic = effectiveFirestoreSession
      ? optimisticGroupPayouts(effectiveFirestoreSession)
      : [];
    const payoutByUid = new Map(
      optimistic.map((row) => [row.userId, row.estimatedPayout]),
    );

    let rows: Row[] = [];
    if (effectiveFirestoreSession) {
      rows = Object.entries(effectiveFirestoreSession.participants).map(
        ([uid, p]) => ({
          userId: uid,
          name: p.name || "Friend",
          completed: p.completed,
          surrendered: p.surrendered,
          violationCount: p.violationCount ?? 0,
          isCurrentUser: uid === currentUserId,
          estimatedPayout: payoutByUid.get(uid) ?? 0,
        }),
      );
    } else if (activeGroupSession) {
      rows = activeGroupSession.participants.map((p) => ({
        userId: p.userId,
        name: p.name || "Friend",
        completed: p.completed,
        surrendered: false,
        violationCount: 0,
        isCurrentUser: p.userId === currentUserId,
        estimatedPayout: 0,
      }));
    }
    return rows.sort((a, b) => {
      const aRank = a.surrendered ? 2 : a.completed ? 1 : 0;
      const bRank = b.surrendered ? 2 : b.completed ? 1 : 0;
      if (aRank !== bRank) return aRank - bRank;
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      return 0;
    });
  }, [effectiveFirestoreSession, activeGroupSession, currentUserId]);

  const { timeRemaining, start } = useCountdown({
    onComplete: () => {
      isNavigatingAwayRef.current = true;
      if (isScreenTimeAvailable) {
        stopBlocking().catch(() => {});
      }
      // Delay one render cycle so the drain animation reaches 100% before navigating.
      setTimeout(async () => {
        if (isSoloStaked) {
          // sessionStore.completeSession handles payout + Firestore + CF call
          useSessionStore.getState().completeSession();
          router.replace("/session/complete?type=solo");
          return;
        }

        const store = useGroupSessionStore.getState();
        const firestoreSession =
          store.activeSession?.status === "active" ? store.activeSession : null;
        const session = store.activeGroupSession;

        // If this is a Firestore-backed session, report to server
        if (firestoreSession) {
          try {
            await reportCompletion(firestoreSession.id);
          } catch (err) {
            // Fallback to legacy local completion
            logger.warn("Server report failed, using local completion:", err);
            if (session) {
              completeGroupSession(
                session.participants.map((p) => ({
                  userId: p.userId,
                  completed: true,
                })),
              );
            }
          }
          router.replace("/session/complete");
        } else if (session) {
          completeGroupSession(
            session.participants.map((p) => ({
              userId: p.userId,
              completed: true,
            })),
          );
          // Quick-block: go home instead of showing money completion screen
          if (mode === "solo_quick") {
            router.dismissAll();
          } else {
            router.replace("/session/complete");
          }
        }
      }, 1000);
    },
  });

  // Use stable identifiers rather than object references. activeSession is a
  // new object on every Firestore snapshot, which would otherwise tear down
  // and re-create the shield listener on every document update — creating a
  // window where a violation could be missed.
  const hasActiveSession = !!(
    activeGroupSession?.id ?? effectiveFirestoreSession?.id
  );
  // Group sessions arrive here via Firestore status change without going through
  // sessionStore.startSession(), so we re-start blocking here to cover both paths.
  // Solo staked sessions already call startBlocking() inside sessionStore.startSession,
  // so skip to avoid redundant calls.
  useEffect(() => {
    if (isSoloStaked) return;
    if (!isScreenTimeAvailable || !hasActiveSession) return;
    // Don't silently run an unshielded session: if auth or an app selection is
    // missing, blocking would no-op (or throw + get swallowed). Warn instead so
    // the user can fix it rather than discovering nothing was blocked.
    const { authorized, hasApps } = getAppSelectionStatus();
    if (!authorized || !hasApps) {
      StatusBanner.show({
        severity: "warn",
        message:
          "Apps aren't blocked — set up Screen Time and pick apps in Profile.",
      });
      return;
    }
    startBlocking().catch(() => {});
  }, [hasActiveSession, isSoloStaked]);

  // Stable ref so the violation listener doesn't re-subscribe when the
  // Firestore session updates (would race with rapid violations).
  const firestoreSessionIdRef = useRef<string | undefined>(undefined);
  firestoreSessionIdRef.current = effectiveFirestoreSession?.id;

  // Live-mode (Firestore) group sessions arrive here via status change without
  // passing through startGroupSession, so the shield session context is synced
  // here too — otherwise the shield would show free-block copy on a staked
  // group session. Ref keeps the effect keyed on the session ID, not on every
  // snapshot. Stake 0 sessions are left alone (shield free copy is correct).
  const firestoreSessionRef = useRef(effectiveFirestoreSession);
  firestoreSessionRef.current = effectiveFirestoreSession;
  const firestoreSessionId = effectiveFirestoreSession?.id;
  useEffect(() => {
    if (isSoloStaked || !isScreenTimeAvailable || !firestoreSessionId) return;
    const session = firestoreSessionRef.current;
    const stake = session?.stakePerParticipant ?? 0;
    if (!session || stake <= 0) return;
    const names = Object.entries(session.participants ?? {})
      .filter(([uid]) => uid !== currentUserId)
      .map(([, p]) => p.name || "Friend");
    setSessionContext({ names, stake, type: "group" }).catch(() => {});
  }, [firestoreSessionId, isSoloStaked, currentUserId]);
  useEffect(() => {
    // Solo staked: sessionStore.startSession already subscribes to onShieldViolation
    // and increments its own violationCount — skip here to avoid double counting.
    if (isSoloStaked) return;
    if (!isScreenTimeAvailable || !hasActiveSession) return;
    const unsubscribe = onShieldViolation(() => {
      setViolationCount((prev) => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Group sessions: notify the server so other participants see it on
      // their leaderboard and get a push. Fire-and-forget — local count is
      // the source of truth for the current user's UI.
      const sid = firestoreSessionIdRef.current;
      if (sid) {
        reportShieldViolationCF(sid).catch((err) => {
          logger.warn("reportShieldViolation failed:", err);
        });
      }
    });
    return unsubscribe;
  }, [hasActiveSession, isSoloStaked]);

  // Subscribe to Firestore session for real-time participant updates
  useEffect(() => {
    if (activeSession?.id) {
      subscribeToSession(activeSession.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  // Recovery: if the app was force-quit during an active session, activeSession is
  // null on restart even though activeGroupSessions has the session. Subscribe so
  // the screen can render.
  const recoverySessionId = !effectiveFirestoreSession?.id
    ? activeGroupSessions?.find((s) => s.status === "active")?.id
    : undefined;
  useEffect(() => {
    if (recoverySessionId) {
      subscribeToSession(recoverySessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoverySessionId]);

  useEffect(() => {
    if (sessionEndsAtMs) {
      start(new Date(sessionEndsAtMs));
    } else if (!isNavigatingAwayRef.current) {
      // No active session and we didn't navigate here intentionally — stale route.
      router.dismissAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEndsAtMs, router]);

  // Solo staked: if the session clears externally (e.g. user tapped "Surrender"
  // on the native shield screen, which routes through sessionStore listener),
  // navigate forward so the user sees the complete screen instead of being
  // stuck on an active screen with no session.
  useEffect(() => {
    if (!isSoloStaked) return;
    if (soloSession) return;
    if (isNavigatingAwayRef.current) return;
    isNavigatingAwayRef.current = true;
    router.replace("/session/complete?type=solo");
  }, [isSoloStaked, soloSession, router]);

  // Shared surrender handler — called from the in-app Surrender button (after
  // user confirms via Alert) and from the shield screen's "Surrender Session"
  // button (no extra confirmation since the user already tapped on the shield).
  // Guarded by surrenderingRef: shield + in-app Alert can both fire in quick
  // succession and we only want one server report per session.
  const surrenderingRef = useRef(false);
  const performSurrender = useCallback(async () => {
    if (surrenderingRef.current) return;
    surrenderingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    isNavigatingAwayRef.current = true;
    if (isScreenTimeAvailable) {
      stopBlocking().catch(() => {});
    }
    if (isSoloStaked) {
      useSessionStore.getState().surrenderSession();
      router.replace("/session/complete?type=solo");
      return;
    }
    if (mode === "solo_quick") {
      completeGroupSession(
        (activeGroupSession?.participants ?? []).map((p) => ({
          userId: p.userId,
          completed: false,
        })),
      );
      router.dismissAll();
    } else if (effectiveFirestoreSession) {
      try {
        await reportSurrender(effectiveFirestoreSession.id);
      } catch (err) {
        logger.warn("Server surrender report failed:", err);
      }
      router.replace("/session/complete");
    } else {
      router.push("/session/surrender");
    }
  }, [
    mode,
    isSoloStaked,
    activeGroupSession,
    completeGroupSession,
    effectiveFirestoreSession,
    reportSurrender,
    router,
  ]);

  // Surrender via the custom shield screen ("Surrender Session" button).
  // The ShieldActionExtension writes a flag to shared UserDefaults; the native
  // module polls and emits this event. The shield no longer unblocks apps
  // directly — blocking stays active until performSurrender calls stopBlocking.
  //
  // Read performSurrender via a ref so the subscription doesn't tear down on
  // every Firestore snapshot — same pattern as the violation listener above.
  const performSurrenderRef = useRef(performSurrender);
  performSurrenderRef.current = performSurrender;
  useEffect(() => {
    // Solo staked: sessionStore.startSession already subscribes to
    // onSurrenderRequested. If we also subscribe here, both listeners fire
    // and surrenderSession gets called twice.
    if (isSoloStaked) return;
    if (!isScreenTimeAvailable || !hasActiveSession) return;
    const unsubscribe = onSurrenderRequested(() => {
      performSurrenderRef.current();
    });
    // Cold-start race condition fix: if the app was opened via the
    // niyah://surrender deep link, the foreground event may have fired
    // before this listener was attached. Check the flag manually.
    checkPendingSurrender();
    return unsubscribe;
  }, [hasActiveSession, isSoloStaked]);

  if (!activeGroupSession && !effectiveFirestoreSession && !soloSession) {
    return null;
  }

  const totalDuration =
    sessionEndsAtMs && sessionStartedAtMs
      ? sessionEndsAtMs - sessionStartedAtMs
      : (effectiveFirestoreSession?.duration ?? 0);

  return (
    <SessionScreenScaffold
      headerVariant="none"
      scrollable={false}
      stickyFooter={true}
      footer={
        <>
          <Button
            title={
              mode === "solo_quick"
                ? "End Session"
                : `💸 End early — forfeit ${formatMoney(stakeAmount)}`
            }
            onPress={() => {
              if (mode === "solo_quick") {
                Alert.alert(
                  "End Blocking?",
                  "Are you sure you want to stop blocking apps?",
                  [
                    { text: "Keep Going", style: "cancel" },
                    {
                      text: "End",
                      style: "destructive",
                      onPress: performSurrender,
                    },
                  ],
                );
              } else {
                setSurrenderModalVisible(true);
              }
            }}
            variant="outline"
            size="large"
          />
          {mode !== "solo_quick" && (
            <Text style={styles.warningText}>
              Warning: Surrendering forfeits your {formatMoney(stakeAmount)}{" "}
              stake
            </Text>
          )}
          <HoldToConfirmModal
            visible={surrenderModalVisible}
            title="Surrender session?"
            body={`You staked ${formatMoney(stakeAmount)} so your future self couldn't weasel out. Your future self is trying to weasel out. Surrender now and your ${formatMoney(stakeAmount)} is gone — no refunds.`}
            holdLabel={`Hold to forfeit ${formatMoney(stakeAmount)}`}
            onCancel={() => setSurrenderModalVisible(false)}
            onConfirm={() => {
              setSurrenderModalVisible(false);
              performSurrender();
            }}
          />
        </>
      }
    >
      {/* Status Header */}
      <View style={styles.header}>
        <View style={styles.statusBadge}>
          <Animated.View style={[styles.statusDot, dotStyle]} />
          <Text style={styles.statusText}>SESSION ACTIVE</Text>
        </View>
        <Text style={styles.title}>Stay Focused</Text>
        <Text style={styles.subtitle}>Distracting apps are blocked</Text>
      </View>

      {/* Timer — the depleting ring + MM:SS are the single progress readout.
          (The old linear "% complete" bar contradicted the ring's remaining-%
          on the same screen; removed after the build-21 test.) */}
      <View style={styles.timerSection}>
        {/* No pause: a staked session is end-only (pausing would free the
            phone mid-commitment). The countdown just runs; the only exit is
            finishing or the money-stamped "end early" control below. */}
        <Timer
          timeRemaining={timeRemaining}
          totalTime={totalDuration}
          size="medium"
          showProgress={true}
          mode="ring"
        />
      </View>

      {/* Payout Card — hidden for solo quick-block (no money involved) */}
      {mode !== "solo_quick" && (
        <Card style={styles.payoutCard}>
          <Text style={styles.payoutLabel}>Complete to keep</Text>
          <Text style={styles.payoutAmount}>
            {isSoloStaked
              ? formatMoney(soloSession?.potentialPayout ?? stakeAmount)
              : formatMoney(stakeAmount * SOLO_COMPLETION_MULTIPLIER)}
          </Text>
        </Card>
      )}

      {/* Live Leaderboard — only for group sessions (2+ participants) */}
      {leaderboard.length >= 2 && (
        <View style={styles.participantsCard}>
          <Text style={styles.participantsTitle}>Live Standings</Text>
          {leaderboard.map((p) => {
            // For self, show whichever count is higher (local fires instantly,
            // Firestore lags one round-trip behind).
            const displayViolations = p.isCurrentUser
              ? Math.max(violationCount, p.violationCount)
              : p.violationCount;
            const dotColor = p.surrendered
              ? Colors.loss
              : p.completed
                ? Colors.gain
                : Colors.primary;
            const statusText = p.surrendered
              ? "Out"
              : p.completed
                ? "Done"
                : "Focused";
            return (
              <Animated.View
                key={p.userId}
                layout={LinearTransition.springify().damping(18)}
                style={styles.participantRow}
              >
                <View
                  style={[styles.participantDot, { backgroundColor: dotColor }]}
                />
                <Text style={styles.participantName} numberOfLines={1}>
                  {p.name}
                  {p.isCurrentUser && (
                    <Text style={styles.participantYouTag}> (you)</Text>
                  )}
                </Text>
                {displayViolations > 0 && (
                  <Text style={styles.participantViolations}>
                    {displayViolations} slip
                    {displayViolations === 1 ? "" : "s"}
                  </Text>
                )}
                {!p.surrendered && p.estimatedPayout > 0 && (
                  <Text style={styles.participantPayout}>
                    {formatMoney(p.estimatedPayout)}
                  </Text>
                )}
                <Text style={styles.participantStatus}>{statusText}</Text>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Standalone violation counter — only for solo (no leaderboard) */}
      {leaderboard.length < 2 &&
        (isSoloStaked ? soloViolationCount : violationCount) > 0 && (
          <Card style={styles.violationCard}>
            <View style={styles.violationRow}>
              <Text style={styles.violationLabel}>Blocked app attempts</Text>
              <Text style={styles.violationCount}>
                {isSoloStaked ? soloViolationCount : violationCount}
              </Text>
            </View>
            {violationBreakdown.length > 0 && (
              <Text style={styles.violationBreakdown}>
                {violationBreakdown}
              </Text>
            )}
          </Card>
        )}

      {/* Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Stay strong</Text>
        <View style={styles.tipsList}>
          {[
            "Put your phone face down",
            "Take short breaks for water",
            "Deep breaths help refocus",
          ].map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </SessionScreenScaffold>
  );
}

const ActiveSessionScreen = withErrorBoundary(
  ActiveSessionScreenInner,
  "active",
);
export default ActiveSessionScreen;
