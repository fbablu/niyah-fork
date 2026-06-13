import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import * as Haptics from "expo-haptics";
import {
  Card,
  Button,
  SessionScreenScaffold,
  withErrorBoundary,
} from "../../src/components";
import { usePartnerStore } from "../../src/store/partnerStore";
import { REPUTATION_LEVELS } from "../../src/constants/config";
import { Partner } from "../../src/types";

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

function PartnerSelectionScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const { partners, currentPartner, selectPartner, sendInvite } =
    usePartnerStore();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const handleSelectPartner = (oderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectPartner(oderId);
    router.back();
  };

  const handleSendInvite = () => {
    if (inviteEmail && inviteName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sendInvite(inviteEmail, inviteName);
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
    }
  };

  const getReputationLabel = (level: string) => {
    const levelInfo =
      REPUTATION_LEVELS[level as keyof typeof REPUTATION_LEVELS];
    return levelInfo?.label || level;
  };

  const getReputationColor = (score: number) => {
    if (score >= 80) return Colors.gain;
    if (score >= 60) return Colors.primary;
    if (score >= 40) return Colors.warning;
    return Colors.loss;
  };

  const renderPartnerCard = (partner: Partner) => {
    const isSelected = currentPartner?.oderId === partner.oderId;

    return (
      <Pressable
        key={partner.id}
        onPress={() => handleSelectPartner(partner.oderId)}
      >
        <Card
          style={[styles.partnerCard, isSelected && styles.partnerCardSelected]}
        >
          <View style={styles.partnerRow}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerInitial}>
                {partner.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.partnerInfo}>
              <View style={styles.partnerNameRow}>
                <Text style={styles.partnerName}>{partner.name}</Text>
                {partner.tag && (
                  <View style={styles.partnerTag}>
                    <Text style={styles.partnerTagText}>{partner.tag}</Text>
                  </View>
                )}
              </View>
              <View style={styles.partnerMeta}>
                <View
                  style={[
                    styles.reputationDot,
                    {
                      backgroundColor: getReputationColor(
                        partner.reputation.score,
                      ),
                    },
                  ]}
                />
                <Text style={styles.reputationText}>
                  {getReputationLabel(partner.reputation.level)} (
                  {partner.reputation.score})
                </Text>
              </View>
              <Text style={styles.sessionsText}>
                {partner.totalSessionsTogether} sessions together
              </Text>
            </View>
            {isSelected && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>Selected</Text>
              </View>
            )}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SessionScreenScaffold
      headerVariant="back"
      title="Choose Your Partner"
      subtitle="Select an accountability partner for this session"
      backgroundColor={Colors.primaryDark}
    >
      {/* Partner List */}
      {partners.length > 0 ? (
        <View style={styles.partnerList}>
          {partners.map(renderPartnerCard)}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Partners Yet</Text>
          <Text style={styles.emptyText}>
            Invite a friend to be your accountability partner. You'll both stake
            money and keep each other focused.
          </Text>
        </Card>
      )}

      {/* Invite Section */}
      {showInvite ? (
        <Card style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Invite a Partner</Text>
          <TextInput
            style={styles.input}
            placeholder="Friend's name"
            placeholderTextColor={WHITE_55}
            value={inviteName}
            onChangeText={setInviteName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Friend's email"
            placeholderTextColor={WHITE_55}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.inviteButtons}>
            <View style={styles.inviteButtonFlex}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowInvite(false)}
                style={styles.glassButton}
                textStyle={styles.glassButtonText}
              />
            </View>
            <View style={styles.inviteButtonFlex}>
              <Button
                title="Send Invite"
                onPress={handleSendInvite}
                disabled={!inviteEmail || !inviteName}
                style={styles.pillButton}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Pressable style={styles.addButton} onPress={() => setShowInvite(true)}>
          <Text style={styles.addButtonText}>+ Invite New Partner</Text>
        </Pressable>
      )}

      {/* Info Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Reputation Scores</Text>
        <Text style={styles.infoText}>
          Reputation reflects payment reliability. Partners who always pay when
          they lose have high scores. Flaky payers get low scores and may be
          excluded from groups.
        </Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.gain }]} />
          <Text style={styles.legendText}>80+ Oak - Highly trusted</Text>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[styles.legendDot, { backgroundColor: Colors.primary }]}
          />
          <Text style={styles.legendText}>60+ Tree - Reliable</Text>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[styles.legendDot, { backgroundColor: Colors.warning }]}
          />
          <Text style={styles.legendText}>40+ Sapling - Building trust</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.loss }]} />
          <Text style={styles.legendText}>Below 40 - Needs improvement</Text>
        </View>
      </Card>
    </SessionScreenScaffold>
  );
}

const PartnerSelectionScreen = withErrorBoundary(
  PartnerSelectionScreenInner,
  "partner",
);
export default PartnerSelectionScreen;

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    partnerList: {
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    // Partner rows: glassLight seats; the chosen one becomes the brand
    // surface (primary fill + white@0.25 border).
    partnerCard: {
      marginBottom: 0,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    partnerCardSelected: {
      backgroundColor: Colors.primary,
      borderWidth: 1,
      borderColor: WHITE_25,
    },
    partnerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    partnerAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    partnerInitial: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.white,
    },
    partnerInfo: {
      flex: 1,
    },
    partnerNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      flexWrap: "wrap",
    },
    partnerTag: {
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.full,
      paddingVertical: 2,
      paddingHorizontal: Spacing.sm,
    },
    partnerTagText: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.white,
    },
    partnerName: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.xs,
    },
    partnerMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    reputationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: Spacing.xs,
    },
    reputationText: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
    sessionsText: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
    },
    // Selected-state flip: white pill, primaryDark content.
    checkmark: {
      backgroundColor: Colors.white,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
    },
    checkmarkText: {
      fontSize: Typography.labelSmall,
      ...Font.semibold,
      color: Colors.primaryDark,
    },
    emptyCard: {
      alignItems: "center",
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.lg,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    emptyTitle: {
      fontSize: Typography.titleMedium,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.sm,
    },
    emptyText: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      textAlign: "center",
      lineHeight: 20,
    },
    addButton: {
      alignItems: "center",
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    addButtonText: {
      fontSize: Typography.bodyMedium,
      color: Colors.white,
      ...Font.semibold,
    },
    inviteCard: {
      marginBottom: Spacing.lg,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    inviteTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.md,
      padding: Spacing.md,
      fontSize: Typography.bodyMedium,
      color: Colors.white,
      borderWidth: 1,
      borderColor: "transparent",
      marginBottom: Spacing.md,
    },
    inviteButtons: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    inviteButtonFlex: {
      flex: 1,
    },
    // Shared Buttons restyled via public style/textStyle props only.
    pillButton: {
      borderRadius: Radius.full,
    },
    glassButton: {
      borderRadius: Radius.full,
      backgroundColor: Colors.glassDark,
    },
    glassButtonText: {
      color: Colors.white,
    },
    infoCard: {
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    infoTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.sm,
    },
    infoText: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      lineHeight: 20,
      marginBottom: Spacing.md,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: Spacing.sm,
    },
    legendText: {
      fontSize: Typography.labelSmall,
      color: WHITE_70,
    },
  });
