import { describe, expect, it } from "vitest";

import type { Flow } from "./graph";
import { PRESETS } from "./presets";
import { deserialize, serialize } from "./storage";

const flow: Flow = {
  nodes: [{ id: "in", kind: "input", x: 1, y: 2, config: { text: "hi" } }],
  edges: [],
};

describe("serialize / deserialize", () => {
  it("round trips a flow", () => {
    expect(deserialize(serialize(flow))).toEqual(flow);
  });

  it("round trips every preset", () => {
    for (const preset of PRESETS) {
      const built = preset.build();
      expect(deserialize(serialize(built))).toEqual(built);
    }
  });

  it("accepts a bare flow, not just a wrapped file", () => {
    expect(deserialize(JSON.stringify(flow))).toEqual(flow);
  });

  it("reads an edge saved before nodes had named output ports", () => {
    const old = {
      nodes: [
        { id: "a", kind: "input", x: 0, y: 0, config: {} },
        { id: "b", kind: "output", x: 1, y: 0, config: {} },
      ],
      edges: [{ id: "e", source: "a", target: "b", targetPort: "in" }],
    };
    // It reads back as an edge from the single default port, so an old saved
    // flow keeps working rather than failing to parse.
    expect(deserialize(JSON.stringify(old))?.edges[0].sourcePort).toBe("out");
  });

  it("rejects text that is not JSON", () => {
    expect(deserialize("<html>nope</html>")).toBeNull();
  });

  it("rejects JSON that is not a flow", () => {
    expect(deserialize('{"hello": "world"}')).toBeNull();
  });

  it("rejects a node with an unknown kind", () => {
    expect(
      deserialize(
        JSON.stringify({
          nodes: [{ id: "a", kind: "mystery", x: 0, y: 0, config: {} }],
          edges: [],
        }),
      ),
    ).toBeNull();
  });

  it("rejects a flow far too big to have come from the canvas", () => {
    const huge = {
      nodes: Array.from({ length: 61 }, (_, i) => ({
        id: `n${i}`,
        kind: "input",
        x: 0,
        y: 0,
        config: {},
      })),
      edges: [],
    };
    expect(deserialize(JSON.stringify(huge))).toBeNull();
  });
});
