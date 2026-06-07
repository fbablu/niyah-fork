import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { useWalletStore } from "../../src/store/walletStore";
import {
  CADENCES,
  SHORT_CADENCES,
  LONG_CADENCES,
  USE_SHORT_TIMERS,
} from "../../src/constants/config";
import type { CadenceType } from "../../src/types";
import { formatMoney, formatDuration } from "../../src/utils/format";

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    carouselWrap: {
      // Escape the scaffold's horizontal padding so cards peek edge-to-edge.
      marginHorizontal: -Spacing.lg,
    },
    carouselHint: {
      fontSize: Typography.labelSmall,
      color: Colors.textMuted,
      textAlign: "center",
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    optionCard: {
      backgroundColor: Colors.backgroundCard,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: 2,
      borderColor: "transparent",
    },
    optionSelected: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primaryMuted,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    optionName: {
      fontSize: Typography.titleMedium,
      ...Font.bold,
      color: Colors.text,
    },
    sectionChip: {
      backgroundColor: Colors.backgroundTertiary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    sectionChipText: {
      fontSize: Typography.labelSmall,
      ...Font.semibold,
      color: Colors.textSecondary,
      letterSpacing: 0.5,
    },
    optionDuration: {
      fontSize: Typography.labelSmall,
      color: Colors.textTertiary,
      marginBottom: Spacing.md,
    },
    optionPricing: {
      flexDirection: "row",
      alignItems: "center",
    },
    priceColumn: {
      flex: 1,
    },
    priceColumnRight: {
      alignItems: "flex-end",
    },
    priceLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textTertiary,
      marginBottom: Spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    stakeAmount: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.text,
    },
    earnAmount: {
      fontSize: Typography.titleLarge,
      ...Font.bold,
      color: Colors.gain,
    },
    vsContainer: {
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    vsText: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.textMuted,
    },
    insufficientText: {
      color: Colors.loss,
      fontSize: Typography.labelSmall,
      marginTop: Spacing.sm,
      textAlign: "center",
    },
    summaryCard: {
      padding: Spacing.lg,
    },
    summaryTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.md,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: Spacing.sm,
    },
    summaryLabel: {
      fontSize: Typography.bodySmall,
      color: Colors.textSecondary,
    },
    summaryValue: {
      fontSize: Typography.bodySmall,
      ...Font.medium,
      color: Colors.text,
    },
    bonusValue: {
      color: Colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
      marginVertical: Spacing.md,
    },
    outcomeSection: {
      marginTop: Spacing.sm,
    },
    outcomeTitle: {
      fontSize: Typography.labelMedium,
      ...Font.semibold,
      color: Colors.text,
      marginBottom: Spacing.sm,
    },
    outcomeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: Spacing.xs,
    },
    outcomeLabel: {
      fontSize: Typography.labelSmall,
      color: Colors.textSecondary,
    },
    outcomeValue: {
      fontSize: Typography.labelSmall,
      ...Font.medium,
      color: Colors.text,
    },
    balanceText: {
      textAlign: "center",
      color: Colors.textSecondary,
      fontSize: Typography.bodySmall,
    },
  });

interface CarouselCadenceCardProps {
  config: (typeof CADENCES)[CadenceType];
  /** "QUICK" | "ENDURANCE" — section chip shown on the card itself since the
   *  carousel merges both preset groups into one row. */
  sectionLabel: string;
  isSelected: boolean;
  canAfford: boolean;
  index: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
  snapInterval: number;
  onSelect: () => void;
}

