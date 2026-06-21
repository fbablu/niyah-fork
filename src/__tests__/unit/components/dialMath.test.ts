import {
  clampPosition,
  indexOfValue,
  maxIndexForCap,
  positionForOffset,
  rangeValues,
  snapIndex,
  valueForOffset,
} from "../../../components/session/dialMath";

// The two configs the Dial ships with (people 1–5; dollars $2–$25 in cents).
const PEOPLE = rangeValues(1, 5); // [1,2,3,4,5]
const DOLLARS = rangeValues(200, 2500, 100); // [200,300,...,2500]
const SPACING = 26; // matches Dial.tsx TICK_SPACING

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

describe("positionForOffset", () => {
  it("maps a left swipe of one spacing to +1 index (iOS-ruler direction)", () => {
    expect(positionForOffset(0, -SPACING, SPACING)).toBe(1);
    expect(positionForOffset(2, -2 * SPACING, SPACING)).toBe(4);
  });

  it("maps a right swipe to a lower (negative) position", () => {
    expect(positionForOffset(0, SPACING, SPACING)).toBe(-1);
  });

  it("is a no-op when spacing is non-positive", () => {
    expect(positionForOffset(2, 999, 0)).toBe(2);
  });
});

describe("clampPosition", () => {
  it("keeps fractional positions inside [0, count-1]", () => {
    expect(clampPosition(2.5, 5)).toBe(2.5);
    expect(clampPosition(-3, 5)).toBe(0);
    expect(clampPosition(99, 5)).toBe(4);
  });

  it("honors a cap (maxEnabledIndex)", () => {
    expect(clampPosition(4, 5, 2)).toBe(2);
    expect(clampPosition(1.4, 5, 2)).toBe(1.4);
  });

  it("never returns past the hard max even if the cap is larger", () => {
    expect(clampPosition(99, 5, 10)).toBe(4);
  });

  it("returns 0 for an empty detent set", () => {
    expect(clampPosition(3, 0)).toBe(0);
  });
});

describe("snapIndex", () => {
  it("rounds to the nearest detent and clamps", () => {
    expect(snapIndex(1.4, 5)).toBe(1);
    expect(snapIndex(1.6, 5)).toBe(2);
    expect(snapIndex(-3, 5)).toBe(0);
    expect(snapIndex(99, 5)).toBe(4);
  });

  it("respects the cap", () => {
    expect(snapIndex(99, 5, 2)).toBe(2);
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

describe("valueForOffset (end-to-end drag → committed value)", () => {
  it("commits the detent the finger lands on", () => {
    // From person 1 (index 0), drag left three detents → person 4.
    expect(valueForOffset(PEOPLE, 0, -3 * SPACING, SPACING)).toBe(4);
    // From $2 (index 0), drag left two detents → $4 (400 cents).
    expect(valueForOffset(DOLLARS, 0, -2 * SPACING, SPACING)).toBe(400);
  });

  it("clamps a hard overshoot to the top detent", () => {
    expect(valueForOffset(PEOPLE, 0, -10000, SPACING)).toBe(5);
  });

  it("cannot pass a cap", () => {
    // Cap at index 2 (person 3): a big drag stops at person 3.
    expect(valueForOffset(PEOPLE, 0, -10000, SPACING, 2)).toBe(3);
  });

  it("clamps a backward drag to the first detent", () => {
    expect(valueForOffset(PEOPLE, 2, 10000, SPACING)).toBe(1);
  });
});
