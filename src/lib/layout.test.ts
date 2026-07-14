import { describe, expect, it } from "vitest";

import type { FlowNode } from "./graph";
import {
  bezierPath,
  clampZoom,
  inputPortPos,
  NODE_W,
  outputPortPos,
  PORT_TOP,
  toGraph,
  toScreen,
  zoomAbout,
} from "./layout";

const node: FlowNode = { id: "n", kind: "llm", x: 100, y: 200, config: {} };

describe("ports", () => {
  it("puts inputs on the left edge, spaced down", () => {
    expect(inputPortPos(node, 0)).toEqual({ x: 100, y: 200 + PORT_TOP });
    expect(inputPortPos(node, 1).y).toBeGreaterThan(inputPortPos(node, 0).y);
    expect(inputPortPos(node, 1).x).toBe(100);
  });

  it("puts the output on the right edge", () => {
    expect(outputPortPos(node)).toEqual({ x: 100 + NODE_W, y: 200 + PORT_TOP });
  });
});

describe("bezierPath", () => {
  it("starts at a and ends at b", () => {
    const d = bezierPath({ x: 0, y: 0 }, { x: 200, y: 50 });
    expect(d.startsWith("M 0 0 C")).toBe(true);
    expect(d.endsWith("200 50")).toBe(true);
  });

  it("keeps a usable handle even when nodes touch", () => {
    const d = bezierPath({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toContain("C 32 0"); // clamped to the minimum reach
  });

  it("does not let the handle run away on long wires", () => {
    const d = bezierPath({ x: 0, y: 0 }, { x: 5000, y: 0 });
    expect(d).toContain("C 160 0"); // clamped to the maximum reach
  });
});

describe("view transform", () => {
  const pan = { x: 30, y: -10 };
  const zoom = 1.5;

  it("round-trips a point", () => {
    const graph = { x: 12, y: 34 };
    const back = toGraph(toScreen(graph, pan, zoom), pan, zoom);
    expect(back.x).toBeCloseTo(graph.x, 6);
    expect(back.y).toBeCloseTo(graph.y, 6);
  });

  it("clamps zoom to sane bounds", () => {
    expect(clampZoom(99)).toBeLessThanOrEqual(2);
    expect(clampZoom(0.001)).toBeGreaterThanOrEqual(0.3);
  });
});

describe("zoomAbout", () => {
  it("keeps the point under the cursor fixed", () => {
    const screen = { x: 400, y: 300 };
    const pan = { x: 0, y: 0 };
    const before = toGraph(screen, pan, 1);
    const next = zoomAbout(screen, pan, 1, 1.25);
    const after = toGraph(screen, next.pan, next.zoom);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("respects the zoom limits", () => {
    const r = zoomAbout({ x: 0, y: 0 }, { x: 0, y: 0 }, 2, 10);
    expect(r.zoom).toBe(2);
  });
});
