import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import {
  Typography,
  Spacing,
  Font,
  type ThemeColors,
} from "../constants/colors";
import { useColors } from "../hooks/useColors";
import { Confetti } from "./Confetti";
import { Button } from "./Button";
import { formatMoney } from "../utils/format";

interface MoneySuccessOverlayProps {
  visible: boolean;
  amountCents: number;
  title?: string;
  subtitle?: string;
  confettiCount?: number;
  doneLabel?: string;
  onDone: () => void;
}

/**
 * Full-screen celebratory reward shown after a successful money moment
 * (deposit credited, payout / withdrawal settled). Mirrors the session-complete
 * pattern: confetti + spring-scaled checkmark + an amount that counts up. Render
 * it as a sibling of the screen scaffold; it covers the screen when `visible`.
 *
 * Legacy `Animated` (not Reanimated) to match Confetti.tsx + complete.tsx idiom.
 */
export const MoneySuccessOverlay: React.FC<MoneySuccessOverlayProps> = ({
  visible,
  amountCents,
  title = "Funds Added",
  subtitle,
  confettiCount = 60,
  doneLabel = "Done",
  onDone,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayCents, setDisplayCents] = useState(0);

  useEffect(() => {
    if (!visible) return;

    // Reset every time the overlay is shown so re-deposits re-animate.
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    countAnim.setValue(0);
    setDisplayCents(0);

    const id = countAnim.addListener(({ value }) =>
      setDisplayCents(Math.round(value)),
    );

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // JS-driven (useNativeDriver:false) so the listener fires each frame.
      Animated.timing(countAnim, {
        toValue: amountCents,
        duration: 900,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => setDisplayCents(amountCents));

    return () => countAnim.removeListener(id);
  }, [visible, amountCents, scaleAnim, opacityAnim, countAnim]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Confetti count={confettiCount} />
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.body,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.checkCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.amount}>{formatMoney(displayCents)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>
      </View>
      <View style={styles.footer}>
        <Button title={doneLabel} onPress={onDone} size="large" />
      </View>
    </View>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Colors.background,
      zIndex: 10,
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
    },
    body: {
      alignItems: "center",
    },
    checkCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: Colors.gainLight,
      borderWidth: 2,
      borderColor: Colors.gain,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg,
    },
    checkmark: {
      fontSize: 40,
      color: Colors.gain,
    },
    title: {
      fontSize: Typography.headlineSmall,
      ...Font.bold,
      color: Colors.text,
      marginBottom: Spacing.xs,
    },
    amount: {
      fontSize: Typography.displaySmall,
      ...Font.heavy,
      color: Colors.gain,
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
      textAlign: "center",
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      paddingTop: Spacing.md,
    },
  });
