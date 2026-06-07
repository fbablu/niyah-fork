import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { ThemeOverrideContext } from "../../src/hooks/useColors";
import { ThemeColorMap } from "../../src/constants/colors";
import { logEvent } from "../../src/utils/analytics";

export default function AuthLayout() {
  const pathname = usePathname();

  // Onboarding funnel: one event per step reached. Pre-auth steps (welcome →
  // verify) are silently dropped by rules (analytics_events create requires
  // auth) — accepted; the post-auth run (profile-setup → … →
  // notifications-setup) is the drop-off signal the beta needs.
  useEffect(() => {
    const step = pathname.replace(/^\//, "");
    if (step) logEvent("onboarding_step_reached", { step });
  }, [pathname]);

  // The whole (auth) group is pinned DARK: the onboarding carousel scenes are
  // dark-designed (hardcoded scene backgrounds), so a light system theme made
  // text/colors half-apply and look broken in the build-21 test. The provider
  // can't affect this component's own hooks, so contentStyle reads the dark
  // palette directly.
  return (
    <ThemeOverrideContext.Provider value="dark">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ThemeColorMap.dark.background },
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
    </ThemeOverrideContext.Provider>
  );
}
