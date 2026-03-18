import { describe, expect, it } from "bun:test";
import { isHttpOnlyRpc } from "./svm.js";

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
