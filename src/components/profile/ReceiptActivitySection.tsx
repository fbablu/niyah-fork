import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Font,
  Spacing,
  Typography,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";

export interface ReceiptActivitySectionProps {
  /** Per-category blocked-app open counts ("social" → 3). Renders a quiet
   *  empty line when absent or all-zero — the component never fetches. */
  byCategory?: Record<string, number> | null;
}

// "App activity" block of the session receipt (comment 5): category rows
// sorted by open count, most-opened first.
export const ReceiptActivitySection: React.FC<ReceiptActivitySectionProps> = ({
  byCategory,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // Positive counts only, most-opened first (name breaks ties for stability).
  const categories = useMemo(
    () =>
      Object.entries(byCategory ?? {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [byCategory],
  );

  return (
    <View>
      <Text style={styles.sectionTitle}>App activity</Text>
      {categories.length > 0 ? (
        categories.map(([key, n], i) => (
          <View key={key} style={styles.row} testID={`receipt-category-${i}`}>
            <Text style={styles.rowLabel}>
              {key[0].toUpperCase() + key.slice(1)}
            </Text>
            <Text style={styles.rowValue}>
              opened {n} time{n === 1 ? "" : "s"}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyLine}>No app activity recorded.</Text>
      )}
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: Spacing.lg,
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    rowLabel: {
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
    },
    rowValue: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    emptyLine: {
      fontSize: Typography.bodySmall,
      color: Colors.textTertiary,
      paddingVertical: Spacing.md,
    },
  });
