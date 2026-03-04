import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  asset,
  cost,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
} from "./schemas.js";

describe("initialBuy", () => {
  describe("supply_percent", () => {
    const validCases = [
      { name: "minimum (0.01)", value: 0.01 },
      { name: "middle value", value: 10 },
      { name: "maximum (69)", value: 69 },
    ];

    const invalidCases = [
      { name: "below minimum", value: 0.009 },
      { name: "zero", value: 0 },
      { name: "above maximum", value: 70 },
    ];

    test.each(validCases)("accepts $name", ({ value }) => {
      expect(initialBuy.safeParse({ supply_percent: value }).success).toBe(true);
    });

    test.each(invalidCases)("rejects $name", ({ value }) => {
      expect(initialBuy.safeParse({ supply_percent: value }).success).toBe(false);
    });

    test("accepts values in valid range (property)", () => {
      fc.assert(
        fc.property(fc.double({ min: 0.01, max: 69, noNaN: true }), (value) => {
          expect(initialBuy.safeParse({ supply_percent: value }).success).toBe(true);
        }),
      );
    });
  });

  describe("spend_usd", () => {
    const validCases = [
      { name: "zero (no initial buy)", value: 0 },
      { name: "decimal value", value: 0.5 },
      { name: "integer value", value: 100 },
    ];

    test.each(validCases)("accepts $name", ({ value }) => {
      expect(initialBuy.safeParse({ spend_usd: value }).success).toBe(true);
    });

    test("rejects negative numbers (property)", () => {
      fc.assert(
        fc.property(fc.double({ max: -0.001, noNaN: true }), (value) => {
          expect(initialBuy.safeParse({ spend_usd: value }).success).toBe(false);
        }),
      );
    });
  });

  describe("spend_native", () => {
    test("accepts any string (property)", () => {
      fc.assert(
        fc.property(fc.string(), (value) => {
          expect(initialBuy.safeParse({ spend_native: value }).success).toBe(true);
        }),
      );
    });

    test("rejects non-string types", () => {
      for (const value of [1000000, null, {}, []]) {
        expect(initialBuy.safeParse({ spend_native: value }).success).toBe(false);
      }
    });
  });

  describe("mutual exclusivity", () => {
    const invalidCombinations = [
      { name: "empty object", input: {} },
      { name: "supply_percent + spend_usd", input: { supply_percent: 10, spend_usd: 100 } },
      { name: "supply_percent + spend_native", input: { supply_percent: 10, spend_native: "100" } },
      { name: "spend_usd + spend_native", input: { spend_usd: 100, spend_native: "100" } },
      { name: "all three", input: { supply_percent: 10, spend_usd: 100, spend_native: "100" } },
    ];

    test.each(invalidCombinations)("rejects $name", ({ input }) => {
      const result = initialBuy.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Exactly one");
      }
    });
  });
});

describe("graduationThreshold", () => {
  test("accepts only 69000, 250000, or undefined", () => {
    expect(graduationThreshold.safeParse(69000).success).toBe(true);
    expect(graduationThreshold.safeParse(250000).success).toBe(true);
    expect(graduationThreshold.safeParse(undefined).success).toBe(true);
  });

  test("rejects other values (property)", () => {
    fc.assert(
      fc.property(
        fc.integer().filter((n) => n !== 69000 && n !== 250000),
        (value) => {
          expect(graduationThreshold.safeParse(value).success).toBe(false);
        },
      ),
    );
  });
});

describe("externalLinks", () => {
  test("accepts valid URLs (property)", () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        expect(externalLinks.safeParse({ website: url }).success).toBe(true);
      }),
    );
  });

  test("accepts empty/undefined", () => {
    expect(externalLinks.safeParse({}).success).toBe(true);
    expect(externalLinks.safeParse(undefined).success).toBe(true);
  });

  test("rejects invalid URLs", () => {
    expect(externalLinks.safeParse({ website: "not-a-url" }).success).toBe(false);
  });
});

describe("cost", () => {
  const baseCost = {
    asset_id: "eip155:8453:0x0000",
    cost_usd: 1.5,
    cost_asset_atomic: "1500000000000000000",
  };

  test("accepts valid cost objects (property)", () => {
    fc.assert(
      fc.property(
        fc.record({
          asset_id: fc.string(),
          cost_usd: fc.double({ noNaN: true, noDefaultInfinity: true }),
          cost_asset_atomic: fc.string(),
        }),
        (input) => {
          expect(cost.safeParse(input).success).toBe(true);
        },
      ),
    );
  });

  test("accepts optional fields", () => {
    expect(cost.safeParse({ ...baseCost, description: "Gas" }).success).toBe(true);
    expect(cost.safeParse({ ...baseCost, limit: 10 }).success).toBe(true);
  });

  test("rejects missing required fields", () => {
    expect(cost.safeParse({ asset_id: "x" }).success).toBe(false);
    expect(cost.safeParse({ asset_id: "x", cost_usd: 1 }).success).toBe(false);
  });
});

describe("asset", () => {
  test("accepts valid asset objects (property)", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          symbol: fc.string(),
          decimals: fc.integer({ min: 0, max: 36 }),
          price_usd: fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }),
        }),
        (input) => {
          expect(asset.safeParse(input).success).toBe(true);
        },
      ),
    );
  });

  test("rejects invalid types", () => {
    const base = { id: "x", name: "y", symbol: "Z", decimals: 18, price_usd: 100 };
    expect(asset.safeParse({ ...base, decimals: "18" }).success).toBe(false);
    expect(asset.safeParse({ ...base, price_usd: "100" }).success).toBe(false);
  });
});

describe("quoteOutput", () => {
  const validQuote = {
    id: "q1",
    router: "uniswap",
    assets: [{ id: "x", name: "ETH", symbol: "ETH", decimals: 18, price_usd: 2500 }],
    costs: [{ asset_id: "x", cost_usd: 1.5, cost_asset_atomic: "1500000000" }],
    total: { asset_id: "x", cost_usd: 1.5, cost_asset_atomic: "1500000000" },
  };

  test("accepts valid quote with optional initial_buy_amount", () => {
    expect(quoteOutput.safeParse(validQuote).success).toBe(true);
    expect(quoteOutput.safeParse({ ...validQuote, initial_buy_amount: "1000" }).success).toBe(true);
  });

  test("rejects invalid structure", () => {
    expect(quoteOutput.safeParse({ id: "q1", router: "x" }).success).toBe(false);
    expect(quoteOutput.safeParse({ ...validQuote, assets: [{}] }).success).toBe(false);
  });
});
