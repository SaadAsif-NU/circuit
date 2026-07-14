/**
 * The concrete blocks.
 *
 * Each definition declares its ports (which the validator and the canvas read)
 * and its runner (which the engine calls). Nothing else in the app needs to know
 * what an "llm" node is.
 */

import type { NodeKind } from "./graph";
import { streamCompletion } from "./llm";
import { firstInput, template, type NodeDefinition } from "./nodes";
import { search } from "./search";

const input: NodeDefinition = {
  kind: "input",
  label: "Input",
  description: "The text the flow starts from.",
  inputs: [],
  hasOutput: true,
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
    return text;
  },
};

const llm: NodeDefinition = {
  kind: "llm",
  label: "Model",
  description: "Prompts a model. Use {{in}} to drop in what arrives.",
  inputs: ["in", "context"],
  hasOutput: true,
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
    return streamCompletion(prompt, ctx.onToken, ctx.signal);
  },
};

const searchNode: NodeDefinition = {
  kind: "search",
  label: "Search",
  description: "Finds relevant passages in a small built-in knowledge base.",
  inputs: ["in"],
  hasOutput: true,
  fields: [],
  run: async (_config, inputs, ctx) => {
    const hits = search(firstInput(inputs));
    const text = hits.length
      ? hits.map((h, i) => `[${i + 1}] ${h}`).join("\n\n")
      : "No matching passages.";
    ctx.onToken(text);
    return text;
  },
};

const join: NodeDefinition = {
  kind: "join",
  label: "Join",
  description: "Merges two branches with a template. Use {{a}} and {{b}}.",
  inputs: ["a", "b"],
  hasOutput: true,
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
    return text;
  },
};

const output: NodeDefinition = {
  kind: "output",
  label: "Output",
  description: "Where the flow ends up.",
  inputs: ["in"],
  hasOutput: false,
  fields: [],
  run: async (_config, inputs, ctx) => {
    const text = firstInput(inputs);
    ctx.onToken(text);
    return text;
  },
};

export const REGISTRY: Record<NodeKind, NodeDefinition> = {
  input,
  llm,
  search: searchNode,
  join,
  output,
};

export function definitionFor(kind: NodeKind): NodeDefinition {
  return REGISTRY[kind];
}
