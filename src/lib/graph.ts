/**
 * The graph model.
 *
 * A flow is a directed graph: nodes carry a type and their own config, edges
 * connect one node's output port to another node's input port. Everything the
 * engine needs is here and nothing about rendering is, so the same graph runs on
 * the server and draws in the browser.
 */

import { z } from "zod";

export type NodeKind =
  "input" | "llm" | "search" | "transform" | "branch" | "join" | "output";

export interface FlowNode {
  id: string;
  kind: NodeKind;
  /** Canvas position, in graph coordinates. */
  x: number;
  y: number;
  /** Node-specific config: the seed text, a prompt template, a title. */
  config: Record<string, string>;
}

export interface FlowEdge {
  id: string;
  source: string;
  /** The output port on the source node this edge carries away. */
  sourcePort: string;
  target: string;
  /** The input port on the target node this edge feeds. */
  targetPort: string;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "input",
    "llm",
    "search",
    "transform",
    "branch",
    "join",
    "output",
  ]),
  x: z.number(),
  y: z.number(),
  config: z.record(z.string(), z.string()).default({}),
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  // Flows saved before nodes could have more than one output have no
  // sourcePort, so they read back as edges from the single default port.
  sourcePort: z.string().min(1).default("out"),
  target: z.string().min(1),
  targetPort: z.string().min(1),
});

export const flowSchema = z.object({
  nodes: z.array(flowNodeSchema).max(60),
  edges: z.array(flowEdgeSchema).max(120),
});

export function parseFlow(raw: unknown): Flow | null {
  const result = flowSchema.safeParse(raw);
  return result.success ? (result.data as Flow) : null;
}

// ----------------------------------------------------------------------
// small graph helpers, shared by the engine and the canvas
// ----------------------------------------------------------------------

/** Edges arriving at a node. */
export function incoming(flow: Flow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((e) => e.target === nodeId);
}

/** Edges leaving a node. */
export function outgoing(flow: Flow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((e) => e.source === nodeId);
}

export function nodeById(flow: Flow, id: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}
