import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import type { User } from "../../types";

interface ProfileHeaderProps {
  user: User | null;
  followingCount: number;
  partnerCount: number;
}

// Header info card (profile-tab-normal frame 352:320): name + email on the
// left, Following | Partners counters on the right. The avatar lives on the
// BlobPlatform zone below — this card intentionally renders no blob, and
// Clout (CloutCard) replaced the old reputation badge.
export function ProfileHeader({
  user,
  followingCount,
  partnerCount,
}: ProfileHeaderProps) {
  const Colors = useColors();
  const router = useRouter();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);

  const goToFriends = (tab: "following" | "partners") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/(tabs)/friends", params: { tab } });
  };

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <Text
          style={styles.name}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {user?.name || "?"}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {user?.email || ""}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Pressable
          style={styles.statItem}
          onPress={() => goToFriends("following")}
          accessibilityRole="button"
          accessibilityLabel={`${followingCount} following`}
        >
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={styles.statItem}
          onPress={() => goToFriends("partners")}
          accessibilityRole="button"
          accessibilityLabel={`${partnerCount} partners`}
        >
          <Text style={styles.statValue}>{partnerCount}</Text>
          <Text style={styles.statLabel}>Partners</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Glass card on the full-bleed green profile screen (v2, node 429:186):
// width is proportional (92.5% of the 402 frame), never a fixed px copy.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: "92.5%",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    identity: {
      flex: 1,
      marginRight: Spacing.md,
    },
    name: {
      fontSize: Typography.headlineLarge,
      ...Font.bold,
      color: Colors.white,
    },
    email: {
      fontSize: Typography.bodyMedium,
      color: Colors.white,
      marginTop: Spacing.xs,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statItem: {
      alignItems: "center",
      minWidth: 56,
    },
    statValue: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.white,
    },
    statLabel: {
      fontSize: Typography.labelMedium,
      color: Colors.white,
      marginTop: 2,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: Colors.white,
      marginHorizontal: Spacing.md,
    },
  });
