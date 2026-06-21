import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { nearestRingIndex } from "./dialMath";

// Padded 0–9 ring: a duplicate of each digit sits 10 cells away, so a column
// can roll a short step across a carry (9→0) onto a duplicate, then re-home to
// the core on settle. Rest index for digit d is d + PAD; core 0–9 at PAD..PAD+9.
const PAD = 5;
const RING = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const CELLS = [
  ...RING.slice(RING.length - PAD),
  ...RING,
  ...RING.slice(0, PAD),
];

// Snappy, mostly-clean roll. A touch of overshoot for life; short enough that
// rapid drag changes settle between steps instead of fighting each other.
const ROLL_SPRING = { dampingRatio: 0.75, duration: 380 };

interface RollingNumberProps {
  /** Formatted string to display, e.g. "$12" or "3 people". */
  text: string;
  /** Clip-window height ≈ one line; each digit column rolls within it. */
  rowHeight: number;
  style?: StyleProp<TextStyle>;
}

interface DigitColumnProps {
  digit: number;
  rowHeight: number;
  /** When true, a freshly-mounted column rolls in from 0 (a new leading digit
   *  on a carry); false on the very first render so the value shows at rest. */
  animateIn: boolean;
  reducedMotion: boolean;
  textStyle?: StyleProp<TextStyle>;
}

// A 0–9 column that springs to its digit along the shortest ring path from its
// current position, then re-homes to the core cell on settle (prevents drift).
const DigitColumn: React.FC<DigitColumnProps> = ({
  digit,
  rowHeight,
  animateIn,
  reducedMotion,
  textStyle,
}) => {
  const idx = useSharedValue((animateIn ? 0 : digit) + PAD);
  const prevDigit = useRef(animateIn ? 0 : digit);
  useEffect(() => {
    const prev = prevDigit.current;
    prevDigit.current = digit;
    if (reducedMotion) {
      idx.value = digit + PAD;
      return;
    }
    if (prev === digit) return;
    const target = nearestRingIndex(digit, idx.value, PAD);
    idx.value = withSpring(target, ROLL_SPRING, (finished) => {
      "worklet";
      if (finished) idx.value = digit + PAD;
    });
  }, [digit, reducedMotion, idx]);
  const colStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -idx.value * rowHeight }],
  }));
  return (
    <View style={[styles.col, { height: rowHeight }]}>
      <Animated.View style={colStyle}>
        {CELLS.map((d, k) => (
          <Text
            key={k}
            style={[
              textStyle,
              styles.cell,
              { height: rowHeight, lineHeight: rowHeight },
            ]}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

/**
 * Robinhood-style number ticker. Each digit is its own 0–9 column, keyed by
 * place value (ones, tens…) so columns persist across digit-count changes
 * ($9↔$10) and only the carried place ticks; columns roll the shortest way.
 * A new leading digit rolls in from 0 so a carry reads "09→10", not "19→10".
 * Non-digit characters render static. Reduce Motion snaps each column. The
 * columns are hidden from VoiceOver — the Dial's adjustable parent conveys the
 * value. Assumes a single contiguous run of digits ("$X" / "N people").
 */
export const RollingNumber: React.FC<RollingNumberProps> = ({
  text,
  rowHeight,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const chars = text.split("");
  const isDigit = (c: string) => c >= "0" && c <= "9";
  return (
    <View
      style={[styles.row, { height: rowHeight }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {chars.map((ch, i) => {
        if (!isDigit(ch)) {
          return (
            <Text
              key={`s${i}`}
              style={[
                style,
                styles.cell,
                { height: rowHeight, lineHeight: rowHeight },
              ]}
            >
              {ch}
            </Text>
          );
        }
        let place = 0;
        for (let j = i + 1; j < chars.length && isDigit(chars[j]); j += 1)
          place += 1;
        return (
          <DigitColumn
            key={`d${place}`}
            digit={Number(ch)}
            rowHeight={rowHeight}
            animateIn={mounted.current}
            reducedMotion={reducedMotion}
            textStyle={style}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", overflow: "hidden", alignItems: "center" },
  col: { overflow: "hidden" },
  cell: { textAlign: "center", fontVariant: ["tabular-nums"] },
});
