/**
 * Keeping a flow.
 *
 * A flow is just data, so persisting one is serialising it and validating it on
 * the way back in. Anything read from disk or from localStorage is untrusted:
 * it goes through the same Zod schema as a request body, and a flow that does
 * not parse is rejected rather than half-loaded.
 */

import { flowSchema, type Flow } from "./graph";

const KEY = "circuit.flow.v1";

/** The on-disk shape. Versioned so a later format can migrate rather than fail. */
interface FlowFile {
  version: 1;
  flow: Flow;
}

export function serialize(flow: Flow): string {
  const file: FlowFile = { version: 1, flow };
  return JSON.stringify(file, null, 2);
}

/**
 * Read a flow back. Accepts either the wrapped file or a bare flow, so a graph
 * copied straight out of the network tab still imports.
 */
export function deserialize(raw: string): Flow | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const body =
    parsed && typeof parsed === "object" && "flow" in parsed
      ? (parsed as { flow: unknown }).flow
      : parsed;
  const result = flowSchema.safeParse(body);
  return result.success ? (result.data as Flow) : null;
}

// ----------------------------------------------------------------------
// the browser side
// ----------------------------------------------------------------------

/** Save the working flow. Never throws: a full or blocked store is not fatal. */
export function save(flow: Flow): void {
  try {
    window.localStorage.setItem(KEY, serialize(flow));
  } catch {
    // Private mode, or the quota is full. The canvas still works.
  }
}

export function load(): Flow | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

/** Hand a flow to the browser as a download. */
export function exportFile(flow: Flow, name = "flow.circuit.json"): void {
  const url = URL.createObjectURL(
    new Blob([serialize(flow)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
