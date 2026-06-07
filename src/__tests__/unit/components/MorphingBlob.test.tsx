import React from "react";
import { render } from "@testing-library/react-native";
import { MorphingBlob } from "../../../components/MorphingBlob";
import {
  BLOB_PALETTES,
  generateBlobPath,
  generateBlobPoints,
} from "../../../constants/blobAvatar";

// The reanimated mock makes useAnimatedProps a no-op, so these tests pin the
// static first-paint contract (initial `d`), not the morph itself.

type Node = {
  type: string;
  props: Record<string, unknown>;
  children?: Node[] | null;
};

const collect = (node: Node | Node[] | null, type: string): Node[] => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap((n) => collect(n, type));
  const self = node.type === type ? [node] : [];
  return [...self, ...collect(node.children ?? null, type)];
};

describe("MorphingBlob", () => {
  it("first-paints the exact path BlobAvatar would draw for the same points", () => {
    const points = generateBlobPoints("user-1");
    const tree = render(
      <MorphingBlob points={points} palette={BLOB_PALETTES.ocean} />,
    ).toJSON() as Node;

    const paths = collect(tree, "Path");
    // Outgoing + incoming skin layers share the identical initial path —
    // and it must match the static renderer or the avatar jumps on settle.
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.props.d).toBe(generateBlobPath("user-1"));
    }
  });

  it("keeps the dark outline on the incoming (top) layer", () => {
    const tree = render(
      <MorphingBlob
        points={generateBlobPoints("user-1")}
        palette={BLOB_PALETTES.sunset}
      />,
    ).toJSON() as Node;

    const [outgoing, incoming] = collect(tree, "Path");
    expect(outgoing.props.stroke).toBeUndefined();
    expect(incoming.props.stroke).toBe("#120505");
  });

  it("renders both gradient skins with the palette colors", () => {
    const tree = render(
      <MorphingBlob
        points={generateBlobPoints("user-1")}
        palette={BLOB_PALETTES.forest}
      />,
    ).toJSON() as Node;

    const stopColors = collect(tree, "Stop").map((s) => s.props.stopColor);
    expect(stopColors).toContain(BLOB_PALETTES.forest.start);
    expect(stopColors).toContain(BLOB_PALETTES.forest.end);
  });
});
