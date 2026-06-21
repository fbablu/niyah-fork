import {
  clampPosition,
  indexForOffset,
  indexOfValue,
  maxIndexForCap,
  nearestRingIndex,
  rangeValues,
  ringDelta,
} from "../../../components/session/dialMath";

const PEOPLE = rangeValues(1, 5); // [1,2,3,4,5]
const DOLLARS = rangeValues(200, 2500, 100); // [200,300,...,2500]
const SPACING = 26; // mirrors Dial.tsx TICK_SPACING

describe("rangeValues", () => {
  it("builds an inclusive integer range", () => {
    expect(rangeValues(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("honors a step and stays inclusive of the end", () => {
    expect(DOLLARS).toHaveLength(24);
    expect(DOLLARS[0]).toBe(200);
    expect(DOLLARS[DOLLARS.length - 1]).toBe(2500);
  });

  it("returns empty when start > end or step is non-positive", () => {
    expect(rangeValues(5, 1)).toEqual([]);
    expect(rangeValues(1, 5, 0)).toEqual([]);
    expect(rangeValues(1, 5, -1)).toEqual([]);
  });
});

describe("clampPosition", () => {
  it("keeps an index inside [0, count-1]", () => {
    expect(clampPosition(2, 5)).toBe(2);
    expect(clampPosition(-3, 5)).toBe(0);
    expect(clampPosition(99, 5)).toBe(4);
  });

  it("honors a cap (maxEnabledIndex)", () => {
    expect(clampPosition(4, 5, 2)).toBe(2);
  });

  it("never returns past the hard max even if the cap is larger", () => {
    expect(clampPosition(99, 5, 10)).toBe(4);
  });

  it("returns 0 for an empty detent set", () => {
    expect(clampPosition(3, 0)).toBe(0);
  });
});

describe("indexForOffset (scroll offset → detent index)", () => {
  it("rounds the offset to the nearest detent", () => {
    expect(indexForOffset(0, SPACING, 5)).toBe(0);
    expect(indexForOffset(SPACING, SPACING, 5)).toBe(1);
    expect(indexForOffset(SPACING * 2.7, SPACING, 5)).toBe(3);
  });

  it("clamps to the ends", () => {
    expect(indexForOffset(-50, SPACING, 5)).toBe(0);
    expect(indexForOffset(9999, SPACING, 5)).toBe(4);
  });

  it("respects the cap", () => {
    expect(indexForOffset(9999, SPACING, 5, 2)).toBe(2);
  });

  it("is safe for non-positive spacing", () => {
    expect(indexForOffset(100, 0, 5)).toBe(0);
  });
});

describe("indexOfValue", () => {
  it("finds the index of a present value", () => {
    expect(indexOfValue(PEOPLE, 3)).toBe(2);
    expect(indexOfValue(DOLLARS, 500)).toBe(3);
  });

  it("returns -1 for an absent value", () => {
    expect(indexOfValue(PEOPLE, 99)).toBe(-1);
  });
});

describe("maxIndexForCap", () => {
  it("returns undefined when no cap is set", () => {
    expect(maxIndexForCap(PEOPLE, undefined)).toBeUndefined();
  });

  it("returns the highest index whose value is ≤ cap", () => {
    expect(maxIndexForCap(PEOPLE, 3)).toBe(2);
    expect(maxIndexForCap(PEOPLE, 5)).toBe(4);
    expect(maxIndexForCap(DOLLARS, 1000)).toBe(8);
  });

  it("forces index 0 when even the smallest detent exceeds the cap", () => {
    expect(maxIndexForCap(PEOPLE, 0)).toBe(0);
    expect(maxIndexForCap(DOLLARS, 50)).toBe(0);
  });

  it("is robust to unordered arrays", () => {
    expect(maxIndexForCap([5, 1, 3], 3)).toBe(2);
  });
});

describe("ringDelta (shortest 0–9 odometer step)", () => {
  it("is a normal step within the ring", () => {
    expect(ringDelta(3, 4)).toBe(1);
    expect(ringDelta(5, 4)).toBe(-1);
  });

  it("wraps a carry the short way (9→0 = +1, 0→9 = -1)", () => {
    expect(ringDelta(9, 0)).toBe(1);
    expect(ringDelta(0, 9)).toBe(-1);
  });

  it("picks the shorter direction for bigger jumps", () => {
    expect(ringDelta(8, 1)).toBe(3); // 8→9→0→1
    expect(ringDelta(1, 8)).toBe(-3); // 1→0→9→8
  });

  it("is 0 for no change", () => {
    expect(ringDelta(4, 4)).toBe(0);
  });
});

describe("nearestRingIndex (shortest cell for a digit on a padded ring)", () => {
  const PAD = 5;
  it("returns the core cell when already there", () => {
    expect(nearestRingIndex(4, 4 + PAD, PAD)).toBe(4 + PAD);
  });

  it("picks the wrap copy when it's closer (forward carry 9→0)", () => {
    expect(nearestRingIndex(0, 14, PAD)).toBe(15);
  });

  it("picks the wrap copy for a backward carry (0→9)", () => {
    expect(nearestRingIndex(9, 5, PAD)).toBe(4);
  });

  it("stays on the core for a normal neighbor step", () => {
    expect(nearestRingIndex(4, 3 + PAD, PAD)).toBe(4 + PAD);
  });
});
