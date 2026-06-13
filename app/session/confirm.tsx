import React, { useMemo, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
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
  SlideToConfirm,
  SessionScreenScaffold,
  withErrorBoundary,
  StatusBanner,
} from "../../src/components";
import { BlockTemplateChips } from "../../src/components/session";
import * as Haptics from "expo-haptics";
import { usePartnerStore } from "../../src/store/partnerStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { useAuthStore } from "../../src/store/authStore";
import {
  CADENCES,
  USE_SHORT_TIMERS,
  REPUTATION_LEVELS,
  SOLO_COMPLETION_MULTIPLIER,
} from "../../src/constants/config";
import type { CadenceType } from "../../src/types";
import { formatMoney, formatDuration } from "../../src/utils/format";
import {
  isScreenTimeAvailable,
  startBlocking,
  getSavedAppSelection,
  getAppSelectionStatus,
  validateAndPromptForAppSelection,
  presentAppPicker,
  requestScreenTimeAuth,
} from "../../src/config/screentime";
import type { AppSelectionToken } from "../../modules/niyah-screentime";
import { logger } from "../../src/utils/logger";

const BLOCKED_APPS = [
  "Instagram",
  "TikTok",
  "Twitter/X",
  "YouTube",
  "Reddit",
  "Facebook",
];

// ─── Styles ───────────────────────────────────────────────────────────────────

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    // Glass seat for the partner summary (glassLight, Radius.xl, borderless).
    partnerCard: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    partnerLabel: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
      marginBottom: Spacing.sm,
    },
    partnerInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    partnerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    partnerInitial: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.white,
    },
    partnerDetails: {
      flex: 1,
    },
    partnerName: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.xs,
    },
    // Dark-glass pill reads on the glass seat over the green field.
    reputationBadge: {
      backgroundColor: Colors.glassDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      alignSelf: "flex-start",
    },
    reputationText: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
    changePartnerButton: {
      alignItems: "center",
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: WHITE_25,
    },
    changePartnerText: {
      fontSize: Typography.labelMedium,
      color: Colors.white,
      ...Font.medium,
    },
    noPartnerCard: {
      marginBottom: Spacing.md,
      alignItems: "center",
      paddingVertical: Spacing.xl,
    },
    noPartnerText: {
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      marginBottom: Spacing.md,
    },
    // Glass seat for the session details (glassLight, Radius.xl).
    detailsCard: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    detailLabel: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
    },
    detailValue: {
      fontSize: Typography.bodySmall,
      ...Font.medium,
      color: Colors.white,
    },
    divider: {
      height: 1,
      backgroundColor: WHITE_25,
      marginVertical: Spacing.md,
    },
    stakeValue: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.white,
    },
    howItWorksCard: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    howItWorksTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.md,
    },
    outcomeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    // Base (duo-mode) dot is white; complete/surrender rows keep their
    // semantic gain/loss inline overrides.
    outcomeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.white,
      marginRight: Spacing.sm,
    },
    outcomeText: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      flex: 1,
    },
    outcomeHighlight: {
      ...Font.semibold,
      color: Colors.white,
    },
    // Warning keeps its semantic gold colors (waiting-room precedent); body
    // text goes white so it reads on the green field in both themes.
    warningCard: {
      backgroundColor: Colors.warningLight,
      borderWidth: 1,
      borderColor: Colors.warning,
      borderRadius: Radius.xl,
      marginBottom: Spacing.md,
    },
    warningTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.warning,
      marginBottom: Spacing.xs,
    },
    warningText: {
      fontSize: Typography.bodySmall,
      color: Colors.white,
      lineHeight: 20,
    },
    blockedSection: {
      marginBottom: Spacing.lg,
    },
    blockedTitle: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: WHITE_70,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    appList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    // Dark-glass pills; the active selection flips to white + primaryDark.
    appBadge: {
      backgroundColor: Colors.glassDark,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: "transparent",
    },
    appBadgeActive: {
      backgroundColor: Colors.white,
      borderColor: Colors.white,
    },
    appName: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
    appNameActive: {
      color: Colors.primaryDark,
      ...Font.semibold,
    },
    blockedNote: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      marginTop: Spacing.sm,
      fontStyle: "italic",
    },
    // Brand-surface attention card: Colors.primary fill + white@0.25 border.
    setupCard: {
      backgroundColor: Colors.primary,
      borderWidth: 1,
      borderColor: WHITE_25,
      borderRadius: Radius.xl,
      gap: Spacing.sm,
    },
    setupTitle: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.white,
    },
    setupDescription: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
    setupRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    setupRowText: {
      flex: 1,
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
    // White-flip pills (Colors.white + primaryDark content) so the setup CTAs
    // read on the brand-surface fill — via Button's public style props only.
    setupButton: {
      backgroundColor: Colors.white,
      borderRadius: Radius.full,
    },
    setupButtonText: {
      color: Colors.primaryDark,
    },
    disclaimer: {
      textAlign: "center",
      color: WHITE_55,
      fontSize: Typography.labelSmall,
    },
  });

function ConfirmSessionScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentPartner } = usePartnerStore();
  const { startGroupSession } = useGroupSessionStore();
  const startSoloSession = useSessionStore((s) => s.startSession);
  const user = useAuthStore((state) => state.user);

  const cadence = (params.cadence as CadenceType) || "daily";
  const config = CADENCES[cadence];
  const isSolo = params.type === "solo";
  const showPartner = !isSolo && !!currentPartner;

  // Screen Time readiness — gate the (stake-charging) start button so a staked
  // session can never run unshielded. `available:false` (simulator/Android)
  // reports ready so we don't trap the user where blocking can't apply.
  const [appSelection, setAppSelection] = useState<AppSelectionToken | null>(
    getSavedAppSelection,
  );
  const [authorized, setAuthorized] = useState(
    () => getAppSelectionStatus().authorized,
  );
  const [isStarting, setIsStarting] = useState(false);
  // Synchronous mirror of isStarting — closes the double-tap window that
  // React-state guards can't (state reads are stale until commit).
  const startingRef = useRef(false);
  const stAvailable = isScreenTimeAvailable;
  const hasApps =
    !!appSelection && appSelection.appCount + appSelection.categoryCount > 0;
  const blockingReady = !stAvailable || (authorized && hasApps);

  const handleAuthorize = useCallback(async () => {
    try {
      if ((await requestScreenTimeAuth()) === "approved") {
        setAuthorized(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      StatusBanner.show({
        severity: "error",
        message: "Couldn't request Screen Time access.",
      });
    }
  }, []);

  const handleSelectApps = useCallback(async () => {
    try {
      const selection = await presentAppPicker();
      setAppSelection(selection);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // User cancelled the picker — keep prior selection.
    }
  }, []);

  const handleConfirm = async () => {
    if (!user) return;
    // SYNCHRONOUS re-entry guard: a second confirm while the first awaits the
    // Screen Time gate would double-charge the stake (createSoloSession is
    // idempotent per-sessionId only, and each invocation generates a fresh
    // id). isStarting alone can't close this — it's React state set AFTER the
    // gate await, and the reduced-motion Button fallback has no one-shot.
    if (startingRef.current) return;
    startingRef.current = true;

    // Gate: ensure Screen Time auth + a non-empty app selection BEFORE charging
    // the stake. Prompts inline if missing; aborts (no charge) if declined.
    // The gate's own prompts must stay interactive, so isStarting flips after.
    const gate = await validateAndPromptForAppSelection();
    if (!gate.ok) {
      StatusBanner.show({
        severity: "warn",
        message:
          gate.reason === "needs-auth"
            ? "Screen Time access is required to block apps for your stake."
            : "Pick at least one app or category to block before staking.",
      });
      setAuthorized(getAppSelectionStatus().authorized);
      setAppSelection(getSavedAppSelection());
      startingRef.current = false;
      return;
    }
    if (gate.selection) setAppSelection(gate.selection);

    setIsStarting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isSolo) {
      try {
        await startSoloSession(cadence);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not start session.";
        logger.warn("startSoloSession failed:", error);
        StatusBanner.show({ severity: "error", message });
        setIsStarting(false);
        startingRef.current = false;
        return;
      }
      // startSession() in sessionStore already fires startBlocking() internally.
      router.replace("/session/active?mode=solo_staked");
      return;
    }

    const participants: Parameters<typeof startGroupSession>[1] = currentPartner
      ? [
          {
            userId: user.id,
            name: user.name,
            profileImage: user.profileImage,
            reputation: user.reputation,
          },
          {
            userId: currentPartner.oderId,
            name: currentPartner.name,
            profileImage: currentPartner.profileImage,
            reputation: currentPartner.reputation,
          },
        ]
      : [
          {
            userId: user.id,
            name: user.name,
            profileImage: user.profileImage,
            reputation: user.reputation,
          },
        ];

    // startGroupSession throws synchronously when a session is already live
    // (e.g. a free quick-block is running) — without the catch the slider
    // would hang in an eternal loading spinner on an unhandled rejection.
    try {
      startGroupSession(cadence, participants);
    } catch (error) {
      StatusBanner.show({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Could not start session.",
      });
      setIsStarting(false);
      startingRef.current = false;
      return;
    }

    // The gate above already ensured auth + a non-empty selection (or that
    // Screen Time isn't available here), so startBlocking won't throw on an
    // empty selection any more.
    if (isScreenTimeAvailable) {
      try {
        await startBlocking();
      } catch (error) {
        logger.warn("Failed to start Screen Time blocking:", error);
      }
    }

    router.replace("/session/active");
  };

  const getDurationText = () => {
    if (USE_SHORT_TIMERS) return `${config.demoDuration / 1000} seconds (demo)`;
    return formatDuration(config.duration);
  };

  const getReputationLabel = (level: string) => {
    const levelInfo =
      REPUTATION_LEVELS[level as keyof typeof REPUTATION_LEVELS];
    return levelInfo?.label || level;
  };

  return (
    <SessionScreenScaffold
      headerVariant="back"
      title="Ready to Focus?"
      subtitle={
        showPartner
          ? "Review your duo session details"
          : "Review your session details"
      }
      backgroundColor={Colors.primaryDark}
      footer={
        <>
          <SlideToConfirm
            title={
              showPartner
                ? "Slide to start duo session"
                : "Slide to start solo session"
            }
            onConfirm={handleConfirm}
            disabled={!blockingReady}
            loading={isStarting}
          />
          <Text style={styles.disclaimer}>
            Your {formatMoney(config.stake)} stake will be deducted immediately
          </Text>
        </>
      }
    >
      {/* Partner Card */}
      {showPartner && currentPartner && (
        <Card style={styles.partnerCard}>
          <Text style={styles.partnerLabel}>With Partner</Text>
          <View style={styles.partnerInfo}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerInitial}>
                {currentPartner.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.partnerDetails}>
              <Text style={styles.partnerName}>{currentPartner.name}</Text>
              <View style={styles.reputationBadge}>
                <Text style={styles.reputationText}>
                  {getReputationLabel(currentPartner.reputation.level)} (
                  {currentPartner.reputation.score}/100)
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            style={styles.changePartnerButton}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={() => router.push("/session/partner" as any)}
          >
            <Text style={styles.changePartnerText}>Change Partner</Text>
          </Pressable>
        </Card>
      )}

      {/* Session Details */}
      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Session Type</Text>
          <Text style={styles.detailValue}>{config.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{getDurationText()}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Your Stake</Text>
          <Text style={styles.stakeValue}>{formatMoney(config.stake)}</Text>
        </View>
        {showPartner && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Partner's Stake</Text>
            <Text style={styles.stakeValue}>{formatMoney(config.stake)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>On Completion</Text>
          <Text style={[styles.stakeValue, { color: Colors.gain }]}>
            Keep {formatMoney(config.stake * SOLO_COMPLETION_MULTIPLIER)}
          </Text>
        </View>
      </Card>

      {/* How It Works */}
      <Card style={styles.howItWorksCard}>
        <Text style={styles.howItWorksTitle}>How It Works</Text>
        <View style={styles.outcomeRow}>
          <View style={[styles.outcomeDot, { backgroundColor: Colors.gain }]} />
          <Text style={styles.outcomeText}>
            <Text style={styles.outcomeHighlight}>Complete the session:</Text>{" "}
            Keep your {formatMoney(config.stake)} stake — proof you followed
            through
          </Text>
        </View>
        <View style={styles.outcomeRow}>
          <View style={[styles.outcomeDot, { backgroundColor: Colors.loss }]} />
          <Text style={styles.outcomeText}>
            <Text style={styles.outcomeHighlight}>Surrender early:</Text> You
            forfeit your {formatMoney(config.stake)} stake
          </Text>
        </View>
        {showPartner && (
          <View style={styles.outcomeRow}>
            <View style={styles.outcomeDot} />
            <Text style={styles.outcomeText}>
              <Text style={styles.outcomeHighlight}>Duo mode:</Text> You and
              your partner each keep your own stake — staking together keeps you
              both accountable.
            </Text>
          </View>
        )}
      </Card>

      {/* Warning */}
      <Card style={styles.warningCard}>
        <Text style={styles.warningTitle}>Important</Text>
        <Text style={styles.warningText}>
          {showPartner
            ? `Once you start, distracting apps will be blocked. Surrendering forfeits your ${formatMoney(config.stake)} stake. Your reputation score is affected by payment reliability.`
            : `Once you start, distracting apps will be blocked. Surrendering forfeits your ${formatMoney(config.stake)} stake — no refunds.`}
        </Text>
      </Card>

      {/* Blocked Apps */}
      <View style={styles.blockedSection}>
        <Text style={styles.blockedTitle}>Apps that will be blocked</Text>
        {stAvailable && !blockingReady ? (
          // Setup Required — must authorize + pick apps before the staked
          // session can start (the Start button is disabled until both are done).
          <Card style={styles.setupCard}>
            <Text style={styles.setupTitle}>Setup Required</Text>
            <Text style={styles.setupDescription}>
              Niyah needs Screen Time access and an app selection to block
              distractions while your stake is on the line.
            </Text>
            {!authorized && (
              <View style={styles.setupRow}>
                <Text style={styles.setupRowText}>
                  Screen Time: not authorized
                </Text>
                <Button
                  title="Authorize"
                  onPress={handleAuthorize}
                  size="small"
                  style={styles.setupButton}
                  textStyle={styles.setupButtonText}
                />
              </View>
            )}
            {authorized && !hasApps && (
              <View style={styles.setupRow}>
                <Text style={styles.setupRowText}>No apps selected</Text>
                <Button
                  title="Select Apps"
                  onPress={handleSelectApps}
                  size="small"
                  style={styles.setupButton}
                  textStyle={styles.setupButtonText}
                />
              </View>
            )}
          </Card>
        ) : stAvailable && hasApps ? (
          <>
            <Pressable onPress={handleSelectApps}>
              <View style={styles.appList}>
                <View style={[styles.appBadge, styles.appBadgeActive]}>
                  <Text style={[styles.appName, styles.appNameActive]}>
                    {appSelection?.label ?? "Selected apps"} ›
                  </Text>
                </View>
              </View>
            </Pressable>
            <Text style={styles.blockedNote}>
              Tap to change · apps block the moment the session starts
            </Text>
            <BlockTemplateChips
              onApplied={(selection) => setAppSelection(selection)}
              canSaveCurrent={hasApps}
            />
          </>
        ) : (
          <>
            <View style={styles.appList}>
              {BLOCKED_APPS.map((app) => (
                <View key={app} style={styles.appBadge}>
                  <Text style={styles.appName}>{app}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.blockedNote}>
              Demo mode: apps are not actually blocked on this device
            </Text>
          </>
        )}
      </View>
    </SessionScreenScaffold>
  );
}

const ConfirmSessionScreen = withErrorBoundary(
  ConfirmSessionScreenInner,
  "confirm",
);
export default ConfirmSessionScreen;
