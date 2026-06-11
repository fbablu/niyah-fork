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
import { Card } from "../Card";
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

  return (
    <Card style={styles.card}>
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
              color={Colors.textSecondary}
            />
          </Pressable>
        </View>
        <Text style={styles.score}>{Math.round(score)}</Text>
      </View>

      <View style={styles.track}>
        <View
          testID="clout-progress-fill"
          style={[styles.fill, { width: `${progress * 100}%` }]}
        />
      </View>

      <Text style={styles.tierLabel}>{tier.label}</Text>
    </Card>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.primaryMuted,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.sm,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    label: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
    },
    score: {
      fontSize: Typography.headlineSmall,
      ...Font.bold,
      color: Colors.text,
    },
    track: {
      height: Spacing.sm,
      backgroundColor: Colors.backgroundTertiary,
      borderRadius: Radius.full,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
    },
    tierLabel: {
      fontSize: Typography.labelMedium,
      ...Font.medium,
      color: Colors.textSecondary,
      marginTop: Spacing.xs,
    },
  });
