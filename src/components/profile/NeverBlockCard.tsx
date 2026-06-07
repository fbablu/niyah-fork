import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { Card } from "../Card";
import {
  isScreenTimeAvailable,
  getScreenTimeAuthStatus,
  presentNeverBlockPicker,
  getNeverBlockSummary,
  clearNeverBlockSelection,
} from "../../config/screentime";
import { useFeatureFlagsStore } from "../../store/featureFlagsStore";
import type { AppSelectionToken } from "../../../modules/niyah-screentime";

// Apps that stay AVAILABLE during every block (music, maps, …). Subtracted
// from the shield natively at apply time. UI is gated by the neverBlockEnabled
// server flag since it sits in the staked shield-apply path.

export function NeverBlockCard() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const enabled = useFeatureFlagsStore((s) => s.flags.neverBlockEnabled);

  const [summary, setSummary] = useState<AppSelectionToken | null>(null);

  const refresh = useCallback(() => {
    setSummary(getNeverBlockSummary());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (
    !enabled ||
    !isScreenTimeAvailable ||
    getScreenTimeAuthStatus() !== "approved"
  ) {
    return null;
  }

  const handlePick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await presentNeverBlockPicker();
      refresh();
    } catch {
      // User cancelled the picker — keep prior list.
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Clear never-block list?",
      "These apps will be blockable again in future sessions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearNeverBlockSelection().then(refresh);
          },
        },
      ],
    );
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Never block</Text>
      <Text style={styles.description}>
        Apps that stay available during every block — music, maps, whatever you
        actually need.
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handlePick}>
          <Text style={styles.buttonText}>
            {summary ? "Change Apps" : "Choose Apps"}
          </Text>
        </Pressable>
        {summary && (
          <>
            <Text style={styles.summaryText}>{summary.label}</Text>
            <Pressable onPress={handleClear} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </>
        )}
      </View>
    </Card>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.backgroundCard,
    },
    title: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    description: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      marginBottom: Spacing.md,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flexWrap: "wrap",
    },
    button: {
      backgroundColor: Colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      minHeight: 36,
      justifyContent: "center",
    },
    buttonText: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    summaryText: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
      flexShrink: 1,
    },
    clearText: {
      fontSize: Typography.labelMedium,
      ...Font.medium,
      color: Colors.loss,
    },
  });
