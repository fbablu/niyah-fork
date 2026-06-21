// Pure detent math for the haptic Dial (./Dial.tsx).
//
// Split out so the snap/clamp logic is unit-testable without rendering, and so
// the UI-thread gesture worklet and the JS-thread (a11y / commit / readout)
// paths share ONE source of truth — no drift between what the finger does and
// what the readout says. The functions used on the UI thread carry the
// "worklet" directive (reanimated v4 cross-module worklets); they stay ordinary
// callable functions on the JS thread, so Jest exercises the real code.

/**
 * Continuous detent position for a drag of `translationX` px starting from
 * `baseIndex`. Swiping LEFT (negative translationX) increases the index — the
 * iOS-ruler convention (higher values scroll in from the right).
 */
export const positionForOffset = (
  baseIndex: number,
  translationX: number,
  spacing: number,
): number => {
  "worklet";
  if (spacing <= 0) return baseIndex;
  return baseIndex - translationX / spacing;
};

/**
 * Clamp a (possibly fractional) position to `[0, upper]`, where `upper` is the
 * last index — or `maxEnabledIndex` when a cap (disabledAbove) is active.
 */
export const clampPosition = (
  position: number,
  count: number,
  maxEnabledIndex?: number,
): number => {
  "worklet";
  if (count <= 0) return 0;
  const hardMax = count - 1;
  const upper =
    maxEnabledIndex == null
      ? hardMax
      : Math.max(0, Math.min(maxEnabledIndex, hardMax));
  return Math.max(0, Math.min(upper, position));
};

/** Snap a position to the nearest valid integer detent index. */
export const snapIndex = (
  position: number,
  count: number,
  maxEnabledIndex?: number,
): number => {
  "worklet";
  return clampPosition(Math.round(position), count, maxEnabledIndex);
};

/**
 * Snapped detent VALUE for a drag from `baseIndex` by `translationX` px — the
 * pure mirror of the composition the Dial runs at runtime: the UI-thread
 * worklet derives the index (positionForOffset → snapIndex) and the JS commit
 * reads `values[index]`. Same primitives across both threads, so they cannot
 * drift; unit-tested here and cross-checked against the live component's drag in
 * Dial.test.tsx.
 */
export const valueForOffset = (
  values: readonly number[],
  baseIndex: number,
  translationX: number,
  spacing: number,
  maxEnabledIndex?: number,
): number => {
  const idx = snapIndex(
    positionForOffset(baseIndex, translationX, spacing),
    values.length,
    maxEnabledIndex,
  );
  return values[idx];
};

/** Index of `value` within the detent array; -1 if absent (JS thread only). */
export const indexOfValue = (
  values: readonly number[],
  value: number,
): number => values.indexOf(value);

/**
 * Largest detent index whose value is ≤ `cap` (the disabledAbove clamp). When
 * even the smallest detent exceeds the cap, returns 0 — the Dial can't show an
 * empty selection, so the caller (wizard screen) owns the "Add funds" gate.
 * `undefined` cap → no clamp. Robust to unordered arrays (scans all, no break).
 */
export const maxIndexForCap = (
  values: readonly number[],
  cap?: number,
): number | undefined => {
  if (cap == null) return undefined;
  let last = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] <= cap) last = i;
  }
  return last < 0 ? 0 : last;
};

/** Inclusive integer range `[start, end]` in `step` increments. */
export const rangeValues = (start: number, end: number, step = 1): number[] => {
  const out: number[] = [];
  if (step <= 0) return out;
  for (let v = start; v <= end; v += step) out.push(v);
  return out;
};
