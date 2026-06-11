import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

interface BlobMakerStageProps {
  /** The in-progress config being edited (hero preview). */
  editing: BlobAvatarConfig;
  uid: string;
  /** Animated slingshot style owned by the sheet (entrance/collapse). */
  heroStyle: StyleProp<ViewStyle>;
  /** Die tap — the stage spins the die itself; randomizing is the sheet's. */
  onRandomize: () => void;
  /** Collapse arrows — saves and slingshots back onto the platform. */
  onSaveCollapse: () => void;
}

const DIE_SPIN_MS = 400;

// Customizer hero zone (frame 401:106): die (randomize-all) on the left,
// hero blob center, collapse arrows on the right.
export function BlobMakerStage({
  editing,
  uid,
  heroStyle,
  onRandomize,
  onSaveCollapse,
}: BlobMakerStageProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const reducedMotion = useReducedMotion();

  // "The die icon simply spins" (design comment 2) — one full turn per tap.
  const dieSpin = useSharedValue(0);
  const dieStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${dieSpin.value * 360}deg` }],
  }));
  const handleDie = () => {
    if (!reducedMotion) {
      dieSpin.value = withTiming(dieSpin.value + 1, { duration: DIE_SPIN_MS });
    }
    onRandomize();
  };

  return (
    <View style={styles.stage}>
      <Pressable
        onPress={handleDie}
        style={({ pressed }) => [
          styles.stageButton,
          pressed && styles.stageButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Randomize your blob"
      >
        <Animated.View style={dieStyle}>
          <Ionicons name="dice-outline" size={24} color={Colors.text} />
        </Animated.View>
      </Pressable>

      <Animated.View style={heroStyle}>
        <BlobAvatar size={168} config={editing} seed={uid} animated />
      </Animated.View>

      <Pressable
        onPress={onSaveCollapse}
        style={({ pressed }) => [
          styles.stageButton,
          pressed && styles.stageButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Save and collapse"
      >
        <Ionicons name="contract" size={24} color={Colors.text} />
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
      gap: Spacing.md,
      paddingVertical: Spacing.xl,
    },
    stageButton: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    stageButtonPressed: {
      backgroundColor: Colors.backgroundSecondary,
    },
  });
