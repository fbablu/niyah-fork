import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import { useScheduleStore } from "../../src/store/scheduleStore";
import {
  SCHEDULE_PRESETS,
  CUSTOM_TEMPLATE_DEFAULT,
  DAY_LABELS,
  formatWindow,
  formatDays,
} from "../../src/constants/scheduleTemplates";
import type { ScheduledTemplate, Weekday } from "../../src/types";
import {
  SCHEDULED_STAKE_ENABLED,
  SCHEDULED_STAKE_DEFAULT_CENTS,
} from "../../src/constants/config";
import { formatMoney } from "../../src/utils/format";

// Phase 1: recurring FREE blocks that auto-start (OS-enforced) at the set time.
// Per-template staking (Phase 2) + weekday-specific native enforcement are
// tracked in docs/schedule-templates-plan-2026-06-03.md. Visual polish: Fardeen.

export default function ScheduleScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();

  const templates = useScheduleStore((s) => s.templates);
  const addPreset = useScheduleStore((s) => s.addPreset);
  const updateTemplate = useScheduleStore((s) => s.updateTemplate);
  const removeTemplate = useScheduleStore((s) => s.removeTemplate);
  const setEnabled = useScheduleStore((s) => s.setEnabled);
  const updateStake = useScheduleStore((s) => s.updateStake);
  const syncNative = useScheduleStore((s) => s.syncNative);

  // Re-arm OS schedules whenever the tab mounts (covers cold start).
  useEffect(() => {
    syncNative();
  }, [syncNative]);

  const toggleDay = (t: ScheduledTemplate, day: Weekday) => {
    Haptics.selectionAsync();
    const has = t.days.includes(day);
    const days = (
      has ? t.days.filter((d) => d !== day) : [...t.days, day]
    ).sort((a, b) => a - b) as Weekday[];
    updateTemplate(t.id, { days });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>
          Recurring focus blocks that turn on automatically at the time you set.
        </Text>

        {/* Active templates */}
        {templates.length > 0 && (
          <View style={styles.section}>
            {templates.map((t) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardName}>{t.name}</Text>
                    <Text style={styles.cardMeta}>
                      {formatDays(t.days)} · {formatWindow(t)}
                    </Text>
                  </View>
                  <Switch
                    value={t.enabled}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      setEnabled(t.id, v);
                    }}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                  />
                </View>

                {/* Inline day editor */}
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((label, i) => {
                    const day = i as Weekday;
                    const on = t.days.includes(day);
                    return (
                      <Pressable
                        key={i}
                        onPress={() => toggleDay(t, day)}
                        style={[styles.dayChip, on && styles.dayChipOn]}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            on && styles.dayChipTextOn,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Per-template stake toggle (Schedule Phase 2). Display-only:
                    flips the stored stakeCents so the server can auto-stake at
                    the block start once the CF + native trigger ship. No yield
                    framing — you stake, finish, and get it back. */}
                {SCHEDULED_STAKE_ENABLED && (
                  <View style={styles.stakeRow}>
                    <View style={styles.stakeText}>
                      <Text style={styles.stakeTitle}>
                        {t.stakeCents > 0
                          ? `Stake ${formatMoney(t.stakeCents)} on this block`
                          : "Stake on this block"}
                      </Text>
                      <Text style={styles.stakeHint}>
                        {t.stakeCents > 0
                          ? "Finish the block → get it back · daily cap applies"
                          : "Put money on it — finish → get it back"}
                      </Text>
                    </View>
                    <Switch
                      value={t.stakeCents > 0}
                      onValueChange={(v) => {
                        Haptics.selectionAsync();
                        updateStake(
                          t.id,
                          v ? SCHEDULED_STAKE_DEFAULT_CENTS : 0,
                        );
                      }}
                      trackColor={{
                        true: Colors.primary,
                        false: Colors.border,
                      }}
                    />
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    removeTemplate(t.id);
                  }}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Add from a preset */}
        <Text style={styles.sectionLabel}>
          {templates.length > 0 ? "Add another" : "Start with a template"}
        </Text>
        <View style={styles.presetGrid}>
          {SCHEDULE_PRESETS.map((preset) => (
            <Pressable
              key={preset.key}
              onPress={() => {
                const added = addPreset(preset);
                if (!added) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Warning,
                  );
                  Alert.alert(
                    "Overlaps a block",
                    "That overlaps a schedule you already have on the same day. Remove or edit the other one first.",
                  );
                  return;
                }
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }}
              style={styles.presetCard}
            >
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetMeta}>{formatDays(preset.days)}</Text>
              <Text style={styles.presetMeta}>{formatWindow(preset)}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              const added = addPreset(CUSTOM_TEMPLATE_DEFAULT);
              if (!added) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
                Alert.alert(
                  "Overlaps a block",
                  "That overlaps a schedule you already have on the same day. Remove or edit the other one first.",
                );
                return;
              }
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            }}
            style={[styles.presetCard, styles.customCard]}
          >
            <Text style={styles.presetName}>Custom</Text>
            <Text style={styles.presetMeta}>Pick your own days</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Blocks turn on by themselves at the start time and lift at the end —
          no need to open Niyah.
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    title: {
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.text,
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      lineHeight: Typography.bodyMedium * 1.4,
    },
    section: {
      gap: Spacing.md,
    },
    sectionLabel: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
      marginTop: Spacing.md,
    },
    card: {
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardHeaderText: {
      flex: 1,
      gap: 2,
    },
    cardName: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.text,
    },
    cardMeta: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
    },
    dayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    dayChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.backgroundTertiary,
    },
    dayChipOn: {
      backgroundColor: Colors.primary,
    },
    dayChipText: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.textSecondary,
    },
    dayChipTextOn: {
      color: Colors.background,
    },
    stakeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      paddingTop: Spacing.md,
    },
    stakeText: {
      flex: 1,
      gap: 2,
    },
    stakeTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    stakeHint: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
    },
    deleteBtn: {
      alignSelf: "flex-start",
    },
    deleteText: {
      fontSize: Typography.bodySmall,
      ...Font.medium,
      color: Colors.loss,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.md,
    },
    presetCard: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: 2,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    customCard: {
      borderStyle: "dashed",
    },
    presetName: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.text,
    },
    presetMeta: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
    },
    footnote: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
      textAlign: "center",
      marginTop: Spacing.lg,
      lineHeight: Typography.labelSmall * 1.5,
    },
  });
