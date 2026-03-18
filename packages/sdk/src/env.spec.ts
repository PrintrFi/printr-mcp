import { describe, expect, test } from "bun:test";
import { rpcUrlsSchema } from "./env.js";

describe("rpcUrlsSchema", () => {
  test("parses single-quoted JSON", () => {
    const input = "{'base': 'https://base.alchemy.com', 'solana': 'https://solana.helius.xyz'}";
    const result = rpcUrlsSchema.parse(input);
    expect(result).toEqual({
      base: "https://base.alchemy.com",
      solana: "https://solana.helius.xyz",
    });
  });

  test("parses double-quoted JSON", () => {
    const input = '{"base": "https://base.alchemy.com", "solana": "https://solana.helius.xyz"}';
    const result = rpcUrlsSchema.parse(input);
    expect(result).toEqual({
      base: "https://base.alchemy.com",
      solana: "https://solana.helius.xyz",
    });
  });

  test("returns empty object for undefined", () => {
    const result = rpcUrlsSchema.parse(undefined);
    expect(result).toEqual({});
  });

  test("returns empty object for invalid JSON", () => {
    const result = rpcUrlsSchema.parse("not json");
    expect(result).toEqual({});
  });

  test("returns empty object for non-object JSON", () => {
    const result = rpcUrlsSchema.parse('"just a string"');
    expect(result).toEqual({});
  });
});
