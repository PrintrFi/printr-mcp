import { describe, expect, test } from "bun:test";
import { graduationThreshold, initialBuy } from "./schemas.js";

describe("initialBuy", () => {
  describe("supply_percent boundaries", () => {
    test.each([
      { value: 0.01, valid: true },
      { value: 69, valid: true },
      { value: 0.009, valid: false },
      { value: 70, valid: false },
    ])("$value → valid=$valid", ({ value, valid }) => {
      expect(initialBuy.safeParse({ supply_percent: value }).success).toBe(valid);
    });
  });

  test("spend_usd accepts zero (no initial buy)", () => {
    expect(initialBuy.safeParse({ spend_usd: 0 }).success).toBe(true);
  });

  test("spend_usd rejects negative", () => {
    expect(initialBuy.safeParse({ spend_usd: -1 }).success).toBe(false);
  });

  describe("mutual exclusivity", () => {
    test.each([
      { name: "empty object", input: {} },
      { name: "supply_percent + spend_usd", input: { supply_percent: 10, spend_usd: 100 } },
      { name: "supply_percent + spend_native", input: { supply_percent: 10, spend_native: "100" } },
      { name: "spend_usd + spend_native", input: { spend_usd: 100, spend_native: "100" } },
      { name: "all three", input: { supply_percent: 10, spend_usd: 100, spend_native: "100" } },
    ])("rejects $name", ({ input }) => {
      const result = initialBuy.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Exactly one");
      }
    });
  });
});

describe("graduationThreshold", () => {
  test.each([
    { value: 69000, valid: true },
    { value: 250000, valid: true },
    { value: undefined, valid: true },
    { value: 100000, valid: false },
    { value: 0, valid: false },
  ])("$value → valid=$valid", ({ value, valid }) => {
    expect(graduationThreshold.safeParse(value).success).toBe(valid);
  });
});
