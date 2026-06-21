// Pure helpers for the Dial (./Dial.tsx, a native ScrollView picker) and its
// odometer readout (./RollingNumber.tsx). Kept side-effect-free and unit-tested
// so the snap/clamp/ring logic is verified without rendering. Functions used on
// the UI thread (reanimated scroll worklet) carry the "worklet" directive; they
// stay ordinary callable functions on the JS thread, so Jest exercises the real
// code.

/**
 * Clamp a (possibly fractional) index to `[0, upper]`, where `upper` is the last
 * index — or `maxEnabledIndex` when a cap (disabledAbove) is active.
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

/**
 * Detent index for a horizontal scroll offset: round to the nearest cell and
 * clamp (honoring the cap). The native ScrollView owns the physics/snap; this
 * just maps the live offset to the selected detent for the readout + haptics.
 */
export const indexForOffset = (
  offsetX: number,
  spacing: number,
  count: number,
  maxEnabledIndex?: number,
): number => {
  "worklet";
  if (spacing <= 0) return 0;
  return clampPosition(Math.round(offsetX / spacing), count, maxEnabledIndex);
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

/**
 * Shortest signed step on a 0–9 ring from `from` to `to` (range -5..5). A 9→0
 * change returns +1 (forward wrap) and 0→9 returns -1, so an odometer digit
 * ticks one place across a carry instead of rolling all the way back.
 */
export const ringDelta = (from: number, to: number): number => {
  let d = to - from;
  if (d > 5) d -= 10;
  else if (d < -5) d += 10;
  return d;
};

/**
 * For a padded 0–9 ring strip (a duplicate of each digit 10 cells apart), pick
 * the cell index showing `digit` that is NEAREST to `current` — so a rolling
 * column always takes the shortest path from wherever it is, even mid-flight.
 * `pad` is the strip's leading-pad offset (rest index of digit d is d + pad).
 */
export const nearestRingIndex = (
  digit: number,
  current: number,
  pad: number,
): number => {
  const core = digit + pad;
  const wrap = digit >= 5 ? core - 10 : core + 10;
  return Math.abs(core - current) <= Math.abs(wrap - current) ? core : wrap;
};

/** Inclusive integer range `[start, end]` in `step` increments. */
export const rangeValues = (start: number, end: number, step = 1): number[] => {
  const out: number[] = [];
  if (step <= 0) return out;
  for (let v = start; v <= end; v += step) out.push(v);
  return out;
};
