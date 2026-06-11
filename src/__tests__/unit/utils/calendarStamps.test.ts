/**
 * Unit tests for deriveCalendarStamps / latestStampId — the profile calendar's
 * stamp derivation (design comments 4–5).
 *
 * Contracts pinned: only COMPLETED sessions stamp; dateKey is the LOCAL
 * calendar day of completedAt (endsAt fallback); group stamps carry the
 * user's own per-participant stake (de-pooled); stamps carry the session's
 * captured blockedByCategory as byCategory (sanitized; null when absent so
 * the receipt falls back to on-device tallies); malformed rows are skipped,
 * never thrown on; latestStampId picks the newest completion across both
 * histories (it gates the on-device fallback tallies).
 */

import {
  deriveCalendarStamps,
  latestStampId,
  toLocalDateKey,
} from "../../../utils/calendarStamps";
import type { GroupSession, Session } from "../../../types";

const solo = (overrides: Partial<Session> = {}): Session => ({
  id: "solo-1",
  cadence: "focus",
  stakeAmount: 500,
  potentialPayout: 500,
  startedAt: new Date(2026, 5, 1, 9, 0),
  endsAt: new Date(2026, 5, 1, 10, 0),
  status: "completed",
  completedAt: new Date(2026, 5, 1, 10, 0),
  ...overrides,
});

const group = (overrides: Partial<GroupSession> = {}): GroupSession => ({
  id: "group-1",
  cadence: "focus",
  stakePerParticipant: 700,
  poolTotal: 1400,
  startedAt: new Date(2026, 5, 2, 9, 0),
  endsAt: new Date(2026, 5, 2, 10, 0),
  status: "completed",
  completedAt: new Date(2026, 5, 2, 10, 0),
  participants: [],
  ...overrides,
});

describe("toLocalDateKey", () => {
  it("formats local year-month-day with zero padding", () => {
    expect(toLocalDateKey(new Date(2026, 5, 3, 23, 59))).toBe("2026-06-03");
    expect(toLocalDateKey(new Date(2026, 0, 9, 0, 0))).toBe("2026-01-09");
  });
});

describe("deriveCalendarStamps", () => {
  it("maps a completed solo session to a solo stamp on its local day", () => {
    const stamps = deriveCalendarStamps([solo()], []);
    expect(stamps).toEqual([
      {
        dateKey: "2026-06-01",
        sessionId: "solo-1",
        kind: "solo",
        stakeCents: 500,
        completedAt: new Date(2026, 5, 1, 10, 0),
        byCategory: null,
      },
    ]);
  });

  it("maps a completed group session with the per-participant stake (de-pooled)", () => {
    const stamps = deriveCalendarStamps([], [group()]);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]).toMatchObject({
      sessionId: "group-1",
      kind: "group",
      stakeCents: 700,
      dateKey: "2026-06-02",
    });
  });

  it("excludes active and surrendered sessions — only completions stamp", () => {
    const stamps = deriveCalendarStamps(
      [
        solo({ id: "a", status: "active" }),
        solo({ id: "s", status: "surrendered" }),
      ],
      [group({ id: "g", status: "surrendered" })],
    );
    expect(stamps).toEqual([]);
  });

  it("falls back to endsAt when completedAt is missing", () => {
    const stamps = deriveCalendarStamps(
      [solo({ completedAt: undefined, endsAt: new Date(2026, 5, 7, 11, 0) })],
      [],
    );
    expect(stamps[0].dateKey).toBe("2026-06-07");
    expect(stamps[0].completedAt).toEqual(new Date(2026, 5, 7, 11, 0));
  });

  it("skips malformed rows (no dates, bad stake) instead of throwing", () => {
    const broken = solo({
      id: "broken",
      completedAt: undefined,
      endsAt: "not-a-date" as unknown as Date,
    });
    const negativeStake = solo({ id: "neg", stakeAmount: -100 });
    const stamps = deriveCalendarStamps([broken, negativeStake], []);
    expect(stamps).toHaveLength(1);
    expect(stamps[0]).toMatchObject({ sessionId: "neg", stakeCents: 0 });
  });

  it("tolerates non-array inputs", () => {
    expect(
      deriveCalendarStamps(
        undefined as unknown as Session[],
        null as unknown as GroupSession[],
      ),
    ).toEqual([]);
  });

  describe("byCategory carry (design comment 5 — per-receipt app activity)", () => {
    it("carries a solo session's captured blockedByCategory onto its stamp", () => {
      const stamps = deriveCalendarStamps(
        [solo({ blockedByCategory: { social: 3, video: 1 } })],
        [],
      );
      expect(stamps[0].byCategory).toEqual({ social: 3, video: 1 });
    });

    it("carries a group session's captured blockedByCategory onto its stamp", () => {
      const stamps = deriveCalendarStamps(
        [],
        [group({ blockedByCategory: { gaming: 2 } })],
      );
      expect(stamps[0].byCategory).toEqual({ gaming: 2 });
    });

    it("sanitizes: zero/negative/non-numeric counts dropped; empty → null", () => {
      const stamps = deriveCalendarStamps(
        [
          solo({
            id: "mixed",
            blockedByCategory: {
              social: 2,
              video: 0,
              news: -1,
              gaming: "3" as unknown as number,
            },
          }),
          solo({ id: "all-zero", blockedByCategory: { social: 0 } }),
        ],
        [],
      );
      expect(stamps[0].byCategory).toEqual({ social: 2 });
      expect(stamps[1].byCategory).toBeNull();
    });

    it("is null for pre-capture sessions (field absent) and malformed values", () => {
      const stamps = deriveCalendarStamps(
        [
          solo({ id: "legacy" }),
          solo({
            id: "malformed",
            blockedByCategory: [1, 2] as unknown as Record<string, number>,
          }),
        ],
        [],
      );
      expect(stamps[0].byCategory).toBeNull();
      expect(stamps[1].byCategory).toBeNull();
    });
  });
});

describe("latestStampId", () => {
  it("returns the newest completion across solo and group histories", () => {
    const stamps = deriveCalendarStamps(
      [solo({ id: "old", completedAt: new Date(2026, 5, 1, 10, 0) })],
      [group({ id: "new", completedAt: new Date(2026, 5, 9, 10, 0) })],
    );
    expect(latestStampId(stamps)).toBe("new");
  });

  it("returns undefined for an empty list", () => {
    expect(latestStampId([])).toBeUndefined();
  });
});
