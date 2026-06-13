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
// the option glyphs read exactly like the avatar's eyes (black ink on the
// green row, per frame 429:347).
const EYE_W = 44;
const EYE_H = 26;

// v2 exact values (frame 429:347): rows are primary bars rounded ~33 at ~81%
// width; the selected option sits in a glassMid squircle 64 rounded ~26.
// Both radii are design-load-bearing — intentionally not Radius tokens.
const ROW_RADIUS = 33;
const OPTION_SIZE = 64;
const OPTION_RADIUS = 26;
const ROW_WIDTH = "81%";
/** White shuffle-tile disk (frame 429:347, ellipse 429:551 ≈ 36pt). */
const SHUFFLE_DISK = 36;

// The customizer's three side-scroll option rows (profile-tab-blob-customizer
// frame 429:347): eye shapes / colors / shapes. Selected option sits in a
// glassMid squircle on the primary-green row.
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
          {/* Black shuffle glyph on a white disk (frame 429:347). */}
          <View style={styles.shuffleDisk}>
            <Ionicons name="shuffle" size={22} color={Colors.black} />
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    rows: {
      alignItems: "center",
      gap: Spacing.md,
    },
    rowPill: {
      width: ROW_WIDTH,
      backgroundColor: Colors.primary,
      borderRadius: ROW_RADIUS,
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
      width: OPTION_SIZE,
      height: OPTION_SIZE,
      borderRadius: OPTION_RADIUS,
      alignItems: "center",
      justifyContent: "center",
    },
    optionSelected: {
      backgroundColor: Colors.glassMid,
    },
    shuffleDisk: {
      width: SHUFFLE_DISK,
      height: SHUFFLE_DISK,
      borderRadius: Radius.full,
      backgroundColor: Colors.white,
      alignItems: "center",
      justifyContent: "center",
    },
  });
