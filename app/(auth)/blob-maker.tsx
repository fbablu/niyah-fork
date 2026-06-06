import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Ellipse, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Spacing, Radius, type ThemeColors } from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  AuthScreenScaffold,
  BlobAvatar,
  Button,
  MorphingBlob,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { generateId } from "../../src/utils/id";
import {
  BLOB_AVATAR_COLORS,
  BLOB_PALETTES,
  generateBlobAvatarPreset,
  generateBlobPoints,
  type BlobAvatarColorPreset,
} from "../../src/constants/blobAvatar";

interface Roll {
  seed: string;
  colorPreset: BlobAvatarColorPreset;
}

const HISTORY_MAX = 5;

const pickNextColor = (
  current: BlobAvatarColorPreset,
): BlobAvatarColorPreset => {
  const options = BLOB_AVATAR_COLORS.filter((c) => c !== current);
  return options[Math.floor(Math.random() * options.length)];
};

export default function BlobMakerScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  // Size the blob so the whole stage (blob + podium + shuffle + history) fits a
  // 667pt screen (iPhone SE) inside the non-scrollable scaffold.
  const { height } = useWindowDimensions();
  const blobSize = Math.max(140, Math.min(190, Math.round(height * 0.22)));
  // Pull the podium up under the blob: its top-surface dish lands where the
  // average generated blob's lowest point sits (~0.83 of the box), so the
  // blob reads as standing on it for any seed.
  const podiumOverlap = Math.round(blobSize * 0.29);
  const { user, firebaseUser, setBlobAvatar } = useAuthStore();
  const uid = user?.id || firebaseUser?.uid || "guest";

  // The opening blob is the user's canonical one — derived from their uid, so
  // continuing without rolling still keeps a stable one-of-a-kind shape.
  const [roll, setRoll] = useState<Roll>(() => ({
    seed: uid,
    colorPreset: generateBlobAvatarPreset(uid).colorPreset,
  }));
  const [history, setHistory] = useState<Roll[]>([]);

  const points = useMemo(() => generateBlobPoints(roll.seed), [roll.seed]);
  const palette = BLOB_PALETTES[roll.colorPreset];

  const shuffleSpin = useSharedValue(0);
  const shuffleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shuffleSpin.value}deg` }],
  }));

  const stashCurrent = (current: Roll, removeSeed?: string) => {
    setHistory((h) =>
      [
        current,
        ...h.filter((r) => r.seed !== current.seed && r.seed !== removeSeed),
      ].slice(0, HISTORY_MAX),
    );
  };

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!reducedMotion) {
      shuffleSpin.value = withTiming(shuffleSpin.value + 360, {
        duration: 550,
        easing: Easing.out(Easing.cubic),
      });
    }
    stashCurrent(roll);
    setRoll((cur) => ({
      seed: `${uid}:${generateId(8)}`,
      colorPreset: pickNextColor(cur.colorPreset),
    }));
  };

  const handleHistorySelect = (item: Roll) => {
    Haptics.selectionAsync();
    stashCurrent(roll, item.seed);
    setRoll(item);
  };

  const handleContinue = () => {
    setBlobAvatar({
      colorPreset: roll.colorPreset,
      shapePreset: "unique",
      eyesPreset: "classic",
      // The uid is the implicit fallback seed; only rolled seeds need storing.
      ...(roll.seed === uid ? {} : { shapeSeed: roll.seed }),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(auth)/intake" as never);
  };

  return (
    <AuthScreenScaffold
      showBack={false}
      keyboardAware={false}
      title={"Meet your\nblob"}
      subtitle="Every shuffle is one of a kind. Keep going until it feels like you."
      footer={
        <Button title="Keep this blob" onPress={handleContinue} size="large" />
      }
    >
      <View style={styles.stage}>
        {/* Blob + podium are one fixed-geometry unit (no flex gap between
            them) so the dish contact stays put across rolls and devices. */}
        <View style={styles.stand}>
          {/* Tapping the blob reshuffles too — it's a toy, not just a preview. */}
          <Pressable
            onPress={handleShuffle}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="New blob"
          >
            <MorphingBlob points={points} palette={palette} size={blobSize} />
          </Pressable>

          <Svg
            width={blobSize * 1.35}
            height={blobSize * 0.47}
            viewBox="0 0 240 84"
            style={{ marginTop: -podiumOverlap }}
          >
            <Path
              d="M 16 22 L 26 62 Q 28 74 40 74 L 200 74 Q 212 74 214 62 L 224 22 Z"
              fill={Colors.backgroundCard}
              stroke={Colors.border}
              strokeWidth={1.5}
            />
            <Ellipse
              cx={120}
              cy={22}
              rx={104}
              ry={16}
              fill={Colors.backgroundSecondary}
              stroke={Colors.border}
              strokeWidth={1.5}
            />
            <Ellipse
              cx={120}
              cy={20}
              rx={56}
              ry={8}
              fill="#000"
              opacity={0.12}
            />
          </Svg>
        </View>

        <Pressable
          onPress={handleShuffle}
          style={({ pressed }) => [
            styles.shuffle,
            pressed && styles.shufflePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Shuffle blob"
        >
          <Animated.View style={shuffleStyle}>
            <Ionicons name="shuffle" size={28} color={Colors.text} />
          </Animated.View>
        </Pressable>

        {/* Always mounted so the stage doesn't reflow on the first roll. */}
        <View style={styles.historyRow}>
          {history.map((item, index) => (
            <BlobAvatar
              key={item.seed}
              size={44}
              config={{
                colorPreset: item.colorPreset,
                shapePreset: "unique",
                eyesPreset: "classic",
                shapeSeed: item.seed,
              }}
              onPress={() => handleHistorySelect(item)}
              accessibilityLabel={`Previous blob ${index + 1} of ${history.length}`}
            />
          ))}
        </View>
      </View>
    </AuthScreenScaffold>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    stage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.md,
    },
    stand: {
      alignItems: "center",
    },
    shuffle: {
      width: 68,
      height: 68,
      borderRadius: Radius.full,
      backgroundColor: Colors.backgroundCard,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    shufflePressed: {
      backgroundColor: Colors.backgroundSecondary,
    },
    historyRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      minHeight: 48,
      alignItems: "center",
    },
  });
