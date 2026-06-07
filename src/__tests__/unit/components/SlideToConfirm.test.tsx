import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Gesture } from "react-native-gesture-handler";
import { useReducedMotion } from "react-native-reanimated";
import {
  SlideToConfirm,
  CONFIRM_THRESHOLD,
} from "../../../components/SlideToConfirm";

// The gesture-handler mock (jest.setup.ts) captures chained Pan callbacks in
// `handlers`, and the reanimated mock makes runOnJS/withSpring synchronous —
// so these tests drive the gesture contract directly, not pixel animation.

type CapturedPan = {
  handlers: {
    onUpdate?: (e: { translationX: number }) => void;
    onEnd?: () => void;
    enabled?: boolean;
  };
};

const TRACK_WIDTH = 300;
// Mirrors the component's geometry: thumb 48, pad 5 each side.
const MAX_X = TRACK_WIDTH - 48 - 10;

const lastPan = (): CapturedPan => {
  const results = (Gesture.Pan as jest.Mock).mock.results;
  return results[results.length - 1].value as CapturedPan;
};

const layoutTrack = () => {
  fireEvent(screen.getByTestId("slide-to-confirm-track"), "layout", {
    nativeEvent: { layout: { width: TRACK_WIDTH, height: 58 } },
  });
};

describe("SlideToConfirm", () => {
  afterEach(() => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  it("fires onConfirm exactly once on a full slide, even if released twice", () => {
    const onConfirm = jest.fn();
    render(<SlideToConfirm title="Slide to add $2.00" onConfirm={onConfirm} />);
    layoutTrack();

    const pan = lastPan();
    pan.handlers.onUpdate!({ translationX: TRACK_WIDTH });
    pan.handlers.onEnd!();
    pan.handlers.onEnd!();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("re-arms after a handler that settles without ever entering loading", async () => {
    // Early-return paths (failed Screen Time gate, auth-expired alert, demo
    // cancel) resolve without flipping `loading` — the slider must not brick.
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<SlideToConfirm title="Slide to add $2.00" onConfirm={onConfirm} />);
    layoutTrack();

    const pan = lastPan();
    pan.handlers.onUpdate!({ translationX: TRACK_WIDTH });
    pan.handlers.onEnd!();
    await Promise.resolve(); // let the handler settle → re-arm
    await Promise.resolve();

    pan.handlers.onUpdate!({ translationX: TRACK_WIDTH });
    pan.handlers.onEnd!();

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("does not fire below the confirm threshold", () => {
    const onConfirm = jest.fn();
    render(<SlideToConfirm title="Slide to add $2.00" onConfirm={onConfirm} />);
    layoutTrack();

    const pan = lastPan();
    pan.handlers.onUpdate!({
      translationX: CONFIRM_THRESHOLD * MAX_X - 10,
    });
    pan.handlers.onEnd!();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables the gesture and flags accessibility state when disabled", () => {
    const onConfirm = jest.fn();
    render(
      <SlideToConfirm
        title="Slide to add $2.00"
        onConfirm={onConfirm}
        disabled
      />,
    );
    layoutTrack();

    expect(lastPan().handlers.enabled).toBe(false);
    expect(
      screen.getByTestId("slide-to-confirm-track").props.accessibilityState,
    ).toEqual({ disabled: true, busy: false });
  });

  it("renders a tap button instead of the gesture track under reduced motion", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const onConfirm = jest.fn();
    render(<SlideToConfirm title="Slide to add $2.00" onConfirm={onConfirm} />);

    expect(screen.queryByTestId("slide-to-confirm-track")).toBeNull();
    expect(screen.getByText("Slide to add $2.00")).toBeTruthy();
  });
});
