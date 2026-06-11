import React, { useEffect, useMemo, useRef } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  BLOB_PALETTES,
  generateBlobAvatarPreset,
  generateBlobPath,
} from "../../constants/blobAvatar";

export interface CalendarStampBlobProps {
  /** Seed for the deterministic one-of-a-kind blob — the per-session collectible. */
  sessionId: string;
  size?: number;
  /** Mount-stagger order for the stamp-press entrance (0 = first). */
  index?: number;
  /** Occasional idle blink — enable on at most the most-recent stamp. */
  blink?: boolean;
  testID?: string;
}

// Stamp-press entrance: scale 1.5 → 1 with overshoot (comment 4's "stamp style
// placement"). Blink dips the eyes' scaleY every few seconds.
const STAMP_SPRING = { damping: 13, stiffness: 160 };
const STAGGER_MS = 90;
const BLINK_EVERY_MS = 3400;

// Decorative blob art (same ink as BlobAvatar) + the "unique" preset's eye
// geometry in its 100×100 viewBox: center (50, 42), gap 18, radius 4.2.
const INK = "#120505";
const EYE = { cx: 50, cy: 42, gap: 18, r: 4.2 };

export const CalendarStampBlob: React.FC<CalendarStampBlobProps> = ({
  sessionId,
  size = 28,
  index = 0,
  blink = false,
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
    entrance.value = withDelay(index * STAGGER_MS, withSpring(1, STAMP_SPRING));
  }, [reducedMotion, index, entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrance.value * 2),
    transform: [{ scale: 1.5 - entrance.value * 0.5 }],
  }));

  const eyeScale = useSharedValue(1);
  useEffect(() => {
    if (!blink || reducedMotion) {
      eyeScale.value = 1; // skip the idle loop
      return;
    }
    eyeScale.value = withRepeat(
      withSequence(
        withDelay(BLINK_EVERY_MS, withTiming(0.15, { duration: 90 })),
        withTiming(1, { duration: 140 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(eyeScale);
  }, [blink, reducedMotion, eyeScale]);
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScale.value }],
  }));

  // Eyes are overlay views (not SVG nodes) so the blink animates without
  // animatedProps; positions map the 100×100 eye geometry into pixels.
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
      <Animated.View
        testID="stamp-eye-left"
        style={[eyeBase, { left: eyeCenterLeft - eyeOffset }, eyeStyle]}
      />
      <Animated.View
        testID="stamp-eye-right"
        style={[eyeBase, { left: eyeCenterLeft + eyeOffset }, eyeStyle]}
      />
    </Animated.View>
  );
};
