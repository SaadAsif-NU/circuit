import { describe, expect, it } from "vitest";

import {
  execute,
  findCycle,
  topoLevels,
  validate,
  type EngineEvent,
} from "./engine";
import type { Flow } from "./graph";

/** A flow with a fan-out and a fan-in: in -> (a, b) -> join -> out. */
function diamond(): Flow {
  return {
    nodes: [
      { id: "in", kind: "input", x: 0, y: 0, config: { text: "seed" } },
      { id: "a", kind: "join", x: 1, y: 0, config: { template: "A:{{a}}" } },
      { id: "b", kind: "join", x: 1, y: 1, config: { template: "B:{{a}}" } },
      {
        id: "j",
        kind: "join",
        x: 2,
        y: 0,
        config: { template: "{{a}}+{{b}}" },
      },
      { id: "out", kind: "output", x: 3, y: 0, config: {} },
    ],
    edges: [
      { id: "e1", source: "in", target: "a", targetPort: "a" },
      { id: "e2", source: "in", target: "b", targetPort: "a" },
      { id: "e3", source: "a", target: "j", targetPort: "a" },
      { id: "e4", source: "b", target: "j", targetPort: "b" },
      { id: "e5", source: "j", target: "out", targetPort: "in" },
    ],
  };
}

function collect(): { emit: (e: EngineEvent) => void; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  return { emit: (e) => events.push(e), events };
}

describe("validate", () => {
  it("accepts a well-formed flow", () => {
    expect(validate(diamond())).toEqual([]);
  });

  it("rejects an edge to a port the node does not have", () => {
    const flow = diamond();
    flow.edges[0].targetPort = "nope";
    expect(validate(flow).some((i) => /no input called/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects an edge from a node with no output", () => {
    const flow = diamond();
    flow.edges.push({ id: "x", source: "out", target: "a", targetPort: "b" });
    expect(validate(flow).some((i) => /no output/.test(i.message))).toBe(true);
  });

  it("rejects a dangling edge", () => {
    const flow = diamond();
    flow.edges.push({ id: "x", source: "ghost", target: "a", targetPort: "b" });
    expect(validate(flow).some((i) => /does not exist/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects two edges feeding the same port", () => {
    const flow = diamond();
    flow.edges.push({ id: "x", source: "b", target: "j", targetPort: "a" });
    expect(validate(flow).some((i) => /Two edges feed/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects duplicate node ids", () => {
    const flow = diamond();
    flow.nodes.push({ id: "in", kind: "output", x: 9, y: 9, config: {} });
    expect(
      validate(flow).some((i) => /Duplicate node id/.test(i.message)),
    ).toBe(true);
  });

  it("rejects a cycle", () => {
    const flow = diamond();
    flow.edges.push({ id: "back", source: "j", target: "a", targetPort: "b" });
    expect(validate(flow).some((i) => /cycle/.test(i.message))).toBe(true);
  });
});

describe("findCycle", () => {
  it("returns null for a DAG", () => {
    expect(findCycle(diamond())).toBeNull();
  });

  it("finds a self loop", () => {
    const flow = diamond();
    flow.edges.push({ id: "self", source: "a", target: "a", targetPort: "b" });
    expect(findCycle(flow)).toContain("a");
  });

  it("finds a longer cycle", () => {
    const flow = diamond();
    flow.edges.push({ id: "back", source: "j", target: "a", targetPort: "b" });
    const cycle = findCycle(flow);
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(expect.arrayContaining(["a", "j"]));
  });
});

describe("topoLevels", () => {
  it("groups independent nodes into one wave", () => {
    const levels = topoLevels(diamond()).map((l) => l.map((n) => n.id).sort());
    expect(levels).toEqual([["in"], ["a", "b"], ["j"], ["out"]]);
  });

  it("never places a node before its dependency", () => {
    const levels = topoLevels(diamond());
    const indexOf = (id: string) =>
      levels.findIndex((l) => l.some((n) => n.id === id));
    expect(indexOf("in")).toBeLessThan(indexOf("a"));
    expect(indexOf("a")).toBeLessThan(indexOf("j"));
    expect(indexOf("j")).toBeLessThan(indexOf("out"));
  });

  it("omits nodes trapped in a cycle", () => {
    const flow = diamond();
    flow.edges.push({ id: "back", source: "j", target: "a", targetPort: "b" });
    const ids = topoLevels(flow)
      .flat()
      .map((n) => n.id);
    expect(ids).not.toContain("j");
  });
});

describe("execute", () => {
  it("threads values along the edges and fans in", async () => {
    const { emit, events } = collect();
    const result = await execute(diamond(), emit);
    expect(result.ok).toBe(true);
    // in -> a ("A:seed") and b ("B:seed"), joined as "A:seed+B:seed"
    expect(result.outputs.j).toBe("A:seed+B:seed");
    expect(result.outputs.out).toBe("A:seed+B:seed");
    expect(events.at(-1)).toMatchObject({ type: "run.completed", ok: true });
  });

  it("emits a lifecycle for every node", async () => {
    const { emit, events } = collect();
    await execute(diamond(), emit);
    const started = events.filter((e) => e.type === "node.started").length;
    const completed = events.filter((e) => e.type === "node.completed").length;
    expect(started).toBe(5);
    expect(completed).toBe(5);
    expect(events[0]).toMatchObject({ type: "run.started", nodes: 5 });
  });

  it("marks the edges that carried data", async () => {
    const { emit, events } = collect();
    await execute(diamond(), emit);
    const active = events
      .filter((e) => e.type === "edge.active")
      .map((e) => (e as { edgeId: string }).edgeId);
    expect(new Set(active)).toEqual(new Set(["e1", "e2", "e3", "e4", "e5"]));
  });

  it("isolates a failure: dependants skip, independents still run", async () => {
    const flow: Flow = {
      nodes: [
        { id: "in", kind: "input", x: 0, y: 0, config: { text: "seed" } },
        // An llm node with no key streams a simulated reply, so force a failure
        // by pointing a join at a port that yields nothing and asserting skip
        // propagation from a genuinely failing node instead.
        { id: "boom", kind: "boom" as never, x: 1, y: 0, config: {} },
        { id: "after", kind: "output", x: 2, y: 0, config: {} },
        { id: "safe", kind: "output", x: 1, y: 2, config: {} },
      ],
      edges: [
        { id: "e1", source: "in", target: "boom", targetPort: "in" },
        { id: "e2", source: "boom", target: "after", targetPort: "in" },
        { id: "e3", source: "in", target: "safe", targetPort: "in" },
      ],
    };
    const { emit, events } = collect();
    const result = await execute(flow, emit);
    expect(result.ok).toBe(false);
    expect(result.failed).toContain("boom");
    expect(result.skipped).toContain("after");
    // The independent branch is untouched.
    expect(result.outputs.safe).toBe("seed");
    expect(events.some((e) => e.type === "node.skipped")).toBe(true);
  });

  it("runs an empty flow without complaining", async () => {
    const { emit } = collect();
    const result = await execute({ nodes: [], edges: [] }, emit);
    expect(result.ok).toBe(true);
    expect(result.outputs).toEqual({});
  });
});
