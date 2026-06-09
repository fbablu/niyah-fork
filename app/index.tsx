import { useEffect, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "../src/store/authStore";
import { useColors } from "../src/hooks/useColors";
import { LegalAcceptanceOverlay } from "../src/components";
import { logger } from "../src/utils/logger";
import { DEMO_MODE } from "../src/constants/config";
import {
  isScreenTimeAvailable,
  getScreenTimeAuthStatus,
} from "../src/config/screentime";

export default function Index() {
  const Colors = useColors();
  const {
    isAuthenticated,
    isInitialized,
    profileComplete,
    hasAcceptedCurrentLegal,
    onboardingComplete,
    acceptLegal,
    initialize,
  } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [legalLoading, setLegalLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        loading: {
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: "center",
          alignItems: "center",
        },
      }),
    [Colors],
  );

  useEffect(() => {
    const unsubscribe = initialize();
    const timer = setTimeout(() => setReady(true), 100);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [initialize]);

  const handleAcceptLegal = async () => {
    setLegalLoading(true);
    try {
      await acceptLegal();
    } catch (error) {
      logger.error("Legal acceptance error:", error);
    } finally {
      setLegalLoading(false);
    }
  };

  if (!isInitialized || !ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Legal gate FIRST: a new user must accept Terms + affirm 18+ immediately
  // after sign-in, BEFORE profile setup or any app use. Existing users are
  // re-prompted here when CURRENT_LEGAL_VERSION bumps. Non-dismissible.
  if (!hasAcceptedCurrentLegal) {
    return (
      <View style={styles.loading}>
        <LegalAcceptanceOverlay
          visible={true}
          onAccept={handleAcceptLegal}
          loading={legalLoading}
        />
      </View>
    );
  }

  if (!profileComplete) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // Hard gate (Opal-style) DURING first-run onboarding: Screen Time is core to
  // Niyah, so a profiled user who hasn't granted it is sent to setup. Once
  // onboarding is complete we DON'T re-trap them on launch if the status reads
  // non-approved (a cold-start native race, or a later revoke) — that was making
  // the "you're all set" / "stay in the loop" screens reappear every launch
  // (build-23 feedback). Reconnect lives in Profile; a staked session re-checks
  // Screen Time at start. Bypassed on devices without Screen Time and in DEMO.
  if (
    isScreenTimeAvailable &&
    !DEMO_MODE &&
    !onboardingComplete &&
    getScreenTimeAuthStatus() !== "approved"
  ) {
    return <Redirect href="/(auth)/screentime-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}
