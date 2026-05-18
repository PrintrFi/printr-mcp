import { describe, expect, it } from "bun:test";
import { compact, dedupe } from "./array.js";

describe("compact", () => {
  it("drops null and undefined while preserving order", () => {
    expect(compact([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  it("preserves falsy non-nullish values (0, '', false)", () => {
    expect(compact([0, "", false, null, undefined, 1])).toEqual([0, "", false, 1]);
  });

  it("returns an empty array when every element is nullish", () => {
    expect(compact([null, undefined, null])).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(compact([])).toEqual([]);
  });

  it("narrows the element type", () => {
    const mixed: readonly (string | undefined)[] = ["a", undefined, "b"];
    const result: readonly string[] = compact(mixed);
    expect(result).toEqual(["a", "b"]);
  });
});

describe("dedupe", () => {
  it("removes duplicates while preserving first-seen order", () => {
    expect(dedupe([1, 2, 1, 3, 2, 4])).toEqual([1, 2, 3, 4]);
  });

  it("works on strings", () => {
    expect(dedupe(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(dedupe([])).toEqual([]);
  });

  it("treats references by identity (objects are not structurally compared)", () => {
    const a = { id: 1 };
    const b = { id: 1 };
    expect(dedupe([a, b, a])).toEqual([a, b]);
  });
});
