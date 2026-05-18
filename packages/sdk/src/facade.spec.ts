import { describe, expect, it } from "bun:test";
import { balance, tx } from "./facade.js";

describe("tx.native.send", () => {
  it("returns an error for a malformed CAIP-2 chain", async () => {
    const result = await tx.native.send({
      chain: "not-a-caip2",
      to: "0x0000000000000000000000000000000000000000",
      amount: "0.1",
      privateKey: "0x0",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("not-a-caip2");
    }
  });

  it("returns an error for an unsupported chain id", async () => {
    const result = await tx.native.send({
      chain: "eip155:99999",
      to: "0x0000000000000000000000000000000000000000",
      amount: "0.1",
      privateKey: "0x0",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("eip155:99999");
    }
  });
});

describe("tx.token.send", () => {
  it("returns an error for a malformed chain", async () => {
    const result = await tx.token.send({
      chain: "not-a-caip2",
      to: "0x0",
      token: "eip155:8453:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amount: "1",
      privateKey: "0x0",
    });
    expect(result.isErr()).toBe(true);
  });
});

describe("balance.native.get", () => {
  it("returns no_rpc for a malformed chain", async () => {
    const result = await balance.native.get({
      chain: "garbage",
      address: "0x0",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("no_rpc");
    }
  });

  it("returns no_rpc for an unsupported chain", async () => {
    const result = await balance.native.get({
      chain: "eip155:99999",
      address: "0x0",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("no_rpc");
    }
  });
});

describe("balance.token.get", () => {
  it("returns no_rpc for a malformed chain", async () => {
    const result = await balance.token.get({
      chain: "garbage",
      address: "0x0",
      token: "eip155:8453:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("no_rpc");
    }
  });

  it("returns no_rpc for a malformed token id", async () => {
    const result = await balance.token.get({
      chain: "eip155:8453",
      address: "0x0",
      token: "not-a-caip10",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("no_rpc");
    }
  });

  it("returns chain_mismatch when the token's chain differs from params.chain", async () => {
    const result = await balance.token.get({
      chain: "eip155:8453",
      address: "0xabc",
      // Token CAIP-10 references a different chain (eip155:1) than `chain` above.
      token: "eip155:1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe("chain_mismatch");
    }
  });
});

describe("namespace shape", () => {
  it("exposes tx.{native,token}.send", () => {
    expect(typeof tx.native.send).toBe("function");
    expect(typeof tx.token.send).toBe("function");
  });

  it("exposes balance.{native,token}.get", () => {
    expect(typeof balance.native.get).toBe("function");
    expect(typeof balance.token.get).toBe("function");
  });

  it("namespaces have readonly type via `as const` (compile-time only)", () => {
    // `as const` narrows the inferred type to readonly at compile time. It does
    // NOT freeze the object at runtime — this test only checks the namespaces
    // exist; the readonly guarantee is enforced by `tsc`, not at runtime.
    expect(tx).toBeDefined();
    expect(balance).toBeDefined();
  });
});
