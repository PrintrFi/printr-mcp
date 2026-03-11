import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CHAIN_META, caip10ToChainId, getChainMeta, getRpcUrl } from "./chains.js";
import { env } from "./env.js";

describe("getChainMeta", () => {
  test("returns metadata for known chains", () => {
    expect(getChainMeta("eip155:8453")).toEqual({
      name: "Base",
      symbol: "ETH",
      decimals: 18,
      defaultRpc: "https://mainnet.base.org",
    });
  });

  test("returns undefined for unknown chains", () => {
    expect(getChainMeta("eip155:99999")).toBeUndefined();
  });
});

describe("caip10ToChainId", () => {
  test("extracts EVM chain ID", () => {
    expect(caip10ToChainId("eip155:8453:0xabc")).toBe("eip155:8453");
  });

  test("extracts Solana chain ID", () => {
    expect(caip10ToChainId("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:pubkey")).toBe(
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
  });
});

describe("getRpcUrl", () => {
  let originalRpcUrls: Record<string, string>;

  beforeEach(() => {
    originalRpcUrls = { ...env.RPC_URLS };
  });

  afterEach(() => {
    // Reset RPC_URLS to original state
    for (const key of Object.keys(env.RPC_URLS)) {
      delete env.RPC_URLS[key];
    }
    for (const [key, value] of Object.entries(originalRpcUrls)) {
      env.RPC_URLS[key] = value;
    }
  });

  test("returns explicit override first", () => {
    const override = "https://custom-rpc.example.com";
    expect(getRpcUrl("eip155:8453", override)).toBe(override);
  });

  test("returns user-configured RPC by CAIP-2", () => {
    const userRpc = "https://alchemy-base.example.com";
    env.RPC_URLS["eip155:8453"] = userRpc;
    expect(getRpcUrl("eip155:8453")).toBe(userRpc);
  });

  test("returns user-configured RPC by chain name", () => {
    const userRpc = "https://alchemy-base.example.com";
    env.RPC_URLS.base = userRpc;
    expect(getRpcUrl("eip155:8453")).toBe(userRpc);
  });

  test("returns user-configured RPC by chain name for Solana", () => {
    const userRpc = "https://helius-solana.example.com";
    env.RPC_URLS.solana = userRpc;
    expect(getRpcUrl("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(userRpc);
  });

  test("user-configured RPC takes precedence over default", () => {
    const userRpc = "https://alchemy-base.example.com";
    env.RPC_URLS.base = userRpc;
    // Should NOT return the default "https://mainnet.base.org"
    expect(getRpcUrl("eip155:8453")).toBe(userRpc);
  });

  test("explicit override takes precedence over user-configured RPC", () => {
    const override = "https://per-call-override.example.com";
    env.RPC_URLS.base = "https://user-configured.example.com";
    expect(getRpcUrl("eip155:8453", override)).toBe(override);
  });

  test("returns default RPC when no overrides configured", () => {
    expect(getRpcUrl("eip155:8453")).toBe("https://mainnet.base.org");
  });

  test("returns undefined for unknown chain with no overrides", () => {
    expect(getRpcUrl("eip155:99999")).toBeUndefined();
  });

  test("returns user-configured RPC for chain without default", () => {
    const userRpc = "https://plasma-rpc.example.com";
    env.RPC_URLS.plasma = userRpc;
    // Plasma (eip155:9745) has no defaultRpc in CHAIN_META
    expect(CHAIN_META["eip155:9745"]?.defaultRpc).toBeUndefined();
    expect(getRpcUrl("eip155:9745")).toBe(userRpc);
  });

  test("returns Alchemy RPC when ALCHEMY_API_KEY is set", () => {
    const originalKey = env.ALCHEMY_API_KEY;
    env.ALCHEMY_API_KEY = "test-alchemy-key";
    try {
      // EVM chains
      expect(getRpcUrl("eip155:1")).toBe("https://eth-mainnet.g.alchemy.com/v2/test-alchemy-key");
      expect(getRpcUrl("eip155:56")).toBe("https://bnb-mainnet.g.alchemy.com/v2/test-alchemy-key");
      expect(getRpcUrl("eip155:130")).toBe(
        "https://unichain-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      expect(getRpcUrl("eip155:999")).toBe(
        "https://hyperliquid-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      expect(getRpcUrl("eip155:5000")).toBe(
        "https://mantle-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      expect(getRpcUrl("eip155:8453")).toBe(
        "https://base-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      expect(getRpcUrl("eip155:42161")).toBe(
        "https://arb-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      expect(getRpcUrl("eip155:43114")).toBe(
        "https://avax-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
      // Solana
      expect(getRpcUrl("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(
        "https://solana-mainnet.g.alchemy.com/v2/test-alchemy-key",
      );
    } finally {
      env.ALCHEMY_API_KEY = originalKey;
    }
  });

  test("RPC_URLS takes precedence over Alchemy", () => {
    const originalKey = env.ALCHEMY_API_KEY;
    env.ALCHEMY_API_KEY = "test-alchemy-key";
    env.RPC_URLS.base = "https://custom-base.example.com";
    try {
      expect(getRpcUrl("eip155:8453")).toBe("https://custom-base.example.com");
    } finally {
      env.ALCHEMY_API_KEY = originalKey;
    }
  });

  test("falls back to default when chain not supported by Alchemy", () => {
    const originalKey = env.ALCHEMY_API_KEY;
    env.ALCHEMY_API_KEY = "test-alchemy-key";
    try {
      // MegaETH is not in ALCHEMY_RPC_TEMPLATES
      expect(getRpcUrl("eip155:4326")).toBe("https://mainnet.megaeth.com/rpc");
    } finally {
      env.ALCHEMY_API_KEY = originalKey;
    }
  });
});
