/**
 * Unit Tests for BlobMakerSheet component
 *
 * Pins the customizer contract (frame 429:347 + the v3 near-static motion
 * spec): a TRANSPARENT partial sheet (~66% height, glassDark backdrop +
 * bottom-anchored primaryLight panel, top radius 57) so the platform's
 * sleepy-eyes flip stays visible behind it, the plain timed entrance (sheet
 * rise 220ms ease-out + backdrop fade 180ms, NO springs), the 180ms
 * close-then-onClose (backdrop tap included), the three option rows
 * (5 eye glyphs / 6 palette swatches, no custom color — blocked by
 * firestore.rules / normalizeBlobAvatarConfig validation), the die
 * randomize-all (instant swap + 150ms hero opacity dip), and save semantics.
 */

import React from "react";
import { Dimensions, Modal, StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import {
  useReducedMotion,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlobMakerSheet } from "../../../components/profile/BlobMakerSheet";
import { DarkColors } from "../../../constants/colors";
import {
  BLOB_AVATAR_COLORS,
  BLOB_AVATAR_EYES,
  BLOB_DISPLAY_LABELS,
  type BlobAvatarConfig,
} from "../../../constants/blobAvatar";

const UID = "test-uid";
const baseConfig: BlobAvatarConfig = {
  colorPreset: "sunset",
  shapePreset: "unique",
  eyesPreset: "classic",
  shapeSeed: "test-uid:seed0001",
};

const renderSheet = () => {
  const onClose = jest.fn();
  const onSave = jest.fn();
  const utils = render(
    <BlobMakerSheet
      visible
      onClose={onClose}
      uid={UID}
      config={baseConfig}
      onSave={onSave}
    />,
  );
  return { ...utils, onClose, onSave };
};

/** Make withTiming invoke its completion callback so the collapse-then-close
 *  path resolves synchronously in tests. */
const runTimingCallbacks = () => {
  (withTiming as jest.Mock).mockImplementation(
    (value: unknown, _config?: unknown, callback?: (f: boolean) => void) => {
      callback?.(true);
      return value;
    },
  );
};

describe("BlobMakerSheet", () => {
  afterEach(() => {
    (withTiming as jest.Mock).mockImplementation((v: unknown) => v);
    (useReducedMotion as jest.Mock).mockImplementation(() => false);
  });

  describe("option rows", () => {
    it("renders all 5 eye-shape options as glyph tiles", () => {
      renderSheet();
      for (const option of BLOB_AVATAR_EYES) {
        expect(screen.getByLabelText(BLOB_DISPLAY_LABELS[option])).toBeTruthy();
      }
    });

    it("renders all 6 palette swatches and no custom-color swatch", () => {
      renderSheet();
      for (const option of BLOB_AVATAR_COLORS) {
        expect(screen.getByLabelText(BLOB_DISPLAY_LABELS[option])).toBeTruthy();
      }
      // Custom color is deferred: firestore.rules hasOnly() +
      // normalizeBlobAvatarConfig reject arbitrary colors.
      expect(screen.queryByLabelText(/custom/i)).toBeNull();
    });

    it("marks the current eye and color options as selected", () => {
      renderSheet();
      expect(
        screen.getByLabelText(BLOB_DISPLAY_LABELS.classic).props
          .accessibilityState,
      ).toEqual({ selected: true });
      expect(
        screen.getByLabelText(BLOB_DISPLAY_LABELS.sunset).props
          .accessibilityState,
      ).toEqual({ selected: true });
    });
  });

  describe("die randomize-all", () => {
    it("one tap re-mints the seed AND draws a valid color + eyes preset", () => {
      const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
      const { onSave } = renderSheet();

      fireEvent.press(screen.getByLabelText("Randomize your blob"));
      fireEvent.press(screen.getByText("Done"));

      expect(onSave).toHaveBeenCalledTimes(1);
      const saved = onSave.mock.calls[0][0] as BlobAvatarConfig;
      expect(saved.shapeSeed).toMatch(/^test-uid:[0-9a-f]{16}$/);
      expect(saved.shapeSeed).not.toBe(baseConfig.shapeSeed);
      // 0.99 deterministically picks the last entry of each valid set.
      expect(saved.colorPreset).toBe("coral");
      expect(saved.eyesPreset).toBe("surprised");
      expect(BLOB_AVATAR_COLORS).toContain(saved.colorPreset);
      expect(BLOB_AVATAR_EYES).toContain(saved.eyesPreset);
      expect(Haptics.selectionAsync).toHaveBeenCalled();
      randSpy.mockRestore();
    });
  });

  describe("save", () => {
    it("passes the full edited config (color + eyes + generative shape/seed)", () => {
      const { onSave } = renderSheet();

      fireEvent.press(screen.getByLabelText(BLOB_DISPLAY_LABELS.berry));
      fireEvent.press(screen.getByLabelText(BLOB_DISPLAY_LABELS.wink));
      fireEvent.press(screen.getByText("Done"));

      expect(onSave).toHaveBeenCalledWith({
        colorPreset: "berry",
        shapePreset: "unique",
        eyesPreset: "wink",
        shapeSeed: "test-uid:seed0001",
      });
    });

    it("shuffle re-mints a uid-namespaced seed with a medium haptic", () => {
      const { onSave } = renderSheet();

      fireEvent.press(screen.getByLabelText("Shuffle blob shape"));
      fireEvent.press(screen.getByText("Done"));

      const saved = onSave.mock.calls[0][0] as BlobAvatarConfig;
      expect(saved.shapeSeed).toMatch(/^test-uid:[0-9a-f]{16}$/);
      expect(saved.shapeSeed).not.toBe(baseConfig.shapeSeed);
      expect(Haptics.impactAsync).toHaveBeenCalledWith("Medium");
    });
  });

  describe("partial-sheet layout (design comment 1)", () => {
    it("renders a transparent modal with backdrop + bottom sheet, not a pageSheet", () => {
      renderSheet();
      const modal = screen.UNSAFE_getByType(Modal);
      // transparent + animationType none = the profile (and the platform's
      // sleepy-eyes flip) stays visible and dimmed behind the sheet.
      expect(modal.props.transparent).toBe(true);
      expect(modal.props.animationType).toBe("none");
      expect(modal.props.presentationStyle).toBeUndefined();
      expect(screen.getByTestId("blob-maker-backdrop")).toBeTruthy();
      expect(screen.getByTestId("blob-maker-sheet")).toBeTruthy();
    });

    it("sizes the sheet to ~66% of the screen (frame 429:347 partial sheet)", () => {
      renderSheet();
      const style = StyleSheet.flatten(
        screen.getByTestId("blob-maker-sheet").props.style,
      );
      expect(style.height).toBe(
        Math.round(Dimensions.get("window").height * 0.66),
      );
    });

    it("paints the green customizer sheet: primaryLight bg, top radius 57 (v2)", () => {
      renderSheet();
      const style = StyleSheet.flatten(
        screen.getByTestId("blob-maker-sheet").props.style,
      );
      // primaryLight is identical in both themes — the sheet is theme-stable.
      expect(style.backgroundColor).toBe(DarkColors.primaryLight);
      expect(style.borderTopLeftRadius).toBe(57);
      expect(style.borderTopRightRadius).toBe(57);
    });

    it("dims the profile above with the glassDark backdrop (v2)", () => {
      renderSheet();
      const style = StyleSheet.flatten(
        screen.getByTestId("blob-maker-backdrop").props.style,
      );
      expect(style.backgroundColor).toBe(DarkColors.glassDark);
    });

    it("tapping the backdrop collapses then closes without saving", () => {
      runTimingCallbacks();
      const { onClose, onSave } = renderSheet();

      fireEvent.press(screen.getByTestId("blob-maker-backdrop"));

      expect(onSave).not.toHaveBeenCalled();
      expect(withTiming).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ duration: 180 }),
        expect.any(Function),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("open/close motion (v3 spec — near-static, no springs)", () => {
    it("sheet rises on a plain 220ms timing; backdrop fades in 180ms; zero springs", () => {
      renderSheet();
      expect(withTiming).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 220 }),
      );
      expect(withTiming).toHaveBeenCalledWith(1, { duration: 180 });
      expect(withSpring).not.toHaveBeenCalled();
    });

    it("randomize dips the hero's opacity back over 150ms (instant content swap)", () => {
      renderSheet();
      fireEvent.press(screen.getByLabelText("Randomize your blob"));
      expect(withTiming).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 150 }),
      );
      expect(withSpring).not.toHaveBeenCalled();
    });

    it("collapse saves, drops the sheet (180ms), then calls onClose", () => {
      runTimingCallbacks();
      const { onClose, onSave } = renderSheet();

      fireEvent.press(screen.getByLabelText("Save and collapse"));

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(withTiming).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ duration: 180 }),
        expect.any(Function),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("cancel collapses without saving", () => {
      runTimingCallbacks();
      const { onClose, onSave } = renderSheet();

      fireEvent.press(screen.getByText("Cancel"));

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows instantly under reduced motion (no entrance animation at all)", () => {
      (useReducedMotion as jest.Mock).mockImplementation(() => true);
      renderSheet();
      // Jump-to-end: sheet/backdrop snap to 1 with zero animation calls.
      expect(withSpring).not.toHaveBeenCalled();
      expect(withTiming).not.toHaveBeenCalled();
      expect(screen.getByTestId("blob-maker-sheet")).toBeTruthy();
    });

    it("closes immediately under reduced motion (no exit animation needed)", () => {
      (useReducedMotion as jest.Mock).mockImplementation(() => true);
      // Default withTiming mock never fires callbacks, so onClose firing here
      // proves the reduced-motion path bypasses the animation entirely.
      const { onClose } = renderSheet();

      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
