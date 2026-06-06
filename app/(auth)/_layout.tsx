import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { useColors } from "../../src/hooks/useColors";
import { logEvent } from "../../src/utils/analytics";

export default function AuthLayout() {
  const colors = useColors();
  const pathname = usePathname();

  // Onboarding funnel: one event per step reached. Pre-auth steps (welcome →
  // verify) are silently dropped by rules (analytics_events create requires
  // auth) — accepted; the post-auth run (profile-setup → … →
  // notifications-setup) is the drop-off signal the beta needs.
  useEffect(() => {
    const step = pathname.replace(/^\//, "");
    if (step) logEvent("onboarding_step_reached", { step });
  }, [pathname]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="auth-entry" />
      <Stack.Screen name="phone-entry" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="blob-maker" />
      <Stack.Screen name="intake" />
      <Stack.Screen name="how-it-works" />
      <Stack.Screen name="screen-time-math" />
      <Stack.Screen name="screentime-setup" />
      <Stack.Screen name="screentime-baseline" />
      <Stack.Screen name="notifications-setup" />
    </Stack>
  );
}
