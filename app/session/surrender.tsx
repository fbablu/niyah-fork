import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  Pressable,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../src/constants/colors";
import { useColors } from "../../src/hooks/useColors";
import {
  Card,
  Button,
  SessionScreenScaffold,
  withErrorBoundary,
} from "../../src/components";
import * as Haptics from "expo-haptics";
import { useGroupSessionStore } from "../../src/store/groupSessionStore";
import { useAuthStore } from "../../src/store/authStore";
import { formatMoney } from "../../src/utils/format";
import { logger } from "../../src/utils/logger";
import { AI_DATA_CAPTURE_ENABLED } from "../../src/constants/config";
import { updateSession } from "../../src/config/firebase";
import type { SurrenderReason } from "../../src/types";

// AI Phase-0 capture (analytics only; no money meaning) — see docs/ai-integration.md.
const REASON_OPTIONS: { value: SurrenderReason; label: string }[] = [
  { value: "distracted", label: "Distracted" },
  { value: "interrupted", label: "Interrupted" },
  { value: "too_long", label: "Too long" },
  { value: "lost_motivation", label: "Lost motivation" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

// Green-world text/border hierarchy (docs/redesign-all-tabs-progress.md):
// everything on the full-bleed primaryDark field is white, white@0.7, or
// white@0.55 — rgba so opacities never compound with layout opacity.
const WHITE_70 = "rgba(255, 255, 255, 0.7)";
const WHITE_55 = "rgba(255, 255, 255, 0.55)";
const WHITE_25 = "rgba(255, 255, 255, 0.25)";

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    // Forfeit emphasis: white-flip card so the semantic loss red stays legible
    // (select.tsx precedent — loss-red sinks into green; once the surface is
    // white the amount keeps Colors.loss).
    warningCard: {
      alignItems: "center",
      backgroundColor: Colors.white,
      borderWidth: 1,
      borderColor: Colors.loss,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.md,
    },
    warningLabel: {
      fontSize: Typography.labelMedium,
      color: Colors.primaryDark,
      marginBottom: Spacing.xs,
    },
    lossAmount: {
      fontSize: Typography.displaySmall,
      ...Font.bold,
      color: Colors.loss,
    },
    // Warning keeps its semantic gold colors (confirm.tsx precedent); body
    // text goes white so it reads on the green field in both themes.
    reputationCard: {
      backgroundColor: Colors.warningLight,
      borderWidth: 1,
      borderColor: Colors.warning,
      borderRadius: Radius.xl,
      marginBottom: Spacing.md,
    },
    reputationTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.warning,
      marginBottom: Spacing.sm,
    },
    reputationText: {
      fontSize: Typography.bodySmall,
      color: Colors.white,
      lineHeight: 20,
    },
    // Glass seat for the alternatives (glassLight, Radius.xl, borderless).
    alternativeCard: {
      marginBottom: Spacing.lg,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    alternativeTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.xs,
    },
    alternativeText: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      marginBottom: Spacing.md,
    },
    suggestions: {
      gap: Spacing.xs,
    },
    suggestionRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    suggestionBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.white,
      marginRight: Spacing.sm,
    },
    suggestionText: {
      fontSize: Typography.bodySmall,
      color: Colors.white,
    },
    // Glass seat for the reason capture (glassLight, Radius.xl).
    reasonCard: {
      marginBottom: Spacing.md,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    reasonTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.sm,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    // Dark-glass pills; the selected chip flips to white + primaryDark.
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: Colors.glassDark,
    },
    chipSelected: {
      backgroundColor: Colors.white,
    },
    chipText: {
      fontSize: Typography.bodySmall,
      color: WHITE_70,
      ...Font.medium,
    },
    chipTextSelected: {
      color: Colors.primaryDark,
      ...Font.semibold,
    },
    // Dark-glass input fields, white text (propose.tsx precedent).
    noteInput: {
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: "transparent",
      padding: Spacing.sm,
      minHeight: 44,
      fontSize: Typography.bodySmall,
      color: Colors.white,
      textAlignVertical: "top",
    },
    confirmSection: {
      marginBottom: Spacing.lg,
    },
    confirmLabel: {
      fontSize: Typography.labelMedium,
      ...Font.medium,
      color: WHITE_70,
      marginBottom: Spacing.sm,
      textAlign: "center",
    },
    confirmInput: {
      backgroundColor: Colors.glassDark,
      borderRadius: Radius.md,
      padding: Spacing.md,
      fontSize: Typography.titleMedium,
      color: Colors.white,
      borderWidth: 2,
      borderColor: WHITE_25,
      textAlign: "center",
      letterSpacing: 4,
      ...Font.semibold,
    },
    confirmInputValid: {
      borderColor: Colors.loss,
      backgroundColor: Colors.lossLight,
    },
    footer: {
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    // Shared Buttons styled via their public style prop only (Radius.full
    // pills; the keep-going CTA gets a white@0.25 hairline so the primary
    // fill separates from the green field — propose.tsx precedent).
    footerButton: {
      borderRadius: Radius.full,
    },
    keepGoingButton: {
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: WHITE_25,
    },
  });

function SurrenderScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const {
    activeGroupSession,
    activeSession,
    completeGroupSession,
    reportSurrender,
  } = useGroupSessionStore();
  const userId = useAuthStore((state) => state.user?.id);
  const [surrendering, setSurrendering] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [surrenderReason, setSurrenderReason] =
    useState<SurrenderReason | null>(null);
  const [surrenderNote, setSurrenderNote] = useState("");

  const canSurrender = confirmText.toLowerCase() === "quit";
  const stakeAmount = activeGroupSession?.stakePerParticipant ?? 0;

  const handleSurrender = async () => {
    if (!canSurrender || surrendering) return;
    setSurrendering(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // AI Phase-0: best-effort capture of the structured surrender reason
    // (analytics only; no money meaning). Persists for sessions-collection docs
    // (rule-allowlisted); server-only group docs reject this write harmlessly.
    if (AI_DATA_CAPTURE_ENABLED && surrenderReason && activeSession) {
      const trimmed = surrenderNote.trim();
      updateSession(activeSession.id, {
        surrenderReason,
        ...(trimmed ? { surrenderNote: trimmed.slice(0, 500) } : {}),
      }).catch((err) =>
        logger.warn("Failed to persist surrender reason:", err),
      );
    }

    // Firestore-backed session: report surrender to the server, which forfeits
    // only this user's own stake. Stakes are de-pooled — nothing is transferred
    // to or split among other participants.
    if (activeSession) {
      try {
        await reportSurrender(activeSession.id);
        router.replace("/session/complete");
        return;
      } catch (err) {
        logger.warn("Server surrender failed, using local:", err);
      }
    }

    // Legacy local fallback: settle local state, then land on the same
    // completion screen as a solo surrender. Forfeiting only ever affects your
    // own stake, so there is no separate partner-payment step.
    if (activeGroupSession) {
      const results = activeGroupSession.participants.map((p) => ({
        userId: p.userId,
        completed: p.userId !== userId,
      }));
      completeGroupSession(results);
    }
    router.replace("/session/complete");
  };

  useEffect(() => {
    if (!activeGroupSession) {
      router.dismissAll();
    }
  }, [activeGroupSession, router]);

  if (!activeGroupSession) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SessionScreenScaffold
        headerVariant="back"
        backLabel="Go Back"
        onBack={() => router.back()}
        scrollable={true}
        title="Surrender Session?"
        subtitle="This action cannot be undone"
        backgroundColor={Colors.primaryDark}
      >
        {/* Loss Warning */}
        <Card style={styles.warningCard}>
          <Text style={styles.warningLabel}>You will forfeit your stake</Text>
          <Text style={styles.lossAmount}>{formatMoney(stakeAmount)}</Text>
        </Card>

        {/* Reputation Impact */}
        <Card style={styles.reputationCard}>
          <Text style={styles.reputationTitle}>Reputation Impact</Text>
          <Text style={styles.reputationText}>
            Surrendering forfeits your stake and ends your commitment for this
            session. Your reputation score will reflect the incomplete session.
          </Text>
        </Card>

        {/* Alternative Suggestions */}
        <Card style={styles.alternativeCard}>
          <Text style={styles.alternativeTitle}>Before you go...</Text>
          <Text style={styles.alternativeText}>
            You have made it this far. Try one of these instead:
          </Text>
          <View style={styles.suggestions}>
            {[
              "Take a 5-minute walk",
              "Get a glass of water",
              "Do some stretches",
              "Take 10 deep breaths",
            ].map((suggestion, index) => (
              <View key={index} style={styles.suggestionRow}>
                <View style={styles.suggestionBullet} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Surrender reason — AI Phase-0 capture (optional, analytics only) */}
        {AI_DATA_CAPTURE_ENABLED && (
          <Card style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>
              What made you stop? (optional)
            </Text>
            <View style={styles.chipRow}>
              {REASON_OPTIONS.map((opt) => {
                const selected = surrenderReason === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() =>
                      setSurrenderReason(selected ? null : opt.value)
                    }
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.noteInput}
              value={surrenderNote}
              onChangeText={setSurrenderNote}
              placeholder="Anything else? (optional)"
              placeholderTextColor={WHITE_55}
              multiline
              maxLength={500}
            />
          </Card>
        )}

        {/* Confirm Section */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>
            Type QUIT to confirm surrender
          </Text>
          <TextInput
            style={[
              styles.confirmInput,
              canSurrender && styles.confirmInputValid,
            ]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type QUIT"
            placeholderTextColor={WHITE_55}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Surrender"
            onPress={handleSurrender}
            disabled={!canSurrender || surrendering}
            variant="danger"
            size="large"
            style={styles.footerButton}
          />
          <Button
            title="Keep Going"
            onPress={() => router.back()}
            variant="primary"
            size="large"
            style={styles.keepGoingButton}
          />
        </View>
      </SessionScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const SurrenderScreen = withErrorBoundary(SurrenderScreenInner, "surrender");
export default SurrenderScreen;
