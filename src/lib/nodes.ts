/**
 * The node registry: what each block is, what it accepts, and how it runs.
 *
 * A node definition is data, not code branching: the engine asks the registry
 * for a node's ports (to validate a graph) and for its runner (to execute one).
 * Adding a block means adding one entry here, and the canvas, the validator and
 * the engine all pick it up.
 */

import type { NodeKind } from "./graph";

/** Text flowing between nodes, keyed by the input port it arrived on. */
export type Inputs = Record<string, string>;

/**
 * What a node produced, keyed by output port.
 *
 * A port left out of this record was **not taken**: nothing flows down it, and
 * the engine skips whatever it feeds. That is the whole mechanism behind
 * conditional routing, and it costs the engine one `undefined` check.
 */
export type Outputs = Record<string, string>;

/** The port a block with nothing to decide sends its single value down. */
export const OUT = "out";

export interface RunContext {
  /** Emit a chunk of output as it is produced, so the UI can stream it. */
  onToken: (text: string) => void;
  signal?: AbortSignal;
}

export interface NodeField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  /** When set, the field is a fixed choice rather than free text. */
  options?: string[];
}

export interface NodeDefinition {
  kind: NodeKind;
  label: string;
  description: string;
  /** Named input ports. A node with none is a source. */
  inputs: string[];
  /** Named output ports. A node with none is a sink. */
  outputs: string[];
  /** Config fields the canvas should render an editor for. */
  fields: NodeField[];
  run: (
    config: Record<string, string>,
    inputs: Inputs,
    ctx: RunContext,
  ) => Promise<Outputs>;
}

/** Fill `{{port}}` placeholders from the values arriving on the input ports. */
export function template(text: string, inputs: Inputs): string {
  return text.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (_m, key: string) => inputs[key] ?? "",
  );
}

/** The single value flowing in, when a node just needs "whatever arrived". */
export function firstInput(inputs: Inputs): string {
  const values = Object.values(inputs).filter((v) => v.length > 0);
  return values[0] ?? "";
}

export const NODE_KINDS: NodeKind[] = [
  "input",
  "llm",
  "search",
  "transform",
  "branch",
  "join",
  "output",
];
