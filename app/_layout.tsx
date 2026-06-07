import { useEffect, type ComponentProps, type ReactElement } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, TextInput, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { BaseFontFamily } from "../src/constants/colors";
import { useColors } from "../src/hooks/useColors";
import { useThemeStore } from "../src/store/themeStore";
import { useAuthStore } from "../src/store/authStore";
import { useFeatureFlagsStore } from "../src/store/featureFlagsStore";
import { ErrorBoundary, StatusBannerHost } from "../src/components";
import { isEmailSignInLink } from "../src/config/firebase";
import { getConnectAccountStatus } from "../src/config/functions";
import {
  DEMO_MODE,
  PENDING_REFERRAL_KEY,
  PENDING_JOIN_KEY,
} from "../src/constants/config";
import { logger } from "../src/utils/logger";
import { initializeSslPinning } from "../src/config/sslPinning";
import {
  setupBackgroundHandler,
  registerFCMToken,
} from "../src/config/notifications";
import { ensureAppCheckInitialized } from "../src/config/appCheck";
import { initSentry } from "../src/config/sentry";
import { logEvent } from "../src/utils/analytics";
import { AppState } from "react-native";

// Firebase requires the background message handler to be registered at the
// module level (outside any component) before the app renders.
setupBackgroundHandler();

// Sentry init before any other side effect so startup crashes get captured.
initSentry();

// Set in .env as EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
// Use pk_test_... for development, pk_live_... for production
const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// Lazily import StripeProvider only when Stripe is active (non-demo mode + key present).
// This prevents crashes on dev client builds that don't yet have the native Stripe module linked.
type StripeWrapperProps = ComponentProps<
  typeof import("@stripe/stripe-react-native").StripeProvider
>;

const FallbackStripeWrapper = ({ children }: StripeWrapperProps) => (
  <>{children}</>
);

let StripeWrapper: (props: StripeWrapperProps) => ReactElement | null =
  FallbackStripeWrapper;

if (!DEMO_MODE && STRIPE_PK) {
  try {
    StripeWrapper = (
      require("@stripe/stripe-react-native") as typeof import("@stripe/stripe-react-native")
    ).StripeProvider;
  } catch (error) {
    logger.warn("Stripe SDK unavailable in this build:", error);
  }

  // Pre-warm heavy native modules at app startup. Without this, the first
  // navigation to deposit/withdraw triggers a synchronous require() that
  // blocks the JS thread mid-modal-animation, leaving a black screen and
  // sometimes crashing before the screen finishes mounting.
  try {
    require("react-native-plaid-link-sdk");
  } catch (error) {
    logger.warn("Plaid SDK unavailable in this build:", error);
  }
}

// Apply SF Pro Rounded globally as the default font family
if (Platform.OS === "ios" && BaseFontFamily) {
  type WithDefaultStyle = {
    defaultProps?: { style?: { fontFamily?: string } };
  };
  const textStyle = { fontFamily: BaseFontFamily };
  (Text as unknown as WithDefaultStyle).defaultProps = {
    ...((Text as unknown as WithDefaultStyle).defaultProps || {}),
    style: textStyle,
  };
  (TextInput as unknown as WithDefaultStyle).defaultProps = {
    ...((TextInput as unknown as WithDefaultStyle).defaultProps || {}),
    style: textStyle,
  };
}

/**
 * Resume a pending group-invite deep link (/join?s=<id>) once the user is
 * authenticated. Stored by handleUrl when the link arrives; consumed here on
 * app-active and right after the link, so an already-signed-in friend lands
 * straight on the accept screen. Clears the key BEFORE routing so it can never
 * loop. A logged-out recipient keeps the key until a foreground after sign-in.
 */
async function consumePendingJoin(): Promise<void> {
  try {
    const sessionId = await SecureStore.getItemAsync(PENDING_JOIN_KEY);
    if (!sessionId) return;
    if (!useAuthStore.getState().isAuthenticated) return;
    await SecureStore.deleteItemAsync(PENDING_JOIN_KEY);
    router.push("/session/invites" as never);
  } catch (err) {
    logger.warn("consumePendingJoin failed:", err);
  }
}

