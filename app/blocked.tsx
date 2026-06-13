import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors, ThemeOverrideContext } from "../src/hooks/useColors";
import {
  Spacing,
  Radius,
  Font,
  Typography,
  type ThemeColors,
} from "../src/constants/colors";
import { BlobAvatar } from "../src/components/BlobAvatar";
import { withErrorBoundary } from "../src/components/ErrorBoundary";
import { useAuthStore } from "../src/store/authStore";
import { useGroupSessionStore } from "../src/store/groupSessionStore";
import { useSessionStore } from "../src/store/sessionStore";
import { formatMoney } from "../src/utils/format";

// Full-screen Niyah-branded surrender entry point. Reached when the user taps
// "Unlock & forfeit stake" on the Apple shield extension — that extension
// deep-links `niyah://blocked`, which expo-router routes here.
//
// Apple's `ShieldConfiguration` API is intentionally minimal (title/subtitle/
// icon/two buttons/bg color), so the real branded experience lives here in the
// main app. Two paths out:
//   1. Back to Focus — dismisses, leaves the session running
//   2. Forfeit — pushes the existing /session/surrender screen (type-QUIT
//      confirmation flow with payment handoff for group sessions)
//
// Mirrors the pattern Opal + One Sec use: minimal shield = brief gate, host
// app = rich surrender flow.

// Green-world text hierarchy (docs/redesign-all-tabs-progress.md): everything
// on the full-bleed primaryDark field is white, white@0.7, or white@0.55 —
// rgba so opacities never compound with layout opacity.
const WHITE_85 = "rgba(255, 255, 255, 0.85)";
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";

const QUOTES = [
  "The urge to open this app will pass.\nWait it out.",
  "You set the timer.\nPast-you knew what they were doing.",
  "The cost of unlocking is real.\nThe payoff for closing is real too.",
  "Every minute you stay focused is money you keep.",
  "Two more minutes. Then two more after that.",
  "The hardest part is the next 60 seconds.\nThen it gets easier.",
  "Close this. Earn the stake. Move on.",
  "Past-you put real money on this.\nDon't outsmart them.",
];

function BlockedScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const groupSession = useGroupSessionStore((s) => s.activeGroupSession);
  const soloSession = useSessionStore((s) => s.currentSession);

  const blob = user?.blobAvatar;
  const otherNames = (groupSession?.participants ?? [])
    .filter((p) => p.userId !== user?.id)
    .map((p) => p.name || "Friend");
  const stakeCents =
    soloSession?.stakeAmount ?? groupSession?.stakePerParticipant ?? 0;
  const isGroup = otherNames.length > 0;

  // Rotate quote on each mount so reopening the screen doesn't feel identical
  const quote = useMemo(
    () => QUOTES[Math.floor(Date.now() / 60_000) % QUOTES.length],
    [],
  );

  // Pulsing animation on the blob — subtle "you're being watched" feel
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  // Slide-up entrance
  const slide = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [slide, fade]);

  const handleBackToFocus = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // dismissAll falls back to going to the root if there's nothing stacked —
    // either way the user lands on a non-blocked Niyah screen and the session
    // keeps running.
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/");
  };

  const handleForfeit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.push("/session/surrender");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary, Colors.primaryDark]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.content,
          { opacity: fade, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatarGlow} />
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            {blob ? (
              <BlobAvatar size={140} config={blob} seed={user?.id} />
            ) : (
              <View style={styles.avatarFallback} />
            )}
          </Animated.View>
        </View>

        <Text style={styles.kicker}>You broke focus</Text>
        <Text style={styles.title}>
          {isGroup
            ? "Your group is still watching."
            : "Your stake is still on the line."}
        </Text>

        <Text style={styles.quote}>{quote}</Text>

        {stakeCents > 0 && (
          <View style={styles.stakeCard}>
            <Text style={styles.stakeLabel}>On the line</Text>
            <Text style={styles.stakeAmount}>{formatMoney(stakeCents)}</Text>
            {isGroup && (
              <Text style={styles.stakeContext}>
                with {formatNames(otherNames)}
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View style={[styles.buttonStack, { opacity: fade }]}>
        <Pressable
          onPress={handleBackToFocus}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>Back to focus</Text>
          <Text style={styles.primaryBtnSubtext}>Keep your stake</Text>
        </Pressable>

        <Pressable onPress={handleForfeit} style={styles.forfeitBtn}>
          <Text style={styles.forfeitText}>Forfeit stake & quit</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function formatNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    // Full-bleed green field (the gradient overlays primaryDark → primary →
    // primaryDark for the same subtle center lift the old theme version had).
    root: {
      flex: 1,
      backgroundColor: Colors.primaryDark,
      paddingTop: Platform.OS === "ios" ? 64 : 32,
      paddingBottom: 36,
      paddingHorizontal: Spacing.lg,
      justifyContent: "space-between",
    },
    content: {
      alignItems: "center",
      paddingTop: Spacing.xl,
    },
    avatarWrap: {
      width: 180,
      height: 180,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.xl,
    },
    avatarGlow: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: Colors.white,
      opacity: 0.15,
    },
    avatarFallback: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: Colors.glassLight,
    },
    // Urgency kept: white-flip pill so the semantic loss red stays legible on
    // the green field (loss sinks into green; it reads on white — select.tsx
    // precedent).
    kicker: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.loss,
      backgroundColor: Colors.white,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      overflow: "hidden",
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: Typography.headlineLarge,
      ...Font.bold,
      color: Colors.white,
      textAlign: "center",
      lineHeight: Typography.headlineLarge * 1.15,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    quote: {
      fontSize: Typography.bodyLarge,
      color: WHITE_70,
      textAlign: "center",
      lineHeight: Typography.bodyLarge * 1.4,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    // Glass seat (glassLight, Radius.xl, borderless).
    stakeCard: {
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xl,
      alignItems: "center",
      width: "100%",
      maxWidth: 320,
    },
    stakeLabel: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: Spacing.xs,
    },
    stakeAmount: {
      fontSize: Typography.displayMedium,
      ...Font.heavy,
      color: Colors.white,
    },
    stakeContext: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      marginTop: Spacing.xs,
    },
    buttonStack: {
      gap: Spacing.md,
    },
    // Emphasis flip (Colors.white + primaryDark content): "Back to focus" is
    // THE action that keeps the stake, so it gets the white pill on green.
    primaryBtn: {
      backgroundColor: Colors.white,
      borderRadius: Radius.full,
      paddingVertical: Spacing.lg,
      alignItems: "center",
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    primaryBtnPressed: {
      backgroundColor: WHITE_85,
      transform: [{ scale: 0.98 }],
    },
    primaryBtnText: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.primaryDark,
    },
    primaryBtnSubtext: {
      fontSize: Typography.labelSmall,
      color: Colors.primary,
      marginTop: 2,
    },
    // Danger semantics kept (lossLight fill + loss border, confirm.tsx
    // warning-card precedent); white text since loss red sinks into green.
    forfeitBtn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: Colors.lossLight,
      borderWidth: 1,
      borderColor: Colors.loss,
      borderRadius: Radius.full,
    },
    forfeitText: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.white,
    },
  });

const BlockedScreenBody = withErrorBoundary(BlockedScreenInner, "blocked");

// Green-world theme pin: blocked is a ROOT-Stack screen (shield deep link), so
// it sits OUTSIDE the pinned (tabs)/session layout subtrees and must pin
// itself. The provider goes ABOVE the screen body — a provider rendered inside
// the component couldn't affect the component's own useColors() — so the whole
// screen (own styles + theme-driven children) resolves to the dark palette and
// renders identically in both themes.
const BlockedScreen = () => (
  <ThemeOverrideContext.Provider value="dark">
    <BlockedScreenBody />
  </ThemeOverrideContext.Provider>
);
export default BlockedScreen;
