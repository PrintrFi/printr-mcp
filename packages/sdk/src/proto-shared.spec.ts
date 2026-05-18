import { describe, expect, it } from "bun:test";
import { Account } from "./proto/caip/account_pb.js";
import { formatCaip10, getBackendClient, parseCaip10, toSimpleAccount } from "./proto-shared.js";

describe("parseCaip10", () => {
  it("splits namespace:chainRef:address into { chainId, address }", () => {
    expect(parseCaip10("eip155:8453:0xabc")).toEqual({
      chainId: "eip155:8453",
      address: "0xabc",
    });
    expect(parseCaip10("solana:5eykt:Ez4hEGek")).toEqual({
      chainId: "solana:5eykt",
      address: "Ez4hEGek",
    });
  });

  it("preserves colons inside the address portion", () => {
    expect(parseCaip10("solana:5eykt:addr:with:colons")).toEqual({
      chainId: "solana:5eykt",
      address: "addr:with:colons",
    });
  });

  it("throws on malformed input (< 3 parts)", () => {
    expect(() => parseCaip10("eip155:8453")).toThrow("Invalid CAIP-10: eip155:8453");
    expect(() => parseCaip10("bare")).toThrow();
  });
});

describe("formatCaip10", () => {
  it("joins chainId and address with a colon", () => {
    expect(formatCaip10({ chainId: "eip155:8453", address: "0xabc" })).toBe("eip155:8453:0xabc");
  });

  it("round-trips through parseCaip10", () => {
    const original = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:Ez4hEGekBmzgYYgDuwXW68LNz";
    expect(formatCaip10(parseCaip10(original))).toBe(original);
  });
});

describe("toSimpleAccount", () => {
  it("converts a proto Account into the simple shape", () => {
    const account = new Account({ chainId: "eip155:8453", address: "0xabc" });
    expect(toSimpleAccount(account)).toEqual({
      chainId: "eip155:8453",
      address: "0xabc",
    });
  });

  it("returns undefined for undefined input", () => {
    expect(toSimpleAccount(undefined)).toBeUndefined();
  });
});

describe("getBackendClient", () => {
  it("returns the same singleton on repeated calls", () => {
    const a = getBackendClient();
    const b = getBackendClient();
    expect(a).toBe(b);
  });
});
