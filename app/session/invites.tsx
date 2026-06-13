import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type RelativePathString } from "expo-router";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  Card,
  Button,
  withErrorBoundary,
  StatusBanner,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useWalletStore } from "../../src/store/walletStore";
import { formatMoney } from "../../src/utils/format";
import { getFunctionErrorMessage } from "../../src/utils/errors";
import { validateAndPromptForAppSelection } from "../../src/config/screentime";
import type { GroupInvite } from "../../src/types";

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert milliseconds to a human-readable duration string. */
const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / (1000 * 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
};

/** Capitalize first letter of a cadence type for display. */
const formatCadenceLabel = (cadence: string): string =>
  cadence.charAt(0).toUpperCase() + cadence.slice(1);

// ─── Component ────────────────────────────────────────────────────────────────

function GroupInvitesScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  const { pendingInvites, acceptInvite, declineInvite } =
    useGroupSessionStore();
  const hydrateWallet = useWalletStore((state) => state.hydrate);
  const userId = useAuthStore((state) => state.user?.id);

  const [loadingAccept, setLoadingAccept] = useState<string | null>(null);
  const [loadingDecline, setLoadingDecline] = useState<string | null>(null);

  const handleAccept = useCallback(
    async (inviteId: string) => {
      const invite = pendingInvites.find((i) => i.id === inviteId);
      if (!invite) return;

      // You block your OWN apps for the session — ensure auth + a selection
      // before staking, so your block summary joins the group and you're
      // actually shielded. Prompts inline; aborts (no stake) if declined.
      const gate = await validateAndPromptForAppSelection();
      if (!gate.ok) {
        StatusBanner.show({
          severity: "warn",
          message:
            gate.reason === "needs-auth"
              ? "Screen Time access is required to block apps for this session."
              : "Pick at least one app or category to block before accepting.",
        });
        return;
      }

      setLoadingAccept(inviteId);
      try {
        await acceptInvite(inviteId);
        // CF deducted stake from Firestore wallet — sync local balance.
        if (userId) hydrateWallet(userId);
        router.replace(
          `/session/waiting-room?sessionId=${invite.sessionId}` as RelativePathString,
        );
      } catch (err) {
        StatusBanner.show({
          severity: "error",
          message: getFunctionErrorMessage(err, "Could not accept invite."),
        });
      } finally {
        setLoadingAccept(null);
      }
    },
    [acceptInvite, hydrateWallet, pendingInvites, router, userId],
  );

  const handleDecline = useCallback(
    async (inviteId: string) => {
      setLoadingDecline(inviteId);
      try {
        await declineInvite(inviteId);
      } catch (err) {
        StatusBanner.show({
          severity: "error",
          message: getFunctionErrorMessage(
            err,
            "Could not decline invite. Please try again.",
          ),
        });
      } finally {
        setLoadingDecline(null);
      }
    },
    [declineInvite],
  );

  const renderInvite = (invite: GroupInvite) => {
    const isAccepting = loadingAccept === invite.id;
    const isDeclining = loadingDecline === invite.id;
    const isLoading = isAccepting || isDeclining;

    return (
      <Card key={invite.id} style={styles.inviteCard}>
        {/* Sender info */}
        <View style={styles.senderRow}>
          {invite.fromUserImage ? (
            <Image
              source={{ uri: invite.fromUserImage }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {(invite.fromUserName ?? "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.senderInfo}>
            <Text style={styles.fromLabel}>From</Text>
            <Text style={styles.fromName}>{invite.fromUserName}</Text>
          </View>
        </View>

        {/* Session details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stake</Text>
            <Text style={styles.detailValue}>{formatMoney(invite.stake)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>
              {formatDuration(invite.duration)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cadence</Text>
            <Text style={styles.detailValue}>
              {formatCadenceLabel(invite.cadence)}
            </Text>
          </View>
        </View>

        {/* Solo-stake semantics (de-pool): your money, your outcome. */}
        <Text style={styles.soloNote}>
          You stake your own money. Finish your session and you get it back —
          your friends&apos; results never change yours.
        </Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <View style={styles.buttonFlex}>
            <Button
              title="Decline"
              variant="outline"
              onPress={() => handleDecline(invite.id)}
              loading={isDeclining}
              disabled={isLoading}
              style={styles.outlineButton}
              textStyle={styles.outlineButtonText}
            />
          </View>
          <View style={styles.buttonFlex}>
            <Button
              title="Accept"
              variant="primary"
              onPress={() => handleAccept(invite.id)}
              loading={isAccepting}
              disabled={isLoading}
              style={styles.pillButton}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={20}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Group Invites</Text>
          <Text style={styles.subtitle}>
            Respond to session invitations from friends
          </Text>
        </View>

        {/* Invite list or empty state */}
        {pendingInvites && pendingInvites.length > 0 ? (
          <View style={styles.inviteList}>
            {pendingInvites.map(renderInvite)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>-</Text>
            <Text style={styles.emptyTitle}>No Pending Invites</Text>
            <Text style={styles.emptyText}>
              When someone invites you to a group session, it will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const GroupInvitesScreen = withErrorBoundary(
  GroupInvitesScreenInner,
  "invites",
);
export default GroupInvitesScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    // Full-bleed green brand field (docs/redesign-all-tabs-progress.md).
    container: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    header: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    backText: {
      color: WHITE_70,
      fontSize: Typography.bodyLarge,
      ...Font.medium,
    },
    titleSection: {
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.white,
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      marginTop: Spacing.xs,
      textAlign: "center",
    },

    // ─── Invite list: glassLight seats ────────────────────────────────
    inviteList: {
      gap: Spacing.md,
    },
    inviteCard: {
      marginBottom: 0,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },

    // ─── Sender row ───────────────────────────────────────────────────
    senderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: Spacing.md,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    avatarInitial: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.white,
    },
    senderInfo: {
      flex: 1,
    },
    fromLabel: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      marginBottom: Spacing.xs,
    },
    fromName: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
    },

    // ─── Session details: dark-glass inset panel ──────────────────────
    detailsSection: {
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    detailLabel: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
    },
    detailValue: {
      fontSize: Typography.bodySmall,
      ...Font.medium,
      color: Colors.white,
    },
    soloNote: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      marginTop: Spacing.md,
      lineHeight: 18,
    },

    // ─── Buttons (shared Button styled via public props only) ─────────
    buttonRow: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
    pillButton: {
      borderRadius: Radius.full,
    },
    outlineButton: {
      borderRadius: Radius.full,
      borderColor: WHITE_55,
    },
    outlineButtonText: {
      color: Colors.white,
    },

    // ─── Empty state ──────────────────────────────────────────────────
    emptyContainer: {
      alignItems: "center",
      paddingVertical: Spacing.xxl,
    },
    emptyIcon: {
      fontSize: Typography.displaySmall,
      color: WHITE_55,
      marginBottom: Spacing.md,
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
      paddingHorizontal: Spacing.lg,
    },
  });
