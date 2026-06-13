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
  /** The streak badge is a white-filled silhouette of the user's current
   *  chosen blob — preset or seeded "unique" (comment 3). Plain white
   *  circle only when absent. */
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

  // One stamp per day (latest wins).
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarStamp>();
    for (const s of stamps) {
      const cur = map.get(s.dateKey);
      if (!cur || s.completedAt > cur.completedAt) map.set(s.dateKey, s);
    }
    return map;
  }, [stamps]);

  const shiftMonth = (delta: -1 | 1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayed(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  };

  const cells = buildMonthCells(year, month);

  return (
    <View style={styles.container}>
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

// Green calendar (v2, node 429:186): primary grid, 1px WHITE cell borders
// (hairline reads too thin against the render), bold white numerals pinned
// top-right inside the cell's inset inner box. Grid ≈ 70.4% of screen width,
// centered, perfectly square cells via aspectRatio.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: "70.4%",
      alignSelf: "center",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: Colors.primary,
    },
    weekdayCell: {
      width: `${100 / 7}%`,
      alignItems: "center",
      paddingVertical: Spacing.xs,
      borderWidth: 1,
      borderColor: Colors.white,
    },
    weekdayText: {
      fontSize: Typography.bodySmall,
      ...Font.bold,
      color: Colors.white,
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: Colors.white,
    },
    dayNumber: {
      position: "absolute",
      top: Spacing.xs,
      right: Spacing.xs,
      fontSize: Typography.labelSmall,
      ...Font.bold,
      color: Colors.white,
    },
  });
