/**
 * Unit Tests for BlobPlatform component
 *
 * Pins the platform-zone contract from the profile redesign (design
 * comment 1): happy arc eyes normally, flipped sleepy/sad eyes while the
 * customizer is open (animated ~180ms — the founder-loved flip, kept in the
 * v3 near-static spec; instant under reduced motion), the blob fading out
 * (150ms, no scale) when it "moves" into the sheet, and the expand
 * affordance.
 */

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useReducedMotion, withTiming } from "react-native-reanimated";
import { BlobPlatform } from "../../../components/profile/BlobPlatform";
import { DEFAULT_BLOB_AVATAR } from "../../../constants/blobAvatar";

const renderPlatform = (customizerOpen: boolean, onExpand = jest.fn()) => {
  const utils = render(
    <BlobPlatform
      config={DEFAULT_BLOB_AVATAR}
      uid="test-uid"
      customizerOpen={customizerOpen}
      onExpand={onExpand}
    />,
  );
  return { ...utils, onExpand };
};

describe("BlobPlatform", () => {
  afterEach(() => {
    (useReducedMotion as jest.Mock).mockImplementation(() => false);
  });

  describe("platform eyes", () => {
    it("shows happy eyes when the customizer is closed", () => {
      renderPlatform(false);
      expect(screen.getByTestId("platform-eyes-happy")).toBeTruthy();
      expect(screen.queryByTestId("platform-eyes-sleepy")).toBeNull();
    });

    it("flips to sleepy eyes while the customizer is open", () => {
      renderPlatform(true);
      expect(screen.getByTestId("platform-eyes-sleepy")).toBeTruthy();
      expect(screen.queryByTestId("platform-eyes-happy")).toBeNull();
    });

    it("animates the eye flip (180ms to -1) and blob hide (150ms to 0) on open", () => {
      const { rerender } = renderPlatform(false);
      rerender(
        <BlobPlatform
          config={DEFAULT_BLOB_AVATAR}
          uid="test-uid"
          customizerOpen
          onExpand={jest.fn()}
        />,
      );
      expect(withTiming).toHaveBeenCalledWith(-1, { duration: 180 });
      expect(withTiming).toHaveBeenCalledWith(0, { duration: 150 });
    });

    it("skips the flip animation entirely under reduced motion", () => {
      (useReducedMotion as jest.Mock).mockImplementation(() => true);
      renderPlatform(true);
      // Jump-to-end: sleepy state is applied without any timing animation
      // (the blob's idle breathe is also suppressed, so zero withTiming calls).
      expect(screen.getByTestId("platform-eyes-sleepy")).toBeTruthy();
      expect(withTiming).not.toHaveBeenCalled();
    });
  });

  describe("expand affordance", () => {
    it("fires onExpand with a light haptic", () => {
      const { onExpand } = renderPlatform(false);
      fireEvent.press(screen.getByLabelText("Customize your blob"));
      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith("Light");
    });

    it("sits at the top-right of the platform dome (frame 352:320)", () => {
      renderPlatform(false);
      const style = StyleSheet.flatten(
        screen.getByLabelText("Customize your blob").props.style,
      );
      expect(style.position).toBe("absolute");
      expect(style.top).toBe(0);
      expect(style.bottom).toBeUndefined();
    });
  });
});
