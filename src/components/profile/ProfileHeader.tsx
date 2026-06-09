import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { BlobAvatar } from "../BlobAvatar";
import { BlobMakerSheet } from "./BlobMakerSheet";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { REPUTATION_LEVELS } from "../../constants/config";
import type { User } from "../../types";
import {
  generateBlobAvatarPreset,
  type BlobAvatarConfig,
} from "../../constants/blobAvatar";

interface ProfileHeaderProps {
  user: User | null;
  followingCount: number;
  partnerCount: number;
  onBlobAvatarChange?: (blobAvatar: BlobAvatarConfig) => void;
}

export function ProfileHeader({
  user,
  followingCount,
  partnerCount,
  onBlobAvatarChange,
}: ProfileHeaderProps) {
  const Colors = useColors();
  const router = useRouter();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  const [editorVisible, setEditorVisible] = React.useState(false);
  const avatarConfig = React.useMemo(
    () => user?.blobAvatar || generateBlobAvatarPreset(user?.id || "guest"),
    [user?.blobAvatar, user?.id],
  );

  const reputation = user?.reputation;
  const reputationLevel = reputation?.level || "sapling";
  const reputationInfo =
    REPUTATION_LEVELS[reputationLevel as keyof typeof REPUTATION_LEVELS];

  const getReputationColor = (score: number) => {
    if (score >= 80) return Colors.gain;
    if (score >= 60) return Colors.primary;
    if (score >= 40) return Colors.warning;
    return Colors.loss;
  };

  const editable = !!user && !!onBlobAvatarChange;
  const openEditor = () => {
    if (!editable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditorVisible(true);
  };

  return (
    <View style={styles.header}>
      <View style={styles.avatarWrap}>
        <BlobAvatar
          size={92}
          config={avatarConfig}
          seed={user?.id}
          animated
          onPress={editable ? openEditor : undefined}
          accessibilityLabel={editable ? "Edit your blob" : undefined}
        />
        {editable && (
          <Pressable
            onPress={openEditor}
            style={styles.editBadge}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit your blob"
          >
            <Ionicons name="pencil" size={14} color={Colors.white} />
          </Pressable>
        )}
      </View>
      <Text style={styles.name}>{user?.name || "?"}</Text>
      <Text style={styles.email}>{user?.email || ""}</Text>

      <View style={styles.reputationBadge}>
        <View
          style={[
            styles.reputationDot,
            {
              backgroundColor: getReputationColor(reputation?.score || 50),
            },
          ]}
        />
        <Text style={styles.reputationText}>
          {reputationInfo?.label || "Sapling"} - {reputation?.score || 50}
          /100
        </Text>
      </View>

      <View style={styles.headerStatsRow}>
        <Pressable
          style={styles.headerStatItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/(tabs)/friends",
              params: { tab: "following" },
            });
          }}
        >
          <Text style={styles.headerStatValue}>{followingCount}</Text>
          <Text style={styles.headerStatLabel}>Following</Text>
        </Pressable>
        <View style={styles.headerStatDivider} />
        <Pressable
          style={styles.headerStatItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/(tabs)/friends",
              params: { tab: "partners" },
            });
          }}
        >
          <Text style={styles.headerStatValue}>{partnerCount}</Text>
          <Text style={styles.headerStatLabel}>Partners</Text>
        </Pressable>
      </View>

      {editable && (
        <BlobMakerSheet
          visible={editorVisible}
          onClose={() => setEditorVisible(false)}
          uid={user.id}
          config={avatarConfig}
          onSave={onBlobAvatarChange}
        />
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    avatarWrap: {
      position: "relative",
    },
    editBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: Colors.background,
    },
    name: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.text,
      marginTop: Spacing.sm,
    },
    email: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      marginTop: Spacing.xs,
    },
    headerStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    headerStatItem: {
      alignItems: "center",
      minWidth: 88,
    },
    headerStatValue: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.text,
    },
    headerStatLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    headerStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.md,
    },
    reputationBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.backgroundCard,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      marginTop: Spacing.md,
    },
    reputationDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: Spacing.sm,
    },
    reputationText: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      ...Font.medium,
    },
  });
