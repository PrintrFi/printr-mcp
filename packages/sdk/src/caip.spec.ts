import { describe, expect, it } from "bun:test";
import { parseCaip2, parseCaip10 } from "./caip.js";

describe("parseCaip2", () => {
  it("parses a valid CAIP-2 string", () => {
    expect(parseCaip2("eip155:8453")).toEqual({ namespace: "eip155", chainRef: "8453" });
    expect(parseCaip2("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toEqual({
      namespace: "solana",
      chainRef: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    });
  });

  it("returns null for missing colon", () => {
    expect(parseCaip2("eip155")).toBeNull();
  });

  it("returns null for empty namespace or chainRef", () => {
    expect(parseCaip2(":8453")).toBeNull();
    expect(parseCaip2("eip155:")).toBeNull();
  });
});

describe("parseCaip10", () => {
  it("parses a valid EVM CAIP-10 string", () => {
    expect(parseCaip10("eip155:8453:0xabc123")).toEqual({
      namespace: "eip155",
      chainRef: "8453",
      address: "0xabc123",
    });
  });

  it("parses a valid Solana CAIP-10 string", () => {
    const addr = "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv";
    expect(parseCaip10(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${addr}`)).toEqual({
      namespace: "solana",
      chainRef: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address: addr,
    });
  });

  it("preserves colons in address (EVM address with no extra colons is fine)", () => {
    // address is everything after the second colon
    const result = parseCaip10("eip155:1:0xabc:extra");
    expect(result?.address).toBe("0xabc:extra");
  });

  it("returns null for a plain string with no colons", () => {
    expect(parseCaip10("invalid")).toBeNull();
  });

  it("returns null for CAIP-2 (missing address segment)", () => {
    expect(parseCaip10("eip155:8453")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCaip10("")).toBeNull();
  });
});
