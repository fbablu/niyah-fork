import React, { useMemo, useState } from "react";
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
import {
  isScreenTimeAvailable,
  listSelectionTemplates,
  applySelectionTemplate,
  deleteSelectionTemplate,
  saveSelectionTemplate,
} from "../../config/screentime";
import type {
  AppSelectionToken,
  SelectionTemplate,
} from "../../../modules/niyah-screentime";

// Named block-list templates: tap to apply a saved selection (write-through
// to the active one), long-press to delete, "+ Save" snapshots the CURRENT
// selection under a name. Editing the selection itself stays on the existing
// "Apps to block" card — these chips only swap between saved lists.

interface BlockTemplateChipsProps {
  /** Called after a template is applied so the parent refreshes its state. */
  onApplied: (selection: AppSelectionToken | null) => void;
  /** Whether the current selection is non-empty (enables the Save chip). */
  canSaveCurrent: boolean;
}

export const BlockTemplateChips: React.FC<BlockTemplateChipsProps> = ({
  onApplied,
  canSaveCurrent,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [templates, setTemplates] = useState<SelectionTemplate[]>(
    listSelectionTemplates,
  );

  if (!isScreenTimeAvailable) return null;
  if (templates.length === 0 && !canSaveCurrent) return null;

  const refresh = () => setTemplates(listSelectionTemplates());

  const handleApply = async (t: SelectionTemplate) => {
    const applied = await applySelectionTemplate(t.name);
    if (!applied) {
      refresh(); // template vanished (cleared elsewhere) — drop the chip
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onApplied(applied);
  };

  const handleDelete = (t: SelectionTemplate) => {
    Alert.alert(
      `Delete "${t.name}"?`,
      "The saved app list goes away. Your current selection stays as-is.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSelectionTemplate(t.name).then(refresh);
          },
        },
      ],
    );
  };

  const handleSave = () => {
    // iOS-only API — fine, the whole Screen Time feature is iOS-only.
    Alert.prompt(
      "Save as template",
      "Name this block list so you can re-apply it with one tap.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (name?: string) => {
            if (!name?.trim()) return;
            saveSelectionTemplate(name.trim())
              .then(() => {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                refresh();
              })
              .catch((err: Error) => Alert.alert("Couldn't save", err.message));
          },
        },
      ],
      "plain-text",
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Templates</Text>
      <View style={styles.row}>
        {templates.map((t) => (
          <Pressable
            key={t.slug}
            onPress={() => handleApply(t)}
            onLongPress={() => handleDelete(t)}
            style={styles.chip}
            accessibilityLabel={`Apply template ${t.name}`}
          >
            <Text style={styles.chipText}>{t.name}</Text>
          </Pressable>
        ))}
        {canSaveCurrent && (
          <Pressable
            onPress={handleSave}
            style={[styles.chip, styles.saveChip]}
            accessibilityLabel="Save current selection as template"
          >
            <Text style={styles.saveChipText}>+ Save</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      fontSize: Typography.labelSmall,
      ...Font.semibold,
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    chipText: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.text,
    },
    saveChip: {
      borderStyle: "dashed",
      backgroundColor: "transparent",
    },
    saveChipText: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.primaryLight,
    },
  });
