import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../constants/colors";
import { useColors } from "../hooks/useColors";

// Brand-surface treatment (index.tsx/friends.tsx WHITE_25 precedent): the
// sole consumer is the profile tab's glassDark functional zone on the green
// field, where the old primaryMuted tint + theme text washed out (and went
// dark-on-dark in light theme).
const WHITE_25 = "rgba(255, 255, 255, 0.25)";
const WHITE_70 = "rgba(255, 255, 255, 0.7)";

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    inviteCard: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: WHITE_25,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    inviteCardContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    inviteCardTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
    },
    inviteCardSubtitle: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
      marginTop: 2,
    },
    inviteBadge: {
      // glassDark, not primary — the badge has to read on the now-primary card
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.full,
      paddingVertical: 4,
      paddingHorizontal: Spacing.md,
    },
    inviteBadgeText: {
      fontSize: Typography.labelLarge,
      ...Font.bold,
      color: Colors.white,
    },
  });

interface InviteCTAProps {
  style?: object;
}

export const InviteCTA: React.FC<InviteCTAProps> = ({ style }) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/invite" as never);
      }}
      style={[styles.inviteCard, style]}
    >
      <View style={styles.inviteCardContent}>
        <View>
          <Text style={styles.inviteCardTitle}>Invite Friends</Text>
          <Text style={styles.inviteCardSubtitle}>
            Earn +10 social credit per referral
          </Text>
        </View>
        <View style={styles.inviteBadge}>
          <Text style={styles.inviteBadgeText}>+10</Text>
        </View>
      </View>
    </Pressable>
  );
};
