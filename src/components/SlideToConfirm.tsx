import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Typography, Font } from "../constants/colors";
import { useColors } from "../hooks/useColors";
import { Button } from "./Button";

// Slide-to-confirm for money actions (deposits, stakes): a deliberate gesture
// instead of a one-tap CTA, so real-money commits can't happen by accident.

/** Fraction of track travel past which releasing fires the action. */
export const CONFIRM_THRESHOLD = 0.85;

const TRACK_HEIGHT = 58;
const THUMB_SIZE = 48;
const TRACK_PAD = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const SNAP_SPRING = { damping: 18, stiffness: 180 };

interface SlideToConfirmProps {
  title: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

export const SlideToConfirm: React.FC<SlideToConfirmProps> = ({
  title,
  onConfirm,
  disabled = false,
  loading = false,
}) => {
  const Colors = useColors();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  const confirmedRef = useRef(false);
  const prevLoadingRef = useRef(loading);

  const maxX = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PAD * 2);

  // A failed confirm (loading true → false) re-arms the slider for retry.
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      confirmedRef.current = false;
      offset.value = withSpring(0, SNAP_SPRING);
    }
    prevLoadingRef.current = loading;
  }, [loading, offset]);

  const fire = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let result: unknown;
    try {
      result = onConfirm();
    } catch {
      result = undefined;
    }
    // Re-arm when the handler settles WITHOUT ever flipping `loading` to true
    // (early-return paths: failed gates, auth-expired alerts, demo cancel).
    // Without this the one-shot guard bricks the slider until remount —
    // handlers that DO enter loading keep the loading-transition re-arm below.
    Promise.resolve(result)
      .catch(() => {})
      .finally(() => {
        if (!prevLoadingRef.current) {
          confirmedRef.current = false;
          offset.value = withSpring(0, SNAP_SPRING);
        }
      });
  };

  const beginHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && !loading)
    .activeOffsetX([-8, 8])
    .onBegin(() => {
      runOnJS(beginHaptic)();
    })
    .onUpdate((e) => {
      offset.value = Math.min(Math.max(e.translationX, 0), maxX);
    })
    .onEnd(() => {
      if (maxX > 0 && offset.value >= CONFIRM_THRESHOLD * maxX) {
        offset.value = withSpring(maxX, SNAP_SPRING);
        runOnJS(fire)();
      } else {
        offset.value = withSpring(0, SNAP_SPRING);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  // Label fades out as the thumb travels.
  const labelStyle = useAnimatedStyle(() => ({
    opacity:
      maxX > 0
        ? interpolate(
            offset.value,
            [0, maxX * 0.6],
            [1, 0],
            Extrapolation.CLAMP,
          )
        : 1,
  }));

  // Reduced motion: a drag gesture is exactly what's being asked to avoid —
  // degrade to the standard tap button (same contract, same loading states).
  if (reducedMotion) {
    return (
      <Button
        title={title}
        onPress={onConfirm}
        disabled={disabled}
        loading={loading}
        size="large"
      />
    );
  }

  return (
    <View
      testID="slide-to-confirm-track"
      accessibilityLabel={title}
      accessibilityState={{ disabled, busy: loading }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          backgroundColor: disabled
            ? Colors.buttonDisabled
            : Colors.backgroundSecondary,
          borderColor: Colors.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} size="small" />
      ) : (
        <>
          <Animated.View style={labelStyle}>
            <Text
              style={[
                styles.label,
                { color: disabled ? Colors.textTertiary : Colors.text },
              ]}
            >
              {title}
            </Text>
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View
              testID="slide-to-confirm-thumb"
              style={[
                styles.thumb,
                thumbStyle,
                {
                  backgroundColor: disabled
                    ? Colors.textTertiary
                    : Colors.primary,
                },
              ]}
            >
              <Ionicons name="arrow-forward" size={22} color={Colors.white} />
            </Animated.View>
          </GestureDetector>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    width: "100%",
  },
  label: {
    fontSize: Typography.bodyLarge,
    ...Font.semibold,
    letterSpacing: 0.3,
  },
  thumb: {
    position: "absolute",
    left: TRACK_PAD,
    top: TRACK_PAD,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
