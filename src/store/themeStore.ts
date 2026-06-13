import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Theme } from "../constants/colors";

interface ThemeStore {
  theme: Theme;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Single brand theme: Niyah ships "dark" unconditionally (the green world is
// pinned dark by construction; the old Appearance.getColorScheme() seed is
// gone). The Light Mode UI toggle was removed 2026-06-12 per founder decision
// — toggleTheme/setTheme stay exported so the store API is unchanged and a
// future light variant can be re-enabled without rewiring consumers.
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "niyah-theme",
      storage: createJSONStorage(() => AsyncStorage),
      // Mark hydration complete so layouts can wait for the persisted value
      // before committing native appearance props to UITabBar. With the UI
      // toggle gone, a previously persisted "light" would strand the user on
      // the retired theme — normalize it back to the single brand theme.
      onRehydrateStorage: () => (state) => {
        if (state?.theme !== "dark") {
          state?.setTheme("dark");
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
