/**
 * The concrete blocks.
 *
 * Each definition declares its ports (which the validator and the canvas read)
 * and its runner (which the engine calls). Nothing else in the app needs to know
 * what an "llm" node is.
 *
 * A runner returns a value per output port. Leaving a port out means nothing
 * flows down it: that is how Branch routes, and how the engine knows to skip the
 * path not taken.
 */

import type { NodeKind } from "./graph";
import { streamCompletion } from "./llm";
import { firstInput, OUT, template, type NodeDefinition } from "./nodes";
import { search } from "./search";
import { applyOp, BRANCH_MODES, matches, TEXT_OPS } from "./text";

const input: NodeDefinition = {
  kind: "input",
  label: "Input",
  description: "The text the flow starts from.",
  inputs: [],
  outputs: [OUT],
  fields: [
    {
      key: "text",
      label: "Text",
      placeholder: "Ask something...",
      multiline: true,
    },
  ],
  run: async (config, _inputs, ctx) => {
    const text = config.text ?? "";
    ctx.onToken(text);
    return { [OUT]: text };
  },
};

const llm: NodeDefinition = {
  kind: "llm",
  label: "Model",
  description: "Prompts a model. Use {{in}} to drop in what arrives.",
  inputs: ["in", "context"],
  outputs: [OUT],
  fields: [
    {
      key: "prompt",
      label: "Prompt",
      placeholder: "Answer this: {{in}}",
      multiline: true,
    },
  ],
  run: async (config, inputs, ctx) => {
    const raw = config.prompt?.trim() ? config.prompt : "{{in}}";
    const prompt = template(raw, inputs);
    return { [OUT]: await streamCompletion(prompt, ctx.onToken, ctx.signal) };
  },
};

const searchNode: NodeDefinition = {
  kind: "search",
  label: "Search",
  description: "Finds relevant passages in a small built-in knowledge base.",
  inputs: ["in"],
  outputs: [OUT],
  fields: [],
  run: async (_config, inputs, ctx) => {
    const hits = search(firstInput(inputs));
    const text = hits.length
      ? hits.map((h, i) => `[${i + 1}] ${h}`).join("\n\n")
      : "No matching passages.";
    ctx.onToken(text);
    return { [OUT]: text };
  },
};

const transform: NodeDefinition = {
  kind: "transform",
  label: "Text",
  description: "Reshapes text on the way through, without a model.",
  inputs: ["in"],
  outputs: [OUT],
  fields: [
    {
      key: "op",
      label: "Operation",
      placeholder: "trim",
      options: [...TEXT_OPS],
    },
  ],
  run: async (config, inputs, ctx) => {
    const text = applyOp(config.op || "trim", firstInput(inputs));
    ctx.onToken(text);
    return { [OUT]: text };
  },
};

const branch: NodeDefinition = {
  kind: "branch",
  label: "Branch",
  description: "Sends the text down one path or the other.",
  inputs: ["in"],
  outputs: ["true", "false"],
  fields: [
    {
      key: "mode",
      label: "Condition",
      placeholder: "contains",
      options: [...BRANCH_MODES],
    },
    { key: "value", label: "Value", placeholder: "refund" },
  ],
  run: async (config, inputs, ctx) => {
    const text = firstInput(inputs);
    const taken = matches(config.mode || "contains", text, config.value ?? "");
    ctx.onToken(taken ? `-> true` : `-> false`);
    // Exactly one port carries a value. The other feeds nothing, so the engine
    // skips everything downstream of it.
    return { [taken ? "true" : "false"]: text };
  },
};

const join: NodeDefinition = {
  kind: "join",
  label: "Join",
  description: "Merges two branches with a template. Use {{a}} and {{b}}.",
  inputs: ["a", "b"],
  outputs: [OUT],
  fields: [
    {
      key: "template",
      label: "Template",
      placeholder: "{{a}}\n\n---\n\n{{b}}",
      multiline: true,
    },
  ],
  run: async (config, inputs, ctx) => {
    const raw = config.template?.trim()
      ? config.template
      : "{{a}}\n\n---\n\n{{b}}";
    const text = template(raw, inputs);
    ctx.onToken(text);
    return { [OUT]: text };
  },
};

const output: NodeDefinition = {
  kind: "output",
  label: "Output",
  description: "Where the flow ends up.",
  inputs: ["in"],
  outputs: [],
  fields: [],
  run: async (_config, inputs, ctx) => {
    const text = firstInput(inputs);
    ctx.onToken(text);
    return {};
  },
};

export const REGISTRY: Record<NodeKind, NodeDefinition> = {
  input,
  llm,
  search: searchNode,
  transform,
  branch,
  join,
  output,
};

export function definitionFor(kind: NodeKind): NodeDefinition {
  return REGISTRY[kind];
}
