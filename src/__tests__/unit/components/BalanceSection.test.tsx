/**
 * Unit tests for BalanceSection (profile redesign, design comment 6).
 *
 * Pins: formatted balance display, the all-time ticker (up / down / fail-safe
 * hidden), and the +/- chooser firing onDeposit / onWithdraw.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import {
  BalanceSection,
  supportsLiquidGlass,
} from "../../../components/profile/BalanceSection";
import type { Transaction } from "../../../types";

let txId = 0;
const tx = (type: Transaction["type"], amount: number): Transaction => ({
  id: `tx-${++txId}`,
  type,
  amount,
  description: type,
  createdAt: new Date(),
});

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof BalanceSection>> = {},
) => {
  const onDeposit = jest.fn();
  const onWithdraw = jest.fn();
  render(
    <BalanceSection
      balanceCents={123456}
      transactions={[]}
      onDeposit={onDeposit}
      onWithdraw={onWithdraw}
      {...overrides}
    />,
  );
  return { onDeposit, onWithdraw };
};

describe("BalanceSection", () => {
  it("renders the heading and the balance via formatMoney", () => {
    renderSection();
    expect(screen.getByText("Balance")).toBeTruthy();
    expect(screen.getByText("$1,234.56")).toBeTruthy();
  });

  describe("all-time ticker", () => {
    it("shows +% when net is up", () => {
      // deposit $100, stake $20, payout $25 → balance $105 → +5.0%
      renderSection({
        balanceCents: 10500,
        transactions: [
          tx("deposit", 10000),
          tx("stake", -2000),
          tx("payout", 2500),
        ],
      });
      expect(screen.getByText("+5.0%")).toBeTruthy();
      expect(screen.getByText("all-time")).toBeTruthy();
    });

    it("shows -% when net is down", () => {
      // deposit $100, $20 stake forfeited → balance $80 → -20.0%
      renderSection({
        balanceCents: 8000,
        transactions: [
          tx("deposit", 10000),
          tx("stake", -2000),
          tx("forfeit", 0),
        ],
      });
      expect(screen.getByText("-20.0%")).toBeTruthy();
      expect(screen.getByText("all-time")).toBeTruthy();
    });

    it("hides the ticker when there are no deposits", () => {
      renderSection({ balanceCents: 500, transactions: [tx("bonus", 500)] });
      expect(screen.queryByText("all-time")).toBeNull();
    });

    it("fail-safe: hides the ticker when the list does not reconcile to the balance", () => {
      // Hydrated balance with only a partial local list — no ticker.
      renderSection({
        balanceCents: 10000,
        transactions: [tx("deposit", 2000)],
      });
      expect(screen.queryByText("all-time")).toBeNull();
    });
  });

  describe("+/- chooser", () => {
    it("is closed by default and opens with a Medium haptic", () => {
      renderSection();
      expect(screen.queryByText("Deposit")).toBeNull();

      fireEvent.press(screen.getByLabelText("Deposit or withdraw"));
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
      expect(screen.getByText("Deposit")).toBeTruthy();
      expect(screen.getByText("Withdraw")).toBeTruthy();
    });

    it("fires onDeposit and closes when Deposit is chosen", () => {
      const { onDeposit, onWithdraw } = renderSection();
      fireEvent.press(screen.getByLabelText("Deposit or withdraw"));
      fireEvent.press(screen.getByText("Deposit"));

      expect(onDeposit).toHaveBeenCalledTimes(1);
      expect(onWithdraw).not.toHaveBeenCalled();
      expect(screen.queryByText("Deposit")).toBeNull(); // chooser closed
    });

    it("fires onWithdraw and closes when Withdraw is chosen", () => {
      const { onDeposit, onWithdraw } = renderSection();
      fireEvent.press(screen.getByLabelText("Deposit or withdraw"));
      fireEvent.press(screen.getByText("Withdraw"));

      expect(onWithdraw).toHaveBeenCalledTimes(1);
      expect(onDeposit).not.toHaveBeenCalled();
      expect(screen.queryByText("Withdraw")).toBeNull(); // chooser closed
    });

    it("toggles closed when +/- is pressed again", () => {
      renderSection();
      const button = screen.getByLabelText("Deposit or withdraw");
      fireEvent.press(button);
      expect(screen.getByText("Deposit")).toBeTruthy();
      fireEvent.press(button);
      expect(screen.queryByText("Deposit")).toBeNull();
    });
  });

  describe("liquid-glass pill gating", () => {
    // The SwiftUI glassEffect modifier no-ops below iOS 26 (no background at
    // all), so the pill must render the RN glassDark fallback — which is what
    // every jest environment exercises (Platform.Version < 26).
    it("renders the RN fallback pill, not the SwiftUI host, in this environment", () => {
      renderSection();
      expect(screen.getByTestId("plus-minus-fallback")).toBeTruthy();
      expect(screen.queryByTestId("expo-ui-host")).toBeNull();
    });

    it("supportsLiquidGlass requires iOS and major version >= 26", () => {
      expect(supportsLiquidGlass("ios", "26.0")).toBe(true);
      expect(supportsLiquidGlass("ios", 26)).toBe(true);
      expect(supportsLiquidGlass("ios", "27.1")).toBe(true);
      expect(supportsLiquidGlass("ios", "18.5")).toBe(false);
      expect(supportsLiquidGlass("ios", "not-a-version")).toBe(false);
      // Android API levels are >= 26 but glass is Apple-only.
      expect(supportsLiquidGlass("android", 36)).toBe(false);
    });
  });
});
