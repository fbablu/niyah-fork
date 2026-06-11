import React, { useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Platform,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import { useScreenProtection } from "../../src/hooks/useScreenProtection";
import { useThemeStore } from "../../src/store/themeStore";
import * as Haptics from "expo-haptics";
import {
  Card,
  LegalContentView,
  InviteCTA,
  withErrorBoundary,
  HoldToConfirmModal,
  StatusBanner,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import { useWalletStore } from "../../src/store/walletStore";
import { usePartnerStore } from "../../src/store/partnerStore";
import { useSocialStore } from "../../src/store/socialStore";
import { useSessionStore } from "../../src/store/sessionStore";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { formatMoney } from "../../src/utils/format";
import { Linking } from "react-native";
import {
  unlinkBankAccount,
  createStripeLoginLink,
  deleteAccount,
} from "../../src/config/functions";
import { getFunctionErrorMessage } from "../../src/utils/errors";
import {
  ProfileHeader,
  ScreenTimeCard,
  NeverBlockCard,
  TransactionHistory,
  BalanceSection,
  BlobPlatform,
  BlobMakerSheet,
  CloutCard,
  CloutInfoSheet,
  SessionCalendar,
  SessionReceiptSheet,
  type CalendarStamp,
} from "../../src/components/profile";
import { computeCloutScore, deriveCloutCounters } from "../../src/utils/clout";
import {
  deriveCalendarStamps,
  latestStampId,
} from "../../src/utils/calendarStamps";
import { getViolationsByCategory } from "../../src/config/screentime";
import { generateBlobAvatarPreset } from "../../src/constants/blobAvatar";
import { logger } from "../../src/utils/logger";

function ProfileScreenInner() {
  useScreenProtection("profile");
  const Colors = useColors();
  const { theme, toggleTheme } = useThemeStore();
  const router = useRouter();
  const { user, logout, setBlobAvatar, updateUser } = useAuthStore();
  // Granular field selectors so an unrelated store mutation doesn't re-render
  // the whole profile tab (each selector returns a stable single field).
  const balance = useWalletStore((s) => s.balance);
  const transactions = useWalletStore((s) => s.transactions);
  const pendingWithdrawal = useWalletStore((s) => s.pendingWithdrawal);
  const isWalletHydrated = useWalletStore((s) => s.isHydrated);
  const partners = usePartnerStore((s) => s.partners);
  const following = useSocialStore((s) => s.following);
  const loadMyFollows = useSocialStore((s) => s.loadMyFollows);
  const sessionHistory = useSessionStore((s) => s.sessionHistory);
  const groupSessionHistory = useGroupSessionStore(
    (s) => s.groupSessionHistory,
  );

  useEffect(() => {
    if (user?.id) {
      loadMyFollows(user.id).catch(() => {});
    }
  }, [user?.id, loadMyFollows]);

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [removeBankModalVisible, setRemoveBankModalVisible] = useState(false);
  const [bankActionLoading, setBankActionLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // Profile-tab redesign sheets (docs/profile-redesign-brief.md)
  const [blobSheetVisible, setBlobSheetVisible] = useState(false);
  const [cloutInfoVisible, setCloutInfoVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptStamp, setReceiptStamp] = useState<CalendarStamp | null>(null);
  const [receiptByCategory, setReceiptByCategory] = useState<Record<
    string,
    number
  > | null>(null);

  const avatarConfig = useMemo(
    () => user?.blobAvatar || generateBlobAvatarPreset(user?.id || "guest"),
    [user?.blobAvatar, user?.id],
  );

  const cloutScore = useMemo(
    () =>
      computeCloutScore(
        deriveCloutCounters({
          soloHistory: sessionHistory,
          groupHistory: groupSessionHistory,
          uid: user?.id ?? "",
          fallbackCompletedSessions: user?.completedSessions,
        }),
      ),
    [sessionHistory, groupSessionHistory, user?.id, user?.completedSessions],
  );

  const stamps = useMemo(
    () => deriveCalendarStamps(sessionHistory, groupSessionHistory),
    [sessionHistory, groupSessionHistory],
  );

  const handleStampPress = (stamp: CalendarStamp) => {
    // Prefer the per-session counts captured into history at completion and
    // carried on the stamp (design comment 5 — every receipt, not just the
    // newest). Sessions completed before that capture landed fall back to
    // the on-device shield tallies, which are cleared natively on every
    // startBlocking — so they only describe the MOST RECENT session, and
    // only while no newer session has started since. Anything else: null
    // (receipt renders without the app-activity block).
    if (stamp.byCategory) {
      setReceiptByCategory(stamp.byCategory);
    } else {
      const isLatest = stamp.sessionId === latestStampId(stamps);
      const sessionRunning =
        !!useSessionStore.getState().currentSession ||
        !!useGroupSessionStore.getState().activeGroupSession;
      setReceiptByCategory(
        isLatest && !sessionRunning ? getViolationsByCategory() : null,
      );
    }
    setReceiptStamp(stamp);
    setReceiptVisible(true);
  };

  const handleManageBank = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updateAction = async () => {
      try {
        const { url } = await createStripeLoginLink();
        await Linking.openURL(url);
      } catch (err) {
        logger.error("createStripeLoginLink failed:", err);
        StatusBanner.show({
          severity: "error",
          message: getFunctionErrorMessage(err, "Please try again."),
        });
      }
    };
    const removeAction = () => setRemoveBankModalVisible(true);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Update Bank with Stripe", "Remove bank"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          title: "Manage linked bank",
        },
        (idx) => {
          if (idx === 1) updateAction();
          else if (idx === 2) removeAction();
        },
      );
    } else {
      Alert.alert("Manage linked bank", undefined, [
        { text: "Update Bank with Stripe", onPress: updateAction },
        { text: "Remove bank", style: "destructive", onPress: removeAction },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const handleRemoveBankConfirmed = async () => {
    if (bankActionLoading) return;
    setBankActionLoading(true);
    try {
      await unlinkBankAccount();
      updateUser({ linkedBank: undefined });
      StatusBanner.show({
        severity: "success",
        message: "Bank removed. Add a new one any time from Withdraw.",
      });
    } catch (err) {
      logger.error("unlinkBankAccount failed:", err);
      StatusBanner.show({
        severity: "error",
        message: getFunctionErrorMessage(
          err,
          "Could not remove bank. Please try again.",
        ),
      });
    } finally {
      setBankActionLoading(false);
      setRemoveBankModalVisible(false);
    }
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            logger.error("Logout error:", error);
          }
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const result = await deleteAccount();
      if (result.ok) {
        setDeleteModalVisible(false);
        StatusBanner.show({
          severity: "success",
          message:
            "Account deleted. Any deposited balance is being refunded to your original payment method.",
        });
        await logout();
        router.replace("/(auth)/welcome");
        return;
      }
      // CF returns ok:false (HTTP 200) for the two recoverable cases so we can
      // guide the user rather than surface a raw error.
      setDeleteModalVisible(false);
      if (result.reason === "active_session") {
        Alert.alert(
          "Finish your session first",
          "You have a focus session in progress. Complete or surrender it, then delete your account.",
        );
      } else if (result.reason === "reauth_required") {
        Alert.alert(
          "Confirm it's you",
          "For your security, sign in again and then delete your account.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign in again",
              style: "destructive",
              onPress: async () => {
                try {
                  await logout();
                } catch (error) {
                  logger.error("Logout before re-auth failed:", error);
                }
                router.replace("/(auth)/welcome");
              },
            },
          ],
        );
      }
    } catch (err) {
      logger.error("deleteAccount failed:", err);
      setDeleteModalVisible(false);
      StatusBanner.show({
        severity: "error",
        message: getFunctionErrorMessage(
          err,
          "Could not delete account. Please try again.",
        ),
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const completionRate =
    user && user.totalSessions > 0
      ? Math.round((user.completedSessions / user.totalSessions) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1 — Header info card: name / email / Following | Partners */}
        <ProfileHeader
          user={user}
          followingCount={following.length}
          partnerCount={partners.length}
        />

        {/* 2 — Blob on its platform; expand slingshots into the customizer */}
        <View style={styles.blobZone}>
          <BlobPlatform
            config={avatarConfig}
            uid={user?.id ?? "guest"}
            customizerOpen={blobSheetVisible}
            onExpand={() => setBlobSheetVisible(true)}
          />
        </View>

        {/* 3 — Balance pill + all-time ticker + deposit/withdraw chooser */}
        <BalanceSection
          balanceCents={balance}
          transactions={transactions}
          onDeposit={() => router.push("/session/deposit")}
          onWithdraw={() => router.push("/session/withdraw")}
        />

        {/* 4 — Clout (replaces the social-credit ReputationCard here) */}
        <CloutCard
          score={cloutScore}
          onInfoPress={() => setCloutInfoVisible(true)}
        />

        {/* 5 — Streaks + collectible-stamp calendar */}
        <View style={styles.calendarSection}>
          <SessionCalendar
            stamps={stamps}
            streakCount={user?.currentStreak ?? 0}
            blobConfig={user?.blobAvatar}
            onStampPress={handleStampPress}
          />
        </View>

        {/* ── Functional cards the design doesn't show, below the calendar ── */}

        {/* Invite Friends Card */}
        <InviteCTA style={styles.inviteCard} />

        <ScreenTimeCard />
        <NeverBlockCard />

        {/* Linked Bank */}
        {user?.linkedBank && (
          <Card style={styles.balanceCard}>
            <View style={styles.bankCardHeader}>
              <View style={styles.bankCardInfo}>
                <Text style={styles.balanceLabel}>Linked Bank</Text>
                <Text style={styles.bankName}>
                  {(user.linkedBank as { institutionName?: string })
                    .institutionName ?? "Bank"}
                </Text>
                <Text style={styles.bankMask}>
                  Account ending in{" "}
                  {(user.linkedBank as { mask?: string }).mask ?? "****"}
                </Text>
              </View>
              <Pressable
                onPress={handleManageBank}
                style={styles.manageBankButton}
                hitSlop={10}
              >
                <Text style={styles.manageBankButtonText}>Manage</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Pending withdrawal (live-money info; deposit/withdraw moved into
            BalanceSection's +/- chooser) */}
        {pendingWithdrawal > 0 && (
          <Card style={styles.balanceCard}>
            <View style={styles.pendingRowStandalone}>
              <Text style={styles.pendingLabel}>Pending withdrawal</Text>
              <Text style={styles.pendingAmount}>
                {formatMoney(pendingWithdrawal)}
              </Text>
            </View>
          </Card>
        )}

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.miniStatCard}>
            <Text style={styles.miniStatValue}>{user?.totalSessions || 0}</Text>
            <Text style={styles.miniStatLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.miniStatCard}>
            <Text style={styles.miniStatValue}>{completionRate}%</Text>
            <Text style={styles.miniStatLabel}>Success</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.miniStatCard}>
            <Text style={styles.miniStatValue}>{user?.longestStreak || 0}</Text>
            <Text style={styles.miniStatLabel}>Best Streak</Text>
          </View>
        </View>

        <TransactionHistory
          transactions={transactions}
          loading={!isWalletHydrated}
        />

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Card style={styles.settingsCard} animate={false}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Light Mode</Text>
              <Switch
                value={theme === "light"}
                onValueChange={toggleTheme}
                trackColor={{
                  false: Colors.backgroundTertiary,
                  true: Colors.primary,
                }}
                thumbColor={Colors.white}
              />
            </View>
          </Card>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Card style={styles.settingsCard} animate={false}>
            <Pressable
              onPress={() => setLegalModalVisible(true)}
              style={styles.settingRow}
            >
              <Text style={styles.settingLabel}>Terms & Privacy</Text>
              <Text style={styles.settingChevron}>›</Text>
            </Pressable>
          </Card>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card style={styles.settingsCard} animate={false}>
            <Pressable onPress={handleLogout} style={styles.settingRow}>
              <Text style={styles.settingLabelDestructive}>Sign Out</Text>
            </Pressable>
            <View style={styles.settingDivider} />
            <Pressable onPress={handleDeleteAccount} style={styles.settingRow}>
              <Text style={styles.settingLabelDestructive}>Delete Account</Text>
            </Pressable>
          </Card>
        </View>

        <HoldToConfirmModal
          visible={removeBankModalVisible}
          title="Remove linked bank?"
          body="Withdrawals will be disabled until you connect a new one. Your balance and history stay intact."
          holdLabel={bankActionLoading ? "Removing…" : "Hold to remove bank"}
          cancelLabel="Keep bank"
          onCancel={() => setRemoveBankModalVisible(false)}
          onConfirm={handleRemoveBankConfirmed}
        />

        <HoldToConfirmModal
          visible={deleteModalVisible}
          title="Delete your account?"
          body="This permanently deletes your account and data. Any deposited balance is refunded to your original payment method. This cannot be undone."
          holdLabel={deleteLoading ? "Deleting…" : "Hold to delete account"}
          cancelLabel="Keep my account"
          onCancel={() => setDeleteModalVisible(false)}
          onConfirm={handleDeleteConfirmed}
        />

        {/* Read-only legal modal */}
        <Modal
          visible={legalModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setLegalModalVisible(false)}
        >
          <View style={styles.legalModal}>
            <View style={styles.legalModalHeader}>
              <Pressable onPress={() => setLegalModalVisible(false)}>
                <Text style={styles.legalModalClose}>Done</Text>
              </Pressable>
            </View>
            <LegalContentView section="both" />
          </View>
        </Modal>

        {/* Blob customizer (slingshot sheet) — saves via authStore */}
        <BlobMakerSheet
          visible={blobSheetVisible}
          onClose={() => setBlobSheetVisible(false)}
          uid={user?.id ?? "guest"}
          config={avatarConfig}
          onSave={setBlobAvatar}
        />

        {/* "What is Clout?" info sheet (CloutCard's (i) button) */}
        <CloutInfoSheet
          visible={cloutInfoVisible}
          onClose={() => setCloutInfoVisible(false)}
        />

        {/* Session receipt for a tapped calendar stamp */}
        <SessionReceiptSheet
          visible={receiptVisible}
          onClose={() => setReceiptVisible(false)}
          stamp={receiptStamp}
          byCategory={receiptByCategory}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Niyah v1.0.0</Text>
          <Text style={styles.footerSubtext}>Demo Mode</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ProfileScreen = withErrorBoundary(ProfileScreenInner, "profile");
export default ProfileScreen;

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    inviteCard: {
      marginBottom: Spacing.md,
    },
    blobZone: {
      marginBottom: Spacing.lg,
    },
    calendarSection: {
      marginBottom: Spacing.xl,
    },
    balanceCard: {
      marginBottom: Spacing.md,
    },
    balanceLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    bankName: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      color: Colors.text,
    },
    bankMask: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    bankCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    bankCardInfo: {
      flex: 1,
    },
    manageBankButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: Colors.backgroundTertiary,
    },
    manageBankButtonText: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.text,
    },
    pendingRowStandalone: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    pendingLabel: {
      fontSize: Typography.bodySmall,
      color: Colors.warning,
    },
    pendingAmount: {
      fontSize: Typography.bodySmall,
      ...Font.semibold,
      color: Colors.warning,
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.xl,
    },
    miniStatCard: {
      flex: 1,
      alignItems: "center",
    },
    statDivider: {
      width: 1,
      backgroundColor: Colors.border,
    },
    miniStatValue: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.text,
    },
    miniStatLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: Spacing.xs,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.md,
    },
    settingsCard: {
      padding: 0,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    settingDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.lg,
    },
    settingLabel: {
      fontSize: Typography.bodyMedium,
      color: Colors.text,
    },
    settingLabelDestructive: {
      fontSize: Typography.bodyMedium,
      color: Colors.danger,
    },
    settingChevron: {
      fontSize: Typography.titleMedium,
      color: Colors.textMuted,
    },
    legalModal: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    legalModalHeader: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    legalModalClose: {
      fontSize: Typography.bodyLarge,
      ...Font.semibold,
      color: Colors.primary,
    },
    footer: {
      alignItems: "center",
      paddingVertical: Spacing.lg,
    },
    footerText: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
    },
    footerSubtext: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
      marginTop: Spacing.xs,
    },
  });
