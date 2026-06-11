/**
 * Unit Tests for CloutCard component
 *
 * Pins the Clout row contract: score + tier label rendering, (i) info button
 * (Light haptic + onInfoPress), and progress-bar fill width driven by
 * getCloutProgress (including out-of-range clamping).
 *
 * src/utils/clout.ts is mocked virtually (it is built in a parallel lane);
 * the mock mirrors its published contract exactly.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

// Tiers live INSIDE the factory: jest.mock + module imports are hoisted, so
// the factory runs before any file-level const would be initialized.
jest.mock(
  "../../../utils/clout",
  () => {
    const tiers = [
      { key: "newcomer", label: "Newcomer", min: 0, max: 49 },
      { key: "committed", label: "Committed", min: 50, max: 149 },
      { key: "trusted", label: "Trusted", min: 150, max: 399 },
      { key: "innerCircle", label: "Inner Circle", min: 400, max: null },
    ];
    return {
      __esModule: true,
      CLOUT_WEIGHTS: {
        soloNone: 1,
        soloStake: 3,
        groupNone: 4,
        groupStaked: 8,
        friendBonusFactor: 4,
      },
      CLOUT_TIERS: tiers,
      computeCloutScore: jest.fn(() => 0),
      getCloutTier: jest.fn(
        (score: number) =>
          tiers.find(
            (t) => score >= t.min && (t.max === null || score <= t.max),
          ) ?? tiers[0],
      ),
      getCloutProgress: jest.fn(() => 0.5),
    };
  },
  { virtual: true },
);

import { CloutCard } from "../../../components/profile/CloutCard";
import { getCloutProgress, getCloutTier } from "../../../utils/clout";

describe("CloutCard", () => {
  describe("score and tier", () => {
    it("renders the Clout label, the score, and the tier label", () => {
      render(<CloutCard score={230} onInfoPress={jest.fn()} />);
      expect(screen.getByText("Clout")).toBeTruthy();
      expect(screen.getByText("230")).toBeTruthy();
      expect(screen.getByText("Trusted")).toBeTruthy();
      expect(getCloutTier).toHaveBeenCalledWith(230);
    });

    it("shows the tier matching a low score", () => {
      render(<CloutCard score={10} onInfoPress={jest.fn()} />);
      expect(screen.getByText("Newcomer")).toBeTruthy();
    });
  });

  describe("info button", () => {
    it("fires onInfoPress with a Light haptic", () => {
      const onInfoPress = jest.fn();
      render(<CloutCard score={0} onInfoPress={onInfoPress} />);
      fireEvent.press(screen.getByLabelText("About Clout"));
      expect(onInfoPress).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
    });
  });

  describe("progress bar", () => {
    it("sizes the fill from getCloutProgress", () => {
      (getCloutProgress as jest.Mock).mockReturnValue(0.4);
      render(<CloutCard score={75} onInfoPress={jest.fn()} />);
      const fill = screen.getByTestId("clout-progress-fill");
      expect(StyleSheet.flatten(fill.props.style).width).toBe("40%");
      expect(getCloutProgress).toHaveBeenCalledWith(75);
    });

    it("clamps progress above 1 to a full bar", () => {
      (getCloutProgress as jest.Mock).mockReturnValue(1.2);
      render(<CloutCard score={9999} onInfoPress={jest.fn()} />);
      const fill = screen.getByTestId("clout-progress-fill");
      expect(StyleSheet.flatten(fill.props.style).width).toBe("100%");
    });

    it("clamps negative progress to an empty bar", () => {
      (getCloutProgress as jest.Mock).mockReturnValue(-0.5);
      render(<CloutCard score={0} onInfoPress={jest.fn()} />);
      const fill = screen.getByTestId("clout-progress-fill");
      expect(StyleSheet.flatten(fill.props.style).width).toBe("0%");
    });
  });
});
