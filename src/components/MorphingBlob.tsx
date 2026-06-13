import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  BLOB_INK as INK,
  pointsToBlobPath,
  type BlobPalette,
  type BlobPoint,
} from "../constants/blobAvatar";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface MorphingBlobProps {
  /** Target control points in a 100×100 space (generateBlobPoints output).
   *  Keep the point count constant across targets so the morph is 1:1. */
  points: BlobPoint[];
  /** Target palette; crossfades in sync with the shape morph. */
  palette: BlobPalette;
  size?: number;
}

// Mild overshoot so the blob lands with a jelly wobble.
const MORPH_SPRING = { damping: 13, stiffness: 110, mass: 1 };

const flatten = (pts: BlobPoint[]): number[] => {
  const flat: number[] = [];
  for (const p of pts) flat.push(p.x, p.y);
  return flat;
};

// Lerp two flat [x0,y0,x1,y1,…] arrays back into points. t may overshoot 1
// (spring) — extrapolation past the target is the wobble.
const lerpFlat = (from: number[], to: number[], t: number): BlobPoint[] => {
  "worklet";
  const n = Math.min(from.length, to.length) / 2;
  const pts: BlobPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    pts.push({
      x: from[i * 2] + (to[i * 2] - from[i * 2]) * t,
      y: from[i * 2 + 1] + (to[i * 2 + 1] - from[i * 2 + 1]) * t,
    });
  }
  return pts;
};

const clamp01 = (v: number): number => {
  "worklet";
  return Math.min(Math.max(v, 0), 1);
};

/**
 * Procedural blob that animates between generated shapes/palettes on the UI
 * thread: the SVG path is rebuilt from interpolated control points every
 * frame (Reanimated worklet), the skin crossfades between gradients, and the
 * eyes blink mid-morph. Used by the onboarding shuffle Blob Maker.
 */
export const MorphingBlob: React.FC<MorphingBlobProps> = ({
  points,
  palette,
  size = 200,
}) => {
  const reducedMotion = useReducedMotion();
  const idSuffix = React.useRef(Math.random().toString(36).slice(2, 9)).current;
  // First-paint path; constant across renders so it never fights animatedProps.
  const initialD = React.useRef(pointsToBlobPath(points)).current;

  const progress = useSharedValue(1);
  const fromPts = useSharedValue(flatten(points));
  const toPts = useSharedValue(flatten(points));
  // Outgoing/incoming palettes for the crossfade; progress drives the blend.
  const [fade, setFade] = React.useState({ prev: palette, next: palette });
  const isFirst = React.useRef(true);

  // Layout effect (not useEffect) so the gradient swap commits before paint —
  // a post-paint effect would flash the outgoing gradient for one frame.
  React.useLayoutEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // Capture the mid-flight shape as the new origin so rapid rerolls morph
    // from wherever the blob currently is instead of snapping. Raw progress
    // (not clamped) — during spring overshoot the on-screen shape is the
    // t > 1 extrapolation, and the capture must match it exactly.
    const t = progress.value;
    fromPts.value = flatten(lerpFlat(fromPts.value, toPts.value, t));
    toPts.value = flatten(points);
    setFade((cur) => ({ prev: cur.next, next: palette }));
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = reducedMotion ? 1 : withSpring(1, MORPH_SPRING);
  }, [points, palette, progress, fromPts, toPts, reducedMotion]);

  // Both skin layers share one per-frame path build (the strings are
  // identical) — halves the worklet work on the morph hot path.
  const morphPath = useDerivedValue(() =>
    pointsToBlobPath(lerpFlat(fromPts.value, toPts.value, progress.value)),
  );
  const outgoingProps = useAnimatedProps(() => ({
    d: morphPath.value,
  }));
  const incomingProps = useAnimatedProps(() => ({
    d: morphPath.value,
    fillOpacity: clamp01(progress.value),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      clamp01(progress.value),
      [0, 1],
      [fade.prev.backdrop, fade.next.backdrop],
    ),
  }));

  // Squash-and-stretch on each roll, plus a blink while the shape is in flux.
  const squashStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scaleX: interpolate(
          progress.value,
          [0, 0.25, 1],
          [1, 1.05, 1],
          "clamp",
        ),
      },
      {
        scaleY: interpolate(
          progress.value,
          [0, 0.25, 1],
          [1, 0.93, 1],
          "clamp",
        ),
      },
    ],
  }));
  const blinkStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scaleY: interpolate(
          progress.value,
          [0, 0.18, 0.55, 1],
          [1, 0.12, 1, 1],
          "clamp",
        ),
      },
    ],
  }));

  // Eye geometry mirrors BlobAvatar's "unique" preset (center 50,46 / gap 18 /
  // r 4.2 in 100-space) — procedural blobs are always centered, so the eyes
  // align on every roll by construction.
  const eyeSize = size * 0.084;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        squashStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size * 1.08,
            height: size * 0.9,
            borderRadius: size * 0.42,
            opacity: 0.42,
            top: size * 0.1,
            left: size * 0.05,
          },
          backdropStyle,
        ]}
      />

      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Defs>
          <LinearGradient
            id={`morphPrev-${idSuffix}`}
            x1="0.25"
            y1="0"
            x2="0.75"
            y2="1"
          >
            <Stop offset="0" stopColor={fade.prev.start} />
            <Stop offset="1" stopColor={fade.prev.end} />
          </LinearGradient>
          <LinearGradient
            id={`morphNext-${idSuffix}`}
            x1="0.25"
            y1="0"
            x2="0.75"
            y2="1"
          >
            <Stop offset="0" stopColor={fade.next.start} />
            <Stop offset="1" stopColor={fade.next.end} />
          </LinearGradient>
        </Defs>

        {/* Outgoing skin underneath; incoming skin + outline fade in above. */}
        <AnimatedPath
          d={initialD}
          animatedProps={outgoingProps}
          fill={`url(#morphPrev-${idSuffix})`}
        />
        <AnimatedPath
          d={initialD}
          animatedProps={incomingProps}
          fill={`url(#morphNext-${idSuffix})`}
          stroke={INK}
          strokeWidth={2.6}
        />
      </Svg>

      <Animated.View
        style={[
          {
            position: "absolute",
            top: size * 0.46 - eyeSize / 2,
            flexDirection: "row",
            gap: size * 0.18 - eyeSize,
          },
          blinkStyle,
        ]}
      >
        <View
          style={{
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: INK,
          }}
        />
        <View
          style={{
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: INK,
          }}
        />
      </Animated.View>
    </Animated.View>
  );
};
