import { describe, expect, it } from "vitest";

import type { FlowNode } from "./graph";
import {
  bezierPath,
  clampZoom,
  fitView,
  inputPortPos,
  NODE_W,
  outputPortPos,
  PORT_GAP,
  PORT_TOP,
  portRows,
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

  it("puts outputs on the right edge, spaced down the same way", () => {
    expect(outputPortPos(node)).toEqual({ x: 100 + NODE_W, y: 200 + PORT_TOP });
    expect(outputPortPos(node, 1)).toEqual({
      x: 100 + NODE_W,
      y: 200 + PORT_TOP + PORT_GAP,
    });
  });

  it("lines an output up with the input on the same row", () => {
    expect(outputPortPos(node, 1).y).toBe(inputPortPos(node, 1).y);
  });

  it("reserves a row for every port on the busier side", () => {
    expect(portRows(2, 1)).toBe(2); // a Model: in, context -> out
    expect(portRows(1, 2)).toBe(2); // a Branch: in -> true, false
    expect(portRows(0, 1)).toBe(1); // an Input: nothing -> out
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

describe("fitView", () => {
  const viewport = { width: 1200, height: 800 };
  const spread: FlowNode[] = [
    { id: "a", kind: "input", x: 0, y: 0, config: {} },
    { id: "b", kind: "output", x: 2000, y: 900, config: {} },
  ];

  it("zooms out far enough to hold a wide flow", () => {
    const { zoom } = fitView(spread, viewport);
    expect(zoom).toBeLessThan(1);
    // Every node lands inside the viewport.
    const view = fitView(spread, viewport);
    for (const n of spread) {
      const p = toScreen({ x: n.x, y: n.y }, view.pan, view.zoom);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(viewport.width);
      expect(p.y).toBeLessThanOrEqual(viewport.height);
    }
  });

  it("centres the flow", () => {
    const view = fitView(spread, viewport);
    const left = toScreen({ x: 0, y: 0 }, view.pan, view.zoom);
    const right = toScreen({ x: 2000 + NODE_W, y: 0 }, view.pan, view.zoom);
    expect(left.x).toBeCloseTo(viewport.width - right.x, 6);
  });

  it("does not blow a small flow up past its natural size", () => {
    const one: FlowNode[] = [
      { id: "a", kind: "input", x: 0, y: 0, config: {} },
    ];
    expect(fitView(one, viewport).zoom).toBe(1);
  });

  it("falls back to the default view when there is nothing to fit", () => {
    expect(fitView([], viewport)).toEqual({
      pan: { x: 40, y: 40 },
      zoom: 0.85,
    });
    expect(fitView(spread, { width: 0, height: 0 })).toEqual({
      pan: { x: 40, y: 40 },
      zoom: 0.85,
    });
  });
});
