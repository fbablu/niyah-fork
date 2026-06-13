import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { getCloutProgress, getCloutTier } from "../../utils/clout";

interface CloutCardProps {
  score: number;
  onInfoPress: () => void;
}

// Clout row (replaces "Social Credit"): score + progress toward the next tier.
// Tapping (i) opens CloutInfoSheet. Scoring lives in src/utils/clout.ts.
export function CloutCard({ score, onInfoPress }: CloutCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const tier = getCloutTier(score);
  const progress = Math.min(Math.max(getCloutProgress(score), 0), 1);

  const handleInfoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInfoPress();
  };

  // No card surface in v2 (node 429:186): a bare glass track on the green
  // screen with the "Clout" label underneath it.
  return (
    <View style={styles.section}>
      <View style={styles.track}>
        <View
          testID="clout-progress-fill"
          style={[styles.fill, { width: `${progress * 100}%` }]}
        />
      </View>

      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Clout</Text>
          <Pressable
            onPress={handleInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="About Clout"
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={Colors.white}
            />
          </Pressable>
        </View>
        <Text style={styles.score}>{Math.round(score)}</Text>
      </View>

      <Text style={styles.tierLabel}>{tier.label}</Text>
    </View>
  );
}

// Proportional to the 402 frame: clout bar ≈ 75% of screen width, centered.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      width: "75%",
      alignSelf: "center",
      marginBottom: Spacing.xl,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: Spacing.sm,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    label: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
    },
    score: {
      fontSize: Typography.titleSmall,
      ...Font.bold,
      color: Colors.white,
    },
    // Design value: 11px tall, radius 22 → Radius.xl (per-task exact values).
    track: {
      height: 11,
      backgroundColor: Colors.glassSolid,
      borderRadius: Radius.xl,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      backgroundColor: Colors.white,
      borderRadius: Radius.xl,
    },
    tierLabel: {
      fontSize: Typography.labelMedium,
      ...Font.medium,
      color: Colors.white,
      opacity: 0.7,
      marginTop: Spacing.xs,
    },
  });
