import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { BlobAvatar } from "../BlobAvatar";
import { Spacing, Radius, type ThemeColors } from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { BlobAvatarConfig } from "../../constants/blobAvatar";

interface BlobMakerStageProps {
  /** The in-progress config being edited (hero preview). */
  editing: BlobAvatarConfig;
  uid: string;
  /** Animated hero style owned by the sheet (entrance/collapse). */
  heroStyle: StyleProp<ViewStyle>;
  /** Die tap — randomizing (and its content-swap dip) is the sheet's. */
  onRandomize: () => void;
  /** Collapse arrows — saves and settles back onto the platform. */
  onSaveCollapse: () => void;
}

// v3 motion spec (near-static): the die itself does not animate — randomize
// is an instant content change; the sheet dips the hero's opacity only.
/** Glass circle the hero blob floats on (frame 429:347). */
const HERO_CIRCLE = 200;

// Customizer hero zone (frame 429:347): die (randomize-all) on the left,
// hero blob on its glass circle in the center, collapse arrows on the right.
export function BlobMakerStage({
  editing,
  uid,
  heroStyle,
  onRandomize,
  onSaveCollapse,
}: BlobMakerStageProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <View style={styles.stage}>
      <Pressable
        onPress={onRandomize}
        style={({ pressed }) => [
          styles.stageButton,
          pressed && styles.stageButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Randomize your blob"
      >
        <Ionicons name="dice-outline" size={24} color={Colors.white} />
      </Pressable>

      <View style={styles.heroCircle}>
        <Animated.View style={heroStyle}>
          <BlobAvatar size={168} config={editing} seed={uid} animated />
        </Animated.View>
      </View>

      <Pressable
        onPress={onSaveCollapse}
        style={({ pressed }) => [
          styles.stageButton,
          pressed && styles.stageButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Save and collapse"
      >
        <Ionicons name="contract" size={24} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    stage: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
    stageButton: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.glassLight,
    },
    stageButtonPressed: {
      backgroundColor: Colors.glassMid,
    },
    heroCircle: {
      width: HERO_CIRCLE,
      height: HERO_CIRCLE,
      borderRadius: Radius.full,
      backgroundColor: Colors.glassLight,
      alignItems: "center",
      justifyContent: "center",
    },
  });
