import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import {
  Font,
  Radius,
  Typography,
  Spacing,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { BlobAvatarConfig } from "../../constants/blobAvatar";
import { getBlobBodyShape } from "../BlobAvatar";

export interface CalendarHeaderProps {
  monthLabel: string;
  streakCount: number;
  /** The streak ring traces the user's current chosen blob (comment 3): named
   *  presets use their fixed body path, "unique" regenerates from the
   *  shapeSeed. Plain outlined circle only when absent. */
  blobConfig?: BlobAvatarConfig;
  /** -1 = previous month, +1 = next month. Caller owns the haptic. */
  onShiftMonth: (delta: -1 | 1) => void;
}

const STREAK_BADGE_SIZE = 36;
// Stroke is authored in viewBox units and the presets use different coordinate
// spaces — scale by viewBox width so the rendered outline keeps the same
// ~2px weight whichever blob shape is traced.
const OUTLINE_STROKE_RATIO = 0.06;

// Month nav (chevrons + centered label) with the streak counter to its right.
export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  monthLabel,
  streakCount,
  blobConfig,
  onShiftMonth,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const blobShape = useMemo(
    () => (blobConfig ? getBlobBodyShape(blobConfig) : undefined),
    [blobConfig],
  );

  return (
    <View style={styles.headerRow}>
      <View style={styles.monthNav}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => onShiftMonth(-1)}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => onShiftMonth(1)}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
      </View>
      <View
        testID={blobShape ? "streak-blob-outline" : "streak-circle"}
        style={[styles.streakBadge, !blobShape && styles.streakCircle]}
        accessibilityLabel={`${streakCount} day streak`}
      >
        {blobShape ? (
          <Svg
            width={STREAK_BADGE_SIZE}
            height={STREAK_BADGE_SIZE}
            viewBox={blobShape.viewBox}
            style={StyleSheet.absoluteFill}
          >
            <Path
              testID="streak-blob-path"
              d={blobShape.bodyPath}
              stroke={Colors.text}
              strokeWidth={
                Number(blobShape.viewBox.split(" ")[2]) * OUTLINE_STROKE_RATIO
              }
              fill="none"
            />
          </Svg>
        ) : null}
        <Text style={styles.streakCount}>{streakCount}</Text>
      </View>
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    monthNav: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    monthLabel: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.text,
      textAlign: "center",
    },
    streakBadge: {
      width: STREAK_BADGE_SIZE,
      height: STREAK_BADGE_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    streakCircle: {
      borderRadius: Radius.full,
      borderWidth: 2,
      borderColor: Colors.text,
    },
    streakCount: {
      fontSize: Typography.labelLarge,
      ...Font.bold,
      color: Colors.text,
    },
  });
