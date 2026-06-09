import React, { useEffect } from "react";
import { Tabs } from "../../src/components/BottomTabs";
import { useColors } from "../../src/hooks/useColors";
import { useThemeStore } from "../../src/store/themeStore";
import { useAuthStore } from "../../src/store/authStore";

export default function TabsLayout() {
  const Colors = useColors();
  const _hasHydrated = useThemeStore((s) => s._hasHydrated);
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete);

  // Reaching the tabs means every onboarding gate cleared — record it so the
  // Screen Time / notification setup screens never re-appear on later launches
  // (build-23 feedback: onboarding shows once). Idempotent + uid-scoped.
  useEffect(() => {
    markOnboardingComplete();
  }, [markOnboardingComplete]);

  // Don't mount the native UITabBarController until we know the persisted
  // theme.  Mounting it once with the correct barTintColor avoids the race
  // where it is first created with the default "dark" color and then asked
  // to update — an update that the SwiftUI/UITabBar layer may miss.
  //
  // KNOWN LIMITATION: toggling theme at runtime updates JS surfaces instantly
  // but the native bar applies its new UITabBarAppearance lazily, so the
  // liquid-glass bar lags the rest of the app by a beat (build-21 finding).
  // Same-frame sync would require patching react-native-bottom-tabs' native
  // pane — accepted for now.
  if (!_hasHydrated) return null;

  return (
    <Tabs
      hapticFeedbackEnabled
      // scrollEdgeAppearance="opaque" forces UITabBarAppearance to use
      // configureWithOpaqueBackground() instead of the default glass
      // material.  The opaque path reliably applies backgroundColor
      // (barTintColor) on iOS 26's floating-pill tab bar; the glass path
      // sometimes ignores it for lighter theme colors.
      scrollEdgeAppearance="opaque"
      tabBarActiveTintColor={Colors.primary}
      tabBarInactiveTintColor={Colors.textSecondary}
      tabBarStyle={{ backgroundColor: Colors.background }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: () => ({ sfSymbol: "house" }),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: () => ({ sfSymbol: "calendar" }),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: () => ({ sfSymbol: "person.2" }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => ({ sfSymbol: "person" }),
        }}
      />
    </Tabs>
  );
}
