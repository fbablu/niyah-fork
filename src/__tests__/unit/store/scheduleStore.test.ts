/**
 * Unit tests for scheduleStore + scheduleTemplates helpers.
 *
 * Pins the Phase-1 contract: templates persist locally, enabling/editing a
 * template arms the OS schedule (DeviceActivitySchedule), disabling/removing
 * clears it, and the per-template stake is INERT (free block still arms).
 */

jest.mock("../../../config/screentime", () => ({
  startScheduledBlocking: jest.fn(() => Promise.resolve()),
  stopScheduledBlocking: jest.fn(() => Promise.resolve()),
}));

import { useScheduleStore } from "../../../store/scheduleStore";
import {
  SCHEDULE_PRESETS,
  presetToTemplate,
  templatesConflict,
  findEnabledConflict,
  formatWindow,
  formatDays,
} from "../../../constants/scheduleTemplates";
import {
  startScheduledBlocking,
  stopScheduledBlocking,
} from "../../../config/screentime";
import type { Weekday } from "../../../types";

const WORKDAY = SCHEDULE_PRESETS.find((p) => p.key === "workday")!;
const MORNING = SCHEDULE_PRESETS.find((p) => p.key === "morning")!;
const STUDY = SCHEDULE_PRESETS.find((p) => p.key === "study_evening")!;

