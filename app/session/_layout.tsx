import { Stack } from "expo-router";
import { ThemeOverrideContext } from "../../src/hooks/useColors";
import { ThemeColorMap } from "../../src/constants/colors";

export default function SessionLayout() {
  // Green-world: the whole session flow is full-bleed brand green, so the
  // subtree is pinned DARK — theme-driven children (modals, Balance internals)
  // resolve to their dark near-white-text values instead of cream-on-green in
  // light theme. The provider can't affect this component's OWN hooks
  // ((auth)/_layout precedent), so contentStyle reads the dark palette
  // directly (primaryDark is theme-identical, so this swap is zero-change).
  return (
    <ThemeOverrideContext.Provider value="dark">
      <Stack
        screenOptions={{
          headerShown: false,
          // Green-world: transitions render over the brand field so pushes/pops
          // never flash the old theme background between screens.
          contentStyle: { backgroundColor: ThemeColorMap.dark.primaryDark },
          animation: "slide_from_bottom",
        }}
      >
        <Stack.Screen name="quick-block" />
        <Stack.Screen name="select" />
        <Stack.Screen name="propose" />
        <Stack.Screen name="confirm" />
        <Stack.Screen name="waiting-room" />
        <Stack.Screen name="active" options={{ gestureEnabled: false }} />
        <Stack.Screen name="surrender" options={{ presentation: "modal" }} />
        <Stack.Screen name="complete" options={{ gestureEnabled: false }} />
        <Stack.Screen name="partner" />
        <Stack.Screen name="deposit" options={{ presentation: "modal" }} />
        <Stack.Screen name="withdraw" options={{ presentation: "modal" }} />
        <Stack.Screen name="stripe-onboarding" />
        <Stack.Screen name="verify-identity" />
        <Stack.Screen name="bank-setup" />
      </Stack>
    </ThemeOverrideContext.Provider>
  );
}
