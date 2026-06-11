import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";

interface CloutWeightRowProps {
  rowKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  points: number;
  maxPoints: number;
}

// One earning rule inside CloutInfoSheet: icon + label + "+N pts" chip +
// a mini bar sized proportionally to the rule's weight.
export function CloutWeightRow({
  rowKey,
  icon,
  label,
  points,
  maxPoints,
}: CloutWeightRowProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={Colors.primary} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowLabel}>{label}</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>+{points} pts</Text>
          </View>
        </View>
        <View style={styles.miniTrack}>
          <View
            testID={`clout-weight-fill-${rowKey}`}
            style={[
              styles.miniFill,
              { width: `${(points / maxPoints) * 100}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    rowBody: { flex: 1 },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.xs,
    },
    rowLabel: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.text,
    },
    chip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Colors.primaryMuted,
    },
    chipText: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.primaryLight,
    },
    miniTrack: {
      height: Spacing.xs,
      backgroundColor: Colors.backgroundTertiary,
      borderRadius: Radius.full,
      overflow: "hidden",
    },
    miniFill: {
      height: "100%",
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
    },
  });
