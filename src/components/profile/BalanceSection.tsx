import React, { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Font,
  Radius,
  Spacing,
  Typography,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { Button } from "../Button";
import { AllTimeTicker } from "./AllTimeTicker";
import { formatMoney } from "../../utils/format";
import { deriveAllTimeDelta } from "../../utils/balanceDelta";
import type { Transaction } from "../../types";

export interface BalanceSectionProps {
  balanceCents: number;
  transactions: Transaction[];
  onDeposit: () => void;
  onWithdraw: () => void;
}

interface PlusMinusGlassPillProps {
  onPress: () => void;
}

// --- SwiftUI liquid glass (iOS 26+) ----------------------------------------
// The native glassEffect modifier silently no-ops below iOS 26 and on
// binaries not built with Xcode 26 (verified in @expo/ui's
// GlassEffectModifier.swift: `#available(iOS 26.0, *)` + `#if compiler(>=6.2)`
// else passthrough) — the pill would render with NO background. So this
// version gate is load-bearing, not cosmetic. Exported for tests.
export function supportsLiquidGlass(
  os: string = Platform.OS,
  version: string | number = Platform.Version,
): boolean {
  if (os !== "ios") return false;
  const major = parseInt(String(version), 10);
  return Number.isFinite(major) && major >= 26;
}

interface ExpoSwiftUi {
  ui: typeof import("@expo/ui/swift-ui");
  modifiers: typeof import("@expo/ui/swift-ui/modifiers");
}

let expoSwiftUiCache: ExpoSwiftUi | null | undefined;

// Lazy require + try/catch (src/config sslPinning.ts convention): a binary
// built before the @expo/ui pod was added throws "Cannot find native module
// 'ExpoUI'" at require time — fall back to the RN pill instead of crashing.
function getExpoSwiftUi(): ExpoSwiftUi | null {
  // HARD-DISABLED until the @expo/ui pod ships again (SDK 55+): the pod is
  // autolinking-excluded (package.json), and on iOS 26 devices this gate
  // passes while the 'ExpoUI' native view is absent from the binary — the
  // require can succeed and the failure lands at RENDER time, crashing the
  // profile tab (suspected build-25/26 crash). Re-enable only WITH the pod.
  const POD_INCLUDED = false;
  if (!POD_INCLUDED) return null;
  if (!supportsLiquidGlass()) return null;
  if (expoSwiftUiCache !== undefined) return expoSwiftUiCache;
  try {
    expoSwiftUiCache = {
      ui: require("@expo/ui/swift-ui"),
      modifiers: require("@expo/ui/swift-ui/modifiers"),
    };
  } catch {
    expoSwiftUiCache = null;
  }
  return expoSwiftUiCache;
}

// Self-contained glass +/- pill (deposit/withdraw chooser trigger). On
// iOS 26+ builds that include @expo/ui, this is a real SwiftUI liquid-glass
// circle (interactive glassEffect); everywhere else it stays the RN
// glassDark pill. Only `onPress` crosses the boundary (haptics + chooser
// state live in the parent).
function PlusMinusGlassPill({ onPress }: PlusMinusGlassPillProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const swiftUi = getExpoSwiftUi();
  if (swiftUi) {
    const { Host, HStack, Text: SwiftUIText } = swiftUi.ui;
    const { accessibilityLabel, font, frame, glassEffect } = swiftUi.modifiers;
    const glyphFont = font({
      weight: "bold",
      size: Typography.headlineSmall,
      design: "rounded",
    });
    return (
      <Host style={styles.plusMinusHost}>
        <HStack
          spacing={0}
          onPress={onPress}
          modifiers={[
            frame({ width: Spacing.xxl, height: Spacing.xxl }),
            glassEffect({
              glass: { variant: "regular", interactive: true },
              shape: "circle",
            }),
            accessibilityLabel("Deposit or withdraw"),
          ]}
        >
          <SwiftUIText color={Colors.gain} modifiers={[glyphFont]}>
            +
          </SwiftUIText>
          <SwiftUIText color={Colors.glassMid} modifiers={[glyphFont]}>
            /
          </SwiftUIText>
          <SwiftUIText color={Colors.loss} modifiers={[glyphFont]}>
            -
          </SwiftUIText>
        </HStack>
      </Host>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Deposit or withdraw"
      testID="plus-minus-fallback"
      onPress={onPress}
      style={styles.plusMinusButton}
      hitSlop={Spacing.sm}
    >
      <Text style={styles.plusMinusText}>
        <Text style={styles.plusSign}>+</Text>
        <Text style={styles.slashSign}>/</Text>
        <Text style={styles.minusSign}>-</Text>
      </Text>
    </Pressable>
  );
}

export function BalanceSection({
  balanceCents,
  transactions,
  onDeposit,
  onWithdraw,
}: BalanceSectionProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const reducedMotion = useReducedMotion();
  const [chooserOpen, setChooserOpen] = useState(false);
  const chooserProgress = useSharedValue(0);

  const delta = useMemo(
    () => deriveAllTimeDelta(balanceCents, transactions),
    [balanceCents, transactions],
  );

  // v3 motion spec (near-static): the chooser is a bare 180ms fade — no
  // slide, no transforms.
  const setChooser = useCallback(
    (open: boolean) => {
      setChooserOpen(open);
      const target = open ? 1 : 0;
      chooserProgress.value = reducedMotion
        ? target
        : withTiming(target, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
          });
    },
    [chooserProgress, reducedMotion],
  );

  const toggleChooser = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChooser(!chooserOpen);
  }, [chooserOpen, setChooser]);

  const handleDeposit = useCallback(() => {
    setChooser(false);
    onDeposit();
  }, [onDeposit, setChooser]);

  const handleWithdraw = useCallback(() => {
    setChooser(false);
    onWithdraw();
  }, [onWithdraw, setChooser]);

  const chooserStyle = useAnimatedStyle(() => ({
    opacity: chooserProgress.value,
  }));

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Balance</Text>
      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(balanceCents)}
          </Text>
        </View>
        <PlusMinusGlassPill onPress={toggleChooser} />
      </View>
      {delta && <AllTimeTicker delta={delta} />}
      {chooserOpen && (
        <Animated.View style={[styles.chooser, chooserStyle]}>
          <Button
            title="Deposit"
            onPress={handleDeposit}
            size="small"
            fullWidth={false}
            style={styles.chooserButton}
          />
          <Button
            title="Withdraw"
            onPress={handleWithdraw}
            variant="secondary"
            size="small"
            fullWidth={false}
            style={styles.chooserButton}
          />
        </Animated.View>
      )}
    </View>
  );
}

