import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";
import { useReducedMotion } from "react-native-reanimated";
import { Dial } from "../../../components/session/Dial";
import { rangeValues, valueForOffset } from "../../../components/session/dialMath";
import { formatMoney } from "../../../utils/format";

const SPACING = 26; // mirrors Dial.tsx TICK_SPACING (private)

const PEOPLE = rangeValues(1, 5);
const DOLLARS = rangeValues(200, 2500, 100);
const formatPeople = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const formatDollars = (cents: number) => formatMoney(cents, false);

// The jest gesture-handler mock captures each builder callback on the returned
// object's `handlers` map, letting us drive the pan worklets directly.
type CapturedPan = {
  handlers: {
    onBegin: () => void;
    onUpdate: (e: { translationX: number }) => void;
    onEnd: () => void;
  };
};
const lastPan = (): CapturedPan => {
  const result = jest.mocked(Gesture.Pan).mock.results.at(-1);
  if (!result || result.type !== "return") {
    throw new Error("Gesture.Pan was never constructed");
  }
  return result.value as unknown as CapturedPan;
};

describe("Dial", () => {
  describe("rendering — people config", () => {
    it("renders the formatted center readout and label", () => {
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
      expect(screen.getByText("3 people")).toBeTruthy();
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
      expect(screen.getByText("$5")).toBeTruthy();
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

  describe("drag gesture", () => {
    it("commits the detent the drag lands on and fires commit haptics", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={1}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
        />,
      );
      const pan = lastPan();
      pan.handlers.onBegin();
      pan.handlers.onUpdate({ translationX: -10000 }); // hard left → top detent
      expect(Haptics.selectionAsync).toHaveBeenCalled();
      // The shipped (split worklet/JS) path lands where the pure helper predicts.
      expect(onChange).toHaveBeenCalledWith(valueForOffset(PEOPLE, 0, -10000, SPACING));
      expect(onChange).toHaveBeenCalledWith(5);

      pan.handlers.onEnd();
      expect(Haptics.impactAsync).toHaveBeenCalledWith("Medium");
    });

    it("a drag cannot cross above disabledAbove", () => {
      const onChange = jest.fn();
      render(
        <Dial
          values={PEOPLE}
          value={1}
          onChange={onChange}
          format={formatPeople}
          label="People"
          accessibilityLabel="People"
          disabledAbove={3}
        />,
      );
      const pan = lastPan();
      pan.handlers.onBegin();
      pan.handlers.onUpdate({ translationX: -10000 });
      expect(onChange).toHaveBeenCalledWith(valueForOffset(PEOPLE, 0, -10000, SPACING, 2));
      expect(onChange).toHaveBeenCalledWith(3);
      expect(onChange).not.toHaveBeenCalledWith(4);
      expect(onChange).not.toHaveBeenCalledWith(5);
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
      // The readout and the parent both land on the cap, not the raw $5/5-people.
      expect(onChange).toHaveBeenCalledWith(3);
      expect(screen.getByText("3 people")).toBeTruthy();
      expect(screen.queryByText("5 people")).toBeNull();
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
      expect(screen.getByText("1 person")).toBeTruthy();
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
      expect(screen.getByText("2 people")).toBeTruthy();
      fireEvent(screen.getByLabelText("People"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
      expect(onChange).toHaveBeenCalledWith(3);
    });
  });
});
