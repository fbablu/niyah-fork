import type { GroupSession, Session } from "../types";
import type { CalendarStamp } from "../components/profile/SessionCalendar";

/**
 * Calendar-stamp derivation for the profile tab (design comments 4–5).
 * Pure: completed solo + group history → CalendarStamp[] for SessionCalendar.
 * Presentation-only, so it never throws — malformed rows are skipped.
 */

/** Local-time YYYY-MM-DD key — calendar cells are user-local days. */
export const toLocalDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const asDate = (value: unknown): Date | null =>
  value instanceof Date && Number.isFinite(value.getTime()) ? value : null;

const asCents = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

/** Sanitize a history `blockedByCategory` record for receipt display: keep
 *  only finite positive counts; null when absent/empty/malformed (the receipt
 *  then falls back to the latest on-device tallies — see profile.tsx). */
const asByCategory = (value: unknown): Record<string, number> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      out[key] = Math.floor(n);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
};

/**
 * One stamp per completed session (SessionCalendar collapses to the latest
 * stamp per day itself). Group stakes are per-participant — de-pooled, the
 * user's own money — so `stakePerParticipant` is the stamp's stakeCents.
 */
export function deriveCalendarStamps(
  soloHistory: Session[],
  groupHistory: GroupSession[],
): CalendarStamp[] {
  const stamps: CalendarStamp[] = [];

  for (const s of Array.isArray(soloHistory) ? soloHistory : []) {
    if (s?.status !== "completed" || typeof s.id !== "string") continue;
    const completedAt = asDate(s.completedAt) ?? asDate(s.endsAt);
    if (!completedAt) continue;
    stamps.push({
      dateKey: toLocalDateKey(completedAt),
      sessionId: s.id,
      kind: "solo",
      stakeCents: asCents(s.stakeAmount),
      completedAt,
      byCategory: asByCategory(s.blockedByCategory),
    });
  }

  for (const g of Array.isArray(groupHistory) ? groupHistory : []) {
    if (g?.status !== "completed" || typeof g.id !== "string") continue;
    const completedAt = asDate(g.completedAt) ?? asDate(g.endsAt);
    if (!completedAt) continue;
    stamps.push({
      dateKey: toLocalDateKey(completedAt),
      sessionId: g.id,
      kind: "group",
      stakeCents: asCents(g.stakePerParticipant),
      completedAt,
      byCategory: asByCategory(g.blockedByCategory),
    });
  }

  return stamps;
}

/**
 * sessionId of the most recently completed session across both histories.
 * The shield's by-category tallies are cleared natively on every
 * startBlocking, so on-device counts only ever describe this session.
 * Fallback path: sessions completed before history capture landed have
 * `byCategory: null` on their stamp and use this gate instead.
 */
export function latestStampId(stamps: CalendarStamp[]): string | undefined {
  let latest: CalendarStamp | undefined;
  for (const s of stamps) {
    if (!latest || s.completedAt > latest.completedAt) latest = s;
  }
  return latest?.sessionId;
}
