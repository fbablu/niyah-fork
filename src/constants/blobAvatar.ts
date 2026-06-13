export type BlobAvatarColorPreset =
  | "sunset"
  | "ocean"
  | "forest"
  | "berry"
  | "lemon"
  | "coral";

export type BlobAvatarShapePreset = "peach" | "wave" | "petal" | "unique";

export type BlobAvatarEyesPreset =
  | "classic"
  | "happy"
  | "wink"
  | "sleepy"
  | "surprised";

export interface BlobAvatarConfig {
  colorPreset: BlobAvatarColorPreset;
  shapePreset: BlobAvatarShapePreset;
  eyesPreset: BlobAvatarEyesPreset;
  /** Seed for the procedural "unique" shape, minted by the onboarding Blob
   *  Maker shuffle (`uid:nonce`). Absent → renderers fall back to the uid. */
  shapeSeed?: string;
}

export const BLOB_AVATAR_COLORS: BlobAvatarColorPreset[] = [
  "sunset",
  "ocean",
  "forest",
  "berry",
  "lemon",
  "coral",
];

/** Base preset shapes used for deterministic auto-generated avatars (never
 *  auto-assigns "unique" — that's an explicit, seeded Blob Maker choice). */
export const BASE_BLOB_AVATAR_SHAPES: BlobAvatarShapePreset[] = [
  "peach",
  "wave",
  "petal",
];

/** Full set of user-selectable shapes in the Blob Maker. "unique" renders a
 *  procedurally generated organic blob seeded per user (see generateBlobPath). */
export const BLOB_AVATAR_SHAPES: BlobAvatarShapePreset[] = [
  ...BASE_BLOB_AVATAR_SHAPES,
  "unique",
];

export const BLOB_AVATAR_EYES: BlobAvatarEyesPreset[] = [
  "classic",
  "happy",
  "wink",
  "sleepy",
  "surprised",
];

/** Human-readable labels for the Blob Maker UI */
export const BLOB_DISPLAY_LABELS: Record<string, string> = {
  // Colors
  sunset: "Peach",
  ocean: "Sky",
  forest: "Mint",
  berry: "Grape",
  lemon: "Sunny",
  coral: "Rose",
  // Shapes
  peach: "Round",
  wave: "Wavy",
  petal: "Teardrop",
  unique: "Unique",
  // Eyes
  classic: "Normal",
  happy: "Happy",
  wink: "Wink",
  sleepy: "Chill",
  surprised: "Shocked",
};

export const DEFAULT_BLOB_AVATAR: BlobAvatarConfig = {
  colorPreset: "sunset",
  shapePreset: "peach",
  eyesPreset: "classic",
};

const hashSeed = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickByHash = <T>(items: T[], hash: number, offset: number): T => {
  return items[(hash + offset) % items.length];
};

export const generateBlobAvatarPreset = (seed: string): BlobAvatarConfig => {
  if (!seed) return DEFAULT_BLOB_AVATAR;
  const hash = hashSeed(seed);

  return {
    colorPreset: pickByHash(BLOB_AVATAR_COLORS, hash, 0),
    shapePreset: pickByHash(BASE_BLOB_AVATAR_SHAPES, hash, 3),
    eyesPreset: pickByHash(BLOB_AVATAR_EYES, hash, 7),
  };
};

/** Firestore rules don't validate blobAvatar (owner-writable freeform), so
 *  normalize-on-read is the only sanitizer — cap the seed so junk writes
 *  can't bloat docs or renders. `uid:nonce` is ~45 chars. */
const MAX_SHAPE_SEED_LENGTH = 64;

export const normalizeBlobAvatarConfig = (
  config: Partial<BlobAvatarConfig> | null | undefined,
  seed: string,
): BlobAvatarConfig => {
  const preset = generateBlobAvatarPreset(seed);
  const shapeSeed =
    typeof config?.shapeSeed === "string" &&
    config.shapeSeed.length > 0 &&
    config.shapeSeed.length <= MAX_SHAPE_SEED_LENGTH
      ? config.shapeSeed
      : undefined;

  return {
    colorPreset:
      config?.colorPreset && BLOB_AVATAR_COLORS.includes(config.colorPreset)
        ? config.colorPreset
        : preset.colorPreset,
    shapePreset:
      config?.shapePreset && BLOB_AVATAR_SHAPES.includes(config.shapePreset)
        ? config.shapePreset
        : preset.shapePreset,
    eyesPreset:
      config?.eyesPreset && BLOB_AVATAR_EYES.includes(config.eyesPreset)
        ? config.eyesPreset
        : preset.eyesPreset,
    ...(shapeSeed ? { shapeSeed } : {}),
  };
};

