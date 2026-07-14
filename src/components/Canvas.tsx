"use client";

import { AnimatePresence, MotionConfig } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import { NodeCard } from "@/components/NodeCard";
import { Toolbar } from "@/components/Toolbar";
import { GhostWire, Wire } from "@/components/Wire";
import { validate } from "@/lib/engine";
import type { Flow, FlowNode, NodeKind } from "@/lib/graph";
import {
  inputPortPos,
  outputPortPos,
  toGraph,
  zoomAbout,
  type Point,
} from "@/lib/layout";
import { starterFlow } from "@/lib/presets";
import { definitionFor } from "@/lib/registry";
import { useRun } from "@/lib/useRun";

/** What the user is currently doing with the pointer. */
type Drag =
  | { kind: "none" }
  | { kind: "pan"; startPan: Point; startScreen: Point }
  | { kind: "node"; nodeId: string; offset: Point }
  | { kind: "wire"; from: string; cursor: Point };

let seq = 0;
const nextId = (kind: string) => `${kind}-${Date.now().toString(36)}-${seq++}`;

export function Canvas() {
  const [flow, setFlow] = useState<Flow>(starterFlow);
  const [pan, setPan] = useState<Point>({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(0.85);
  const [drag, setDrag] = useState<Drag>({ kind: "none" });
  const [selected, setSelected] = useState<string | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const run = useRun();

  const issues = validate(flow);

  const screenOf = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const box = surface.current?.getBoundingClientRect();
      return {
        x: e.clientX - (box?.left ?? 0),
        y: e.clientY - (box?.top ?? 0),
      };
    },
    [],
  );

  // -- pointer plumbing ------------------------------------------------

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag.kind === "none") return;
      const screen = screenOf(e);
      if (drag.kind === "pan") {
        setPan({
          x: drag.startPan.x + (screen.x - drag.startScreen.x),
          y: drag.startPan.y + (screen.y - drag.startScreen.y),
        });
      } else if (drag.kind === "node") {
        const g = toGraph(screen, pan, zoom);
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) =>
            n.id === drag.nodeId
              ? { ...n, x: g.x - drag.offset.x, y: g.y - drag.offset.y }
              : n,
          ),
        }));
      } else if (drag.kind === "wire") {
        setDrag({ ...drag, cursor: toGraph(screen, pan, zoom) });
      }
    },
    [drag, pan, zoom, screenOf],
  );

  const endDrag = useCallback(() => setDrag({ kind: "none" }), []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const next = zoomAbout(screenOf(e), pan, zoom, e.deltaY < 0 ? 1.1 : 0.9);
      setPan(next.pan);
      setZoom(next.zoom);
    },
    [pan, zoom, screenOf],
  );

  // -- graph edits -----------------------------------------------------

  const connect = useCallback(
    (target: string, port: string) => {
      if (drag.kind !== "wire") return;
      const source = drag.from;
      setDrag({ kind: "none" });
      if (source === target) return;
      setFlow((f) => ({
        ...f,
        // One value per port, so a new wire replaces whatever fed it.
        edges: [
          ...f.edges.filter(
            (e) => !(e.target === target && e.targetPort === port),
          ),
          { id: nextId("e"), source, target, targetPort: port },
        ],
      }));
    },
    [drag],
  );

  const addNode = useCallback(
    (kind: NodeKind) => {
      const g = toGraph({ x: 260, y: 200 }, pan, zoom);
      const node: FlowNode = {
        id: nextId(kind),
        kind,
        x: g.x + Math.random() * 40,
        y: g.y + Math.random() * 40,
        config: {},
      };
      setFlow((f) => ({ ...f, nodes: [...f.nodes, node] }));
      setSelected(node.id);
    },
    [pan, zoom],
  );

  const deleteNode = useCallback((id: string) => {
    setFlow((f) => ({
      nodes: f.nodes.filter((n) => n.id !== id),
      edges: f.edges.filter((e) => e.source !== id && e.target !== id),
    }));
  }, []);

  const nodeById = useCallback(
    (id: string) => flow.nodes.find((n) => n.id === id),
    [flow.nodes],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-screen w-full overflow-hidden">
        <Toolbar
          onAdd={addNode}
          onRun={() => run.run(flow)}
          onStop={run.stop}
          onReset={() => {
            run.reset();
            setFlow(starterFlow());
            setPan({ x: 40, y: 40 });
            setZoom(0.85);
          }}
          running={run.running}
          issue={issues[0]?.message ?? run.error}
          ms={run.ms}
        />

        <div
          ref={surface}
          onPointerDown={(e) => {
            if (
              e.target === e.currentTarget ||
              (e.target as HTMLElement).dataset.surface
            ) {
              setSelected(null);
              setDrag({ kind: "pan", startPan: pan, startScreen: screenOf(e) });
            }
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onWheel={onWheel}
          className="dotted absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          data-surface="true"
        >
          {/* wires live under the nodes, in the same transformed space */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {flow.edges.map((edge) => {
                const from = nodeById(edge.source);
                const to = nodeById(edge.target);
                if (!from || !to) return null;
                const def = definitionFor(to.kind);
                const index = Math.max(
                  0,
                  def?.inputs.indexOf(edge.targetPort) ?? 0,
                );
                return (
                  <g key={edge.id} className="pointer-events-auto">
                    <Wire
                      from={outputPortPos(from)}
                      to={inputPortPos(to, index)}
                      active={run.running && run.activeEdges.has(edge.id)}
                      done={!run.running && run.activeEdges.has(edge.id)}
                      onCut={() =>
                        setFlow((f) => ({
                          ...f,
                          edges: f.edges.filter((e) => e.id !== edge.id),
                        }))
                      }
                    />
                  </g>
                );
              })}
              {drag.kind === "wire" &&
                (() => {
                  const from = nodeById(drag.from);
                  return from ? (
                    <GhostWire from={outputPortPos(from)} to={drag.cursor} />
                  ) : null;
                })()}
            </g>
          </svg>

          {/* nodes */}
          <div
            className="absolute origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <AnimatePresence>
              {flow.nodes.map((node) => {
                const def = definitionFor(node.kind);
                if (!def) return null;
                return (
                  <NodeCard
                    key={node.id}
                    node={node}
                    def={def}
                    status={run.status[node.id] ?? "idle"}
                    text={run.text[node.id] ?? ""}
                    selected={selected === node.id}
                    onPointerDownHeader={(e) => {
                      e.stopPropagation();
                      setSelected(node.id);
                      const g = toGraph(screenOf(e), pan, zoom);
                      setDrag({
                        kind: "node",
                        nodeId: node.id,
                        offset: { x: g.x - node.x, y: g.y - node.y },
                      });
                    }}
                    onConfigChange={(key, value) =>
                      setFlow((f) => ({
                        ...f,
                        nodes: f.nodes.map((n) =>
                          n.id === node.id
                            ? { ...n, config: { ...n.config, [key]: value } }
                            : n,
                        ),
                      }))
                    }
                    onOutputDown={(e) => {
                      e.stopPropagation();
                      setDrag({
                        kind: "wire",
                        from: node.id,
                        cursor: toGraph(screenOf(e), pan, zoom),
                      });
                    }}
                    onInputUp={(port) => connect(node.id, port)}
                    onDelete={() => deleteNode(node.id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
