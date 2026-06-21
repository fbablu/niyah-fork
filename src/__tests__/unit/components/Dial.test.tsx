import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useReducedMotion } from "react-native-reanimated";
import { Dial } from "../../../components/session/Dial";
import { rangeValues } from "../../../components/session/dialMath";
import { formatMoney } from "../../../utils/format";

const PEOPLE = rangeValues(1, 5);
const DOLLARS = rangeValues(200, 2500, 100);
const formatPeople = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const formatDollars = (cents: number) => formatMoney(cents, false);

// The dial is a native ScrollView (snapToOffsets + decelerationRate="fast"), so
// the scroll/decelerate/snap physics is the OS's and isn't simulated in jest.
// What's tested here: the readout (via the adjustable node's value), the cap
// reconciliation, and the VoiceOver increment/decrement path. The offset→index
// math is unit-tested in dialMath.test.ts.

describe("Dial", () => {
  describe("rendering — people config", () => {
    it("pins the value on the adjustable node and renders the label", () => {
      render(
        <Dial
          values={PEOPLE}
          value={3}
          onChange={jest.fn()}
          format={formatPeople}
          label="How many people"
          accessibilityLabel="Number of people"
        />,
      );
      expect(
        screen.getByLabelText("Number of people").props.accessibilityValue.text,
      ).toBe("3 people");
      expect(screen.getByText("How many people")).toBeTruthy();
    });

    it("exposes an adjustable accessibility node with the current value", () => {
      render(
        <Dial
          values={PEOPLE}
          value={3}
          onChange={jest.fn()}
          format={formatPeople}
          label="People"
          accessibilityLabel="Number of people"
        />,
      );
      const node = screen.getByLabelText("Number of people");
      expect(node.props.accessibilityRole).toBe("adjustable");
      expect(node.props.accessibilityValue).toEqual({
        min: 1,
        max: 5,
        now: 3,
        text: "3 people",
      });
    });
  });

  describe("rendering — dollar config", () => {
    it("renders the dollar readout and the group subline", () => {
      render(
        <Dial
          values={DOLLARS}
          value={500}
          onChange={jest.fn()}
          format={formatDollars}
          label="Stake"
          accessibilityLabel="Stake amount"
          subline="Everyone stakes their own"
        />,
      );
      expect(
        screen.getByLabelText("Stake amount").props.accessibilityValue.text,
      ).toBe("$5");
      expect(screen.getByText("Everyone stakes their own")).toBeTruthy();
    });
  });

  describe("accessibility increment / decrement", () => {
    it("increments to the next detent and ticks a selection haptic", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={3}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
      expect(onChange).toHaveBeenCalledWith(4);
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    });

    it("decrements to the previous detent", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={3}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "decrement" },
      });
      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("does nothing past the ends", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={5}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("will not increment past disabledAbove (cap/balance clamp)", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={3}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
          disabledAbove={3}
        />,
      );
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("clamp reconciliation (the cap actually constrains)", () => {
    it("reconciles an over-cap value down to the cap on mount", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={5}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
          disabledAbove={3}
        />,
      );
      expect(onChange).toHaveBeenCalledWith(3);
      expect(
        screen.getByLabelText("People").props.accessibilityValue.text,
      ).toBe("3 people");
    });

    it("snaps the readout to a real detent when value is off-ladder", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={99}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      expect(
        screen.getByLabelText("People").props.accessibilityValue.text,
      ).toBe("1 person");
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("does not emit when value already sits on a valid in-cap detent", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={2}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("reduce motion", () => {
    it("renders and still adjusts via a11y when Reduce Motion is on", () => {
      jest.mocked(useReducedMotion).mockReturnValueOnce(true);
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={2}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      expect(
        screen.getByLabelText("People").props.accessibilityValue.text,
      ).toBe("2 people");
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
      expect(onChange).toHaveBeenCalledWith(3);
    });
  });
});
