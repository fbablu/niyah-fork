import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { BlobAvatar, BlobEyes } from "../BlobAvatar";
import { Spacing, Radius, type ThemeColors } from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import {
  BLOB_AVATAR_COLORS,
  BLOB_AVATAR_EYES,
  BLOB_DISPLAY_LABELS,
  BLOB_PALETTES,
  type BlobAvatarColorPreset,
  type BlobAvatarConfig,
  type BlobAvatarEyesPreset,
} from "../../constants/blobAvatar";

interface BlobOptionRowsProps {
  /** The in-progress config being edited (drives selection + previews). */
  editing: BlobAvatarConfig;
  uid: string;
  onSelectColor: (option: BlobAvatarColorPreset) => void;
  onSelectEyes: (option: BlobAvatarEyesPreset) => void;
  /** Re-mints the generative shape seed (existing shuffle semantics). */
  onShuffleShape: () => void;
}

// Eye-glyph tile canvas — geometry mirrors the "unique" shape's eye spec so
// the option glyphs read exactly like the avatar's eyes.
const EYE_W = 44;
const EYE_H = 26;

// The customizer's three side-scroll option rows (profile-tab-blob-customizer
// frame): eye shapes / colors / shapes. Selected option sits in a
// backgroundSecondary circle.
export function BlobOptionRows({
  editing,
  uid,
  onSelectColor,
  onSelectEyes,
  onShuffleShape,
}: BlobOptionRowsProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <View style={styles.rows}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowPill}
        contentContainerStyle={styles.rowContent}
      >
        {BLOB_AVATAR_EYES.map((option) => {
          const selected = editing.eyesPreset === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectEyes(option);
              }}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="button"
              accessibilityLabel={BLOB_DISPLAY_LABELS[option]}
              accessibilityState={{ selected }}
            >
              <Svg
                width={EYE_W}
                height={EYE_H}
                viewBox={`0 0 ${EYE_W} ${EYE_H}`}
              >
                <BlobEyes
                  eyesPreset={option}
                  centerX={EYE_W / 2}
                  centerY={EYE_H / 2}
                  eyeGap={18}
                  eyeRadius={4.2}
                />
              </Svg>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* TODO(profile-redesign): the Figma color row ends with a paintpalette
          custom-color swatch (docs/profile-redesign-brief.md, frame 401:106).
          Deferred: firestore.rules limits blobAvatar to hasOnly(colorPreset/
          shapePreset/eyesPreset/shapeSeed) and normalizeBlobAvatarConfig only
          accepts the 6 named presets, so an arbitrary color wouldn't survive
          validation. Needs a rules + normalizer change first. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowPill}
        contentContainerStyle={styles.rowContent}
      >
        {BLOB_AVATAR_COLORS.map((option) => {
          const selected = editing.colorPreset === option;
          const swatch = BLOB_PALETTES[option];
          return (
            <Pressable
              key={option}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectColor(option);
              }}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="button"
              accessibilityLabel={BLOB_DISPLAY_LABELS[option]}
              accessibilityState={{ selected }}
            >
              <Svg width={32} height={32} viewBox="0 0 32 32">
                <Defs>
                  <LinearGradient
                    id={`sw-${option}`}
                    x1="0.25"
                    y1="0"
                    x2="0.75"
                    y2="1"
                  >
                    <Stop offset="0" stopColor={swatch.start} />
                    <Stop offset="1" stopColor={swatch.end} />
                  </LinearGradient>
                </Defs>
                <Circle cx={16} cy={16} r={15} fill={`url(#sw-${option})`} />
              </Svg>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowPill}
        contentContainerStyle={styles.rowContent}
      >
        {/* Shapes stay generative: the current one-of-a-kind shape, plus a
            shuffle tile that re-mints the seed (shuffle-in-shape-row). */}
        <View
          style={[styles.option, styles.optionSelected]}
          accessibilityLabel="Current blob shape"
        >
          <BlobAvatar size={40} config={editing} seed={uid} />
        </View>
        <Pressable
          onPress={onShuffleShape}
          style={styles.option}
          accessibilityRole="button"
          accessibilityLabel="Shuffle blob shape"
        >
          <Ionicons name="shuffle" size={22} color={Colors.text} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    rows: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    rowPill: {
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.xl,
      flexGrow: 0,
    },
    rowContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    option: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    optionSelected: {
      backgroundColor: Colors.backgroundSecondary,
    },
  });
