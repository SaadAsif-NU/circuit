/**
 * Canvas geometry.
 *
 * Ports are anchored to fixed offsets from a node's top-left corner rather than
 * measured from the DOM, so an edge can be drawn without laying out the node
 * first, and a node can grow (streaming text into it) without its wires moving.
 * All of this is pure maths in graph coordinates; the view transform is applied
 * once, by the canvas.
 */

import type { FlowNode } from "./graph";

export const NODE_W = 264;
/**
 * Where the first port sits below a node's top edge, and how far apart they are.
 *
 * These line up with the node's chrome: a 41px header, then one 24px port row,
 * so a port dot is centred on its own row (41 + 24/2 = 53). The node reserves
 * those rows, which is what stops a wire from landing on a text field.
 *
 * A row holds an input on the left and an output on the right, so a node
 * reserves as many rows as its busier side has ports.
 */
export const PORT_TOP = 53;
export const PORT_GAP = 24;

export interface Point {
  x: number;
  y: number;
}

/** Rows a node must reserve to give every one of its ports somewhere to sit. */
export function portRows(inputs: number, outputs: number): number {
  return Math.max(inputs, outputs);
}

export function inputPortPos(node: FlowNode, index: number): Point {
  return { x: node.x, y: node.y + PORT_TOP + index * PORT_GAP };
}

export function outputPortPos(node: FlowNode, index = 0): Point {
  return { x: node.x + NODE_W, y: node.y + PORT_TOP + index * PORT_GAP };
}

/**
 * A horizontal cubic bezier between two ports. The handles reach out sideways in
 * proportion to the gap, which keeps a wire readable whether the nodes are side
 * by side or stacked.
 */
export function bezierPath(a: Point, b: Point): string {
  const dx = Math.min(Math.max(Math.abs(b.x - a.x) * 0.5, 32), 160);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

/** Screen point -> graph point, given the current pan and zoom. */
export function toGraph(screen: Point, pan: Point, zoom: number): Point {
  return { x: (screen.x - pan.x) / zoom, y: (screen.y - pan.y) / zoom };
}

/** Graph point -> screen point. */
export function toScreen(graph: Point, pan: Point, zoom: number): Point {
  return { x: graph.x * zoom + pan.x, y: graph.y * zoom + pan.y };
}

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** Zoom about a fixed screen point, so the cursor stays put. */
export function zoomAbout(
  screen: Point,
  pan: Point,
  zoom: number,
  factor: number,
): { pan: Point; zoom: number } {
  const next = clampZoom(zoom * factor);
  const graph = toGraph(screen, pan, zoom);
  return {
    zoom: next,
    pan: { x: screen.x - graph.x * next, y: screen.y - graph.y * next },
  };
}

export const DEFAULT_VIEW = { pan: { x: 40, y: 40 }, zoom: 0.85 };

/**
 * A nominal node height, used only to frame the view. Real nodes grow as text
 * streams into them, but fitting has to answer before anything has been laid
 * out, and being a little generous is the harmless direction to be wrong in.
 */
const NODE_H = 170;

/**
 * Pan and zoom so every node is on screen at once.
 *
 * Zoom is capped at 1, because scaling a two-node flow up to fill a monitor
 * looks broken rather than helpful.
 */
export function fitView(
  nodes: FlowNode[],
  viewport: { width: number; height: number },
  padding = 72,
): { pan: Point; zoom: number } {
  if (nodes.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return DEFAULT_VIEW;
  }

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const width = Math.max(...nodes.map((n) => n.x + NODE_W)) - minX;
  const height = Math.max(...nodes.map((n) => n.y + NODE_H)) - minY;

  const zoom = clampZoom(
    Math.min(
      (viewport.width - padding * 2) / width,
      (viewport.height - padding * 2) / height,
      1,
    ),
  );
  return {
    zoom,
    pan: {
      x: (viewport.width - width * zoom) / 2 - minX * zoom,
      y: (viewport.height - height * zoom) / 2 - minY * zoom,
    },
  };
}
