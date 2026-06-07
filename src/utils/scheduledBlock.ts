import type { ScheduledTemplate } from "../types";

/** Minutes since local midnight for an hour/minute pair. */
const minutesOfDay = (h: number, m: number): number => h * 60 + m;

/**
 * The scheduled focus block that is "live" at `now`, or `null` if none.
 *
 * A block is live when it is ENABLED, its `days` include `now`'s weekday
 * (0 = Sun … 6 = Sat, matching `Date.getDay()`), and `now`'s minute-of-day
 * falls inside the block's `[start, end)` window — start inclusive, end
 * exclusive (so a block ending at 11:00 is no longer live at exactly 11:00,
 * and the next one starting at 11:00 takes over cleanly).
 *
 * Pure + `now` is injected so the dashboard indicator is deterministic and the
 * helper is unit-testable. Assumes same-day windows (start < end), matching the
 * Phase-1 editor + `templatesConflict`. Returns the first match in `templates`
 * order; overlapping enabled blocks are already refused at create time.
 */
export const getActiveScheduledBlock = (
  templates: ScheduledTemplate[],
  now: Date,
): ScheduledTemplate | null => {
  const day = now.getDay();
  const cur = minutesOfDay(now.getHours(), now.getMinutes());
  for (const t of templates) {
    if (!t.enabled) continue;
    if (!t.days.includes(day as ScheduledTemplate["days"][number])) continue;
    const start = minutesOfDay(t.startHour, t.startMinute);
    const end = minutesOfDay(t.endHour, t.endMinute);
    if (cur >= start && cur < end) return t;
  }
  return null;
};

/**
 * Progress through a LIVE block's window at `now` — drives the dashboard's
 * remaining-time line ("2h 10m left" + a thin progress track). Pure, minutes
 * resolution (the dashboard ticks every 30s; sub-minute precision would be
 * noise on hours-long windows).
 *
 * `fraction` is elapsed/window clamped to [0, 1]; `minutesLeft` is the whole
 * minutes until the end of the window (≥ 0). Callers pass a template that
 * `getActiveScheduledBlock` returned for the same `now` — out-of-window input
 * clamps rather than throwing.
 */
export const getBlockProgress = (
  t: Pick<
    ScheduledTemplate,
    "startHour" | "startMinute" | "endHour" | "endMinute"
  >,
  now: Date,
): { fraction: number; minutesLeft: number } => {
  const start = minutesOfDay(t.startHour, t.startMinute);
  const end = minutesOfDay(t.endHour, t.endMinute);
  const cur = minutesOfDay(now.getHours(), now.getMinutes());
  const window = Math.max(1, end - start);
  const elapsed = Math.min(window, Math.max(0, cur - start));
  return {
    fraction: elapsed / window,
    minutesLeft: Math.max(0, end - Math.min(end, Math.max(start, cur))),
  };
};

/** "2h 10m left" / "45m left" label for a live block. */
export const formatBlockTimeLeft = (minutesLeft: number): string => {
  const h = Math.floor(minutesLeft / 60);
  const m = minutesLeft % 60;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};
