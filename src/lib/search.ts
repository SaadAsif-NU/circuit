/**
 * A small offline knowledge base.
 *
 * The search node retrieves passages by lexical overlap so a flow can be
 * grounded in something without a network call. Deterministic, which also makes
 * it a stable node to test the engine against.
 */

const TOKEN = /\b\w+\b/g;

const CORPUS: string[] = [
  "A directed acyclic graph has no cycles, so its nodes can be sorted into an order where every edge points forward. That ordering is what lets a workflow engine run each step only after its inputs exist.",
  "Topological sort can be done by repeatedly taking nodes with no remaining incoming edges (Kahn's algorithm). If nodes remain but none are free, the graph contains a cycle.",
  "Retrieval-augmented generation grounds a language model in retrieved passages, which reduces hallucination because the answer can cite the text it was given.",
  "Streaming a model's output token by token lowers perceived latency: the reader starts reading before the model has finished thinking.",
  "Good pipelines isolate failure. If one step fails, the steps that depend on it are skipped rather than fed garbage, and everything independent still runs.",
  "Running independent steps in parallel shortens the critical path of a pipeline to its longest chain rather than the sum of every step.",
  "Prompt templates keep a pipeline readable: the shape of the instruction lives in one place and the changing values are substituted in.",
  "Evaluation matters more than model choice for most products: a small model with tight grounding often beats a large one answering from memory.",
  "Caching identical requests is the cheapest latency win available to an LLM application, and semantic caching extends it to near-identical requests.",
  "A system prompt sets the role and the output contract; without one, a model guesses at the job and the result drifts between calls.",
];

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(TOKEN) ?? []);
}

/** Return the passages best overlapping the query, most relevant first. */
export function search(query: string, limit = 2): string[] {
  const q = tokens(query);
  if (q.size === 0) return [];
  const scored = CORPUS.map((doc) => {
    const d = tokens(doc);
    let hits = 0;
    for (const word of q) if (d.has(word)) hits += 1;
    return { doc, hits };
  })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.doc.localeCompare(b.doc));
  return scored.slice(0, limit).map((s) => s.doc);
}
