import { describe, expect, it } from "bun:test";
import {
  formatCaip10,
  parseCaip10,
  parseLockPeriod,
  StakingLockPeriod,
  tryParseLockPeriod,
} from "./staking-api.js";

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

describe("parseLockPeriod", () => {
  it("maps short form labels", () => {
    expect(parseLockPeriod("7_DAYS")).toBe(StakingLockPeriod.SEVEN_DAYS);
    expect(parseLockPeriod("14_DAYS")).toBe(StakingLockPeriod.FOURTEEN_DAYS);
    expect(parseLockPeriod("30_DAYS")).toBe(StakingLockPeriod.THIRTY_DAYS);
    expect(parseLockPeriod("60_DAYS")).toBe(StakingLockPeriod.SIXTY_DAYS);
    expect(parseLockPeriod("90_DAYS")).toBe(StakingLockPeriod.NINETY_DAYS);
    expect(parseLockPeriod("180_DAYS")).toBe(StakingLockPeriod.ONE_HUNDRED_EIGHTY_DAYS);
    expect(parseLockPeriod("10_SECONDS")).toBe(StakingLockPeriod.TEN_SECONDS);
  });

  it("maps long form labels", () => {
    expect(parseLockPeriod("SEVEN_DAYS")).toBe(StakingLockPeriod.SEVEN_DAYS);
    expect(parseLockPeriod("ONE_HUNDRED_EIGHTY_DAYS")).toBe(
      StakingLockPeriod.ONE_HUNDRED_EIGHTY_DAYS,
    );
  });

  it("throws on unknown values", () => {
    expect(() => parseLockPeriod("FIVE_DAYS")).toThrow("Invalid lock period");
  });
});

describe("tryParseLockPeriod", () => {
  it("returns ok for known short-form labels", () => {
    const result = tryParseLockPeriod("7_DAYS");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(StakingLockPeriod.SEVEN_DAYS);
    }
  });

  it("returns ok for long-form labels", () => {
    const result = tryParseLockPeriod("ONE_HUNDRED_EIGHTY_DAYS");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(StakingLockPeriod.ONE_HUNDRED_EIGHTY_DAYS);
    }
  });

  it("returns err with the raw input for unknown values", () => {
    const result = tryParseLockPeriod("FIVE_DAYS");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ kind: "invalid_lock_period", input: "FIVE_DAYS" });
    }
  });
});
