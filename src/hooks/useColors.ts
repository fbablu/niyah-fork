import { createContext, useContext } from "react";
import {
  ThemeColorMap,
  type Theme,
  type ThemeColors,
} from "../constants/colors";
import { useThemeStore } from "../store/themeStore";

/**
 * Pins a subtree to a fixed theme regardless of the user's setting. The
 * onboarding/auth group provides "dark" — its illustrated scenes are
 * dark-designed and rendered half-light-mode text unreadably in the build-21
 * test. `null` (default) follows the theme store.
 */
export const ThemeOverrideContext = createContext<Theme | null>(null);

/**
 * Returns the Colors object for the current theme.
 * Components should call this inside the component body and use the
 * returned value in place of the static `Colors` import.
 *
 *   const Colors = useColors();
 *   const styles = useMemo(() => StyleSheet.create({ ... }), [Colors]);
 */
export const useColors = (): ThemeColors => {
  const override = useContext(ThemeOverrideContext);
  const theme = useThemeStore((s) => s.theme);
  return ThemeColorMap[override ?? theme];
};
