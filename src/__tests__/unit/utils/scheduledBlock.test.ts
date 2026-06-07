/**
 * Unit tests for getActiveScheduledBlock — the pure helper the dashboard uses
 * to know whether a recurring scheduled focus block is live right now (so it
 * can show the indicator card + lock the Start CTAs).
 *
 * `now` is injected, so these are deterministic and TZ-independent: templates
 * are built around `now.getDay()` rather than a hard-coded weekday.
 */

import {
  getActiveScheduledBlock,
  getBlockProgress,
  formatBlockTimeLeft,
} from "../../../utils/scheduledBlock";
import type { ScheduledTemplate, Weekday } from "../../../types";

const at = (h: number, m = 0): Date => new Date(2026, 5, 1, h, m, 0, 0); // local

const mk = (
  patch: Partial<ScheduledTemplate> & {
    days: Weekday[];
    startHour: number;
    endHour: number;
  },
): ScheduledTemplate => ({
  id: patch.id ?? "t1",
  name: patch.name ?? "Block",
  days: patch.days,
  startHour: patch.startHour,
  startMinute: patch.startMinute ?? 0,
  endHour: patch.endHour,
  endMinute: patch.endMinute ?? 0,
  stakeCents: patch.stakeCents ?? 0,
  enabled: patch.enabled ?? true,
  createdAt: patch.createdAt ?? 0,
});

describe("getActiveScheduledBlock", () => {
  it("returns null for no templates", () => {
    expect(getActiveScheduledBlock([], at(10))).toBeNull();
  });

  it("matches an enabled block whose window contains now on a matching day", () => {
    const now = at(10);
    const today = now.getDay() as Weekday;
    const t = mk({ days: [today], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([t], now)).toBe(t);
  });

  it("returns null when now is outside the window", () => {
    const now = at(8); // before 9
    const today = now.getDay() as Weekday;
    const t = mk({ days: [today], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([t], now)).toBeNull();
  });

  it("ignores a disabled block even if the window matches", () => {
    const now = at(10);
    const today = now.getDay() as Weekday;
    const t = mk({ days: [today], startHour: 9, endHour: 17, enabled: false });
    expect(getActiveScheduledBlock([t], now)).toBeNull();
  });

  it("returns null on a non-matching weekday", () => {
    const now = at(10);
    const other = ((now.getDay() + 1) % 7) as Weekday; // not today
    const t = mk({ days: [other], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([t], now)).toBeNull();
  });

  it("treats start as inclusive and end as exclusive", () => {
    const now = at(9); // exactly start
    const today = now.getDay() as Weekday;
    const startBlock = mk({ days: [today], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([startBlock], now)).toBe(startBlock);

    const end = at(17); // exactly end
    const endBlock = mk({ days: [today], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([endBlock], end)).toBeNull();
  });

  it("respects minute granularity", () => {
    const now = at(9, 29);
    const today = now.getDay() as Weekday;
    const t = mk({ days: [today], startHour: 9, startMinute: 30, endHour: 10 });
    expect(getActiveScheduledBlock([t], now)).toBeNull();
    expect(getActiveScheduledBlock([t], at(9, 30))).toBe(t);
  });

  it("returns the first matching enabled block in order", () => {
    const now = at(10);
    const today = now.getDay() as Weekday;
    const disabled = mk({
      id: "off",
      days: [today],
      startHour: 9,
      endHour: 17,
      enabled: false,
    });
    const live = mk({ id: "on", days: [today], startHour: 9, endHour: 17 });
    expect(getActiveScheduledBlock([disabled, live], now)).toBe(live);
  });
});

describe("getBlockProgress", () => {
  const window = { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 };

  it("starts at fraction 0 with the full window left", () => {
    expect(getBlockProgress(window, at(9))).toEqual({
      fraction: 0,
      minutesLeft: 8 * 60,
    });
  });

  it("reports the midpoint", () => {
    expect(getBlockProgress(window, at(13))).toEqual({
      fraction: 0.5,
      minutesLeft: 4 * 60,
    });
  });

  it("clamps in the last minute and at/after the end", () => {
    expect(getBlockProgress(window, at(16, 59)).minutesLeft).toBe(1);
    expect(getBlockProgress(window, at(17))).toEqual({
      fraction: 1,
      minutesLeft: 0,
    });
    // Out-of-window input clamps rather than going negative.
    expect(getBlockProgress(window, at(18)).minutesLeft).toBe(0);
    expect(getBlockProgress(window, at(8)).fraction).toBe(0);
  });

  it("formatBlockTimeLeft renders hours+minutes / minutes-only", () => {
    expect(formatBlockTimeLeft(130)).toBe("2h 10m left");
    expect(formatBlockTimeLeft(45)).toBe("45m left");
    expect(formatBlockTimeLeft(0)).toBe("0m left");
  });
});
