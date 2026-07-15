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
      {
        id: "e1",
        source: "in",
        sourcePort: "out",
        target: "a",
        targetPort: "a",
      },
      {
        id: "e2",
        source: "in",
        sourcePort: "out",
        target: "b",
        targetPort: "a",
      },
      {
        id: "e3",
        source: "a",
        sourcePort: "out",
        target: "j",
        targetPort: "a",
      },
      {
        id: "e4",
        source: "b",
        sourcePort: "out",
        target: "j",
        targetPort: "b",
      },
      {
        id: "e5",
        source: "j",
        sourcePort: "out",
        target: "out",
        targetPort: "in",
      },
    ],
  };
}

/**
 * in -> branch -> (yes | no). The branch's condition decides which of the two
 * sinks runs and which is skipped.
 */
function router(text: string, value: string): Flow {
  return {
    nodes: [
      { id: "in", kind: "input", x: 0, y: 0, config: { text } },
      {
        id: "br",
        kind: "branch",
        x: 1,
        y: 0,
        config: { mode: "contains", value },
      },
      { id: "yes", kind: "join", x: 2, y: 0, config: { template: "Y:{{a}}" } },
      { id: "no", kind: "join", x: 2, y: 1, config: { template: "N:{{a}}" } },
    ],
    edges: [
      {
        id: "e1",
        source: "in",
        sourcePort: "out",
        target: "br",
        targetPort: "in",
      },
      {
        id: "e2",
        source: "br",
        sourcePort: "true",
        target: "yes",
        targetPort: "a",
      },
      {
        id: "e3",
        source: "br",
        sourcePort: "false",
        target: "no",
        targetPort: "a",
      },
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

  it("accepts a branch wired from both of its ports", () => {
    expect(validate(router("hi", "hi"))).toEqual([]);
  });

  it("rejects an edge to a port the node does not have", () => {
    const flow = diamond();
    flow.edges[0].targetPort = "nope";
    expect(validate(flow).some((i) => /no input called/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects an edge from an output port the node does not have", () => {
    const flow = router("hi", "hi");
    flow.edges[1].sourcePort = "maybe";
    expect(validate(flow).some((i) => /no output called/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects an edge from a node with no output", () => {
    const flow = diamond();
    flow.edges.push({
      id: "x",
      source: "out",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
    expect(
      validate(flow).some((i) => /no output to connect/.test(i.message)),
    ).toBe(true);
  });

  it("rejects a dangling edge", () => {
    const flow = diamond();
    flow.edges.push({
      id: "x",
      source: "ghost",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
    expect(validate(flow).some((i) => /does not exist/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects two edges feeding the same port", () => {
    const flow = diamond();
    flow.edges.push({
      id: "x",
      source: "b",
      sourcePort: "out",
      target: "j",
      targetPort: "a",
    });
    expect(validate(flow).some((i) => /Two edges feed/.test(i.message))).toBe(
      true,
    );
  });

  it("allows one output port to feed several nodes", () => {
    expect(validate(diamond())).toEqual([]); // "in" already fans out to a and b
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
    flow.edges.push({
      id: "back",
      source: "j",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
    expect(validate(flow).some((i) => /cycle/.test(i.message))).toBe(true);
  });

  it("points an issue at the node that caused it", () => {
    const flow = diamond();
    flow.edges[0].targetPort = "nope";
    expect(validate(flow)[0]).toMatchObject({ nodeId: "a" });
  });

  it("blames every node in a cycle, so the loop can be marked", () => {
    const flow = diamond();
    flow.edges.push({
      id: "back",
      source: "j",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
    const blamed = validate(flow)
      .filter((i) => /cycle/.test(i.message))
      .map((i) => i.nodeId);
    expect(new Set(blamed)).toEqual(new Set(["a", "j"]));
  });
});

describe("findCycle", () => {
  it("returns null for a DAG", () => {
    expect(findCycle(diamond())).toBeNull();
  });

  it("finds a self loop", () => {
    const flow = diamond();
    flow.edges.push({
      id: "self",
      source: "a",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
    expect(findCycle(flow)).toContain("a");
  });

  it("finds a longer cycle", () => {
    const flow = diamond();
    flow.edges.push({
      id: "back",
      source: "j",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
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
    flow.edges.push({
      id: "back",
      source: "j",
      sourcePort: "out",
      target: "a",
      targetPort: "b",
    });
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
    expect(result.outputs.j).toEqual({ out: "A:seed+B:seed" });
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
        // with a node kind that has no definition at all.
        { id: "boom", kind: "boom" as never, x: 1, y: 0, config: {} },
        { id: "after", kind: "output", x: 2, y: 0, config: {} },
        { id: "safe", kind: "join", x: 1, y: 2, config: { template: "{{a}}" } },
      ],
      edges: [
        {
          id: "e1",
          source: "in",
          sourcePort: "out",
          target: "boom",
          targetPort: "in",
        },
        {
          id: "e2",
          source: "boom",
          sourcePort: "out",
          target: "after",
          targetPort: "in",
        },
        {
          id: "e3",
          source: "in",
          sourcePort: "out",
          target: "safe",
          targetPort: "a",
        },
      ],
    };
    const { emit, events } = collect();
    const result = await execute(flow, emit);
    expect(result.ok).toBe(false);
    expect(result.failed).toContain("boom");
    expect(result.skipped).toContain("after");
    // The independent branch is untouched.
    expect(result.outputs.safe).toEqual({ out: "seed" });
    expect(events.some((e) => e.type === "node.skipped")).toBe(true);
  });

  it("runs an empty flow without complaining", async () => {
    const { emit } = collect();
    const result = await execute({ nodes: [], edges: [] }, emit);
    expect(result.ok).toBe(true);
    expect(result.outputs).toEqual({});
  });

  describe("conditional routing", () => {
    it("takes the true path and skips the false one", async () => {
      const { emit, events } = collect();
      const result = await execute(router("I want a refund", "refund"), emit);
      expect(result.ok).toBe(true);
      expect(result.outputs.br).toEqual({ true: "I want a refund" });
      expect(result.outputs.yes).toEqual({ out: "Y:I want a refund" });
      expect(result.skipped).toEqual(["no"]);
      expect(result.outputs.no).toBeUndefined();
      expect(events).toContainEqual({
        type: "node.skipped",
        nodeId: "no",
        because: "br",
      });
    });

    it("takes the false path when the condition does not hold", async () => {
      const { emit } = collect();
      const result = await execute(router("where is my order", "refund"), emit);
      expect(result.outputs.no).toEqual({ out: "N:where is my order" });
      expect(result.skipped).toEqual(["yes"]);
    });

    it("does not light up the wire it did not take", async () => {
      const { emit, events } = collect();
      await execute(router("I want a refund", "refund"), emit);
      const active = events
        .filter((e) => e.type === "edge.active")
        .map((e) => (e as { edgeId: string }).edgeId);
      expect(active).toContain("e2"); // the true wire
      expect(active).not.toContain("e3"); // the false wire
    });

    it("skips a whole chain downstream of the path not taken", async () => {
      const flow = router("I want a refund", "refund");
      flow.nodes.push({
        id: "tail",
        kind: "output",
        x: 3,
        y: 1,
        config: {},
      });
      flow.edges.push({
        id: "e4",
        source: "no",
        sourcePort: "out",
        target: "tail",
        targetPort: "in",
      });
      const { emit } = collect();
      const result = await execute(flow, emit);
      expect(result.ok).toBe(true);
      expect(new Set(result.skipped)).toEqual(new Set(["no", "tail"]));
    });

    it("fails the branch, not the run, when its condition is nonsense", async () => {
      const flow = router("anything", "5");
      flow.nodes[1].config = { mode: "is longer than", value: "not a number" };
      const { emit } = collect();
      const result = await execute(flow, emit);
      expect(result.ok).toBe(false);
      expect(result.failed).toEqual(["br"]);
      expect(new Set(result.skipped)).toEqual(new Set(["yes", "no"]));
    });
  });
});