// Full-bleed green screen (v2, node 429:186): the section is proportional
// (~94.7% of the 402 frame so the pill itself lands at the design's 80.8% —
// the section minus the 8pt gap + 48pt +/- pill), dark-glass pill, white
// display amount.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      width: "94.7%",
      alignSelf: "center",
      marginBottom: Spacing.xl,
    },
    heading: {
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.white,
      textAlign: "center",
      marginBottom: Spacing.sm,
    },
    pillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    pill: {
      flex: 1,
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.full,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
    },
    amount: {
      fontSize: Typography.displayMedium,
      ...Font.bold,
      color: Colors.white,
      fontVariant: ["tabular-nums"],
    },
    plusMinusHost: {
      width: Spacing.xxl,
      height: Spacing.xxl,
    },
    plusMinusButton: {
      width: Spacing.xxl,
      height: Spacing.xxl,
      borderRadius: Radius.full,
      backgroundColor: Colors.glassDark,
      alignItems: "center",
      justifyContent: "center",
    },
    plusMinusText: {
      fontSize: Typography.headlineSmall,
      ...Font.bold,
    },
    plusSign: {
      color: Colors.gain,
    },
    slashSign: {
      color: Colors.glassMid,
    },
    minusSign: {
      color: Colors.loss,
    },
    chooser: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    chooserButton: {
      flex: 1,
    },
  });