export default function RootLayout() {
  const Colors = useColors();
  const theme = useThemeStore((s) => s.theme);
  const { completeEmailLink, updateUser } = useAuthStore();

  // Initialize SSL certificate pinning (no-op in __DEV__ mode)
  useEffect(() => {
    initializeSslPinning();
    ensureAppCheckInitialized();
    logEvent("app_open");
  }, []);

  // Subscribe to server-controlled feature flags (kill switches for
  // acceptingDeposits, acceptingWithdrawals, group/solo sessions). Live
  // updates via onSnapshot so a Firestore toggle takes effect instantly.
  useEffect(() => {
    const unsub = useFeatureFlagsStore.getState().subscribe();
    return () => {
      unsub?.();
    };
  }, []);

  // Re-register FCM token on every foreground. First-launch registration
  // often misses because APNs hasn't delivered the token yet — re-running on
  // resume ensures every signed-in device lands a token in Firestore.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        registerFCMToken().catch(() => {});
        consumePendingJoin();
      }
    });
    return () => sub.remove();
  }, []);

  // Handle deep links for email magic link sign-in, surrender, and referral invites
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (await isEmailSignInLink(url)) {
        try {
          await completeEmailLink(url);
        } catch (error) {
          logger.error("Error completing email link sign-in:", error);
        }
        return;
      }

      // Shield "Open Niyah" deep link. The ShieldActionExtension opens
      // niyah://blocked when the user taps the secondary shield button while a
      // blocked app is open. The scheme host is "blocked" (empty path), so
      // expo-router resolves it to "/" (home) UNLESS we route it explicitly —
      // that mis-route is exactly the qa-2026-06-02 #10 bug ("lands on the home
      // screen"). Push the branded surrender-confirm screen (app/blocked.tsx),
      // which offers Back-to-focus or Forfeit → /session/surrender. Cold start
      // is covered too (getInitialURL feeds the same handler).
      if (url.includes("blocked")) {
        logger.info("Shield blocked deep link received → /blocked");
        router.push("/blocked" as never);
        return;
      }

      // Legacy niyah://surrender deep link (pre-blocked-screen flow). The native
      // foreground hook also emits onSurrenderRequested off the shared-defaults
      // flag; the active-session screen mounts that listener. Kept as a no-op
      // guard so the link doesn't fall through to referrer parsing.
      if (url.includes("surrender")) {
        logger.info("Surrender deep link received");
        return;
      }

      // Stripe Connect onboarding/update bounce. The web page at
      // niyah.live/stripe/return redirects here once Stripe finishes
      // (Stripe rejects custom-scheme return_urls, so the HTTPS bounce
      // is the only viable round-trip). Refresh Connect status so the
      // withdraw screen reflects the just-completed change.
      if (url.includes("stripe-return")) {
        try {
          const status = await getConnectAccountStatus();
          updateUser({
            stripeAccountStatus:
              status.status === "none" ? undefined : status.status,
            linkedBank:
              status.bankName && status.bankMask
                ? {
                    institutionName: status.bankName,
                    bankName: status.bankName,
                    mask: status.bankMask,
                  }
                : undefined,
          });
        } catch (err) {
          logger.warn("Stripe return: status refresh failed:", err);
        }
        return;
      }

      // Group focus-session invite. Universal Link
      // (https://niyah.live/join?s=<id>) or the landing-page custom-scheme
      // bounce (niyah://join?s=<id>). Stash the session id and resume once
      // authenticated so an existing friend lands on the accept screen.
      if (url.includes("/join")) {
        const joinParsed = Linking.parse(url);
        let sessionId =
          typeof joinParsed.queryParams?.s === "string"
            ? joinParsed.queryParams.s
            : undefined;
        if (!sessionId && joinParsed.path) {
          const m = joinParsed.path.match(/^\/?join\/([A-Za-z0-9_-]+)/);
          if (m) sessionId = m[1];
        }
        if (sessionId && /^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
          await SecureStore.setItemAsync(PENDING_JOIN_KEY, sessionId);
          await consumePendingJoin();
        }
        return;
      }

      const parsed = Linking.parse(url);
      const referrerUid = parsed.queryParams?.ref;
      // Validate referrer UID: must be a non-empty string matching Firebase
      // UID format (alphanumeric, 1-128 chars). Prevents storing arbitrary
      // data from malicious deep links.
      if (
        referrerUid &&
        typeof referrerUid === "string" &&
        /^[a-zA-Z0-9]{1,128}$/.test(referrerUid)
      ) {
        await SecureStore.setItemAsync(PENDING_REFERRAL_KEY, referrerUid);
        // Pre-auth opens are silently dropped by rules (create requires
        // auth) — invite_redeemed at profile-setup covers the new-user leg.
        logEvent("invite_opened", { referrerUid });
      }
    };

    // Handle link that cold-started the app
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await handleUrl(initialUrl);
    };

    handleInitialURL();

    // Handle links while the app is already open
    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [completeEmailLink]);

  return (
    <ErrorBoundary>
      <StripeWrapper
        publishableKey={STRIPE_PK}
        merchantIdentifier="merchant.com.niyah.app"
        urlScheme="niyah"
      >
        <GestureHandlerRootView
          style={{ flex: 1, backgroundColor: Colors.background }}
        >
          <KeyboardProvider>
            <StatusBar style={theme === "dark" ? "light" : "dark"} />
            <StatusBannerHost />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.background },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="blocked"
                options={{
                  headerShown: false,
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="session"
                options={{
                  headerShown: false,
                  presentation: "fullScreenModal",
                }}
              />
              <Stack.Screen
                name="invite"
                options={{
                  headerShown: false,
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="user/[uid]"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="screentime-priorities"
                options={{
                  headerShown: true,
                  title: "Screen Time Priorities",
                  animation: "slide_from_right",
                }}
              />
            </Stack>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </StripeWrapper>
    </ErrorBoundary>
  );
}
