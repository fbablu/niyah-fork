import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

  const setChooser = useCallback(
    (open: boolean) => {
      setChooserOpen(open);
      const target = open ? 1 : 0;
      chooserProgress.value = reducedMotion
        ? target
        : withTiming(target, {
            duration: 220,
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
    transform: [{ translateY: (1 - chooserProgress.value) * -Spacing.sm }],
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deposit or withdraw"
          onPress={toggleChooser}
          style={styles.plusMinusButton}
          hitSlop={Spacing.sm}
        >
          <Text style={styles.plusMinusText}>
            <Text style={{ color: Colors.gain }}>+</Text>
            <Text style={{ color: Colors.textSecondary }}>/</Text>
            <Text style={{ color: Colors.loss }}>-</Text>
          </Text>
        </Pressable>
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

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginBottom: Spacing.xl,
    },
    heading: {
      fontSize: Typography.headlineMedium,
      ...Font.bold,
      color: Colors.text,
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
      backgroundColor: Colors.backgroundSecondary,
      borderRadius: Radius.full,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
    },
    amount: {
      fontSize: Typography.displayMedium,
      ...Font.heavy,
      color: Colors.text,
      fontVariant: ["tabular-nums"],
    },
    plusMinusButton: {
      width: Spacing.xxl,
      height: Spacing.xxl,
      borderRadius: Radius.full,
      backgroundColor: Colors.primaryMuted,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      alignItems: "center",
      justifyContent: "center",
    },
    plusMinusText: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
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
