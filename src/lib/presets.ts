/**
 * The flows you can open from the toolbar.
 *
 * Each one exists to make a different property of the engine visible on screen:
 * the first runs two branches at the same time, the second runs only one of them
 * and greys out the path it did not take.
 */

import type { Flow } from "./graph";

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  build: () => Flow;
}

/**
 * A diamond, on purpose: one input fans out to two branches that run at the same
 * time, then fans back in. That shape is the whole point of the engine, and you
 * can watch it happen: both middle nodes light up together.
 */
export function starterFlow(): Flow {
  return {
    nodes: [
      {
        id: "input-1",
        kind: "input",
        x: 40,
        y: 200,
        config: { text: "Why do workflow engines run steps as a DAG?" },
      },
      { id: "search-1", kind: "search", x: 380, y: 60, config: {} },
      {
        id: "llm-1",
        kind: "llm",
        x: 380,
        y: 330,
        config: { prompt: "In two sentences, answer plainly:\n\n{{in}}" },
      },
      {
        id: "llm-2",
        kind: "llm",
        x: 730,
        y: 170,
        config: {
          prompt:
            "Question: {{in}}\n\nNotes from the knowledge base:\n{{context}}\n\nWrite a short, grounded answer that uses the notes.",
        },
      },
      { id: "output-1", kind: "output", x: 1080, y: 200, config: {} },
    ],
    edges: [
      {
        id: "e-1",
        source: "input-1",
        sourcePort: "out",
        target: "search-1",
        targetPort: "in",
      },
      {
        id: "e-2",
        source: "input-1",
        sourcePort: "out",
        target: "llm-1",
        targetPort: "in",
      },
      {
        id: "e-3",
        source: "llm-1",
        sourcePort: "out",
        target: "llm-2",
        targetPort: "in",
      },
      {
        id: "e-4",
        source: "search-1",
        sourcePort: "out",
        target: "llm-2",
        targetPort: "context",
      },
      {
        id: "e-5",
        source: "llm-2",
        sourcePort: "out",
        target: "output-1",
        targetPort: "in",
      },
    ],
  };
}

/**
 * A support triage line: classify the message, clean the model's answer down to
 * one word, then route on it. Only one of the two replies runs; the other path
 * goes grey, because a branch that is not taken feeds nothing.
 *
 * Both replies read the original message off the Input node's second wire, since
 * what reaches them through the branch is the verdict, not the complaint.
 */
export function routerFlow(): Flow {
  return {
    nodes: [
      {
        id: "input-1",
        kind: "input",
        x: 30,
        y: 250,
        config: { text: "My order arrived smashed and I want my money back." },
      },
      {
        id: "llm-1",
        kind: "llm",
        x: 340,
        y: 60,
        config: {
          prompt: "Reply with exactly one word, refund or question:\n\n{{in}}",
        },
      },
      {
        id: "transform-1",
        kind: "transform",
        x: 650,
        y: 60,
        config: { op: "first line" },
      },
      {
        id: "branch-1",
        kind: "branch",
        x: 960,
        y: 60,
        config: { mode: "contains", value: "refund" },
      },
      {
        id: "llm-2",
        kind: "llm",
        x: 1270,
        y: 10,
        config: {
          prompt:
            "The customer wrote:\n\n{{context}}\n\nWrite a short, warm reply confirming their refund is approved.",
        },
      },
      {
        id: "llm-3",
        kind: "llm",
        x: 1270,
        y: 420,
        config: {
          prompt:
            "The customer wrote:\n\n{{context}}\n\nAnswer their question in two sentences.",
        },
      },
      // The two paths sit far apart because a Model grows as its reply streams
      // in, and a node that has answered must not cover the one below it.
      { id: "output-1", kind: "output", x: 1580, y: 40, config: {} },
      { id: "output-2", kind: "output", x: 1580, y: 450, config: {} },
    ],
    edges: [
      {
        id: "e-1",
        source: "input-1",
        sourcePort: "out",
        target: "llm-1",
        targetPort: "in",
      },
      {
        id: "e-2",
        source: "llm-1",
        sourcePort: "out",
        target: "transform-1",
        targetPort: "in",
      },
      {
        id: "e-3",
        source: "transform-1",
        sourcePort: "out",
        target: "branch-1",
        targetPort: "in",
      },
      {
        id: "e-4",
        source: "branch-1",
        sourcePort: "true",
        target: "llm-2",
        targetPort: "in",
      },
      {
        id: "e-5",
        source: "branch-1",
        sourcePort: "false",
        target: "llm-3",
        targetPort: "in",
      },
      {
        id: "e-6",
        source: "input-1",
        sourcePort: "out",
        target: "llm-2",
        targetPort: "context",
      },
      {
        id: "e-7",
        source: "input-1",
        sourcePort: "out",
        target: "llm-3",
        targetPort: "context",
      },
      {
        id: "e-8",
        source: "llm-2",
        sourcePort: "out",
        target: "output-1",
        targetPort: "in",
      },
      {
        id: "e-9",
        source: "llm-3",
        sourcePort: "out",
        target: "output-2",
        targetPort: "in",
      },
    ],
  };
}

export function blankFlow(): Flow {
  return { nodes: [], edges: [] };
}

export const PRESETS: Preset[] = [
  {
    id: "starter",
    name: "Grounded answer",
    blurb: "A diamond: search and a model run at once, then a model uses both.",
    build: starterFlow,
  },
  {
    id: "router",
    name: "Support router",
    blurb: "Classify a message, then take one path and skip the other.",
    build: routerFlow,
  },
  {
    id: "blank",
    name: "Blank canvas",
    blurb: "Start from nothing.",
    build: blankFlow,
  },
];
