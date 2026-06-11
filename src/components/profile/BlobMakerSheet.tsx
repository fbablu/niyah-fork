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
  withSpring,
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

// Slingshot rubber-band: low-damping overshoot spring (design comment 2).
// Shared by the hero blob AND the sheet's translateY rise.
const SLINGSHOT_SPRING = { damping: 12, stiffness: 140 };
const COLLAPSE_MS = 250;
const BACKDROP_MS = 200;
/** Partial sheet: ~66% of the screen, bottom-anchored (frame 401:106 — the
 *  sheet rises to y≈298 of 874), so the dimmed profile and the platform's
 *  sleepy-eyes flip (design comment 1) stay visible above it. */
const SHEET_HEIGHT_RATIO = 0.66;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Edit-your-blob sheet: the profile blob slingshots from its platform into
// the foreground and becomes editable. Shapes are fully generative — Shuffle
// re-mints a one-of-a-kind seed; Color + Eyes stay explicit; the die
// randomizes all three (design comment 2).
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

  // Entrance: hero slingshots off the platform with rubber-band overshoot,
  // the sheet springs up from the bottom edge, the backdrop fades in.
  const hero = useSharedValue(0);
  const sheet = useSharedValue(0);
  const backdrop = useSharedValue(0);
  useEffect(() => {
    if (!visible) {
      hero.value = 0;
      sheet.value = 0;
      backdrop.value = 0;
      return;
    }
    if (reducedMotion) {
      hero.value = 1;
      sheet.value = 1;
      backdrop.value = 1;
      return;
    }
    hero.value = withSpring(1, SLINGSHOT_SPRING);
    sheet.value = withSpring(1, SLINGSHOT_SPRING);
    backdrop.value = withTiming(1, { duration: BACKDROP_MS });
  }, [visible, reducedMotion, hero, sheet, backdrop]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: Math.min(hero.value, 1),
    transform: [{ scale: 0.6 + hero.value * 0.4 }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    // Overshoot (>1) briefly lifts past the resting line — rubber band.
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

  const pop = () => {
    if (reducedMotion) return;
    hero.value = withTiming(0.92, { duration: 90 }, () => {
      hero.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    });
  };

  // Collapse-then-close: the hero slingshots back toward the platform while
  // the sheet drops and the backdrop fades; control hands back on settle.
  const requestClose = () => {
    if (reducedMotion) {
      onClose();
      return;
    }
    hero.value = withTiming(0, {
      duration: COLLAPSE_MS,
      easing: Easing.in(Easing.cubic),
    });
    backdrop.value = withTiming(0, { duration: COLLAPSE_MS });
    sheet.value = withTiming(
      0,
      { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) },
      () => {
        runOnJS(onClose)();
      },
    );
  };

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSeed(`${uid}:${generateId(8)}`);
    pop();
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
    pop();
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
      backgroundColor: Colors.overlay,
    },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      overflow: "hidden",
    },
    sheetInner: {
      flex: 1,
    },
    grabBar: {
      alignSelf: "center",
      width: Spacing.xxl,
      height: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Colors.backgroundTertiary,
      marginTop: Spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    title: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.text,
    },
    cancel: {
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
    },
    done: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.primary,
    },
  });
