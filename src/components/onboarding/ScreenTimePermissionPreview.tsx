import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  Radius,
  Spacing,
  Typography,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";

// Opal-style "preview the permission sheet as a button": instead of a generic
// CTA, we render a tappable mock of the iOS "Niyah Would Like to Access Screen
// Time" alert. Tapping it fires the REAL system request — so the faux Continue
// / Not Now pills set the expectation for the dialog that follows. Blended with
// Niyah's palette (green primary, app icon) rather than copying Opal's blue.

const AppIcon = require("../../../assets/icon.png");
// Apple's Screen Time indigo — evokes the system icon, not a Niyah brand color.
const SCREEN_TIME_INDIGO = "#5E5CE6";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onPress: () => void;
  loading?: boolean;
}

export const ScreenTimePermissionPreview: React.FC<Props> = ({
  onPress,
  loading = false,
}) => {
  const Colors = useColors();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const glow = useSharedValue(0);
  const bob = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    const ease = Easing.inOut(Easing.ease);
    glow.value = withRepeat(
      withTiming(1, { duration: 1600, easing: ease }),
      -1,
      true,
    );
    bob.value = withRepeat(
      withTiming(1, { duration: 1100, easing: ease }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(glow);
      cancelAnimation(bob);
    };
  }, [reducedMotion, glow, bob]);

  const cardStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.18 + glow.value * 0.32,
    shadowRadius: 10 + glow.value * 12,
    transform: [{ scale: 1 - press.value * 0.015 }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          bob.value,
          [0, 1],
          [0, -5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <AnimatedPressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Connect Niyah to Screen Time"
        accessibilityState={{ busy: loading }}
        onPress={onPress}
        disabled={loading}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 140 });
        }}
        style={[styles.card, cardStyle]}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.text} />
            <Text style={styles.loadingText}>Connecting to Screen Time…</Text>
          </View>
        ) : (
          <>
            <View style={styles.iconRow}>
              <Image source={AppIcon} style={styles.appIcon} />
              <View style={styles.stIcon}>
                <Ionicons name="hourglass-outline" size={26} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.cardTitle}>
              “Niyah” Would Like to Access Screen Time
            </Text>
            <Text style={styles.cardBody}>
              This lets Niyah block distracting apps during focus sessions. Your
              data stays on your device.
            </Text>
            <View style={styles.btnRow}>
              <View style={[styles.faux, styles.fauxPrimary]}>
                <Text style={styles.fauxPrimaryText}>Continue</Text>
              </View>
              <View style={styles.faux}>
                <Text style={styles.fauxText}>Not Now</Text>
              </View>
            </View>
          </>
        )}
      </AnimatedPressable>

      {!loading && (
        <Animated.View style={[styles.hintRow, arrowStyle]}>
          <Ionicons name="arrow-up" size={15} color={Colors.primary} />
          <Text style={styles.hintText}>Tap, then choose Continue</Text>
        </Animated.View>
      )}
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      width: "100%",
      gap: Spacing.sm,
    },
    card: {
      width: "100%",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.xl,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
    },
    iconRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    appIcon: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
    },
    stIcon: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: SCREEN_TIME_INDIGO,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -10,
    },
    cardTitle: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.text,
      textAlign: "center",
      lineHeight: Typography.bodyLarge * 1.3,
    },
    cardBody: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: Typography.bodySmall * 1.45,
      marginTop: Spacing.sm,
    },
    btnRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    faux: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      alignItems: "center",
      backgroundColor: Colors.backgroundTertiary,
    },
    fauxPrimary: {
      backgroundColor: Colors.primary,
    },
    fauxText: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    fauxPrimaryText: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.white,
    },
    loadingBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.xl,
    },
    loadingText: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.textSecondary,
    },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
    },
    hintText: {
      fontSize: Typography.labelSmall,
      ...Font.semibold,
      color: Colors.primary,
    },
  });
