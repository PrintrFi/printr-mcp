import { describe, expect, it } from "bun:test";
import { formatCaip10, parseCaip10, StakingLockPeriod } from "./staking-api.js";

describe("staking-api parseCaip10", () => {
  it("parses EVM CAIP-10", () => {
    expect(parseCaip10("eip155:8453:0xabc123")).toEqual({
      chainId: "eip155:8453",
      address: "0xabc123",
    });
  });

  it("parses Solana CAIP-10", () => {
    const addr = "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv";
    expect(parseCaip10(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${addr}`)).toEqual({
      chainId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      address: addr,
    });
  });

  it("throws on missing address", () => {
    expect(() => parseCaip10("eip155:8453")).toThrow("Invalid CAIP-10");
  });

  it("throws on plain string", () => {
    expect(() => parseCaip10("nonsense")).toThrow("Invalid CAIP-10");
  });
});

describe("staking-api formatCaip10", () => {
  it("joins chainId and address", () => {
    expect(formatCaip10({ chainId: "eip155:8453", address: "0xabc" })).toBe("eip155:8453:0xabc");
  });

  it("is inverse of parseCaip10", () => {
    const original = "eip155:1:0xdeadbeef";
    expect(formatCaip10(parseCaip10(original))).toBe(original);
  });
});

describe("StakingLockPeriod", () => {
  it("re-exports the enum", () => {
    expect(StakingLockPeriod.SEVEN_DAYS).toBeDefined();
    expect(StakingLockPeriod.THIRTY_DAYS).toBeDefined();
  });
});
