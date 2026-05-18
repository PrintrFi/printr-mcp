import { describe, expect, it } from "bun:test";
import {
  type EvmSubmitError,
  formatEvmSubmitError,
  normalisePrivateKey,
  parseEvmCaip10,
  signAndSubmitEvm,
  tryParseEvmCaip10,
} from "./evm.js";

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

describe("formatEvmSubmitError", () => {
  it("renders each variant with its key context", () => {
    expect(formatEvmSubmitError({ kind: "invalid_caip10", input: "bad" })).toContain("bad");
    expect(formatEvmSubmitError({ kind: "no_rpc", caip2: "eip155:8453" })).toContain("eip155:8453");
    expect(formatEvmSubmitError({ kind: "broadcast_failed", message: "boom" })).toContain(
      "broadcast",
    );
    expect(
      formatEvmSubmitError({ kind: "receipt_failed", tx_hash: "0xabc", message: "timeout" }),
    ).toContain("0xabc");
    expect(
      formatEvmSubmitError({ kind: "tx_reverted", tx_hash: "0xabc", block_number: "100" }),
    ).toContain("reverted");
  });
});

describe("signAndSubmitEvm", () => {
  it("returns invalid_caip10 for a malformed `to` address", async () => {
    const result = await signAndSubmitEvm(
      { to: "not-a-caip10", calldata: "0x", value: "0", gas_limit: 21000 },
      "0x" + "0".repeat(64),
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("invalid_caip10");
    }
  });

  it("returns no_rpc when no RPC is configured for the chain", async () => {
    // eip155:99999 is not in CHAIN_META and no env RPC is configured for it.
    const result = await signAndSubmitEvm(
      { to: "eip155:99999:0x0", calldata: "0x", value: "0", gas_limit: 21000 },
      "0x" + "0".repeat(64),
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const err: EvmSubmitError = result.error;
      expect(err.kind).toBe("no_rpc");
      if (err.kind === "no_rpc") {
        expect(err.caip2).toBe("eip155:99999");
      }
    }
  });
});
