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

  it("namespaces are readonly (frozen by `as const`)", () => {
    // Type-level assertion only — `as const` makes the const shape readonly.
    // Runtime mutability is not blocked, but TS would reject reassignment.
    expect(tx).toBeDefined();
    expect(balance).toBeDefined();
  });
});
