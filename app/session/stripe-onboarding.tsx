/**
 * Stripe Connect onboarding screen
 * Users complete identity verification (KYC) to enable real payouts.
 * Stripe Express handles the KYC flow via a browser redirect.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import { useScreenProtection } from "../../src/hooks/useScreenProtection";
import * as Haptics from "expo-haptics";
import {
  Button,
  Card,
  SessionScreenScaffold,
  withErrorBoundary,
} from "../../src/components";
import { useAuthStore } from "../../src/store/authStore";
import {
  createAccountLink,
  getConnectAccountStatus,
} from "../../src/config/functions";
import { logger } from "../../src/utils/logger";

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";

type AccountStatus = "none" | "pending" | "active" | "restricted";

function StripeOnboardingScreenInner() {
  useScreenProtection("stripe-onboarding");
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const [status, setStatus] = useState<AccountStatus>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const hasNavigatedBackRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    hasNavigatedBackRef.current = false;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeBack = useCallback(() => {
    if (hasNavigatedBackRef.current) return;
    hasNavigatedBackRef.current = true;
    try {
      router.back();
    } catch (err) {
      logger.warn("router.back failed:", err);
    }
  }, [router]);

  const checkStatus = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!user?.stripeAccountId) {
        if (isMountedRef.current) setStatus("none");
        return;
      }
      const result = await getConnectAccountStatus();
      if (!isMountedRef.current) return;
      setStatus(result.status);
      if (
        result.status !== "none" &&
        result.status !== user?.stripeAccountStatus
      ) {
        updateUser({ stripeAccountStatus: result.status });
      }
    } catch (err) {
      logger.error("Failed to check Stripe status:", err);
      if (!isMountedRef.current) return;
      if (user?.stripeAccountStatus) {
        setStatus(user.stripeAccountStatus as AccountStatus);
      } else {
        setLoadError(
          "Could not reach the server. Check your connection and try again.",
        );
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [user?.stripeAccountId, user?.stripeAccountStatus, updateUser]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleStartOnboarding = async () => {
    // First-time setup goes through the native KYC intake which collects DOB
    // + address + legal name in-app, then pre-populates the Stripe Express
    // account so the hosted form only needs SSN + phone.
    if (!user?.stripeAccountId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push("/session/verify-identity" as any);
      return;
    }

    setIsStarting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { url } = await createAccountLink();
      const result = await WebBrowser.openBrowserAsync(url, {
        dismissButtonStyle: "close",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });

      if (result.type === "dismiss" || result.type === "opened") {
        await checkStatus();
      }
    } catch (err) {
      logger.error("Onboarding error:", err);
      Alert.alert(
        "Setup Error",
        "Could not start payout setup. Please try again.",
      );
    } finally {
      if (isMountedRef.current) setIsStarting(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.loadingText}>Checking account status...</Text>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.center}>
          <Text style={styles.statusEmoji}>!</Text>
          <Text style={styles.statusTitle}>Connection Error</Text>
          <Text style={styles.statusDescription}>{loadError}</Text>
          <Button
            title="Retry"
            onPress={checkStatus}
            size="large"
            style={styles.actionButton}
          />
          <Button
            title="Go Back"
            onPress={safeBack}
            size="large"
            variant="secondary"
            style={styles.secondaryActionButton}
            textStyle={styles.secondaryActionText}
          />
        </View>
      );
    }

    if (status === "active") {
      return (
        <View style={styles.center}>
          <Text style={styles.statusEmoji}>✓</Text>
          <Text style={styles.statusTitle}>Payouts Enabled</Text>
          <Text style={styles.statusDescription}>
            Your account is verified. Payouts will be deposited directly to your
            bank.
          </Text>
          <Button
            title="Done"
            onPress={safeBack}
            size="large"
            style={styles.actionButton}
          />
        </View>
      );
    }

    if (status === "restricted") {
      return (
        <View style={styles.center}>
          <Text style={styles.statusEmoji}>⚠</Text>
          <Text style={styles.statusTitle}>Action Required</Text>
          <Text style={styles.statusDescription}>
            Stripe needs additional information to enable payouts on your
            account.
          </Text>
          <Button
            title="Complete Verification"
            onPress={handleStartOnboarding}
            size="large"
            style={styles.actionButton}
            loading={isStarting}
          />
        </View>
      );
    }

    if (status === "pending") {
      return (
        <View style={styles.center}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={styles.statusTitle}>Verification Pending</Text>
          <Text style={styles.statusDescription}>
            Your account is under review. This usually takes a few minutes.
          </Text>
          <Button
            title="Check Status"
            onPress={checkStatus}
            size="large"
            style={styles.actionButton}
            loading={isLoading}
          />
        </View>
      );
    }

    // status === "none" — not set up yet
    return (
      <View style={styles.center}>
        <Text style={styles.hero}>Enable Payouts</Text>
        <Text style={styles.subtitle}>
          Set up your payout account to cash out directly to your bank. Powered
          by Stripe — the same payment infrastructure used by Amazon and
          Shopify.
        </Text>

        <Card style={styles.infoCard} variant="outlined">
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              Bank-level encryption. Stripe never stores card details.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🏦</Text>
            <Text style={styles.infoText}>
              Direct bank transfers. Funds arrive within 1–2 business days.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🌍</Text>
            <Text style={styles.infoText}>
              US accounts only (for now). Connect your checking account.
            </Text>
          </View>
        </Card>

        <Button
          title="Set Up Payouts"
          onPress={handleStartOnboarding}
          size="large"
          style={styles.actionButton}
          loading={isStarting}
        />

        <Text style={styles.disclaimer}>
          You'll be taken to Stripe to verify your identity and link a bank
          account. This is a one-time setup.
        </Text>
      </View>
    );
  };

  return (
    <SessionScreenScaffold
      headerVariant="centered"
      headerTitle="Payout Setup"
      backgroundColor={Colors.primaryDark}
      scrollable={false}
    >
      {renderContent()}
    </SessionScreenScaffold>
  );
}

const StripeOnboardingScreen = withErrorBoundary(
  StripeOnboardingScreenInner,
  "stripe-onboarding",
);
export default StripeOnboardingScreen;

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.lg,
    },
    hero: {
      fontSize: Typography.displaySmall,
      ...Font.bold,
      color: Colors.white,
      textAlign: "center",
    },
    subtitle: {
      fontSize: Typography.bodyLarge,
      color: WHITE_70,
      textAlign: "center",
      lineHeight: Typography.bodyLarge * 1.5,
    },
    // Glass seat for the info rows (glassLight, Radius.xl, borderless —
    // overrides the outlined variant's hairline via the Card style prop).
    infoCard: {
      width: "100%",
      gap: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      borderWidth: 0,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.md,
    },
    infoIcon: {
      fontSize: 20,
      width: 28,
      textAlign: "center",
    },
    infoText: {
      flex: 1,
      fontSize: Typography.bodyMedium,
      color: WHITE_70,
      lineHeight: Typography.bodyMedium * 1.5,
    },
    actionButton: {
      width: "100%",
      borderRadius: Radius.full,
    },
    // Dark-glass pill for the medium-emphasis action (via Button's public
    // style/textStyle props only).
    secondaryActionButton: {
      width: "100%",
      borderRadius: Radius.full,
      backgroundColor: Colors.glassDark,
    },
    secondaryActionText: {
      color: Colors.white,
    },
    disclaimer: {
      textAlign: "center",
      color: WHITE_55,
      fontSize: Typography.labelSmall,
      lineHeight: Typography.labelSmall * 1.5,
    },
    loadingText: {
      color: WHITE_70,
      fontSize: Typography.bodyMedium,
      marginTop: Spacing.md,
    },
    // Status glyphs are text ("!", "✓") — explicit white so they don't fall
    // back to the RN default black on the green field.
    statusEmoji: {
      fontSize: 48,
      color: Colors.white,
    },
    statusTitle: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.white,
    },
    statusDescription: {
      fontSize: Typography.bodyLarge,
      color: WHITE_70,
      textAlign: "center",
      lineHeight: Typography.bodyLarge * 1.5,
    },
  });
