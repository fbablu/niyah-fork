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
import { SafeAreaView } from "react-native-safe-area-context";
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
  findEnabledConflict,
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

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

export default function ScheduleScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

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
    <SafeAreaView style={styles.container} edges={["top"]}>
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
                      const ok = setEnabled(t.id, v);
                      if (!ok && v) {
                        const conflict = findEnabledConflict(
                          templates,
                          t,
                          t.id,
                        );
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Warning,
                        );
                        Alert.alert(
                          "Overlaps a block",
                          `"${t.name}" overlaps "${conflict?.name ?? "another block"}" — turn that one off first.`,
                        );
                        return;
                      }
                      Haptics.selectionAsync();
                    }}
                    // ON keeps the primary brand track; OFF was Colors.border
                    // (theme-dependent: invisible brown on dark / cream leak on
                    // light against the green glass card) → theme-stable dark
                    // glass. iOS paints the off track via ios_backgroundColor.
                    trackColor={{
                      true: Colors.primary,
                      false: Colors.glassDark,
                    }}
                    ios_backgroundColor={Colors.glassDark}
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
                        false: Colors.glassDark,
                      }}
                      ios_backgroundColor={Colors.glassDark}
                    />
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    // Destructive confirm — one accidental tap shouldn't
                    // delete a schedule (Opal-style friction, build-21 ask).
                    Alert.alert(
                      `Remove ${t.name}?`,
                      "This stops the scheduled block. You can add it back anytime.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Medium,
                            );
                            removeTemplate(t.id);
                          },
                        },
                      ],
                    );
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
          {SCHEDULE_PRESETS.map((preset) => {
            // Live disabled state instead of alert-after-tap: a preset that
            // overlaps an ENABLED block dims and says which one.
            const conflict = findEnabledConflict(templates, preset);
            return (
              <Pressable
                key={preset.key}
                disabled={!!conflict}
                onPress={() => {
                  const added = addPreset(preset);
                  if (!added) {
                    // Safety net — should be unreachable with the card disabled
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning,
                    );
                    return;
                  }
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                }}
                style={[styles.presetCard, conflict && styles.presetCardOff]}
              >
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetMeta}>{formatDays(preset.days)}</Text>
                <Text style={styles.presetMeta}>{formatWindow(preset)}</Text>
                {conflict && (
                  <Text style={styles.presetConflict}>
                    Overlaps {conflict.name}
                  </Text>
                )}
              </Pressable>
            );
          })}
          {(() => {
            const customConflict = findEnabledConflict(
              templates,
              CUSTOM_TEMPLATE_DEFAULT,
            );
            return (
              <Pressable
                disabled={!!customConflict}
                onPress={() => {
                  const added = addPreset(CUSTOM_TEMPLATE_DEFAULT);
                  if (!added) {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning,
                    );
                    return;
                  }
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                }}
                style={[
                  styles.presetCard,
                  styles.customCard,
                  customConflict && styles.presetCardOff,
                ]}
              >
                <Text style={styles.presetName}>Custom</Text>
                <Text style={styles.presetMeta}>Pick your own days</Text>
                {customConflict && (
                  <Text style={styles.presetConflict}>
                    Overlaps {customConflict.name}
                  </Text>
                )}
              </Pressable>
            );
          })()}
        </View>

        <Text style={styles.footnote}>
          Blocks turn on by themselves at the start time and lift at the end —
          no need to open Niyah.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Full-bleed GREEN brand screen (mirrors profile.tsx / index.tsx, v2 node
// 429:186): primaryDark field, no shared horizontal padding — each section
// owns its proportional width (~92.5%, centered).
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
    },
    content: {
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    title: {
      width: "92.5%",
      alignSelf: "center",
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.white,
    },
    subtitle: {
      width: "92.5%",
      alignSelf: "center",
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      marginBottom: Spacing.sm,
      lineHeight: Typography.bodyMedium * 1.4,
    },
    section: {
      width: "92.5%",
      alignSelf: "center",
      gap: Spacing.md,
    },
    sectionLabel: {
      width: "92.5%",
      alignSelf: "center",
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginTop: Spacing.md,
    },
    // Template card = glass seat (glassLight, Radius.xl, borderless), like the
    // dashboard balance/CTA cards.
    card: {
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
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
      color: Colors.white,
    },
    cardMeta: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
    },
    dayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    // Selected day flips to the white circle / primaryDark text treatment
    // (the profile streak badge + dashboard done-step pattern); unselected
    // sits in a dark-glass circle.
    dayChip: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.glassDark,
    },
    dayChipOn: {
      backgroundColor: Colors.white,
    },
    dayChipText: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: WHITE_70,
    },
    dayChipTextOn: {
      color: Colors.primaryDark,
    },
    stakeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: WHITE_25,
      paddingTop: Spacing.md,
    },
    stakeText: {
      flex: 1,
      gap: 2,
    },
    stakeTitle: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.white,
    },
    stakeHint: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
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
      width: "92.5%",
      alignSelf: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.md,
    },
    // Add affordances = Colors.primary brand surfaces with the white@0.25
    // border (the dashboard active-session treatment), distinct from the
    // glass seats of blocks you already own.
    presetCard: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: Colors.primary,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: 2,
      borderWidth: 1,
      borderColor: WHITE_25,
    },
    presetCardOff: {
      opacity: 0.5,
    },
    // White, not Colors.loss: the clay red is illegible on the primary fill,
    // and the 0.5 card dim already carries the disabled state.
    presetConflict: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.white,
      marginTop: Spacing.xs,
    },
    customCard: {
      borderStyle: "dashed",
    },
    presetName: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.white,
    },
    presetMeta: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
    },
    footnote: {
      width: "92.5%",
      alignSelf: "center",
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      textAlign: "center",
      marginTop: Spacing.lg,
      lineHeight: Typography.labelSmall * 1.5,
    },
  });
