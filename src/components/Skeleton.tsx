import React, { useEffect } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "../hooks/useColors";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius in px. Default 8. Use height/2 for pills/circles. */
  radius?: number;
  /** Override the placeholder fill. Defaults to the theme border neutral. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Minimal shimmer placeholder. A neutral block whose opacity gently pulses on
 * the UI thread (Reanimated) — no new deps, no gradient. Respects
 * reduced-motion (renders a static block). Use it to hold layout while async
 * data loads so a screen paints instantly instead of popping in or showing a
 * spinner. Keep dimensions matched to the final content to avoid layout shift.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  radius = 8,
  color,
  style,
}) => {
  const Colors = useColors();
  const opacity = useSharedValue(0.5);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.6;
      return;
    }
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: color ?? Colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};
