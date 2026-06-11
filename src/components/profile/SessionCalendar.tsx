import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  Font,
  Spacing,
  Typography,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { BlobAvatarConfig } from "../../constants/blobAvatar";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarStampBlob } from "./CalendarStampBlob";

export interface CalendarStamp {
  dateKey: string /* YYYY-MM-DD local */;
  sessionId: string;
  kind: "solo" | "group";
  stakeCents: number;
  completedAt: Date;
  /** Per-category blocked-attempt counts captured into history at session end
   *  (receipt display, design comment 5). null for sessions completed before
   *  capture landed — the receipt then falls back to the latest on-device
   *  tallies. */
  byCategory?: Record<string, number> | null;
}

export interface SessionCalendarProps {
  stamps: CalendarStamp[];
  streakCount: number;
  /** The streak ring traces the user's current chosen blob — preset or
   *  seeded "unique" (comment 3). Plain outlined circle only when absent. */
  blobConfig?: BlobAvatarConfig;
  onStampPress: (s: CalendarStamp) => void;
  /** Month shown on mount (defaults to the device's current month). Read once. */
  initialMonth?: Date;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const STAMP_SIZE = 28;

const toDateKey = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Day-of-month per cell (null = leading/trailing blank), Sunday-first weeks. */
const buildMonthCells = (y: number, m: number): (number | null)[] => {
  const cells: (number | null)[] = Array(new Date(y, m, 1).getDay()).fill(null);
  const days = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export const SessionCalendar: React.FC<SessionCalendarProps> = ({
  stamps,
  streakCount,
  blobConfig,
  onStampPress,
  initialMonth,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [displayed, setDisplayed] = useState(() => {
    const d = initialMonth ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = displayed.getFullYear();
  const month = displayed.getMonth();

  const monthLabel = useMemo(() => {
    const name = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
      displayed,
    );
    return year === new Date().getFullYear() ? name : `${name} ${year}`;
  }, [displayed, year]);

  // One stamp per day (latest wins); entrance stagger follows completion
  // order; only the most recent collectible idles with a blink.
  const { byDay, order, latestId } = useMemo(() => {
    const byDay = new Map<string, CalendarStamp>();
    for (const s of stamps) {
      const cur = byDay.get(s.dateKey);
      if (!cur || s.completedAt > cur.completedAt) byDay.set(s.dateKey, s);
    }
    const sorted = [...byDay.values()].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
    );
    return {
      byDay,
      order: new Map(sorted.map((s, i) => [s.sessionId, i])),
      latestId: sorted[sorted.length - 1]?.sessionId,
    };
  }, [stamps]);

  const shiftMonth = (delta: -1 | 1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayed(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  };

  const cells = buildMonthCells(year, month);

  return (
    <View>
      <CalendarHeader
        monthLabel={monthLabel}
        streakCount={streakCount}
        blobConfig={blobConfig}
        onShiftMonth={shiftMonth}
      />
      <View style={styles.grid}>
        {WEEKDAYS.map((d, i) => (
          <View key={`wd-${i}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{d}</Text>
          </View>
        ))}
        {cells.map((day, i) => {
          const key = day == null ? null : toDateKey(year, month, day);
          const stamp = key ? byDay.get(key) : undefined;
          const inner = (
            <>
              {day != null && <Text style={styles.dayNumber}>{day}</Text>}
              {stamp && key && (
                <CalendarStampBlob
                  sessionId={stamp.sessionId}
                  size={STAMP_SIZE}
                  index={order.get(stamp.sessionId) ?? 0}
                  blink={stamp.sessionId === latestId}
                  testID={`calendar-stamp-${key}`}
                />
              )}
            </>
          );
          return stamp ? (
            <Pressable
              key={i}
              testID={`calendar-cell-${i}`}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={`Completed session on ${key}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onStampPress(stamp);
              }}
            >
              {inner}
            </Pressable>
          ) : (
            <View key={i} testID={`calendar-cell-${i}`} style={styles.cell}>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    weekdayCell: {
      width: `${100 / 7}%`,
      alignItems: "center",
      paddingVertical: Spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    weekdayText: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.textSecondary,
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    dayNumber: {
      position: "absolute",
      top: Spacing.xs,
      right: Spacing.xs,
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.textSecondary,
    },
  });
