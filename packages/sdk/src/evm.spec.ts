import { describe, expect, it } from "bun:test";
import { normalisePrivateKey, parseEvmCaip10, tryParseEvmCaip10 } from "./evm.js";

describe("tryParseEvmCaip10", () => {
  it("returns ok for a well-formed CAIP-10", () => {
    const result = tryParseEvmCaip10("eip155:8453:0xabc");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ chainId: 8453, address: "0xabc" });
    }
  });

  it("returns malformed for fewer than 3 parts", () => {
    const result = tryParseEvmCaip10("eip155:8453");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ kind: "malformed", input: "eip155:8453" });
    }
  });

  it("returns invalid_chain_id when chainRef is not a positive integer", () => {
    const r1 = tryParseEvmCaip10("eip155:abc:0xdead");
    expect(r1.isErr()).toBe(true);
    if (r1.isErr()) {
      expect(r1.error.kind).toBe("invalid_chain_id");
    }

    const r2 = tryParseEvmCaip10("eip155:0:0xdead");
    expect(r2.isErr()).toBe(true);
    if (r2.isErr()) {
      expect(r2.error.kind).toBe("invalid_chain_id");
    }

    const r3 = tryParseEvmCaip10("eip155:-1:0xdead");
    expect(r3.isErr()).toBe(true);
    if (r3.isErr()) {
      expect(r3.error.kind).toBe("invalid_chain_id");
    }
  });
});

describe("parseEvmCaip10 (throwing variant)", () => {
  it("returns the parsed value for well-formed input", () => {
    expect(parseEvmCaip10("eip155:8453:0xabc")).toEqual({ chainId: 8453, address: "0xabc" });
  });

  it("throws on malformed input", () => {
    expect(() => parseEvmCaip10("eip155:8453")).toThrow("Invalid CAIP-10 address: eip155:8453");
  });

  it("throws on invalid chain id", () => {
    expect(() => parseEvmCaip10("eip155:abc:0xdead")).toThrow("Invalid chain ID in CAIP-10");
  });
});

describe("normalisePrivateKey", () => {
  it("passes 0x-prefixed keys through unchanged", () => {
    expect(normalisePrivateKey("0xdeadbeef")).toBe("0xdeadbeef");
  });

  it("prepends 0x when missing", () => {
    expect(normalisePrivateKey("deadbeef")).toBe("0xdeadbeef");
  });
});
