import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Font,
  Radius,
  Spacing,
  Typography,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { formatDate, formatMoney } from "../../utils/format";
import { CalendarStampBlob } from "./CalendarStampBlob";
import { ReceiptActivitySection } from "./ReceiptActivitySection";
import type { CalendarStamp } from "./SessionCalendar";

export interface SessionReceiptSheetProps {
  visible: boolean;
  onClose: () => void;
  stamp: CalendarStamp | null;
  /** Per-category blocked-app open counts for this session, when the caller
   *  has them (only the most recent session's tallies exist on-device today). */
  byCategory?: Record<string, number> | null;
}

// Session-receipt sheet (comment 5): a stamped calendar day opens into the
// session's receipt — date, kind, stake, status, then app usage by category.
export function SessionReceiptSheet({
  visible,
  onClose,
  stamp,
  byCategory,
}: SessionReceiptSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const detailRows = stamp
    ? [
        { label: "Date", value: formatDate(stamp.completedAt) },
        {
          label: "Session",
          value: stamp.kind === "group" ? "With friends" : "Solo focus",
        },
        {
          label: "Stake",
          value:
            stamp.stakeCents > 0 ? formatMoney(stamp.stakeCents) : "No stake",
        },
      ]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.grabBar} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Session receipt</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>
        {stamp && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.blobZone}>
              <CalendarStampBlob sessionId={stamp.sessionId} size={56} />
            </View>
            {detailRows.map((r) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue}>{r.value}</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <View style={styles.statusValue}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Colors.gain}
                />
                <Text style={styles.statusText}>Completed</Text>
              </View>
            </View>
            <ReceiptActivitySection byCategory={byCategory} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    grabBar: {
      alignSelf: "center",
      width: Spacing.xl,
      height: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Colors.backgroundTertiary,
      marginTop: Spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    title: {
      fontSize: Typography.titleMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    blobZone: {
      alignItems: "center",
      paddingVertical: Spacing.lg,
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
    statusValue: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    statusText: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.gain,
    },
  });
