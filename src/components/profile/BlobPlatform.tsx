import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlobAvatar } from "../BlobAvatar";
import { Spacing, Radius, type ThemeColors } from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { BlobAvatarConfig } from "../../constants/blobAvatar";

interface BlobPlatformProps {
  config: BlobAvatarConfig;
  uid: string;
  /** While the customizer sheet is up the platform's happy arc eyes flip
   *  vertically (sleepy/sad — Fardeen's keep-this detail, design comment 1)
   *  and the blob hides, since it "moved" into the sheet. */
  customizerOpen: boolean;
  onExpand: () => void;
}

// Decorative SVG art constants (platform disk + arc eyes) — same ink as the
// BlobAvatar outline.
const INK = "#120505";
const PLATFORM_W = 180;
const PLATFORM_H = 72;
const EYES_W = 64;
const EYES_H = 16;
const BLOB_SIZE = 96;

const EYE_FLIP_MS = 200;
const BLOB_HIDE_MS = 150;

// The blob mascot standing on its green platform (profile-tab-normal frame).
export function BlobPlatform({
  config,
  uid,
  customizerOpen,
  onExpand,
}: BlobPlatformProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const reducedMotion = useReducedMotion();

  // scaleY +1 = happy arcs, -1 = flipped (sleepy/sad); blob scales away while
  // the customizer owns it.
  const flip = useSharedValue(customizerOpen ? -1 : 1);
  const blobScale = useSharedValue(customizerOpen ? 0 : 1);
  useEffect(() => {
    const eyeTarget = customizerOpen ? -1 : 1;
    const blobTarget = customizerOpen ? 0 : 1;
    if (reducedMotion) {
      flip.value = eyeTarget;
      blobScale.value = blobTarget;
      return;
    }
    flip.value = withTiming(eyeTarget, { duration: EYE_FLIP_MS });
    blobScale.value = withTiming(blobTarget, { duration: BLOB_HIDE_MS });
  }, [customizerOpen, reducedMotion, flip, blobScale]);

  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flip.value }],
  }));
  const blobStyle = useAnimatedStyle(() => ({
    opacity: blobScale.value,
    transform: [{ scale: blobScale.value }],
  }));

  const handleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExpand();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.blobWrap, blobStyle]}>
        <BlobAvatar size={BLOB_SIZE} config={config} seed={uid} animated />
      </Animated.View>

      <View style={styles.platformWrap}>
        <Svg
          width={PLATFORM_W}
          height={PLATFORM_H}
          viewBox={`0 0 ${PLATFORM_W} ${PLATFORM_H}`}
        >
          <Defs>
            <LinearGradient id="platformGrad" x1="0.25" y1="0" x2="0.75" y2="1">
              <Stop offset="0" stopColor={Colors.primaryLight} />
              <Stop offset="1" stopColor={Colors.primaryDark} />
            </LinearGradient>
          </Defs>
          {/* Disk side (cylinder wall) */}
          <Path
            d="M 4 24 L 4 44 A 86 22 0 0 0 176 44 L 176 24"
            fill="url(#platformGrad)"
            stroke={INK}
            strokeWidth={2.6}
          />
          {/* Disk top */}
          <Ellipse
            cx={90}
            cy={24}
            rx={86}
            ry={20}
            fill={Colors.primaryLight}
            stroke={INK}
            strokeWidth={2.6}
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          testID={
            customizerOpen ? "platform-eyes-sleepy" : "platform-eyes-happy"
          }
          style={[styles.eyes, eyesStyle]}
        >
          <Svg
            width={EYES_W}
            height={EYES_H}
            viewBox={`0 0 ${EYES_W} ${EYES_H}`}
          >
            {/* Happy arcs; vertical flip reads sleepy/sad */}
            <Path
              d="M 6 12 Q 14 2 22 12"
              stroke={INK}
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M 42 12 Q 50 2 58 12"
              stroke={INK}
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </View>

      <Pressable
        onPress={handleExpand}
        style={({ pressed }) => [
          styles.expandButton,
          pressed && styles.expandButtonPressed,
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Customize your blob"
      >
        <Ionicons name="expand" size={18} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      paddingTop: Spacing.md,
    },
    blobWrap: {
      zIndex: 1,
      // Plant the blob on the platform's top face.
      marginBottom: -Spacing.lg,
    },
    platformWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    eyes: {
      position: "absolute",
      // Centered on the disk's front wall, below the top-face rim.
      top: PLATFORM_H / 2 + Spacing.sm,
      left: (PLATFORM_W - EYES_W) / 2,
    },
    expandButton: {
      // Top-right of the platform dome (frame 352:320).
      position: "absolute",
      right: Spacing.lg,
      top: 0,
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: Colors.overlayLight,
      alignItems: "center",
      justifyContent: "center",
    },
    expandButtonPressed: {
      backgroundColor: Colors.overlay,
    },
  });
