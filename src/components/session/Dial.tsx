import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Font, Spacing, Typography } from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import {
  clampPosition,
  indexOfValue,
  maxIndexForCap,
  positionForOffset,
  snapIndex,
} from "./dialMath";

// Reusable haptic dial — a horizontal tick-strip the user drags; it snaps to a
// detent on release. Drives the staking wizard's people (1–5) and dollar
// ($2–$25) steps. Motion is near-static per the house spec: a 250ms ease-out
// settle, no springs/overshoot; Reduce Motion jumps straight to the detent.

const TICK_SPACING = 26;
const TICK_W = 2;
const TICK_H_MAJOR = 30;
const TICK_H_MINOR = 16;
const STRIP_H = 40;
const SETTLE_MS = 250;
const WHITE_70 = "rgba(255, 255, 255, 0.7)";

interface DialProps {
  /** Detent values in ascending order (people: 1–5; dollars in cents: 200–2500). */
  values: number[];
  value: number;
  onChange: (value: number) => void;
  /** Renders the center readout, e.g. `(n) => "3 people"` or `(c) => "$12"`. */
  format: (value: number) => string;
  label: string;
  accessibilityLabel: string;
  /** Max selectable VALUE (balance / daily cap): detents above render dimmed + un-draggable. */
  disabledAbove?: number;
  /** Optional readout subline, e.g. "Everyone stakes their own" in group mode. */
  subline?: string;
}

export const Dial: React.FC<DialProps> = ({
  values,
  value,
  onChange,
  format,
  label,
  accessibilityLabel,
  disabledAbove,
  subline,
}) => {
  const Colors = useColors();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const count = values.length;
  const maxIndex = maxIndexForCap(values, disabledAbove);
  const selectedIndex = clampPosition(indexOfValue(values, value), count, maxIndex);
  // The readout / a11y / parent always reflect a REAL detent — never a raw prop
  // that is off-ladder or above the cap. The settle effect reconciles `value`
  // down to this so `disabledAbove` actually constrains the staked amount.
  const snappedValue = count > 0 ? values[selectedIndex] : value;

  const pos = useSharedValue(selectedIndex);
  const baseIndex = useSharedValue(selectedIndex);
  const draggingRef = useRef(false);
  const lastEmittedRef = useRef(selectedIndex);

  // Latest props for the stable gesture callbacks, so the gesture is never
  // rebuilt (and dropped) by a re-render mid-drag.
  const valuesRef = useRef(values);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valuesRef.current = values;
  valueRef.current = value;
  onChangeRef.current = onChange;

  const emit = useCallback((idx: number) => {
    const next = valuesRef.current[idx];
    if (next === undefined) return;
    if (next !== valueRef.current) onChangeRef.current(next);
  }, []);

  const onCross = useCallback(
    (idx: number) => {
      if (idx === lastEmittedRef.current) return;
      lastEmittedRef.current = idx;
      Haptics.selectionAsync();
      emit(idx);
    },
    [emit],
  );

  const onSettle = useCallback(
    (idx: number) => {
      draggingRef.current = false;
      lastEmittedRef.current = idx;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      emit(idx);
    },
    [emit],
  );

  const startDrag = useCallback(() => {
    draggingRef.current = true;
  }, []);

  // External value changes (e.g. a balance clamp) settle the strip — but never
  // while the finger is down (that would fight the drag).
  useEffect(() => {
    if (draggingRef.current) return;
    lastEmittedRef.current = selectedIndex;
    if (reducedMotion) {
      pos.value = selectedIndex;
    } else {
      pos.value = withTiming(selectedIndex, {
        duration: SETTLE_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
    // Reconcile a clamped / off-ladder prop to the snapped detent so the parent
    // (and the staked amount) can never exceed the cap or disagree with the
    // readout. No-ops when `value` already sits on the snapped detent.
    emit(selectedIndex);
  }, [selectedIndex, reducedMotion, pos, emit]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .onBegin(() => {
          baseIndex.value = pos.value;
          runOnJS(startDrag)();
        })
        .onUpdate((e) => {
          const p = clampPosition(
            positionForOffset(baseIndex.value, e.translationX, TICK_SPACING),
            count,
            maxIndex,
          );
          pos.value = p;
          runOnJS(onCross)(snapIndex(p, count, maxIndex));
        })
        .onEnd(() => {
          const idx = snapIndex(pos.value, count, maxIndex);
          pos.value = reducedMotion
            ? idx
            : withTiming(idx, {
                duration: SETTLE_MS,
                easing: Easing.out(Easing.cubic),
              });
          runOnJS(onSettle)(idx);
        }),
    [count, maxIndex, reducedMotion, onCross, onSettle, startDrag, pos, baseIndex],
  );

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const dir =
        e.nativeEvent.actionName === "increment"
          ? 1
          : e.nativeEvent.actionName === "decrement"
            ? -1
            : 0;
      if (!dir) return;
      const idx = Math.round(clampPosition(selectedIndex + dir, count, maxIndex));
      if (idx === selectedIndex) return;
      Haptics.selectionAsync();
      emit(idx);
    },
    [selectedIndex, count, maxIndex, emit],
  );

  const stripStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: trackWidth / 2 - TICK_SPACING / 2 - pos.value * TICK_SPACING },
      ],
    }),
    [trackWidth],
  );

  if (count === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: WHITE_70 }]}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{
            min: values[0],
            max: values[count - 1],
            now: snappedValue,
            text: format(snappedValue),
          }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={onAccessibilityAction}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          style={styles.track}
        >
          <Text style={[styles.readout, { color: Colors.white }]}>
            {format(snappedValue)}
          </Text>
          {subline ? (
            <Text style={[styles.subline, { color: WHITE_70 }]}>{subline}</Text>
          ) : null}
          <View style={styles.stripClip} pointerEvents="none">
            <Animated.View style={[styles.strip, stripStyle]}>
              {values.map((v, i) => {
                const dimmed = disabledAbove != null && v > disabledAbove;
                return (
                  <View key={v} style={styles.tickCell}>
                    <View
                      style={[
                        styles.tick,
                        {
                          backgroundColor: Colors.white,
                          height: i === selectedIndex ? TICK_H_MAJOR : TICK_H_MINOR,
                          opacity: dimmed ? 0.25 : i === selectedIndex ? 1 : 0.45,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </Animated.View>
          </View>
          <View style={styles.pointerWrap} pointerEvents="none">
            <View style={[styles.pointer, { backgroundColor: Colors.white }]} />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center" },
  label: {
    ...Font.medium,
    fontSize: Typography.labelLarge,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  track: {
    width: "100%",
    minHeight: 150,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Spacing.lg,
    overflow: "hidden",
  },
  readout: { ...Font.heavy, fontSize: Typography.displayMedium },
  subline: {
    ...Font.regular,
    fontSize: Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  stripClip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    height: STRIP_H,
    overflow: "hidden",
  },
  strip: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: STRIP_H,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  tickCell: {
    width: TICK_SPACING,
    height: STRIP_H,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tick: { width: TICK_W, borderRadius: TICK_W / 2 },
  pointerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    height: TICK_H_MAJOR + 8,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pointer: { width: 3, height: TICK_H_MAJOR + 8, borderRadius: 2 },
});
