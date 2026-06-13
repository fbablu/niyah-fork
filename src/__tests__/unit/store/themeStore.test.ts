/**
 * Unit Tests for themeStore.ts
 *
 * Tests the persisted theme store: initial state, toggle, explicit set,
 * hydration flag, and the single-brand-theme rehydrate normalization.
 * The Light Mode UI toggle was removed 2026-06-12 (single brand theme);
 * toggleTheme/setTheme remain exported API and stay under test.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeStore } from "../../../store/themeStore";

describe("themeStore", () => {
  beforeEach(() => {
    // Reset to the single brand baseline (initial seed is "dark"
    // unconditionally — no Appearance.getColorScheme() involved).
    useThemeStore.setState({ theme: "dark", _hasHydrated: false });
  });

  describe("initial state", () => {
    it("seeds the single brand theme (dark) on startup", () => {
      const { theme } = useThemeStore.getState();
      expect(theme).toBe("dark");
    });

    it("starts with _hasHydrated false", () => {
      expect(useThemeStore.getState()._hasHydrated).toBe(false);
    });
  });

  // ─── toggleTheme ─────────────────────────────────────────────────────────────

  describe("toggleTheme", () => {
    it("switches from dark to light", () => {
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("switches from light to dark", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("returns to original theme after two toggles", () => {
      const initial = useThemeStore.getState().theme;
      useThemeStore.getState().toggleTheme();
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe(initial);
    });
  });

  // ─── setTheme ────────────────────────────────────────────────────────────────

  describe("setTheme", () => {
    it("sets theme to light explicitly", () => {
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().setTheme("light");
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("sets theme to dark explicitly", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("is idempotent when setting the same theme", () => {
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().theme).toBe("dark");
    });
  });

  // ─── setHasHydrated ──────────────────────────────────────────────────────────

  describe("setHasHydrated", () => {
    it("sets _hasHydrated to true", () => {
      expect(useThemeStore.getState()._hasHydrated).toBe(false);
      useThemeStore.getState().setHasHydrated(true);
      expect(useThemeStore.getState()._hasHydrated).toBe(true);
    });

    it("can be reset to false", () => {
      useThemeStore.setState({ _hasHydrated: true });
      useThemeStore.getState().setHasHydrated(false);
      expect(useThemeStore.getState()._hasHydrated).toBe(false);
    });
  });

  // ─── Integration ─────────────────────────────────────────────────────────────

  describe("theme + hydration interaction", () => {
    it("theme changes do not affect _hasHydrated", () => {
      useThemeStore.getState().setHasHydrated(true);
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState()._hasHydrated).toBe(true);
    });
  });

  // ─── Rehydrate normalization (single brand theme) ────────────────────────────

  describe("rehydrate normalization", () => {
    it("normalizes a persisted 'light' theme back to 'dark'", async () => {
      // Users who toggled light before 2026-06-12 have no UI toggle anymore —
      // rehydration must not strand them on the retired theme.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          state: { theme: "light", _hasHydrated: true },
          version: 0,
        }),
      );
      await useThemeStore.persist.rehydrate();
      expect(useThemeStore.getState().theme).toBe("dark");
      expect(useThemeStore.getState()._hasHydrated).toBe(true);
    });

    it("keeps 'dark' and marks hydration complete on rehydrate", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          state: { theme: "dark", _hasHydrated: true },
          version: 0,
        }),
      );
      await useThemeStore.persist.rehydrate();
      expect(useThemeStore.getState().theme).toBe("dark");
      expect(useThemeStore.getState()._hasHydrated).toBe(true);
    });
  });
});
