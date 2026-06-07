import {
  generateBlobPath,
  generateBlobPoints,
  pointsToBlobPath,
  generateBlobAvatarPreset,
  normalizeBlobAvatarConfig,
  BLOB_AVATAR_SHAPES,
  BASE_BLOB_AVATAR_SHAPES,
} from "../../../constants/blobAvatar";

describe("generateBlobPath", () => {
  it("is deterministic for a given seed (stable blob across sessions)", () => {
    expect(generateBlobPath("user-123")).toBe(generateBlobPath("user-123"));
  });

  it("produces different paths for different seeds", () => {
    expect(generateBlobPath("alice")).not.toBe(generateBlobPath("bob"));
  });

  it("returns a closed, smooth SVG path (M … C … Z) with no NaN", () => {
    const d = generateBlobPath("seed");
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect(d).toContain(" C ");
    expect(d).not.toContain("NaN");
  });

  it("keeps every coordinate sanely within the viewBox (no blowups)", () => {
    const size = 100;
    const nums = generateBlobPath("bounds", { size })
      .match(/-?\d+\.?\d*/g)!
      .map(Number);
    expect(nums.length).toBeGreaterThan(0);
    for (const v of nums) {
      expect(Number.isFinite(v)).toBe(true);
      // Generous bound — points sit at ~size*0.34 from center, control handles
      // extend a little past; this only catches gross blowups / bad math.
      expect(v).toBeGreaterThan(-20);
      expect(v).toBeLessThan(size + 20);
    }
  });

  it("respects the point-count clamp [4, 12]", () => {
    // 3 control points would not make a smooth closed loop; generator clamps up.
    const few = generateBlobPath("x", { points: 1 });
    const many = generateBlobPath("x", { points: 50 });
    expect((few.match(/ C /g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((many.match(/ C /g) ?? []).length).toBeLessThanOrEqual(12);
  });
});

describe("generateBlobPoints / pointsToBlobPath", () => {
  it("composes to exactly generateBlobPath (morph and static renderers must agree)", () => {
    // MorphingBlob draws pointsToBlobPath(generateBlobPoints(seed)) while
    // BlobAvatar draws generateBlobPath(seed) — a drift between the two would
    // make the avatar "jump" when the morph settles vs. the static render.
    for (const seed of ["user-123", "uid:a1b2c3", "guest"]) {
      expect(pointsToBlobPath(generateBlobPoints(seed))).toBe(
        generateBlobPath(seed),
      );
    }
  });

  it("is deterministic and seed-sensitive", () => {
    expect(generateBlobPoints("alice")).toEqual(generateBlobPoints("alice"));
    expect(generateBlobPoints("alice")).not.toEqual(generateBlobPoints("bob"));
  });

  it("always emits the same point count for any seed (1:1 morph contract)", () => {
    // Point-to-point morphing requires every generated blob to share a count.
    const n = generateBlobPoints("a").length;
    for (let i = 0; i < 50; i += 1) {
      expect(generateBlobPoints(`seed-${i}`).length).toBe(n);
    }
  });

  it("clamps the point count to [4, 12]", () => {
    expect(generateBlobPoints("x", { points: 1 }).length).toBe(4);
    expect(generateBlobPoints("x", { points: 50 }).length).toBe(12);
  });

  it("keeps angular ordering monotonic (sector jitter never crosses neighbors)", () => {
    // Point-to-point morphing assumes points stay in sector order around the
    // center. Jitter is bounded to ±45% of a sector, so consecutive angles
    // must strictly increase (mod 2π) for every seed.
    for (let s = 0; s < 50; s += 1) {
      const pts = generateBlobPoints(`order-${s}`);
      const angles = pts.map((p) => Math.atan2(p.y - 50, p.x - 50));
      // Unwrap relative to the first point so the sequence is comparable.
      const unwrapped = angles.map((a) => {
        let d = a - angles[0];
        while (d < 0) d += Math.PI * 2;
        return d;
      });
      for (let i = 1; i < unwrapped.length; i += 1) {
        expect(unwrapped[i]).toBeGreaterThan(unwrapped[i - 1]);
      }
    }
  });

  it("varies shape noticeably across seeds (radius spread isn't flat)", () => {
    // The build-21 finding was that "unique" blobs looked samey. Pin that
    // per-seed irregularity actually produces different radius spreads.
    const spreadOf = (seed: string): number => {
      const radii = generateBlobPoints(seed).map((p) =>
        Math.hypot(p.x - 50, p.y - 50),
      );
      return Math.max(...radii) - Math.min(...radii);
    };
    const spreads = Array.from({ length: 30 }, (_, i) =>
      spreadOf(`spread-${i}`),
    );
    expect(Math.max(...spreads) - Math.min(...spreads)).toBeGreaterThan(4);
  });
});

describe("normalizeBlobAvatarConfig shapeSeed", () => {
  it("preserves a valid rolled shapeSeed", () => {
    const cfg = normalizeBlobAvatarConfig(
      { shapePreset: "unique", shapeSeed: "uid123:deadbeef" },
      "uid123",
    );
    expect(cfg.shapeSeed).toBe("uid123:deadbeef");
  });

  it("drops junk shapeSeed values (rules don't validate blobAvatar server-side)", () => {
    const junkValues = [
      "",
      "x".repeat(65),
      42 as unknown as string,
      { evil: true } as unknown as string,
    ];
    for (const shapeSeed of junkValues) {
      const cfg = normalizeBlobAvatarConfig({ shapeSeed }, "uid123");
      expect(cfg.shapeSeed).toBeUndefined();
    }
  });

  it("leaves shapeSeed absent when not set (existing users keep uid-derived blobs)", () => {
    const cfg = normalizeBlobAvatarConfig({ shapePreset: "unique" }, "uid123");
    expect("shapeSeed" in cfg).toBe(false);
  });
});

describe("blob shape presets", () => {
  it("never auto-assigns the procedural 'unique' shape", () => {
    // Auto-generated avatars must be deterministic without a seed, so the hash
    // picker only chooses base presets.
    expect(BASE_BLOB_AVATAR_SHAPES).not.toContain("unique");
    for (let i = 0; i < 200; i += 1) {
      expect(generateBlobAvatarPreset(`seed-${i}`).shapePreset).not.toBe(
        "unique",
      );
    }
  });

  it("accepts an explicit 'unique' choice through normalize", () => {
    const cfg = normalizeBlobAvatarConfig({ shapePreset: "unique" }, "seed");
    expect(cfg.shapePreset).toBe("unique");
    expect(BLOB_AVATAR_SHAPES).toContain("unique");
  });
});
