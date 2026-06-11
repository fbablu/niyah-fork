/**
 * Unit Tests for CloutInfoSheet component (+ CloutWeightRow rows)
 *
 * Pins the info-sheet contract: title + one-liner, all four CLOUT_WEIGHTS
 * earning rows with "+N pts" chips and proportional mini bars, the friends
 * bonus line, the tier ladder from CLOUT_TIERS, the footer, onClose wiring,
 * and hidden content when visible=false.
 *
 * src/utils/clout.ts is mocked virtually (built in a parallel lane);
 * the mock mirrors its published contract exactly.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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
      getCloutTier: jest.fn(() => tiers[0]),
      getCloutProgress: jest.fn(() => 0),
    };
  },
  { virtual: true },
);

import { CloutInfoSheet } from "../../../components/profile/CloutInfoSheet";

describe("CloutInfoSheet", () => {
  describe("content", () => {
    it("renders the title and the one-liner", () => {
      render(<CloutInfoSheet visible={true} onClose={jest.fn()} />);
      expect(screen.getByText("What is Clout?")).toBeTruthy();
      expect(
        screen.getByText(
          "Clout reflects how consistently you commit to and finish focus sessions — and how often you bring friends along.",
        ),
      ).toBeTruthy();
    });

    it("renders all four weight rows with their +pts chips", () => {
      render(<CloutInfoSheet visible={true} onClose={jest.fn()} />);
      expect(screen.getByText("Finish a session")).toBeTruthy();
      expect(screen.getByText("+1 pts")).toBeTruthy();
      expect(screen.getByText("Finish a staked session")).toBeTruthy();
      expect(screen.getByText("+3 pts")).toBeTruthy();
      expect(screen.getByText("Finish with friends")).toBeTruthy();
      expect(screen.getByText("+4 pts")).toBeTruthy();
      expect(screen.getByText("Finish staked with friends")).toBeTruthy();
      expect(screen.getByText("+8 pts")).toBeTruthy();
    });

    it("sizes mini bars proportionally to CLOUT_WEIGHTS", () => {
      render(<CloutInfoSheet visible={true} onClose={jest.fn()} />);
      const soloNone = screen.getByTestId("clout-weight-fill-soloNone");
      const groupStaked = screen.getByTestId("clout-weight-fill-groupStaked");
      expect(StyleSheet.flatten(soloNone.props.style).width).toBe("12.5%");
      expect(StyleSheet.flatten(groupStaked.props.style).width).toBe("100%");
    });

    it("renders the friends bonus line and the footer", () => {
      render(<CloutInfoSheet visible={true} onClose={jest.fn()} />);
      expect(
        screen.getByText("Completing sessions with new friends adds a bonus."),
      ).toBeTruthy();
      expect(
        screen.getByText("Higher Clout unlocks early access to new features."),
      ).toBeTruthy();
    });

    it("renders the tier ladder from CLOUT_TIERS with ranges", () => {
      render(<CloutInfoSheet visible={true} onClose={jest.fn()} />);
      expect(screen.getByText("Newcomer")).toBeTruthy();
      expect(screen.getByText("Committed")).toBeTruthy();
      expect(screen.getByText("Trusted")).toBeTruthy();
      expect(screen.getByText("Inner Circle")).toBeTruthy();
      expect(screen.getByText("0–49")).toBeTruthy();
      expect(screen.getByText("400+")).toBeTruthy(); // open-ended top tier
    });
  });

  describe("visibility and close", () => {
    it("calls onClose when the close button is pressed", () => {
      const onClose = jest.fn();
      render(<CloutInfoSheet visible={true} onClose={onClose} />);
      fireEvent.press(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("renders nothing when not visible", () => {
      render(<CloutInfoSheet visible={false} onClose={jest.fn()} />);
      expect(screen.queryByText("What is Clout?")).toBeNull();
    });
  });
});
