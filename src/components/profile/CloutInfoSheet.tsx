import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { CLOUT_WEIGHTS, CLOUT_TIERS } from "../../utils/clout";
import { CloutWeightRow } from "./CloutWeightRow";

interface CloutInfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const WEIGHT_ROWS: ReadonlyArray<{
  key: "soloNone" | "soloStake" | "groupNone" | "groupStaked";
  icon: IoniconName;
  label: string;
}> = [
  {
    key: "soloNone",
    icon: "checkmark-circle-outline",
    label: "Finish a session",
  },
  { key: "soloStake", icon: "cash-outline", label: "Finish a staked session" },
  { key: "groupNone", icon: "people-outline", label: "Finish with friends" },
  {
    key: "groupStaked",
    icon: "star-outline",
    label: "Finish staked with friends",
  },
];

// "What is Clout?" bottom sheet — opened from CloutCard's (i) button.
export function CloutInfoSheet({ visible, onClose }: CloutInfoSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.grabBar} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>What is Clout?</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={Colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Clout reflects how consistently you commit to and finish focus
            sessions — and how often you bring friends along.
          </Text>

          {WEIGHT_ROWS.map((row) => (
            <CloutWeightRow
              key={row.key}
              rowKey={row.key}
              icon={row.icon}
              label={row.label}
              points={CLOUT_WEIGHTS[row.key]}
              maxPoints={CLOUT_WEIGHTS.groupStaked}
            />
          ))}

          <Text style={styles.bonusNote}>
            Completing sessions with new friends adds a bonus.
          </Text>

          <Text style={styles.tiersHeading}>Tiers</Text>
          {CLOUT_TIERS.map((tier) => (
            <View key={tier.key} style={styles.tierRow}>
              <Text style={styles.tierLabel}>{tier.label}</Text>
              <Text style={styles.tierRange}>
                {Number.isFinite(tier.max)
                  ? `${tier.min}–${tier.max}`
                  : `${tier.min}+`}
              </Text>
            </View>
          ))}

          <Text style={styles.footer}>
            Higher Clout unlocks early access to new features.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Green sheet system (customizer language, node 429:347): primaryLight sheet,
// white grab bar + text, glass/primary rows.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.primaryLight },
    grabBar: {
      alignSelf: "center",
      width: Spacing.xxl,
      height: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Colors.white,
      marginTop: Spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    title: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.white,
    },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    intro: {
      fontSize: Typography.bodyMedium,
      color: Colors.white,
      opacity: 0.9,
      marginBottom: Spacing.lg,
    },
    bonusNote: {
      fontSize: Typography.bodySmall,
      color: Colors.white,
      opacity: 0.7,
      marginTop: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    tiersHeading: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.sm,
    },
    tierRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.glassMid,
    },
    tierLabel: {
      fontSize: Typography.bodyMedium,
      ...Font.medium,
      color: Colors.white,
    },
    tierRange: {
      fontSize: Typography.labelMedium,
      color: Colors.white,
      opacity: 0.7,
    },
    footer: {
      fontSize: Typography.bodySmall,
      color: Colors.white,
      opacity: 0.7,
      marginTop: Spacing.lg,
    },
  });
