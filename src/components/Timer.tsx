import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { Typography, Spacing, Radius, Font } from "../constants/colors";
import { useColors } from "../hooks/useColors";
import { formatTime } from "../utils/format";

interface TimerProps {
  timeRemaining: number; // in milliseconds
  totalTime?: number; // total session time in milliseconds
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  showProgress?: boolean;
  // "ring" = SVG progress ring (default, group sessions). "scrubber" =
  // YouTube-style horizontal track with a play/pause button below; tapping
  // pause invokes onPauseRequested (used by solo sessions to open the
  // surrender confirm).
  mode?: "ring" | "scrubber";
  onPauseRequested?: () => void;
}

export const Timer: React.FC<TimerProps> = ({
  timeRemaining,
  totalTime = timeRemaining,
  size = "large",
  showLabel = true,
  showProgress = true,
  mode = "ring",
  onPauseRequested,
}) => {
  const Colors = useColors();
  const opacity = useSharedValue(0);
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const isLow = timeRemaining < 60000; // Less than 1 minute
  const isCritical = timeRemaining < 10000; // Less than 10 seconds

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
  }, [opacity]);

  const getTimerSize = () => {
    switch (size) {
      case "small":
        return { ring: 120, stroke: 6, font: Typography.headlineMedium };
      case "medium":
        return { ring: 180, stroke: 8, font: Typography.displaySmall };
      case "large":
        return { ring: 240, stroke: 10, font: Typography.displayMedium };
    }
  };

  const timerSize = getTimerSize();
  const progress = totalTime > 0 ? timeRemaining / totalTime : 1;

  const radius = (timerSize.ring - timerSize.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Drive the SVG ring offset on the UI thread via Reanimated (was JS-thread
  // Animated with useNativeDriver:false, the only option for SVG props before).
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withTiming(circumference * (1 - progress), {
      duration: 950, // slightly under 1s so it lands before the next tick
    });
  }, [circumference, offset, progress]);
  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  const getColor = () => {
    if (isCritical) return Colors.danger;
    if (isLow) return Colors.warning;
    return Colors.primary;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: "center",
          justifyContent: "center",
        },
        ringContainer: {
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
        },
        svgContainer: {
          position: "absolute",
        },
        timeContainer: {
          alignItems: "center",
          justifyContent: "center",
        },
        simpleContainer: {
          alignItems: "center",
        },
        label: {
          fontSize: Typography.labelMedium,
          color: Colors.textSecondary,
          marginBottom: Spacing.xs,
          ...Font.medium,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        time: {
          ...Font.bold,
          fontVariant: ["tabular-nums"],
          letterSpacing: -1,
        },
        inlineTime: {
          fontSize: Typography.bodyLarge,
          ...Font.semibold,
          color: Colors.text,
          fontVariant: ["tabular-nums"],
        },
        scrubberContainer: {
          width: "100%",
          alignItems: "center",
          paddingHorizontal: Spacing.lg,
          gap: Spacing.md,
        },
        scrubberTimeRow: {
          width: "100%",
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        },
        scrubberElapsed: {
          fontSize: Typography.labelMedium,
          color: Colors.textSecondary,
          ...Font.medium,
          fontVariant: ["tabular-nums"],
        },
        scrubberRemaining: {
          fontSize: Typography.labelMedium,
          color: Colors.textSecondary,
          ...Font.medium,
          fontVariant: ["tabular-nums"],
        },
        scrubberTrack: {
          width: "100%",
          height: 4,
          backgroundColor: Colors.backgroundTertiary,
          borderRadius: Radius.full,
          overflow: "visible",
          justifyContent: "center",
        },
        scrubberFill: {
          height: 4,
          borderRadius: Radius.full,
        },
        scrubberThumb: {
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: 7,
          marginLeft: -7,
          top: -5,
        },
        scrubberCenterTime: {
          ...Font.bold,
          fontVariant: ["tabular-nums"],
          fontSize: Typography.displaySmall,
          letterSpacing: -1,
        },
        pauseButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Colors.backgroundCard,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        pauseBarsRow: {
          flexDirection: "row",
          gap: 4,
        },
        pauseBar: {
          width: 4,
          height: 18,
          borderRadius: 2,
        },
      }),
    [Colors],
  );

  if (mode === "scrubber") {
    const elapsed = Math.max(0, totalTime - timeRemaining);
    const fillPercent = `${Math.min(
      100,
      Math.max(0, (1 - progress) * 100),
    )}%` as `${number}%`;
    return (
      <Animated.View
        style={[styles.container, styles.scrubberContainer, containerStyle]}
      >
        {showLabel && <Text style={styles.label}>Focus session</Text>}
        <Text style={[styles.scrubberCenterTime, { color: getColor() }]}>
          {formatTime(timeRemaining)}
        </Text>
        <View style={styles.scrubberTrack}>
          <View
            style={[
              styles.scrubberFill,
              { backgroundColor: getColor(), width: fillPercent },
            ]}
          />
          <View
            style={[
              styles.scrubberThumb,
              { left: fillPercent, backgroundColor: getColor() },
            ]}
          />
        </View>
        <View style={styles.scrubberTimeRow}>
          <Text style={styles.scrubberElapsed}>{formatTime(elapsed)}</Text>
          <Text style={styles.scrubberRemaining}>
            -{formatTime(timeRemaining)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause session (will prompt to forfeit)"
          onPress={() => onPauseRequested?.()}
          style={styles.pauseButton}
          hitSlop={12}
        >
          <View style={styles.pauseBarsRow}>
            <View style={[styles.pauseBar, { backgroundColor: getColor() }]} />
            <View style={[styles.pauseBar, { backgroundColor: getColor() }]} />
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {showProgress && (
        <View
          style={[
            styles.ringContainer,
            { width: timerSize.ring, height: timerSize.ring },
          ]}
        >
          {/* SVG Progress Ring */}
          <Svg
            width={timerSize.ring}
            height={timerSize.ring}
            style={[styles.svgContainer, { transform: [{ scaleX: -1 }] }]}
          >
            {/* Background circle */}
            <Circle
              cx={timerSize.ring / 2}
              cy={timerSize.ring / 2}
              r={radius}
              stroke={Colors.backgroundTertiary}
              strokeWidth={timerSize.stroke}
              fill="transparent"
            />
            {/* Progress circle — uses AnimatedCircle for smooth movement */}
            <AnimatedCircle
              cx={timerSize.ring / 2}
              cy={timerSize.ring / 2}
              r={radius}
              stroke={getColor()}
              strokeWidth={timerSize.stroke}
              fill="transparent"
              strokeDasharray={circumference}
              animatedProps={ringAnimatedProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${timerSize.ring / 2}, ${timerSize.ring / 2}`}
            />
          </Svg>

          {/* Center content — the depleting ring + MM:SS are the single
              source of truth; no % label (a remaining-% next to an elapsed-%
              bar read as two contradictory numbers in the build-21 test). */}
          <View style={styles.timeContainer}>
            {showLabel && <Text style={styles.label}>Remaining</Text>}
            <Text
              style={[
                styles.time,
                { fontSize: timerSize.font, color: getColor() },
              ]}
            >
              {formatTime(timeRemaining)}
            </Text>
          </View>
        </View>
      )}
      {!showProgress && (
        <View style={styles.simpleContainer}>
          {showLabel && <Text style={styles.label}>Time Remaining</Text>}
          <Text
            style={[
              styles.time,
              { fontSize: timerSize.font, color: getColor() },
            ]}
          >
            {formatTime(timeRemaining)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

interface InlineTimerProps {
  timeRemaining: number;
}

export const InlineTimer: React.FC<InlineTimerProps> = ({ timeRemaining }) => {
  const Colors = useColors();
  const isLow = timeRemaining < 60000;

  const inlineTimeStyle = {
    fontSize: Typography.bodyLarge,
    ...Font.semibold,
    color: Colors.text,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  };

  return (
    <Text style={[inlineTimeStyle, isLow && { color: Colors.warning }]}>
      {formatTime(timeRemaining)}
    </Text>
  );
};
