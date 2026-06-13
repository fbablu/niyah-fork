/**
 * Unit tests for SessionCalendar — month grid, stamps, nav, streak badge.
 *
 * Uses initialMonth (June 2026 — June 1, 2026 is a Monday) so the grid
 * layout is pinned without faking the system clock.
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import {
  SessionCalendar,
  type CalendarStamp,
} from "../../../components/profile/SessionCalendar";
import { getBlobBodyShape } from "../../../components/BlobAvatar";
import {
  generateBlobPath,
  type BlobAvatarConfig,
} from "../../../constants/blobAvatar";

const JUNE_2026 = new Date(2026, 5, 1);

const mkStamp = (over: Partial<CalendarStamp> = {}): CalendarStamp => ({
  dateKey: "2026-06-03",
  sessionId: "sess-abc",
  kind: "solo",
  stakeCents: 1500,
  completedAt: new Date(2026, 5, 3, 14, 30),
  ...over,
});

const renderCal = (over: Record<string, unknown> = {}) =>
  render(
    <SessionCalendar
      stamps={[]}
      streakCount={0}
      onStampPress={jest.fn()}
      initialMonth={JUNE_2026}
      {...over}
    />,
  );

describe("SessionCalendar", () => {
  describe("grid", () => {
    it("lays out June 2026 Sunday-first: 1 leading blank, 30 days, 35 cells", () => {
      renderCal();
      // S-M-T-W-T-F-S header
      expect(screen.getAllByText("S")).toHaveLength(2);
      expect(screen.getAllByText("T")).toHaveLength(2);
      expect(screen.getByText("W")).toBeTruthy();
      // June 1, 2026 is a Monday → cell 0 blank, cell 1 = "1"
      expect(
        within(screen.getByTestId("calendar-cell-0")).queryByText(/\d/),
      ).toBeNull();
      expect(
        within(screen.getByTestId("calendar-cell-1")).getByText("1"),
      ).toBeTruthy();
      // last day in cell 30; trailing blanks pad to a full 5th week
      expect(
        within(screen.getByTestId("calendar-cell-30")).getByText("30"),
      ).toBeTruthy();
      expect(screen.getByTestId("calendar-cell-34")).toBeTruthy();
      expect(screen.queryByTestId("calendar-cell-35")).toBeNull();
      expect(screen.queryByText("31")).toBeNull();
      expect(screen.getByText(/June/)).toBeTruthy();
    });

    it("steps months with the chevrons and fires a light haptic", () => {
      renderCal();
      fireEvent.press(screen.getByLabelText("Next month"));
      expect(screen.getByText(/July/)).toBeTruthy();
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
      fireEvent.press(screen.getByLabelText("Previous month"));
      fireEvent.press(screen.getByLabelText("Previous month"));
      expect(screen.getByText(/May/)).toBeTruthy();
    });
  });

  describe("stamps", () => {
    it("renders the stamp blob only on its dateKey", () => {
      renderCal({ stamps: [mkStamp()] });
      expect(screen.getByTestId("calendar-stamp-2026-06-03")).toBeTruthy();
      expect(screen.queryByTestId("calendar-stamp-2026-06-04")).toBeNull();
      expect(screen.queryByTestId("calendar-stamp-2026-06-02")).toBeNull();
    });

    it("pressing a stamped day fires onStampPress with that stamp + light haptic", () => {
      const onStampPress = jest.fn();
      const stamp = mkStamp();
      renderCal({ stamps: [stamp], onStampPress });
      fireEvent.press(screen.getByLabelText("Completed session on 2026-06-03"));
      expect(onStampPress).toHaveBeenCalledTimes(1);
      expect(onStampPress).toHaveBeenCalledWith(stamp);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
    });

    it("keeps the latest session when two stamps share a day", () => {
      const early = mkStamp({
        sessionId: "sess-early",
        completedAt: new Date(2026, 5, 3, 9, 0),
      });
      const late = mkStamp({
        sessionId: "sess-late",
        completedAt: new Date(2026, 5, 3, 21, 0),
      });
      const onStampPress = jest.fn();
      renderCal({ stamps: [late, early], onStampPress });
      fireEvent.press(screen.getByLabelText("Completed session on 2026-06-03"));
      expect(onStampPress).toHaveBeenCalledWith(late);
    });

    it("stamps outside the displayed month don't render", () => {
      renderCal({ stamps: [mkStamp({ dateKey: "2026-07-03" })] });
      expect(screen.queryByTestId("calendar-stamp-2026-07-03")).toBeNull();
      expect(screen.queryByTestId("calendar-stamp-2026-06-03")).toBeNull();
    });
  });

  describe("streak counter", () => {
    it("falls back to a plain white circle ONLY when there is no blobConfig", () => {
      renderCal({ streakCount: 3 });
      const badge = screen.getByTestId("streak-circle");
      expect(within(badge).getByText("3")).toBeTruthy();
      expect(screen.queryByTestId("streak-blob-outline")).toBeNull();
      expect(screen.queryByTestId("streak-blob-path")).toBeNull();
    });

    it("traces the named preset's body path (white-filled, v2 inversion) — same source BlobAvatar draws", () => {
      const blobConfig: BlobAvatarConfig = {
        colorPreset: "sunset",
        shapePreset: "wave",
        eyesPreset: "happy",
      };
      renderCal({ streakCount: 5, blobConfig });
      const badge = screen.getByTestId("streak-blob-outline");
      expect(within(badge).getByText("5")).toBeTruthy();
      const path = screen.getByTestId("streak-blob-path");
      // Cross-validated against the avatar's own shape record — these MUST
      // agree or the streak badge stops matching the user's chosen blob.
      expect(path.props.d).toBe(getBlobBodyShape(blobConfig).bodyPath);
      // Pins the preset branch: NOT the procedural fallback path.
      expect(path.props.d).not.toBe(generateBlobPath("guest"));
      // v2 white/black inversion: white-filled silhouette (was stroke-only).
      expect(path.props.fill).toBe("#FFFFFF");
      expect(screen.queryByTestId("streak-circle")).toBeNull();
    });

    it("draws the user's blob silhouette (white-filled, deterministic) from the shapeSeed", () => {
      renderCal({
        streakCount: 7,
        blobConfig: {
          colorPreset: "ocean",
          shapePreset: "unique",
          eyesPreset: "classic",
          shapeSeed: "uid:seed1",
        },
      });
      const badge = screen.getByTestId("streak-blob-outline");
      expect(within(badge).getByText("7")).toBeTruthy();
      const path = screen.getByTestId("streak-blob-path");
      expect(path.props.d).toBe(generateBlobPath("uid:seed1"));
      expect(path.props.fill).toBe("#FFFFFF");
      expect(screen.queryByTestId("streak-circle")).toBeNull();
    });

    it("a seedless 'unique' config still outlines a blob (never the circle)", () => {
      renderCal({
        streakCount: 2,
        blobConfig: {
          colorPreset: "berry",
          shapePreset: "unique",
          eyesPreset: "classic",
        },
      });
      const path = screen.getByTestId("streak-blob-path");
      // Matches BlobAvatar's own seedless fallback so ring and avatar agree.
      expect(path.props.d).toBe(generateBlobPath("guest"));
      expect(screen.queryByTestId("streak-circle")).toBeNull();
    });
  });
});