describe("scheduleTemplates helpers", () => {
  it("presetToTemplate is a pure, deterministic factory", () => {
    const t = presetToTemplate(WORKDAY, "fixed-id", 1700000000000);
    expect(t).toMatchObject({
      id: "fixed-id",
      name: "Work day",
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 17,
      stakeCents: 0, // free by default — staking is opt-in (Phase 2)
      enabled: true,
      createdAt: 1700000000000,
    });
    // Must copy the days array, not alias the preset's.
    expect(t.days).not.toBe(WORKDAY.days);
  });

  it("formatWindow renders a 12-hour window label", () => {
    expect(
      formatWindow({
        startHour: 9,
        startMinute: 0,
        endHour: 17,
        endMinute: 30,
      }),
    ).toBe("9:00 AM – 5:30 PM");
    expect(
      formatWindow({
        startHour: 0,
        startMinute: 0,
        endHour: 12,
        endMinute: 0,
      }),
    ).toBe("12:00 AM – 12:00 PM");
  });

  it("formatDays summarises common day sets", () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(formatDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(formatDays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(formatDays([])).toBe("No days");
  });

  it("templatesConflict detects same-day time-window overlap", () => {
    const mk = (days: Weekday[], startHour: number, endHour: number) => ({
      days,
      startHour,
      startMinute: 0,
      endHour,
      endMinute: 0,
    });
    const workday = mk([1, 2, 3, 4, 5], 9, 17);
    const morning = mk([0, 1, 2, 3, 4, 5, 6], 6, 11);
    const evening = mk([0, 1, 2, 3, 4, 5, 6], 18, 22);
    const weekend = mk([0, 6], 9, 17);
    expect(templatesConflict(workday, morning)).toBe(true); // Mon–Fri 9–11 overlap
    expect(templatesConflict(workday, evening)).toBe(false); // disjoint times
    expect(templatesConflict(workday, weekend)).toBe(false); // no shared day
    expect(templatesConflict(workday, workday)).toBe(true); // identical
  });

  it("findEnabledConflict ignores disabled blocks and the excluded id", () => {
    const workday = presetToTemplate(WORKDAY, "wd", 0);
    const morning = presetToTemplate(MORNING, "mo", 0);

    // Enabled Work day conflicts with Morning (9–11 overlap Mon–Fri).
    expect(findEnabledConflict([workday], MORNING)).toBe(workday);
    // Disabled Work day does NOT (build-21 repro: OFF block wrongly blocked
    // adding Morning).
    expect(
      findEnabledConflict([{ ...workday, enabled: false }], MORNING),
    ).toBeNull();
    // Re-enabling a template never conflicts with itself.
    expect(findEnabledConflict([workday], workday, "wd")).toBeNull();
    // …but does conflict with OTHER enabled overlapping blocks.
    expect(findEnabledConflict([workday, morning], morning, "mo")).toBe(
      workday,
    );
  });
});

describe("scheduleStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScheduleStore.setState({ templates: [] });
  });

  it("addPreset creates a template and arms the OS schedule", () => {
    const t = useScheduleStore.getState().addPreset(WORKDAY)!;

    expect(useScheduleStore.getState().templates).toHaveLength(1);
    expect(t.name).toBe("Work day");
    expect(t.enabled).toBe(true);
    expect(t.stakeCents).toBe(0);

    expect(startScheduledBlocking).toHaveBeenCalledTimes(1);
    expect(startScheduledBlocking).toHaveBeenCalledWith(
      9,
      0,
      17,
      0,
      `niyah_sched_${t.id}`,
    );
  });

  it("refuses an overlapping or duplicate block (enabled blocks only)", () => {
    const workday = useScheduleStore.getState().addPreset(WORKDAY)!;
    jest.clearAllMocks();

    // Exact duplicate.
    expect(useScheduleStore.getState().addPreset(WORKDAY)).toBeNull();
    // Morning (every day 6–11) overlaps Work day on Mon–Fri 9–11.
    expect(useScheduleStore.getState().addPreset(MORNING)).toBeNull();

    expect(useScheduleStore.getState().templates).toHaveLength(1);
    expect(startScheduledBlocking).not.toHaveBeenCalled();

    // A non-overlapping block (evening) is still allowed.
    expect(useScheduleStore.getState().addPreset(STUDY)).not.toBeNull();
    expect(useScheduleStore.getState().templates).toHaveLength(2);

    // DISABLED blocks don't conflict: switch Work day off → Morning adds
    // fine (build-21 repro: "Work day is OFF, I select Morning →
    // 'Overlaps a block'").
    useScheduleStore.getState().setEnabled(workday.id, false);
    expect(useScheduleStore.getState().addPreset(MORNING)).not.toBeNull();
    expect(useScheduleStore.getState().templates).toHaveLength(3);
  });

  it("setEnabled(true) refuses when it would collide with an enabled block", () => {
    const workday = useScheduleStore.getState().addPreset(WORKDAY)!;
    useScheduleStore.getState().setEnabled(workday.id, false);
    const morning = useScheduleStore.getState().addPreset(MORNING)!;
    jest.clearAllMocks();

    // Work day (Mon–Fri 9–17) collides with the now-enabled Morning (6–11).
    expect(useScheduleStore.getState().setEnabled(workday.id, true)).toBe(
      false,
    );
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === workday.id)
        ?.enabled,
    ).toBe(false); // state untouched
    expect(startScheduledBlocking).not.toHaveBeenCalled();

    // Disable the collider → enabling succeeds.
    useScheduleStore.getState().setEnabled(morning.id, false);
    expect(useScheduleStore.getState().setEnabled(workday.id, true)).toBe(true);
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === workday.id)
        ?.enabled,
    ).toBe(true);
  });

  it("setEnabled(false) disarms; setEnabled(true) re-arms", () => {
    const t = useScheduleStore.getState().addPreset(MORNING)!;
    jest.clearAllMocks();

    useScheduleStore.getState().setEnabled(t.id, false);
    expect(stopScheduledBlocking).toHaveBeenCalledWith(`niyah_sched_${t.id}`);
    expect(startScheduledBlocking).not.toHaveBeenCalled();
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === t.id)?.enabled,
    ).toBe(false);

    jest.clearAllMocks();
    useScheduleStore.getState().setEnabled(t.id, true);
    expect(startScheduledBlocking).toHaveBeenCalledWith(
      6,
      0,
      11,
      0,
      `niyah_sched_${t.id}`,
    );
  });

  it("updateTemplate re-arms with the new window and keeps id immutable", () => {
    const t = useScheduleStore.getState().addPreset(WORKDAY)!;
    jest.clearAllMocks();

    // id is intentionally ignored by updateTemplate (runtime-immutable).
    useScheduleStore
      .getState()
      .updateTemplate(t.id, { startHour: 8, endHour: 16, id: "hacked" });

    const updated = useScheduleStore.getState().templates[0];
    expect(updated.id).toBe(t.id); // not "hacked"
    expect(updated.startHour).toBe(8);
    expect(startScheduledBlocking).toHaveBeenCalledWith(
      8,
      0,
      16,
      0,
      `niyah_sched_${t.id}`,
    );
  });

  it("removeTemplate deletes the template and clears its OS schedule", () => {
    const t = useScheduleStore.getState().addPreset(WORKDAY)!;
    jest.clearAllMocks();

    useScheduleStore.getState().removeTemplate(t.id);
    expect(useScheduleStore.getState().templates).toHaveLength(0);
    expect(stopScheduledBlocking).toHaveBeenCalledWith(`niyah_sched_${t.id}`);
  });

  it("updateStake sets the stake without re-arming the OS schedule", () => {
    // Phase 2 stake is display-only: the server auto-stakes at the block start,
    // so toggling a stake never moves money or re-arms a native schedule here.
    const t = useScheduleStore.getState().addPreset(WORKDAY)!;
    expect(t.stakeCents).toBe(0);
    jest.clearAllMocks();

    useScheduleStore.getState().updateStake(t.id, 500);
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === t.id)
        ?.stakeCents,
    ).toBe(500);
    // No re-arm / disarm — the OS block is identical whether or not it's staked.
    expect(startScheduledBlocking).not.toHaveBeenCalled();
    expect(stopScheduledBlocking).not.toHaveBeenCalled();

    // Toggling back to free clears the stake; negatives are floored to 0.
    useScheduleStore.getState().updateStake(t.id, 0);
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === t.id)
        ?.stakeCents,
    ).toBe(0);
    useScheduleStore.getState().updateStake(t.id, -100);
    expect(
      useScheduleStore.getState().templates.find((x) => x.id === t.id)
        ?.stakeCents,
    ).toBe(0);
  });

  it("reset disarms every OS schedule and clears all templates (logout hygiene)", () => {
    const a = useScheduleStore.getState().addPreset(WORKDAY)!;
    const b = useScheduleStore.getState().addPreset(STUDY)!;
    useScheduleStore.getState().setEnabled(b.id, false);
    jest.clearAllMocks();

    useScheduleStore.getState().reset();

    expect(useScheduleStore.getState().templates).toHaveLength(0);
    // Both enabled AND disabled schedules are disarmed — the next account on
    // this device must not inherit any armed DeviceActivity window.
    expect(stopScheduledBlocking).toHaveBeenCalledWith(`niyah_sched_${a.id}`);
    expect(stopScheduledBlocking).toHaveBeenCalledWith(`niyah_sched_${b.id}`);
  });

  it("syncNative arms enabled templates and clears disabled ones", () => {
    const a = useScheduleStore.getState().addPreset(WORKDAY)!;
    const b = useScheduleStore.getState().addPreset(STUDY)!; // evening — no overlap
    useScheduleStore.getState().setEnabled(b.id, false);
    jest.clearAllMocks();

    useScheduleStore.getState().syncNative();

    expect(startScheduledBlocking).toHaveBeenCalledWith(
      9,
      0,
      17,
      0,
      `niyah_sched_${a.id}`,
    );
    expect(stopScheduledBlocking).toHaveBeenCalledWith(`niyah_sched_${b.id}`);
  });
});
