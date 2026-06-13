import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Typography,
  Spacing,
  Radius,
  Font,
  type ThemeColors,
} from "../../constants/colors";
import { useColors } from "../../hooks/useColors";
import { Skeleton } from "../Skeleton";
import { formatMoney, formatRelativeTime } from "../../utils/format";
import type { Transaction } from "../../types";

// White hierarchy on the green field — rgba so opacities never compound with
// layout opacity.
const WHITE_55 = "rgba(255, 255, 255, 0.55)";

interface TransactionHistoryProps {
  transactions: Transaction[];
  /** Max number of transactions to show (default: 5) */
  limit?: number;
  /** Show placeholder skeleton rows while the wallet hydrates. */
  loading?: boolean;
}

export function TransactionHistory({
  transactions,
  limit = 5,
  loading = false,
}: TransactionHistoryProps) {
  const Colors = useColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  const visible = React.useMemo(
    () => transactions.slice(0, limit),
    [transactions, limit],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Transaction History</Text>
      {loading && transactions.length === 0 ? (
        Array.from({ length: 4 }).map((_, i) => (
          <View key={`tx-skeleton-${i}`} style={styles.transactionRow}>
            <View style={styles.transactionInfo}>
              <Skeleton width="55%" height={15} radius={6} />
              <Skeleton
                width="32%"
                height={11}
                radius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <Skeleton width={64} height={16} radius={6} />
          </View>
        ))
      ) : transactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        visible.map((tx) => (
          <View key={tx.id} style={styles.transactionRow}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDesc}>{tx.description}</Text>
              <Text style={styles.transactionDate}>
                {formatRelativeTime(tx.createdAt)}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                tx.amount >= 0 ? styles.amountPositive : styles.amountNegative,
              ]}
            >
              {tx.amount >= 0 ? "+" : ""}
              {formatMoney(tx.amount)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

// Rows sit directly on the green field (v2 language): white text hierarchy,
// glass separators, semantic gain/loss amounts kept.
const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: Typography.titleSmall,
      ...Font.semibold,
      color: Colors.white,
      marginBottom: Spacing.md,
    },
    emptyCard: {
      alignItems: "center",
      paddingVertical: Spacing.xl,
      backgroundColor: Colors.glassLight,
      borderRadius: Radius.xl,
    },
    emptyText: {
      fontSize: Typography.bodySmall,
      color: WHITE_55,
    },
    transactionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.glassLight,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionDesc: {
      fontSize: Typography.bodyMedium,
      color: Colors.white,
    },
    transactionDate: {
      fontSize: Typography.labelSmall,
      color: WHITE_55,
      marginTop: 2,
    },
    transactionAmount: {
      fontSize: Typography.bodyMedium,
      ...Font.semibold,
      fontVariant: ["tabular-nums"],
    },
    amountPositive: {
      color: Colors.gain,
    },
    amountNegative: {
      color: Colors.loss,
    },
  });
