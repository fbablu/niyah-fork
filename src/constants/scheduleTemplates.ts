import type { ScheduledTemplate, Weekday } from "../types";

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS_MON_FRI: Weekday[] = [1, 2, 3, 4, 5];

/** Short day labels, indexed by Weekday (0 = Sun). */
export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/**
 * A blueprint the user can tap to create a {@link ScheduledTemplate} so they
 * never face a blank scheduler. "Custom" is offered separately (the editor
 * starts from a blank/sensible default), not as a preset here.
 */
export interface SchedulePreset {
  key: string;
  name: string;
  days: Weekday[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    key: "workday",
    name: "Work day",
    days: WEEKDAYS_MON_FRI,
    startHour: 9,
    startMinute: 0,
    endHour: 17,
    endMinute: 0,
  },
  {
    key: "morning",
    name: "Morning",
    days: ALL_DAYS,
    startHour: 6,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
  },
  {
    key: "study_evening",
    name: "Study evening",
    days: ALL_DAYS,
    startHour: 18,
    startMinute: 0,
    endHour: 22,
    endMinute: 0,
  },
];

/** Sensible starting point for a brand-new "Custom" template (daily 9–5, free). */
export const CUSTOM_TEMPLATE_DEFAULT: SchedulePreset = {
  key: "custom",
  name: "Custom",
  days: ALL_DAYS,
  startHour: 9,
  startMinute: 0,
  endHour: 17,
  endMinute: 0,
};

/**
 * Pure factory — builds a full {@link ScheduledTemplate} from a preset. `id` and
 * `now` are injected so the caller (store) owns id-generation and time, keeping
 * this deterministic and unit-testable.
 */
export const presetToTemplate = (
  preset: SchedulePreset,
  id: string,
  now: number,
): ScheduledTemplate => ({
  id,
  name: preset.name,
  days: [...preset.days],
  startHour: preset.startHour,
  startMinute: preset.startMinute,
  endHour: preset.endHour,
  endMinute: preset.endMinute,
  stakeCents: 0, // free block by default; staking is opt-in (Phase 2)
  enabled: true,
  createdAt: now,
});

/** "9:00 AM – 5:00 PM" style label for a template's window. */
export const formatWindow = (t: {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}): string => {
  const fmt = (h: number, m: number) => {
    const period = h < 12 ? "AM" : "PM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
  };
  return `${fmt(t.startHour, t.startMinute)} – ${fmt(t.endHour, t.endMinute)}`;
};

/** "Mon–Fri" / "Every day" / "Mon, Wed, Fri" summary for a set of days. */
export const formatDays = (days: Weekday[]): string => {
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "No days";
  const sorted = [...days].sort((a, b) => a - b);
  const isMonFri = sorted.length === 5 && sorted.every((d, i) => d === i + 1);
  if (isMonFri) return "Mon–Fri";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return sorted.map((d) => names[d]).join(", ");
};

/** Minutes since local midnight. */
const minutesOfDay = (h: number, m: number): number => h * 60 + m;

type WindowLike = Pick<
  ScheduledTemplate,
  "days" | "startHour" | "startMinute" | "endHour" | "endMinute"
>;

/**
 * Two blocks conflict if they share ANY weekday AND their time windows overlap.
 * Used to refuse overlapping/duplicate schedules (a user can't have two blocks
 * fighting the same hours). Assumes same-day windows (start < end).
 */
export const templatesConflict = (a: WindowLike, b: WindowLike): boolean => {
  if (!a.days.some((d) => b.days.includes(d))) return false;
  const aStart = minutesOfDay(a.startHour, a.startMinute);
  const aEnd = minutesOfDay(a.endHour, a.endMinute);
  const bStart = minutesOfDay(b.startHour, b.startMinute);
  const bEnd = minutesOfDay(b.endHour, b.endMinute);
  return aStart < bEnd && bStart < aEnd;
};

/**
 * First ENABLED template that conflicts with `candidate`, or null. Disabled
 * blocks never count — a switched-off "Work day" must not stop the user from
 * adding "Morning" (build-21 repro). `excludeId` skips the candidate itself
 * when re-checking an existing template (e.g. on re-enable).
 *
 * Single source of truth for the store's add/enable guards AND the screen's
 * live disabled-preset state.
 */
export const findEnabledConflict = <
  T extends WindowLike & { id?: string; enabled?: boolean; name?: string },
>(
  templates: T[],
  candidate: WindowLike,
  excludeId?: string,
): T | null => {
  for (const t of templates) {
    if (!t.enabled) continue;
    if (excludeId && t.id === excludeId) continue;
    if (templatesConflict(t, candidate)) return t;
  }
  return null;
};
