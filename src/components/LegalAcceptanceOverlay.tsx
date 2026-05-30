import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Linking,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../constants/colors";
import { useColors } from "../hooks/useColors";
import { LEGAL_TERMS_URL, LEGAL_PRIVACY_URL } from "../constants/config";
import { logger } from "../utils/logger";
import { Button } from "./Button";

interface LegalAcceptanceOverlayProps {
  visible: boolean;
  onAccept: () => void;
  loading?: boolean;
}

// Plain-words summary of the de-pooled commitment-contract + privacy model.
// Mirrors the "Summary in Plain Words" sections on the hosted legal pages; the
// full text lives there and is reachable via the "Read full…" links below.
const SUMMARY_BULLETS = [
  "You stake your own money on a focus goal. Finish, you get it back. Quit early, you forfeit it to Niyah, never another user.",
  "It's a commitment contract, not gambling. Group sessions are individual; everyone stakes their own money, nothing is shared.",
  "Your Screen Time data stays on your device. We don't run ads or sell your data.",
  "Adults 18+ in the U.S. only. Withdrawals require an identity check.",
];

const openLegal = (url: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  Linking.openURL(url).catch((err) =>
    logger.warn("Failed to open legal URL:", url, err),
  );
};

interface CheckRowProps {
  styles: ReturnType<typeof makeStyles>;
  checked: boolean;
  onToggle: () => void;
  label: string;
}

// A single labeled checkbox row. Two are stacked in the overlay: an explicit
// 18+ age affirmation and Terms/Privacy agreement. Both must be ticked before
// Continue enables; the age attestation is recorded server-side on accept.
const CheckRow: React.FC<CheckRowProps> = ({
  styles,
  checked,
  onToggle,
  label,
}) => (
  <Pressable
    style={styles.checkboxRow}
    onPress={onToggle}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    accessibilityLabel={label}
  >
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkmark}>✓</Text>}
    </View>
    <Text style={styles.checkboxLabel}>{label}</Text>
  </Pressable>
);

export const LegalAcceptanceOverlay: React.FC<LegalAcceptanceOverlayProps> = ({
  visible,
  onAccept,
  loading = false,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [age18, setAge18] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter((prev) => !prev);
  };

  // Both affirmations are required: 18+ eligibility and Terms/Privacy agreement.
  const canContinue = age18 && agreedTerms;

  const handleConfirm = () => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        // Non-dismissible — no-op
      }}
    >
      {/* Dimmed backdrop centers the card vertically + horizontally */}
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms & Privacy</Text>
          <Text style={styles.subtitle}>
            Please review and accept to continue
          </Text>

          {/* Short summary — scrolls within the card only if it overflows */}
          <ScrollView
            style={styles.bullets}
            contentContainerStyle={styles.bulletsContent}
            showsVerticalScrollIndicator={false}
          >
            {SUMMARY_BULLETS.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Links out to the full hosted legal text */}
          <View style={styles.links}>
            <Pressable
              style={styles.linkButton}
              onPress={() => openLegal(LEGAL_TERMS_URL)}
              accessibilityRole="link"
              accessibilityLabel="Read full Terms of Service"
              hitSlop={8}
            >
              <Text style={styles.link}>Read full Terms ↗</Text>
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={() => openLegal(LEGAL_PRIVACY_URL)}
              accessibilityRole="link"
              accessibilityLabel="Read full Privacy Policy"
              hitSlop={8}
            >
              <Text style={styles.link}>Read full Privacy Policy ↗</Text>
            </Pressable>
          </View>

          {/* Acceptance controls */}
          <View style={styles.checks}>
            <CheckRow
              styles={styles}
              checked={age18}
              onToggle={() => toggle(setAge18)}
              label="I confirm I am 18 years of age or older"
            />
            <CheckRow
              styles={styles}
              checked={agreedTerms}
              onToggle={() => toggle(setAgreedTerms)}
              label="I agree to the Terms of Service and Privacy Policy"
            />
          </View>

          <Button
            title="Continue"
            onPress={handleConfirm}
            disabled={!canContinue || loading}
            loading={loading}
            size="large"
          />
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: Colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 460,
      maxHeight: "88%",
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    title: {
      fontSize: Typography.headlineSmall,
      ...Font.bold,
      color: Colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    bullets: {
      flexShrink: 1,
    },
    bulletsContent: {
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    bulletRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      alignItems: "flex-start",
    },
    bulletDot: {
      fontSize: Typography.bodyMedium,
      lineHeight: Typography.bodyMedium * 1.45,
      color: Colors.primaryLight,
      ...Font.bold,
    },
    bulletText: {
      flex: 1,
      fontSize: Typography.bodyMedium,
      lineHeight: Typography.bodyMedium * 1.45,
      color: Colors.text,
      ...Font.regular,
    },
    links: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    // Clean drawn line instead of textDecoration, which renders ragged with the
    // rounded font (descenders cut through it).
    linkButton: {
      borderBottomWidth: 1.5,
      borderBottomColor: Colors.primaryLight,
      paddingBottom: 2,
    },
    link: {
      fontSize: Typography.bodySmall,
      color: Colors.primaryLight,
      ...Font.semibold,
    },
    checks: {
      gap: Spacing.xs,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: Radius.sm,
      borderWidth: 2,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    checkmark: {
      color: Colors.white,
      fontSize: 16,
      ...Font.bold,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: Typography.bodySmall,
      color: Colors.text,
      lineHeight: Typography.bodySmall * 1.5,
    },
  });