/** Gradient + backdrop colors per palette — single source of truth for blob
 *  skins (BlobAvatar, MorphingBlob, profile pickers). */
export interface BlobPalette {
  start: string;
  end: string;
  backdrop: string;
}

export const BLOB_PALETTES: Record<BlobAvatarColorPreset, BlobPalette> = {
  sunset: { start: "#F0A090", end: "#E07A5F", backdrop: "#725A50" },
  ocean: { start: "#64BFEE", end: "#329DD8", backdrop: "#2F5D78" },
  forest: { start: "#5CB88A", end: "#40916C", backdrop: "#2E5C49" },
  berry: { start: "#D38ECF", end: "#A65EA1", backdrop: "#5E3B66" },
  lemon: { start: "#F5D76E", end: "#E8B830", backdrop: "#8B7D3C" },
  coral: { start: "#FF8A80", end: "#E05555", backdrop: "#7A3535" },
};

/** Outline/eye ink shared by every blob renderer. */
export const BLOB_INK = "#120505";

/** A blob control point in the generator's `size`×`size` space. */
export interface BlobPoint {
  x: number;
  y: number;
}

export interface BlobGeneratorOptions {
  points?: number;
  size?: number;
  irregularity?: number;
}

/**
 * Deterministic control points for an organic blob (blobmaker.app-style) —
 * in-house, zero deps. N points sit on a circle with seeded radius AND
 * angular jitter. Same seed → identical points, so a user's "unique" shape
 * stays stable across sessions and devices. A fixed N (default 7) also means
 * any two blobs morph cleanly point-to-point (see MorphingBlob).
 *
 * Variance (widened after the build-21 test — "unique" blobs looked samey):
 * - Each point wanders within ±45% of its angular sector (never crossing a
 *   neighbor, so point ordering — and morphing — stays clean).
 * - When no explicit `irregularity` is passed, the amount of radius jitter is
 *   itself per-seed in [0.18, 0.34]: some users get gentle blobs, others wild.
 *
 * Draw order matters for determinism: irregularity draw → per point one
 * angle draw + one radius draw. Changing it reshapes every existing blob.
 */
export const generateBlobPoints = (
  seed: string,
  options?: BlobGeneratorOptions,
): BlobPoint[] => {
  const points = Math.max(4, Math.min(12, options?.points ?? 7));
  const size = options?.size ?? 100;
  const cx = size / 2;
  const cy = size / 2;
  // 0.34 keeps even the bézier control points inside the viewBox so the blob
  // never clips at the edges (control handles extend ~size*0.1 past each point).
  const baseR = size * 0.34;

  // Seeded PRNG: FNV-1a string hash → mulberry32. Deterministic per seed.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const rand = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Per-seed irregularity (consumes one draw even when overridden, so an
  // explicit option doesn't shift the per-point draws).
  const seedIrregularity = 0.18 + rand() * 0.16; // [0.18, 0.34]
  const irregularity = options?.irregularity ?? seedIrregularity;
  const sectorJitter = (Math.PI / points) * 0.45;

  const pts: BlobPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2 + (rand() * 2 - 1) * sectorJitter;
    const r = baseR * (1 + (rand() * 2 - 1) * irregularity);
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return pts;
};

/**
 * Closed smooth SVG path through blob control points (Catmull-Rom →
 * cubic-bézier smoothing for soft, natural lobes). Marked as a worklet so
 * MorphingBlob can rebuild the path every frame on the UI thread.
 */
export const pointsToBlobPath = (pts: BlobPoint[]): string => {
  "worklet";
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(at(0).x)} ${f(at(0).y)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d} Z`;
};

/**
 * Deterministic organic-blob path generator. Same seed → identical blob.
 * Composition of generateBlobPoints + pointsToBlobPath (kept as the public
 * one-shot API; renderers that animate use the two halves directly).
 */
export const generateBlobPath = (
  seed: string,
  options?: BlobGeneratorOptions,
): string => pointsToBlobPath(generateBlobPoints(seed, options));