const CarouselCadenceCard: React.FC<CarouselCadenceCardProps> = ({
  config,
  sectionLabel,
  isSelected,
  canAfford,
  index,
  scrollX,
  cardWidth,
  snapInterval,
  onSelect,
}) => {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const reducedMotion = useReducedMotion();

  // The centered card sits at full scale; neighbors peek in slightly shrunk.
  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    const center = index * snapInterval;
    return {
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            [center - snapInterval, center, center + snapInterval],
            [0.94, 1, 0.94],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
    >
      <Animated.View style={[{ width: cardWidth }, animatedStyle]}>
        <View
          style={[
            styles.optionCard,
            isSelected && styles.optionSelected,
            !canAfford && styles.optionDisabled,
          ]}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.optionName}>{config.name}</Text>
            <View style={styles.sectionChip}>
              <Text style={styles.sectionChipText}>{sectionLabel}</Text>
            </View>
          </View>
          <Text style={styles.optionDuration}>
            {USE_SHORT_TIMERS
              ? `${config.demoDuration / 1000}s demo session`
              : formatDuration(config.duration)}
          </Text>
          <View style={styles.optionPricing}>
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Stake</Text>
              <Text style={styles.stakeAmount}>
                {formatMoney(config.stake)}
              </Text>
            </View>
            <View style={[styles.priceColumn, styles.priceColumnRight]}>
              <Text style={styles.priceLabel}>On Complete</Text>
              <Text style={[styles.earnAmount]}>Keep it</Text>
            </View>
          </View>
          {!canAfford && (
            <Text style={styles.insufficientText}>Insufficient balance</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
};

function SelectCadenceScreenInner() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: windowWidth } = useWindowDimensions();
  const balance = useWalletStore((state) => state.balance);
  const sessionType = params.type === "solo" ? "solo" : undefined;

  // One horizontal carousel instead of a long vertical stack (swipe fatigue
  // was a build-21 finding). Quick + Endurance merge into one row — each card
  // carries its section chip. The "Test" dev preset is gated out of prod.
  const visibleCadences = useMemo(
    () =>
      [...SHORT_CADENCES, ...LONG_CADENCES].filter(
        (key) => USE_SHORT_TIMERS || key !== "test",
      ) as CadenceType[],
    [],
  );
  const sectionFor = (key: CadenceType) =>
    (SHORT_CADENCES as readonly string[]).includes(key) ? "QUICK" : "ENDURANCE";

  const CARD_WIDTH = Math.round(windowWidth * 0.78);
  const SNAP_INTERVAL = CARD_WIDTH + Spacing.md;
  const sidePadding = (windowWidth - CARD_WIDTH) / 2;

  const initialCadence = (params.cadence as CadenceType) || "focus";
  const initialIndex = Math.max(0, visibleCadences.indexOf(initialCadence));
  const [selectedCadence, setSelectedCadence] = useState<CadenceType>(
    visibleCadences[initialIndex] ?? "focus",
  );

  const scrollX = useSharedValue(initialIndex * SNAP_INTERVAL);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const selectIndex = (index: number) => {
    const key = visibleCadences[index];
    if (!key || key === selectedCadence) return;
    Haptics.selectionAsync();
    setSelectedCadence(key);
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    selectIndex(Math.min(visibleCadences.length - 1, Math.max(0, index)));
  };

  const handleCardPress = (index: number) => {
    selectIndex(index);
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
  };

  const config = CADENCES[selectedCadence];
  const canAfford = balance >= config.stake;

  const handleContinue = () => {
    if (canAfford) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const typeQuery = sessionType ? `&type=${sessionType}` : "";
      router.push(`/session/confirm?cadence=${selectedCadence}${typeQuery}`);
    }
  };

  return (
    <SessionScreenScaffold
      headerVariant="back"
      backLabel="Cancel"
      title={
        sessionType === "solo"
          ? "Choose Your Solo Session"
          : "Choose Your Session"
      }
      subtitle={
        sessionType === "solo"
          ? "Stake on yourself. Complete to get it back."
          : "Focus together. Everyone stakes their own."
      }
      centerTitle={false}
      footer={
        <>
          <Text style={styles.balanceText}>
            Available: {formatMoney(balance)}
          </Text>
          <Button
            title={canAfford ? "Continue" : "Insufficient Balance"}
            onPress={handleContinue}
            disabled={!canAfford}
            size="large"
          />
        </>
      }
    >
      {/* Preset carousel — swipe sideways, snap to one card at a time */}
      <Text style={styles.sectionTitle}>Pick a session</Text>
      <View style={styles.carouselWrap}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          disableIntervalMomentum
          contentOffset={{ x: initialIndex * SNAP_INTERVAL, y: 0 }}
          contentContainerStyle={{
            paddingHorizontal: sidePadding,
            gap: Spacing.md,
          }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          // iOS skips onMomentumScrollEnd when a drag releases with zero
          // velocity already resting at a snap offset — without this fallback
          // the centered card and the selection silently disagree.
          onScrollEndDrag={(event) => {
            if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.05) {
              handleMomentumEnd(event);
            }
          }}
        >
          {visibleCadences.map((key, index) => (
            <CarouselCadenceCard
              key={key}
              config={CADENCES[key]}
              sectionLabel={sectionFor(key)}
              isSelected={selectedCadence === key}
              canAfford={balance >= CADENCES[key].stake}
              index={index}
              scrollX={scrollX}
              cardWidth={CARD_WIDTH}
              snapInterval={SNAP_INTERVAL}
              onSelect={() => handleCardPress(index)}
            />
          ))}
        </Animated.ScrollView>
      </View>
      <Text style={styles.carouselHint}>Swipe to compare · tap to select</Text>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Session Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Stake</Text>
          <Text style={styles.summaryValue}>{formatMoney(config.stake)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.outcomeSection}>
          <Text style={styles.outcomeTitle}>Outcomes</Text>
          <View style={styles.outcomeRow}>
            <Text style={styles.outcomeLabel}>Complete:</Text>
            <Text style={[styles.outcomeValue, { color: Colors.gain }]}>
              Keep your {formatMoney(config.stake)} stake
            </Text>
          </View>
          <View style={styles.outcomeRow}>
            <Text style={styles.outcomeLabel}>Surrender:</Text>
            <Text style={[styles.outcomeValue, { color: Colors.loss }]}>
              Lose your {formatMoney(config.stake)} stake
            </Text>
          </View>
        </View>
      </Card>
    </SessionScreenScaffold>
  );
}

const SelectCadenceScreen = withErrorBoundary(
  SelectCadenceScreenInner,
  "select",
);
export default SelectCadenceScreen;
