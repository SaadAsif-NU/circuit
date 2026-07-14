/**
 * The flow the canvas opens with.
 *
 * Deliberately a diamond: one input fans out to two branches that run at the
 * same time, then fans back into a join. That shape is the whole point of the
 * engine, and you can watch it happen: both middle nodes light up together.
 */

import type { Flow } from "./graph";

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
      {
        id: "search-1",
        kind: "search",
        x: 380,
        y: 60,
        config: {},
      },
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
      {
        id: "output-1",
        kind: "output",
        x: 1080,
        y: 200,
        config: {},
      },
    ],
    edges: [
      { id: "e-1", source: "input-1", target: "search-1", targetPort: "in" },
      { id: "e-2", source: "input-1", target: "llm-1", targetPort: "in" },
      { id: "e-3", source: "llm-1", target: "llm-2", targetPort: "in" },
      { id: "e-4", source: "search-1", target: "llm-2", targetPort: "context" },
      { id: "e-5", source: "llm-2", target: "output-1", targetPort: "in" },
    ],
  };
}
