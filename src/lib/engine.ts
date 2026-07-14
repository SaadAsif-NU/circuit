/**
 * The execution engine.
 *
 * A flow is a DAG, so running it is: validate it, order it, then walk it. This
 * file is pure TypeScript with no DOM and no framework, which is why it can run
 * on the server and be unit tested directly.
 *
 * - **validate** rejects unknown kinds, dangling or duplicate edges, ports a
 *   node does not have, sources that produce nothing, and cycles.
 * - **topoLevels** groups nodes into waves via Kahn's algorithm: every node in a
 *   wave depends only on earlier waves, so a wave can run in parallel.
 * - **execute** runs wave by wave, gathering each node's inputs from its
 *   incoming edges, and emits an event for everything that happens so a UI can
 *   animate it live. A node that throws does not take the run down: its
 *   dependants are skipped and independent branches still finish.
 */

import { incoming, type Flow, type FlowNode } from "./graph";
import { NODE_KINDS, type Inputs } from "./nodes";
import { definitionFor } from "./registry";

export type EngineEvent =
  | { type: "run.started"; nodes: number }
  | { type: "node.started"; nodeId: string }
  | { type: "node.token"; nodeId: string; text: string }
  | { type: "node.completed"; nodeId: string; output: string; ms: number }
  | { type: "node.failed"; nodeId: string; error: string }
  | { type: "node.skipped"; nodeId: string; because: string }
  | { type: "edge.active"; edgeId: string }
  | { type: "run.completed"; ms: number; ok: boolean };

export type Emit = (event: EngineEvent) => void;

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

// ----------------------------------------------------------------------
// validation
// ----------------------------------------------------------------------

export function validate(flow: Flow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  for (const node of flow.nodes) {
    if (ids.has(node.id))
      issues.push({ nodeId: node.id, message: "Duplicate node id." });
    ids.add(node.id);
    if (!NODE_KINDS.includes(node.kind)) {
      issues.push({
        nodeId: node.id,
        message: `Unknown node kind "${node.kind}".`,
      });
    }
  }

  const seenEdge = new Set<string>();
  for (const edge of flow.edges) {
    if (!ids.has(edge.source)) {
      issues.push({
        message: `Edge ${edge.id} starts at a node that does not exist.`,
      });
      continue;
    }
    if (!ids.has(edge.target)) {
      issues.push({
        message: `Edge ${edge.id} ends at a node that does not exist.`,
      });
      continue;
    }
    const source = flow.nodes.find((n) => n.id === edge.source)!;
    const target = flow.nodes.find((n) => n.id === edge.target)!;
    if (!definitionFor(source.kind)?.hasOutput) {
      issues.push({
        nodeId: source.id,
        message: `${source.kind} has no output to connect.`,
      });
    }
    if (!definitionFor(target.kind)?.inputs.includes(edge.targetPort)) {
      issues.push({
        nodeId: target.id,
        message: `${target.kind} has no input called "${edge.targetPort}".`,
      });
    }
    // One value per port: a second edge into the same port is ambiguous.
    const key = `${edge.target}:${edge.targetPort}`;
    if (seenEdge.has(key)) {
      issues.push({
        nodeId: edge.target,
        message: `Two edges feed "${edge.targetPort}".`,
      });
    }
    seenEdge.add(key);
  }

  if (findCycle(flow)) {
    issues.push({ message: "This flow has a cycle, so it cannot run." });
  }
  return issues;
}

/** Depth-first search for a back edge. Returns the cycle's node ids, or null. */
export function findCycle(flow: Flow): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const node of flow.nodes) adjacency.set(node.id, []);
  for (const edge of flow.edges) adjacency.get(edge.source)?.push(edge.target);

  const state = new Map<string, 0 | 1 | 2>(); // unseen | on stack | done
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    state.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const s = state.get(next) ?? 0;
      if (s === 1) return [...stack.slice(stack.indexOf(next)), next];
      if (s === 0) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  }

  for (const node of flow.nodes) {
    if ((state.get(node.id) ?? 0) === 0) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// ordering
// ----------------------------------------------------------------------

/**
 * Kahn's algorithm, kept in waves. Each returned group depends only on the
 * groups before it, so its nodes are safe to run at the same time.
 */
export function topoLevels(flow: Flow): FlowNode[][] {
  const indegree = new Map<string, number>();
  for (const node of flow.nodes) indegree.set(node.id, 0);
  for (const edge of flow.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const levels: FlowNode[][] = [];
  let frontier = flow.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0);
  const done = new Set<string>();

  while (frontier.length > 0) {
    levels.push(frontier);
    const next: FlowNode[] = [];
    for (const node of frontier) {
      done.add(node.id);
      for (const edge of flow.edges.filter((e) => e.source === node.id)) {
        const left = (indegree.get(edge.target) ?? 0) - 1;
        indegree.set(edge.target, left);
        if (left === 0) {
          const target = flow.nodes.find((n) => n.id === edge.target);
          if (target) next.push(target);
        }
      }
    }
    frontier = next;
  }

  // Anything left is inside a cycle; validate() reports that separately.
  return levels;
}

// ----------------------------------------------------------------------
// execution
// ----------------------------------------------------------------------

export interface RunResult {
  outputs: Record<string, string>;
  failed: string[];
  skipped: string[];
  ok: boolean;
}

export async function execute(
  flow: Flow,
  emit: Emit,
  signal?: AbortSignal,
): Promise<RunResult> {
  const started = Date.now();
  emit({ type: "run.started", nodes: flow.nodes.length });

  const outputs: Record<string, string> = {};
  const failed = new Set<string>();
  const skipped = new Set<string>();

  for (const level of topoLevels(flow)) {
    // Every node in a level is independent, so run the whole wave at once.
    await Promise.all(
      level.map(async (node) => {
        const feeds = incoming(flow, node.id);
        const broken = feeds.find(
          (e) => failed.has(e.source) || skipped.has(e.source),
        );
        if (broken) {
          skipped.add(node.id);
          emit({
            type: "node.skipped",
            nodeId: node.id,
            because: broken.source,
          });
          return;
        }

        const inputs: Inputs = {};
        for (const edge of feeds) {
          inputs[edge.targetPort] = outputs[edge.source] ?? "";
          emit({ type: "edge.active", edgeId: edge.id });
        }

        emit({ type: "node.started", nodeId: node.id });
        const at = Date.now();
        try {
          const definition = definitionFor(node.kind);
          if (!definition) throw new Error(`Unknown node kind "${node.kind}".`);
          const output = await definition.run(node.config ?? {}, inputs, {
            onToken: (text) =>
              emit({ type: "node.token", nodeId: node.id, text }),
            signal,
          });
          outputs[node.id] = output;
          emit({
            type: "node.completed",
            nodeId: node.id,
            output,
            ms: Date.now() - at,
          });
        } catch (error) {
          failed.add(node.id);
          emit({
            type: "node.failed",
            nodeId: node.id,
            error: error instanceof Error ? error.message : "Node failed.",
          });
        }
      }),
    );
  }

  const ok = failed.size === 0;
  emit({ type: "run.completed", ms: Date.now() - started, ok });
  return { outputs, failed: [...failed], skipped: [...skipped], ok };
}
