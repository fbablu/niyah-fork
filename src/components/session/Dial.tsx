import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Font, Spacing, Typography } from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { RollingNumber } from "./RollingNumber";
import {
  clampPosition,
  indexForOffset,
  indexOfValue,
  maxIndexForCap,
} from "./dialMath";

// Reusable haptic dial — a horizontal tick-strip the user scrolls; the detent
// under the center line is the value. Built on a native ScrollView with
// snapToInterval + decelerationRate, so flick/decelerate/snap is Apple's own
// picker physics (the Clock-app feel) in one continuous motion — nothing to
// tune. onScroll drives the odometer readout (RollingNumber) and a selection
// tick at each detent (during drag AND the native coast); an impact fires on
// settle. The cap (disabledAbove) snaps back if the user coasts into the dimmed
// zone. VoiceOver uses the adjustable wrapper's increment/decrement actions.

const TICK_SPACING = 26;
const TICK_W = 2;
const TICK_H = 22;
const STRIP_H = 40;
const READOUT_ROW_H = 56;
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
  /** Max selectable VALUE (balance / daily cap): detents above render dimmed and
   *  the strip snaps back to the cap. */
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
  const [trackWidth, setTrackWidth] = useState(0);

  const count = values.length;
  const maxIndex = maxIndexForCap(values, disabledAbove);
  const selectedIndex = clampPosition(
    indexOfValue(values, value),
    count,
    maxIndex,
  );
  // The readout / a11y / parent always reflect a REAL detent — never a raw prop
  // that is off-ladder or above the cap. The sync effect reconciles `value`.
  const snappedValue = count > 0 ? values[selectedIndex] : value;

  const scrollRef = useRef<ScrollView>(null);
  const interactingRef = useRef(false); // finger down or coasting
  const programmaticRef = useRef(false); // suppress ticks from our own scrollTo
  const lastEmittedRef = useRef(selectedIndex);
  const initialOffsetRef = useRef(selectedIndex * TICK_SPACING);

  // Latest props for the scroll/a11y handlers.
  const valuesRef = useRef(values);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const selectedIndexRef = useRef(selectedIndex);
  const countRef = useRef(count);
  const maxIndexRef = useRef(maxIndex);
  valuesRef.current = values;
  valueRef.current = value;
  onChangeRef.current = onChange;
  selectedIndexRef.current = selectedIndex;
  countRef.current = count;
  maxIndexRef.current = maxIndex;

  const sidePad = Math.max(0, (trackWidth - TICK_SPACING) / 2);

  const emit = useCallback((idx: number) => {
    const next = valuesRef.current[idx];
    if (next === undefined) return;
    if (next !== valueRef.current) onChangeRef.current(next);
  }, []);

  // Imperatively snap the strip to a detent (only the cap clamp / external sync;
  // normal stops are left to the native snapToInterval so the motion stays one
  // continuous ease). Suppresses the resulting ticks via programmaticRef.
  const snapTo = useCallback((idx: number) => {
    programmaticRef.current = true;
    scrollRef.current?.scrollTo({ x: idx * TICK_SPACING, animated: true });
    setTimeout(() => {
      programmaticRef.current = false;
    }, 350);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (programmaticRef.current) return;
      const idx = indexForOffset(
        e.nativeEvent.contentOffset.x,
        TICK_SPACING,
        countRef.current,
        maxIndexRef.current,
      );
      if (idx === lastEmittedRef.current) return;
      lastEmittedRef.current = idx;
      Haptics.selectionAsync();
      emit(idx);
    },
    [emit],
  );

  const commit = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!interactingRef.current) return; // already settled this gesture
      interactingRef.current = false;
      const raw = Math.round(e.nativeEvent.contentOffset.x / TICK_SPACING);
      const idx = clampPosition(raw, countRef.current, maxIndexRef.current);
      lastEmittedRef.current = idx;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      emit(idx);
      if (raw !== idx) snapTo(idx); // coasted past the cap → ease back
    },
    [emit, snapTo],
  );

  const onBeginDrag = useCallback(() => {
    interactingRef.current = true;
    programmaticRef.current = false; // a real touch always ticks
  }, []);

  const onEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // No momentum will follow → settle now (else wait for momentum end).
      if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) commit(e);
    },
    [commit],
  );

  // Reconcile an external / clamped / off-ladder value to a real detent and keep
  // the strip aligned to it — but never while the user is interacting.
  useEffect(() => {
    if (interactingRef.current) return;
    emit(selectedIndex);
    if (selectedIndex !== lastEmittedRef.current) {
      lastEmittedRef.current = selectedIndex;
      snapTo(selectedIndex);
    }
  }, [selectedIndex, emit, snapTo]);

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const dir =
        e.nativeEvent.actionName === "increment"
          ? 1
          : e.nativeEvent.actionName === "decrement"
            ? -1
            : 0;
      if (!dir) return;
      const cur = selectedIndexRef.current;
      const idx = Math.round(
        clampPosition(cur + dir, countRef.current, maxIndexRef.current),
      );
      if (idx === cur) return;
      Haptics.selectionAsync();
      lastEmittedRef.current = idx;
      emit(idx);
      snapTo(idx);
    },
    [emit, snapTo],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  // Static tick strip — independent of the selected value so per-tick scroll
  // updates never re-render the scroller (the center pointer marks selection).
  const ticks = useMemo(
    () =>
      values.map((v) => {
        const dimmed = disabledAbove != null && v > disabledAbove;
        return (
          <View key={v} style={styles.tickCell}>
            <View
              style={[
                styles.tick,
                { backgroundColor: Colors.white, opacity: dimmed ? 0.2 : 0.5 },
              ]}
            />
          </View>
        );
      }),
    [values, disabledAbove, Colors],
  );

  if (count === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: WHITE_70 }]}>{label}</Text>
      <View
        style={styles.track}
        onLayout={onLayout}
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
      >
        <RollingNumber
          text={format(snappedValue)}
          rowHeight={READOUT_ROW_H}
          style={[styles.readout, { color: Colors.white }]}
        />
        {subline ? (
          <Text style={[styles.subline, { color: WHITE_70 }]}>{subline}</Text>
        ) : null}

        {trackWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_SPACING}
            snapToAlignment="start"
            decelerationRate="fast"
            contentOffset={{ x: initialOffsetRef.current, y: 0 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={onBeginDrag}
            onScrollEndDrag={onEndDrag}
            onMomentumScrollEnd={commit}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: sidePad },
            ]}
          >
            {ticks}
          </ScrollView>
        ) : null}

        <View style={styles.pointerWrap} pointerEvents="none">
          <View style={[styles.pointer, { backgroundColor: Colors.white }]} />
        </View>
      </View>
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
  scroll: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    height: STRIP_H,
  },
  scrollContent: { alignItems: "flex-end", height: STRIP_H },
  tickCell: {
    width: TICK_SPACING,
    height: STRIP_H,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tick: { width: TICK_W, height: TICK_H, borderRadius: TICK_W / 2 },
  pointerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    height: TICK_H + 12,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pointer: { width: 3, height: TICK_H + 12, borderRadius: 2 },
});
