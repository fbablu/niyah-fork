import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, AppState, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import { Button, AuthScreenScaffold } from "../../src/components";
import {
  isScreenTimeAvailable,
  requestScreenTimeAuth,
  getScreenTimeAuthStatus,
  presentAppPicker,
  getSavedAppSelection,
  onAuthorizationChange,
} from "../../src/config/screentime";
import { logEvent } from "../../src/utils/analytics";

// HARD GATE (Opal-style): Screen Time is core to Niyah, so onboarding requires
// it before reaching the app — there is no "Skip" here, and app/index.tsx
// re-routes back to this screen on launch until authorization is granted.
// Apple won't let us FORCE the grant, so a denial isn't a dead end: we surface
// an "Open Settings" recovery path and re-check authorization whenever the app
// returns to the foreground (or the native auth-change event fires).
// Devices without Screen Time (sim / <iOS16) pass straight through.

export default function ScreenTimeSetupScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  const [isRequesting, setIsRequesting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(
    isScreenTimeAvailable && getScreenTimeAuthStatus() === "approved",
  );
  const [authDenied, setAuthDenied] = useState(
    isScreenTimeAvailable && getScreenTimeAuthStatus() === "denied",
  );
  const [hasSelection, setHasSelection] = useState(
    isScreenTimeAvailable && !!getSavedAppSelection(),
  );

  const goNext = useCallback(() => {
    router.replace("/(auth)/notifications-setup" as never);
  }, [router]);

  // Re-check authorization when the user returns from Settings (or the native
  // auth-change event fires) so a recovered grant clears the denied state.
  const recheckAuth = useCallback(() => {
    if (!isScreenTimeAvailable) return;
    if (getScreenTimeAuthStatus() === "approved") {
      setIsAuthorized(true);
      setAuthDenied(false);
    }
  }, []);

  useEffect(() => {
    if (!isScreenTimeAvailable) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") recheckAuth();
    });
    const unsubAuth = onAuthorizationChange(() => recheckAuth());
    return () => {
      sub.remove();
      unsubAuth();
    };
  }, [recheckAuth]);

  const handleConnect = async () => {
    if (!isScreenTimeAvailable) {
      // No Screen Time on this device — nothing to gate on, move on.
      goNext();
      return;
    }

    setIsRequesting(true);
    try {
      const result = await requestScreenTimeAuth();
      if (result === "approved") {
        setIsAuthorized(true);
        setAuthDenied(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        logEvent("screentime_granted");
      } else {
        // Denied — iOS won't re-prompt, so route the user to Settings.
        setAuthDenied(true);
        logEvent("screentime_denied", { reason: "denied" });
      }
    } catch {
      setAuthDenied(true);
      logEvent("screentime_denied", { reason: "error" });
    } finally {
      setIsRequesting(false);
    }
  };

  const handlePickApps = async () => {
    if (!isScreenTimeAvailable) {
      goNext();
      return;
    }
    setIsRequesting(true);
    try {
      // Use the picker's RESOLVED selection, not a read-after-write — the
      // re-read can miss on a fresh native-module instance and falsely report
      // no apps. An empty Done now throws (treated as cancel) and is caught.
      const selection = await presentAppPicker();
      if (selection && selection.appCount + selection.categoryCount > 0) {
        setHasSelection(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(goNext, 600);
      }
    } catch {
      // User cancelled or picker failed — let them try again.
    } finally {
      setIsRequesting(false);
    }
  };

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const title = hasSelection
    ? "You're all set"
    : authDenied
      ? "Screen Time is off"
      : isAuthorized
        ? 'Tap "All Apps & Categories"'
        : "Connect Niyah to\nScreen Time";
  const subtitle = hasSelection
    ? "Niyah will block your selected apps during focus sessions."
    : authDenied
      ? "Niyah can't block apps without Screen Time access. Turn it on in Settings, then come back — we'll pick up automatically."
      : isAuthorized
        ? "Select everything. You can exclude specific apps later — picking All gives you the most control."
        : "To block distracting apps, Niyah needs Screen Time access. Apple keeps this private to your device.";

  return (
    <AuthScreenScaffold showBack={false} title={title} subtitle={subtitle}>
      {/* Onboarding progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: hasSelection ? "100%" : isAuthorized ? "66%" : "33%" },
          ]}
        />
      </View>

      <View style={styles.content}>
        {/* Visual indicator */}
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconCircle,
              hasSelection && styles.iconCircleSuccess,
              authDenied && styles.iconCircleDenied,
            ]}
          >
            <Text style={styles.iconText}>
              {hasSelection
                ? "✓"
                : authDenied
                  ? "⚠️"
                  : isAuthorized
                    ? "⚑"
                    : "⏱"}
            </Text>
          </View>
        </View>

        {/* Denied recovery instructions */}
        {authDenied && (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>How to turn it on</Text>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Open Settings → Screen Time → and allow Niyah, or
              </Text>
            </View>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Settings → Niyah → toggle Screen Time access on.
              </Text>
            </View>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Return to Niyah and we'll continue automatically.
              </Text>
            </View>
          </View>
        )}

        {/* Permission explanation */}
        {!isAuthorized && !authDenied && (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>What this allows</Text>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Block selected apps during focus sessions
              </Text>
            </View>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Show a custom Niyah shield when you try to open a blocked app
              </Text>
            </View>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Enforced at the OS level by Apple — uninstalling Niyah, turning
                off Wi-Fi, or restarting your phone won't unlock the block. The
                only way out is to surrender your stake.
              </Text>
            </View>
            <View style={styles.explanationItem}>
              <Text style={styles.bulletText}>
                Track focus streaks — never read personal data
              </Text>
            </View>
          </View>
        )}

        {/* When authorized but no selection: mock "All Apps & Categories" row
            so user knows exactly what to tap inside Apple's picker sheet. */}
        {isAuthorized && !hasSelection && (
          <View style={styles.mockCard}>
            <View style={styles.mockRow}>
              <View style={styles.mockRadio} />
              <View style={styles.mockIcon}>
                <Text style={styles.mockIconText}>📚</Text>
              </View>
              <Text style={styles.mockLabel}>All Apps & Categories</Text>
            </View>
            <Text style={styles.mockHint}>↑ Choose this one</Text>
          </View>
        )}

        {/* Privacy note */}
        <Text style={styles.privacyText}>
          Your sensitive data is protected by Apple{"\n"}and never leaves your
          device.
        </Text>
      </View>

      {/* Buttons — no "skip"; this is a required step (hard gate). */}
      <View style={styles.buttonSection}>
        {authDenied ? (
          <>
            <Button title="Open Settings" onPress={openSettings} size="large" />
            <Button
              title="I've enabled it"
              onPress={recheckAuth}
              variant="outline"
              size="large"
            />
          </>
        ) : !isAuthorized ? (
          <Button
            title={isRequesting ? "Connecting..." : "Connect Screen Time"}
            onPress={handleConnect}
            disabled={isRequesting}
            loading={isRequesting}
            size="large"
          />
        ) : !hasSelection ? (
          <Button
            title={isRequesting ? "Opening picker..." : "Choose Apps"}
            onPress={handlePickApps}
            disabled={isRequesting}
            loading={isRequesting}
            size="large"
          />
        ) : (
          <Button title="Continue" onPress={goNext} size="large" />
        )}
      </View>
    </AuthScreenScaffold>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    progressBar: {
      height: 4,
      backgroundColor: Colors.backgroundTertiary,
      borderRadius: Radius.full,
      marginBottom: Spacing.lg,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
    },
    content: {
      alignItems: "center",
      gap: Spacing.xl,
    },
    mockCard: {
      width: "100%",
      gap: Spacing.sm,
    },
    mockRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: Spacing.md,
    },
    mockRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: Colors.textMuted,
    },
    mockIcon: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    mockIconText: {
      fontSize: 20,
    },
    mockLabel: {
      flex: 1,
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    mockHint: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.primary,
      textAlign: "center",
    },
    iconContainer: {
      marginVertical: Spacing.lg,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.backgroundCard,
      borderWidth: 2,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconCircleSuccess: {
      backgroundColor: Colors.gainLight,
      borderColor: Colors.gain,
    },
    iconCircleDenied: {
      borderColor: Colors.loss,
    },
    iconText: {
      fontSize: 36,
    },
    explanationCard: {
      width: "100%",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    explanationTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    explanationItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
    },
    bulletText: {
      flex: 1,
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    privacyText: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
      textAlign: "center",
      lineHeight: Typography.labelSmall * 1.6,
    },
    buttonSection: {
      marginTop: Spacing.xl,
      gap: Spacing.md,
    },
  });
