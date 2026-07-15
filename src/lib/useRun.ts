"use client";

import { useCallback, useRef, useState } from "react";

import type { EngineEvent } from "./engine";
import type { Flow } from "./graph";

export type NodeStatus = "idle" | "running" | "done" | "failed" | "skipped";

export interface RunState {
  status: Record<string, NodeStatus>;
  /** Text streamed out of each node so far. */
  text: Record<string, string>;
  /** Output ports that carried a value, so a branch can show the path it took. */
  taken: Record<string, string[]>;
  activeEdges: Set<string>;
  running: boolean;
  error: string | null;
  ms: number | null;
}

const EMPTY: RunState = {
  status: {},
  text: {},
  taken: {},
  activeEdges: new Set(),
  running: false,
  error: null,
  ms: null,
};

/**
 * Runs a flow and folds the server's event stream into render state.
 *
 * The response is an SSE stream, so this reads the body directly rather than
 * using EventSource (which cannot POST). Events arrive as they happen, which is
 * what makes nodes light up and wires flow in real time.
 */
export function useRun() {
  const [state, setState] = useState<RunState>(EMPTY);
  const abort = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  const apply = useCallback((event: EngineEvent) => {
    setState((s) => {
      switch (event.type) {
        case "run.started":
          return { ...EMPTY, activeEdges: new Set(), running: true };
        case "node.started":
          return { ...s, status: { ...s.status, [event.nodeId]: "running" } };
        case "node.token":
          return {
            ...s,
            text: {
              ...s.text,
              [event.nodeId]: (s.text[event.nodeId] ?? "") + event.text,
            },
          };
        case "node.completed":
          // The streamed tokens already are the text, so this only records the
          // status and which output ports actually carried a value.
          return {
            ...s,
            status: { ...s.status, [event.nodeId]: "done" },
            taken: { ...s.taken, [event.nodeId]: Object.keys(event.outputs) },
          };
        case "node.failed":
          return {
            ...s,
            status: { ...s.status, [event.nodeId]: "failed" },
            text: { ...s.text, [event.nodeId]: event.error },
          };
        case "node.skipped":
          return { ...s, status: { ...s.status, [event.nodeId]: "skipped" } };
        case "edge.active":
          return {
            ...s,
            activeEdges: new Set(s.activeEdges).add(event.edgeId),
          };
        case "run.completed":
          return { ...s, running: false, ms: event.ms };
        default:
          return s;
      }
    });
  }, []);

  const run = useCallback(
    async (flow: Flow) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setState({ ...EMPTY, running: true });

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flow),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            ...EMPTY,
            error: body.error ?? "This flow could not run.",
          });
          return;
        }
        if (!res.body) throw new Error("No stream came back.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              apply(JSON.parse(line.slice(5).trim()) as EngineEvent);
            } catch {
              // ignore a partial frame
            }
          }
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setState({ ...EMPTY, error: (error as Error).message });
      } finally {
        setState((s) => ({ ...s, running: false }));
        abort.current = null;
      }
    },
    [apply],
  );

  const reset = useCallback(() => setState(EMPTY), []);

  return { ...state, run, stop, reset };
}
