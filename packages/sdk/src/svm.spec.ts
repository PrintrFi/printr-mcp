import { describe, expect, it } from "bun:test";
import { formatSvmSubmitError, isHttpOnlyRpc, signAndSubmitSvm } from "./svm.js";

describe("isHttpOnlyRpc", () => {
  it("returns true for Alchemy URLs", () => {
    expect(isHttpOnlyRpc("https://solana-mainnet.g.alchemy.com/v2/xxx")).toBe(true);
    expect(isHttpOnlyRpc("https://eth-mainnet.g.alchemy.com/v2/xxx")).toBe(true);
    expect(isHttpOnlyRpc("https://alchemy.com/some/path")).toBe(true);
  });

  it("returns true for Ankr URLs", () => {
    expect(isHttpOnlyRpc("https://rpc.ankr.com/solana")).toBe(true);
    expect(isHttpOnlyRpc("https://rpc.ankr.com/eth")).toBe(true);
  });

  it("returns false for other RPC providers", () => {
    expect(isHttpOnlyRpc("https://api.mainnet-beta.solana.com")).toBe(false);
    expect(isHttpOnlyRpc("https://solana-api.projectserum.com")).toBe(false);
    expect(isHttpOnlyRpc("https://rpc.helius.xyz")).toBe(false);
    expect(isHttpOnlyRpc("https://mainnet.infura.io/v3/xxx")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isHttpOnlyRpc("https://SOLANA-MAINNET.G.ALCHEMY.COM/v2/xxx")).toBe(true);
    expect(isHttpOnlyRpc("https://RPC.ANKR.COM/solana")).toBe(true);
  });
});

describe("formatSvmSubmitError", () => {
  it("renders each variant with its key context", () => {
    expect(formatSvmSubmitError({ kind: "signing_failed", message: "bad key" })).toContain(
      "bad key",
    );
    expect(formatSvmSubmitError({ kind: "broadcast_failed", message: "boom" })).toContain(
      "broadcast",
    );
    expect(
      formatSvmSubmitError({
        kind: "confirmation_failed",
        signature: "sig123",
        message: "timeout",
      }),
    ).toContain("sig123");
  });
});

describe("signAndSubmitSvm", () => {
  it("returns signing_failed for an invalid base58 private key", async () => {
    const result = await signAndSubmitSvm(
      { ixs: [], mint_address: "solana:abc:mint" },
      "not-valid-base58!!!",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("signing_failed");
    }
  });

  it("returns signing_failed when an instruction has a malformed program_id", async () => {
    // Valid 64-byte secret key (all zeros, base58-encoded) but the instruction
    // has a non-base58 program_id, so PublicKey throws inside the ix map.
    const validKey = "1".repeat(88); // all-zero secret key base58 is mostly 1s
    const result = await signAndSubmitSvm(
      {
        ixs: [{ program_id: "not-valid-base58!!!", accounts: [], data: "" }],
        mint_address: "solana:abc:mint",
      },
      validKey,
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("signing_failed");
    }
  });
});
