/**
 * Unit tests for CalendarStampBlob — the per-session collectible stamp.
 *
 * The reanimated mock makes useAnimatedStyle a no-op, so these pin the
 * static contract — deterministic seed → path/palette, and the paired eye
 * overlay geometry — plus the v3 near-static motion drivers (bare 200ms
 * opacity fade; no spring, no stagger, no blink loop) via the
 * animation-function mocks.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import {
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CalendarStampBlob } from "../../../components/profile/CalendarStampBlob";
import {
  BLOB_PALETTES,
  generateBlobAvatarPreset,
  generateBlobPath,
} from "../../../constants/blobAvatar";

type Node = {
  type: string;
  props: Record<string, unknown>;
  children?: Node[] | null;
};

const collect = (node: Node | Node[] | null, type: string): Node[] => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap((n) => collect(n, type));
  const self = node.type === type ? [node] : [];
  return [...self, ...collect(node.children ?? null, type)];
};

describe("CalendarStampBlob", () => {
  it("draws the exact deterministic path for its sessionId (the collectible)", () => {
    render(<CalendarStampBlob sessionId="sess-1" />);
    expect(screen.getByTestId("stamp-body-path").props.d).toBe(
      generateBlobPath("sess-1"),
    );
  });

  it("different sessionIds mint different blobs; same id is stable", () => {
    const { unmount } = render(<CalendarStampBlob sessionId="sess-1" />);
    const first = screen.getByTestId("stamp-body-path").props.d;
    unmount();

    render(<CalendarStampBlob sessionId="sess-2" />);
    const second = screen.getByTestId("stamp-body-path").props.d;
    expect(second).not.toBe(first);
    expect(first).toBe(generateBlobPath("sess-1"));
    expect(second).toBe(generateBlobPath("sess-2"));
  });

  it("skins the blob with the seed-derived palette gradient", () => {
    const tree = render(
      <CalendarStampBlob sessionId="sess-1" />,
    ).toJSON() as Node;
    const palette =
      BLOB_PALETTES[generateBlobAvatarPreset("sess-1").colorPreset];
    const stops = collect(tree, "Stop");
    expect(stops).toHaveLength(2);
    expect(stops[0].props.stopColor).toBe(palette.start);
    expect(stops[1].props.stopColor).toBe(palette.end);
  });

  it("renders a pair of eye overlays at matching height", () => {
    render(<CalendarStampBlob sessionId="sess-1" />);
    const left = screen.getByTestId("stamp-eye-left");
    const right = screen.getByTestId("stamp-eye-right");
    const flatLeft = Object.assign({}, ...[left.props.style].flat(Infinity));
    const flatRight = Object.assign({}, ...[right.props.style].flat(Infinity));
    expect(flatLeft.top).toBe(flatRight.top);
    expect(flatLeft.left).toBeLessThan(flatRight.left);
  });

  it("enters with a bare 200ms fade — no spring, no stagger, no blink (v3)", () => {
    render(<CalendarStampBlob sessionId="sess-1" />);
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 200 }),
    );
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withSpring).not.toHaveBeenCalled();
    expect(withDelay).not.toHaveBeenCalled();
    expect(withRepeat).not.toHaveBeenCalled();
  });
});
