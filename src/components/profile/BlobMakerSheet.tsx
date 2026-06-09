import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlobAvatar } from "../BlobAvatar";
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
  BLOB_DISPLAY_LABELS,
  BLOB_PALETTES,
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

// Edit-your-blob sheet: the profile blob "zooms to the foreground" and becomes
// editable. Shapes are fully generative (no preset picker) — Shuffle re-mints a
// one-of-a-kind seed; Color + Expression stay explicit. (build-23 feedback.)
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

  // Hero entrance: the blob grows from the background to fill the foreground.
  const hero = useSharedValue(0);
  useEffect(() => {
    if (!visible) {
      hero.value = 0;
      return;
    }
    hero.value = reducedMotion
      ? 1
      : withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [visible, reducedMotion, hero]);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: hero.value,
    transform: [{ scale: 0.6 + hero.value * 0.4 }],
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

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSeed(`${uid}:${generateId(8)}`);
    pop();
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(editing);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Edit your blob</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          <Animated.View style={heroStyle}>
            <BlobAvatar size={168} config={editing} seed={uid} animated />
          </Animated.View>
          <Pressable
            onPress={handleShuffle}
            style={({ pressed }) => [
              styles.shuffle,
              pressed && styles.shufflePressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Shuffle blob shape"
          >
            <Ionicons name="shuffle" size={22} color={Colors.text} />
            <Text style={styles.shuffleText}>Shuffle</Text>
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Text style={styles.label}>Color</Text>
          <View style={styles.optionsRow}>
            {BLOB_AVATAR_COLORS.map((option) => {
              const selected = colorPreset === option;
              const swatch = BLOB_PALETTES[option];
              return (
                <Pressable
                  key={option}
                  style={styles.swatchWrapper}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setColorPreset(option);
                  }}
                >
                  <View
                    style={[
                      styles.swatchRing,
                      selected && {
                        borderColor: Colors.primary,
                        borderWidth: 2.5,
                      },
                    ]}
                  >
                    <Svg width={36} height={36} viewBox="0 0 36 36">
                      <Defs>
                        <LinearGradient
                          id={`sw-${option}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <Stop offset="0" stopColor={swatch.start} />
                          <Stop offset="1" stopColor={swatch.end} />
                        </LinearGradient>
                      </Defs>
                      <Circle
                        cx={18}
                        cy={18}
                        r={16}
                        fill={`url(#sw-${option})`}
                      />
                    </Svg>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Expression</Text>
          <View style={styles.optionsRow}>
            {BLOB_AVATAR_EYES.map((option) => {
              const selected = eyesPreset === option;
              return (
                <Pressable
                  key={option}
                  style={styles.previewWrapper}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEyesPreset(option);
                  }}
                >
                  <View
                    style={[
                      styles.previewBorder,
                      selected && {
                        borderColor: Colors.primary,
                        borderWidth: 2.5,
                      },
                    ]}
                  >
                    <BlobAvatar
                      size={44}
                      config={{ ...editing, eyesPreset: option }}
                      seed={uid}
                    />
                  </View>
                  <Text
                    style={[
                      styles.previewLabel,
                      selected && styles.previewLabelSelected,
                    ]}
                  >
                    {BLOB_DISPLAY_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
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
    stage: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.xl,
      gap: Spacing.lg,
    },
    shuffle: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    shufflePressed: {
      backgroundColor: Colors.backgroundSecondary,
    },
    shuffleText: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    controls: {
      paddingHorizontal: Spacing.lg,
    },
    label: {
      fontSize: Typography.labelMedium,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    optionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    swatchWrapper: {
      alignItems: "center",
    },
    swatchRing: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    previewWrapper: {
      alignItems: "center",
      gap: 4,
    },
    previewBorder: {
      width: 56,
      height: 56,
      borderRadius: Radius.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    previewLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      ...Font.medium,
    },
    previewLabelSelected: {
      color: Colors.primary,
      ...Font.semibold,
    },
  });
