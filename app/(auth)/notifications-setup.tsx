import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  AuthScreenScaffold,
  Button,
  withErrorBoundary,
} from "../../src/components";
import { enableNotifications } from "../../src/config/notifications";
import { logger } from "../../src/utils/logger";

// Priming screen: explain WHY before the OS dialog fires. The actual
// permission prompt only appears when the user taps "Turn on notifications"
// (enableNotifications) — never silently on sign-in, where a dismissal would
// permanently kill push. Notifications are NOT hard-required, so "Not now" is
// allowed; the OS prompt can be re-triggered later from Profile / first session.

const REASONS = [
  {
    emoji: "🚀",
    text: "Know the moment a friend joins your session",
  },
  {
    emoji: "⏱️",
    text: "Get nudged when a session starts and ends",
  },
  {
    emoji: "💸",
    text: "Stay on top of your stake — never lose it by surprise",
  },
];

function NotificationsSetupScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  const [isRequesting, setIsRequesting] = useState(false);

  const finish = () => router.replace("/(tabs)");

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const granted = await enableNotifications();
      if (granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      logger.error("enableNotifications failed:", err);
    } finally {
      setIsRequesting(false);
      finish();
    }
  };

  return (
    <AuthScreenScaffold
      showBack={false}
      title="Stay in the loop"
      subtitle="Niyah only pings you about your sessions and friends — no spam."
    >
      <View style={styles.progressBar}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔔</Text>
          </View>
        </View>

        <View style={styles.reasonsCard}>
          {REASONS.map((r) => (
            <View key={r.text} style={styles.reasonRow}>
              <Text style={styles.reasonEmoji}>{r.emoji}</Text>
              <Text style={styles.reasonText}>{r.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttonSection}>
        <Button
          title={isRequesting ? "Just a sec..." : "Turn on notifications"}
          onPress={handleEnable}
          disabled={isRequesting}
          loading={isRequesting}
          size="large"
        />
        <Button
          title="Not now"
          onPress={finish}
          variant="outline"
          size="large"
          disabled={isRequesting}
        />
      </View>
    </AuthScreenScaffold>
  );
}

const NotificationsSetupScreen = withErrorBoundary(
  NotificationsSetupScreenInner,
  "notifications-setup",
);
export default NotificationsSetupScreen;

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
      width: "100%",
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
    },
    content: {
      alignItems: "center",
      gap: Spacing.xl,
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
    iconText: {
      fontSize: 36,
    },
    reasonsCard: {
      width: "100%",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    reasonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    reasonEmoji: {
      fontSize: 24,
    },
    reasonText: {
      flex: 1,
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
      lineHeight: Typography.bodyMedium * 1.4,
    },
    buttonSection: {
      marginTop: Spacing.xl,
      gap: Spacing.md,
    },
  });
