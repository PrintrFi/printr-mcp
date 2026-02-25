import { describe, expect, it, test } from "bun:test";
import {
  asset,
  caip2ChainId,
  caip10Address,
  cost,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
  tokenId,
} from "./schemas.js";

describe("string-based schemas", () => {
  const schemas = [
    { name: "caip2ChainId", schema: caip2ChainId, valid: "eip155:8453" },
    {
      name: "caip10Address",
      schema: caip10Address,
      valid: "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    },
    { name: "tokenId", schema: tokenId, valid: "0x3a7a8d1234567890abcdef" },
  ];

  test.each(schemas)("$name rejects non-string values", ({ schema }) => {
    expect(schema.safeParse(123).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
  });
});

describe("caip2ChainId", () => {
  const validCases = [
    { name: "EVM chain (Base)", input: "eip155:8453" },
    { name: "EVM chain (Ethereum mainnet)", input: "eip155:1" },
    { name: "Solana chain", input: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
  ];

  test.each(validCases)("accepts $name", ({ input }) => {
    const result = caip2ChainId.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("caip10Address", () => {
  it("accepts valid CAIP-10 addresses", () => {
    const result = caip10Address.safeParse("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
    expect(result.success).toBe(true);
  });
});

describe("tokenId", () => {
  const validCases = [
    { name: "hex token ID", input: "0x3a7a8d1234567890abcdef" },
    { name: "CAIP-10 address", input: "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
  ];

  test.each(validCases)("accepts $name", ({ input }) => {
    const result = tokenId.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("initialBuy", () => {
  describe("supply_percent", () => {
    const validCases = [
      { name: "valid middle value", value: 10 },
      { name: "minimum (0.01)", value: 0.01 },
      { name: "maximum (69)", value: 69 },
    ];

    test.each(validCases)("accepts $name", ({ value }) => {
      const result = initialBuy.safeParse({ supply_percent: value });
      expect(result.success).toBe(true);
    });

    const invalidCases = [
      { name: "below minimum", value: 0.009 },
      { name: "above maximum", value: 70 },
      { name: "zero", value: 0 },
    ];

    test.each(invalidCases)("rejects $name", ({ value }) => {
      const result = initialBuy.safeParse({ supply_percent: value });
      expect(result.success).toBe(false);
    });
  });

  describe("spend_usd", () => {
    const validCases = [
      { name: "integer value", value: 100 },
      { name: "decimal value", value: 0.5 },
    ];

    test.each(validCases)("accepts $name", ({ value }) => {
      const result = initialBuy.safeParse({ spend_usd: value });
      expect(result.success).toBe(true);
    });

    const invalidCases = [
      { name: "zero", value: 0 },
      { name: "negative", value: -10 },
    ];

    test.each(invalidCases)("rejects $name", ({ value }) => {
      const result = initialBuy.safeParse({ spend_usd: value });
      expect(result.success).toBe(false);
    });
  });

  describe("spend_native", () => {
    it("accepts valid spend_native", () => {
      const result = initialBuy.safeParse({ spend_native: "1000000000000000000" });
      expect(result.success).toBe(true);
    });

    it("rejects non-string spend_native", () => {
      const result = initialBuy.safeParse({ spend_native: 1000000 });
      expect(result.success).toBe(false);
    });
  });

  describe("refinement logic", () => {
    const invalidCases = [
      {
        name: "empty object",
        input: {},
      },
      {
        name: "supply_percent + spend_usd",
        input: { supply_percent: 10, spend_usd: 100 },
      },
      {
        name: "spend_usd + spend_native",
        input: { spend_usd: 100, spend_native: "1000000" },
      },
      {
        name: "all three fields",
        input: { supply_percent: 10, spend_usd: 100, spend_native: "1000000" },
      },
    ];

    test.each(invalidCases)("rejects $name", ({ input }) => {
      const result = initialBuy.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Exactly one");
      }
    });
  });
});

describe("graduationThreshold", () => {
  const validCases = [
    { name: "30000", value: 30000 },
    { name: "250000", value: 250000 },
    { name: "undefined (optional)", value: undefined },
  ];

  test.each(validCases)("accepts $name", ({ value }) => {
    const result = graduationThreshold.safeParse(value);
    expect(result.success).toBe(true);
  });

  const invalidCases = [
    { name: "other number", value: 100000 },
    { name: "string value", value: "30000" },
    { name: "zero", value: 0 },
  ];

  test.each(invalidCases)("rejects $name", ({ value }) => {
    const result = graduationThreshold.safeParse(value);
    expect(result.success).toBe(false);
  });
});

describe("externalLinks", () => {
  const validCases = [
    {
      name: "all links",
      input: {
        website: "https://example.com",
        x: "https://x.com/handle",
        telegram: "https://t.me/channel",
        github: "https://github.com/user/repo",
      },
    },
    {
      name: "partial links",
      input: { website: "https://example.com" },
    },
    {
      name: "empty object",
      input: {},
    },
    {
      name: "undefined",
      input: undefined,
    },
  ];

  test.each(validCases)("accepts $name", ({ input }) => {
    const result = externalLinks.safeParse(input);
    expect(result.success).toBe(true);
  });

  const invalidCases = [
    { name: "invalid URL", input: { website: "not-a-url" } },
    { name: "malformed URL", input: { website: "not a url" } },
  ];

  test.each(invalidCases)("rejects $name", ({ input }) => {
    const result = externalLinks.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("cost", () => {
  it("accepts valid cost object", () => {
    const result = cost.safeParse({
      asset_id: "eip155:8453:0x0000",
      cost_usd: 1.5,
      cost_asset_atomic: "1500000000000000000",
    });
    expect(result.success).toBe(true);
  });

  const optionalFieldsCases = [
    {
      name: "with description",
      input: {
        asset_id: "eip155:8453:0x0000",
        cost_usd: 1.5,
        cost_asset_atomic: "1500000000000000000",
        description: "Gas Fee",
      },
    },
    {
      name: "with limit",
      input: {
        asset_id: "eip155:8453:0x0000",
        cost_usd: 1.5,
        cost_asset_atomic: "1500000000000000000",
        limit: 10,
      },
    },
  ];

  test.each(optionalFieldsCases)("accepts cost $name", ({ input }) => {
    const result = cost.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = cost.safeParse({ asset_id: "eip155:8453:0x0000" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cost_usd type", () => {
    const result = cost.safeParse({
      asset_id: "eip155:8453:0x0000",
      cost_usd: "1.5",
      cost_asset_atomic: "1500000000000000000",
    });
    expect(result.success).toBe(false);
  });
});

describe("asset", () => {
  it("accepts valid asset object", () => {
    const result = asset.safeParse({
      id: "eip155:8453:0x0000",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      price_usd: 2500.5,
    });
    expect(result.success).toBe(true);
  });

  const invalidCases = [
    {
      name: "missing required fields",
      input: { id: "eip155:8453:0x0000", name: "Ethereum" },
    },
    {
      name: "invalid decimals type",
      input: {
        id: "eip155:8453:0x0000",
        name: "Ethereum",
        symbol: "ETH",
        decimals: "18",
        price_usd: 2500.5,
      },
    },
  ];

  test.each(invalidCases)("rejects $name", ({ input }) => {
    const result = asset.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("quoteOutput", () => {
  const validQuote = {
    id: "q1",
    router: "uniswap",
    assets: [
      {
        id: "eip155:8453:0x0000",
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
        price_usd: 2500.5,
      },
    ],
    costs: [
      {
        asset_id: "eip155:8453:0x0000",
        cost_usd: 1.5,
        cost_asset_atomic: "1500000000000000000",
      },
    ],
    total: {
      asset_id: "eip155:8453:0x0000",
      cost_usd: 1.5,
      cost_asset_atomic: "1500000000000000000",
    },
  };

  it("accepts valid quote output", () => {
    const result = quoteOutput.safeParse(validQuote);
    expect(result.success).toBe(true);
  });

  it("accepts quote with optional initial_buy_amount", () => {
    const result = quoteOutput.safeParse({
      ...validQuote,
      initial_buy_amount: "1000000000000000000",
    });
    expect(result.success).toBe(true);
  });

  const invalidCases = [
    {
      name: "missing required fields",
      input: { id: "q1", router: "uniswap" },
    },
    {
      name: "invalid assets array",
      input: {
        ...validQuote,
        assets: [{ invalid: "asset" }],
      },
    },
  ];

  test.each(invalidCases)("rejects $name", ({ input }) => {
    const result = quoteOutput.safeParse(input);
    expect(result.success).toBe(false);
  });
});
