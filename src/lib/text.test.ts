import { describe, expect, it } from "vitest";

import { applyOp, extractJson, matches } from "./text";

describe("applyOp", () => {
  it("trims, cases, and truncates", () => {
    expect(applyOp("trim", "  hi  ")).toBe("hi");
    expect(applyOp("lowercase", "Refund")).toBe("refund");
    expect(applyOp("uppercase", "Refund")).toBe("REFUND");
    expect(applyOp("first 200 characters", "x".repeat(300))).toHaveLength(200);
  });

  it("takes the first line, ignoring leading blank lines", () => {
    expect(applyOp("first line", "\n\nRefund\nbecause broken")).toBe("Refund");
  });

  it("pulls every number out, in order", () => {
    expect(applyOp("extract numbers", "order 12 cost 3.50 and -4")).toBe(
      "12, 3.50, -4",
    );
  });

  it("refuses an operation it does not know", () => {
    expect(() => applyOp("translate", "hi")).toThrow(/Unknown text operation/);
  });
});

describe("extractJson", () => {
  it("finds an object wrapped in prose", () => {
    expect(extractJson('Sure! {"a": 1} hope that helps')).toBe('{"a": 1}');
  });

  it("finds an object in a code fence", () => {
    expect(extractJson('```json\n{"a": [1, 2]}\n```')).toBe('{"a": [1, 2]}');
  });

  it("keeps nested braces together", () => {
    expect(extractJson('{"a": {"b": 2}} trailing')).toBe('{"a": {"b": 2}}');
  });

  it("finds a top-level array", () => {
    expect(extractJson('here: [1, {"b": 2}]')).toBe('[1, {"b": 2}]');
  });

  it("is not fooled by a brace inside a string", () => {
    expect(extractJson('{"a": "}"}')).toBe('{"a": "}"}');
  });

  it("is not fooled by an escaped quote", () => {
    expect(extractJson('{"a": "say \\"}\\" now"}')).toBe(
      '{"a": "say \\"}\\" now"}',
    );
  });

  it("throws when there is no JSON at all", () => {
    expect(() => extractJson("no json here")).toThrow(/No JSON/);
  });

  it("throws on an unclosed object rather than returning half of one", () => {
    expect(() => extractJson('{"a": 1')).toThrow(/No JSON/);
  });
});

describe("matches", () => {
  it("compares without caring about case", () => {
    expect(matches("contains", "I want a REFUND", "refund")).toBe(true);
    expect(matches("does not contain", "hello", "refund")).toBe(true);
  });

  it("applies a regex", () => {
    expect(matches("matches regex", "order 42", "^order \\d+$")).toBe(true);
    expect(matches("matches regex", "order x", "^order \\d+$")).toBe(false);
  });

  it("compares length", () => {
    expect(matches("is longer than", "abcdef", "3")).toBe(true);
    expect(matches("is longer than", "ab", "3")).toBe(false);
  });

  it("throws when a length is not a number", () => {
    expect(() => matches("is longer than", "ab", "three")).toThrow(
      /not a number/,
    );
  });

  it("throws on a condition it does not know", () => {
    expect(() => matches("rhymes with", "ab", "cd")).toThrow(
      /Unknown condition/,
    );
  });
});
