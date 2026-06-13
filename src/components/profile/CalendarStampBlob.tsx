import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  BLOB_INK as INK,
  BLOB_PALETTES,
  generateBlobAvatarPreset,
  generateBlobPath,
} from "../../constants/blobAvatar";

export interface CalendarStampBlobProps {
  /** Seed for the deterministic one-of-a-kind blob — the per-session collectible. */
  sessionId: string;
  size?: number;
  testID?: string;
}

// v3 motion spec (near-static): entrance is a bare opacity fade — no scale,
// no stagger, no idle blink. iOS-system feel: fades over transforms.
const STAMP_IN_MS = 200;

// Decorative blob art (ink shared with BlobAvatar via BLOB_INK) + the
// "unique" preset's eye geometry in its 100×100 viewBox: center (50, 42),
// gap 18, radius 4.2.
const EYE = { cx: 50, cy: 42, gap: 18, r: 4.2 };

export const CalendarStampBlob: React.FC<CalendarStampBlobProps> = ({
  sessionId,
  size = 28,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const idSuffix = useRef(Math.random().toString(36).slice(2, 9)).current;

  // Same seed → identical blob, forever (the collectible contract).
  const { bodyPath, palette } = useMemo(
    () => ({
      bodyPath: generateBlobPath(sessionId),
      palette: BLOB_PALETTES[generateBlobAvatarPreset(sessionId).colorPreset],
    }),
    [sessionId],
  );

  const entrance = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      entrance.value = 1; // jump-to-end
      return;
    }
    entrance.value = withTiming(1, {
      duration: STAMP_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [reducedMotion, entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
  }));

  // Eyes are overlay views (not SVG nodes); positions map the 100×100 eye
  // geometry into pixels.
  const eyeD = ((EYE.r * 2) / 100) * size;
  const eyeBase = {
    position: "absolute" as const,
    top: (EYE.cy / 100) * size - eyeD / 2,
    width: eyeD,
    height: eyeD,
    borderRadius: eyeD / 2,
    backgroundColor: INK,
  };
  const eyeOffset = (EYE.gap / 2 / 100) * size;
  const eyeCenterLeft = (EYE.cx / 100) * size - eyeD / 2;

  return (
    <Animated.View
      testID={testID}
      style={[{ width: size, height: size }, entranceStyle]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Defs>
          <LinearGradient
            id={`stampGrad-${idSuffix}`}
            x1="0.25"
            y1="0"
            x2="0.75"
            y2="1"
          >
            <Stop offset="0" stopColor={palette.start} />
            <Stop offset="1" stopColor={palette.end} />
          </LinearGradient>
        </Defs>
        <Path
          testID="stamp-body-path"
          d={bodyPath}
          fill={`url(#stampGrad-${idSuffix})`}
          stroke={INK}
          strokeWidth={5}
        />
      </Svg>
      <View
        testID="stamp-eye-left"
        style={[eyeBase, { left: eyeCenterLeft - eyeOffset }]}
      />
      <View
        testID="stamp-eye-right"
        style={[eyeBase, { left: eyeCenterLeft + eyeOffset }]}
      />
    </Animated.View>
  );
};
