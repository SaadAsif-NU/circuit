/**
 * The deterministic text logic behind the Text and Branch blocks.
 *
 * Kept out of the registry so it is pure, unit tested, and readable on its own:
 * a block should be a port declaration and a one-line call into here.
 */

export const TEXT_OPS = [
  "trim",
  "lowercase",
  "uppercase",
  "first line",
  "first 200 characters",
  "extract JSON",
  "extract numbers",
] as const;

export type TextOp = (typeof TEXT_OPS)[number];

/**
 * Apply one named operation. An unknown op throws rather than silently passing
 * the text through, so a typo in a saved flow surfaces as a failed node.
 */
export function applyOp(op: string, text: string): string {
  switch (op) {
    case "trim":
      return text.trim();
    case "lowercase":
      return text.toLowerCase();
    case "uppercase":
      return text.toUpperCase();
    case "first line":
      return text.trimStart().split("\n")[0] ?? "";
    case "first 200 characters":
      return text.slice(0, 200);
    case "extract JSON":
      return extractJson(text);
    case "extract numbers":
      return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).join(", ");
    default:
      throw new Error(`Unknown text operation "${op}".`);
  }
}

/**
 * Pull the first balanced JSON object or array out of a larger reply, which is
 * the usual way to get structured data back from a model that also wrote prose
 * or wrapped its answer in a code fence.
 */
export function extractJson(text: string): string {
  const start = text.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in the input.");

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close && --depth === 0) {
      const slice = text.slice(start, i + 1);
      // Only claim a match if it actually parses.
      JSON.parse(slice);
      return slice;
    }
  }
  throw new Error("No JSON found in the input.");
}

export const BRANCH_MODES = [
  "contains",
  "does not contain",
  "matches regex",
  "is longer than",
] as const;

export type BranchMode = (typeof BRANCH_MODES)[number];

/** Test a value against a condition. Comparisons are case insensitive. */
export function matches(mode: string, text: string, value: string): boolean {
  const needle = value.trim();
  switch (mode) {
    case "contains":
      return text.toLowerCase().includes(needle.toLowerCase());
    case "does not contain":
      return !text.toLowerCase().includes(needle.toLowerCase());
    case "matches regex":
      // An invalid pattern is the author's mistake, so fail the node loudly
      // rather than quietly routing everything down the false branch.
      return new RegExp(needle, "i").test(text);
    case "is longer than": {
      const limit = Number(needle);
      if (!Number.isFinite(limit)) {
        throw new Error(`"${needle}" is not a number of characters.`);
      }
      return text.length > limit;
    }
    default:
      throw new Error(`Unknown condition "${mode}".`);
  }
}
