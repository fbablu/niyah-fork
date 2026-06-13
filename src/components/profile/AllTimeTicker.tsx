import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Font,
  Spacing,
  Typography,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { AllTimeDelta } from "../../utils/balanceDelta";

export interface AllTimeTickerProps {
  /** Non-null delta from deriveAllTimeDelta — parent omits the ticker when null. */
  delta: AllTimeDelta;
}

/** Stock-ticker style all-time up/down row: caret + signed % + "all-time". */
export function AllTimeTicker({ delta }: AllTimeTickerProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const up = delta.direction === "up";
  const color = up ? Colors.gain : Colors.loss;

  return (
    <View style={styles.row}>
      <Ionicons name={up ? "caret-up" : "caret-down"} size={14} color={color} />
      <Text style={[styles.pct, { color }]}>
        {`${up ? "+" : "-"}${Math.abs(delta.pct * 100).toFixed(1)}%`}
      </Text>
      <Text style={styles.label}>all-time</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    pct: {
      fontSize: Typography.labelLarge,
      ...Font.semibold,
      fontVariant: ["tabular-nums"],
    },
    // Sits directly on the green screen — white at reduced opacity, not a
    // theme text token (the profile tab is theme-stable by design).
    label: {
      fontSize: Typography.labelMedium,
      color: Colors.white,
      opacity: 0.7,
    },
  });
