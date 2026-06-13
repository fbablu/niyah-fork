import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlobMakerStage } from "./BlobMakerStage";
import { BlobOptionRows } from "./BlobOptionRows";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { generateId } from "../../utils/id";
import {
  BLOB_AVATAR_COLORS,
  BLOB_AVATAR_EYES,
  type BlobAvatarColorPreset,
  type BlobAvatarConfig,
  type BlobAvatarEyesPreset,
} from "../../constants/blobAvatar";

interface BlobMakerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Seed fallback + namespace for shuffled shapes (the user's uid). */
  uid: string;
  /** The user's current avatar, used to seed the editor's initial state. */
  config: BlobAvatarConfig;
  onSave: (next: BlobAvatarConfig) => void;
}

// v3 motion spec (near-static): plain timed rise, no spring, no overshoot,
// no hero slingshot — the hero just appears statically with the sheet.
// Open = backdrop fade + sheet translateY ease-out; close = reverse, faster.
const SHEET_IN_MS = 220;
const SHEET_OUT_MS = 180;
const BACKDROP_MS = 180;
/** Bare opacity dip on the hero while shuffle/randomize swaps its content. */
const HERO_DIP_MS = 150;
const HERO_DIP_OPACITY = 0.4;
/** Customizer sheet top-corner radius (frame 429:347, rounded-[57.46]) —
 *  intentionally far beyond Radius.xl; the giant curve IS the design. */
const SHEET_TOP_RADIUS = 57;
/** White grab bar width (frame 429:347, line 429:553 ≈ 52pt). */
const GRAB_BAR_WIDTH = 52;
/** Partial sheet: ~66% of the screen, bottom-anchored (frame 401:106 — the
 *  sheet rises to y≈298 of 874), so the dimmed profile and the platform's
 *  sleepy-eyes flip (design comment 1) stay visible above it. */
const SHEET_HEIGHT_RATIO = 0.66;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Edit-your-blob sheet (frame 429:347): the profile blob moves from its
// platform into the foreground and becomes editable. Shapes are fully
// generative — Shuffle re-mints a one-of-a-kind seed; Color + Eyes stay
// explicit; the die randomizes all three (design comment 2).
export function BlobMakerSheet({
  visible,
  onClose,
  uid,
  config,
  onSave,
}: BlobMakerSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const reducedMotion = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();
  const sheetHeight = Math.round(screenHeight * SHEET_HEIGHT_RATIO);

  const [seed, setSeed] = useState(config.shapeSeed || uid);
  const [colorPreset, setColorPreset] = useState<BlobAvatarColorPreset>(
    config.colorPreset,
  );
  const [eyesPreset, setEyesPreset] = useState<BlobAvatarEyesPreset>(
    config.eyesPreset,
  );

  // Re-seed the editor from the live config whenever it (re)opens.
  useEffect(() => {
    if (visible) {
      setSeed(config.shapeSeed || uid);
      setColorPreset(config.colorPreset);
      setEyesPreset(config.eyesPreset);
    }
  }, [visible, config, uid]);

  // Entrance: the sheet rises from the bottom edge on a plain ease-out
  // timing while the backdrop fades in. The hero rides inside the sheet —
  // no separate entrance animation (near-static spec).
  const heroDip = useSharedValue(1);
  const sheet = useSharedValue(0);
  const backdrop = useSharedValue(0);
  useEffect(() => {
    if (!visible) {
      heroDip.value = 1;
      sheet.value = 0;
      backdrop.value = 0;
      return;
    }
    if (reducedMotion) {
      sheet.value = 1;
      backdrop.value = 1;
      return;
    }
    sheet.value = withTiming(1, {
      duration: SHEET_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    backdrop.value = withTiming(1, { duration: BACKDROP_MS });
  }, [visible, reducedMotion, heroDip, sheet, backdrop]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroDip.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheet.value) * sheetHeight }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(backdrop.value, 1),
  }));

  const editing: BlobAvatarConfig = {
    colorPreset,
    shapePreset: "unique",
    eyesPreset,
    ...(seed !== uid ? { shapeSeed: seed } : {}),
  };

  // Shuffle/randomize feedback: the content swap is instant; a bare opacity
  // dip (instant drop, 150ms recovery) softens it. No transforms.
  const dip = () => {
    if (reducedMotion) return;
    heroDip.value = HERO_DIP_OPACITY;
    heroDip.value = withTiming(1, {
      duration: HERO_DIP_MS,
      easing: Easing.out(Easing.cubic),
    });
  };

  // Close: the sheet drops and the backdrop fades (reverse of open, faster);
  // control hands back on settle.
  const requestClose = () => {
    if (reducedMotion) {
      onClose();
      return;
    }
    backdrop.value = withTiming(0, { duration: SHEET_OUT_MS });
    sheet.value = withTiming(
      0,
      { duration: SHEET_OUT_MS, easing: Easing.in(Easing.cubic) },
      () => {
        runOnJS(onClose)();
      },
    );
  };

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSeed(`${uid}:${generateId(8)}`);
    dip();
  };

  // Die: one tap re-mints the seed AND draws a random color + eyes (eye
  // geometry is per-shape, so eyes stay centered on any result).
  const handleRandomizeAll = () => {
    Haptics.selectionAsync();
    setSeed(`${uid}:${generateId(8)}`);
    setColorPreset(
      BLOB_AVATAR_COLORS[Math.floor(Math.random() * BLOB_AVATAR_COLORS.length)],
    );
    setEyesPreset(
      BLOB_AVATAR_EYES[Math.floor(Math.random() * BLOB_AVATAR_EYES.length)],
    );
    dip();
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(editing);
    requestClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={requestClose}
    >
      <View style={styles.root}>
        <AnimatedPressable
          testID="blob-maker-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close the blob editor"
          onPress={requestClose}
          style={[styles.backdrop, backdropStyle]}
        />
        <Animated.View
          testID="blob-maker-sheet"
          style={[styles.sheet, { height: sheetHeight }, sheetStyle]}
        >
          <SafeAreaView style={styles.sheetInner} edges={["bottom"]}>
            <View style={styles.grabBar} />
            <View style={styles.headerRow}>
              <Pressable onPress={requestClose} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.title}>Edit your blob</Text>
              <Pressable onPress={handleSave} hitSlop={8}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>

            <BlobMakerStage
              editing={editing}
              uid={uid}
              heroStyle={heroStyle}
              onRandomize={handleRandomizeAll}
              onSaveCollapse={handleSave}
            />

            <BlobOptionRows
              editing={editing}
              uid={uid}
              onSelectColor={setColorPreset}
              onSelectEyes={setEyesPreset}
              onShuffleShape={handleShuffle}
            />
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      // The dimmed profile (and the platform's sleepy-eyes flip) stays
      // visible through the glass above the sheet (frame 429:347).
      backgroundColor: Colors.glassDark,
    },
    sheet: {
      backgroundColor: Colors.primaryLight,
      borderTopLeftRadius: SHEET_TOP_RADIUS,
      borderTopRightRadius: SHEET_TOP_RADIUS,
      overflow: "hidden",
    },
    sheetInner: {
      flex: 1,
    },
    grabBar: {
      alignSelf: "center",
      width: GRAB_BAR_WIDTH,
      height: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Colors.white,
      marginTop: Spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    title: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.white,
    },
    cancel: {
      fontSize: Typography.bodyMedium,
      color: Colors.white,
    },
    done: {
      fontSize: Typography.bodyMedium,
      ...Font.bold,
      color: Colors.white,
    },
  });
