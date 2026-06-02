import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  fetchNativeBalanceLite,
  fetchTokenBalanceLite,
  formatUnits,
  getEvmNativeBalanceLite,
  getEvmTokenBalanceLite,
  getSplTokenBalanceLite,
  getSvmNativeBalanceLite,
} from "./balance-lite.js";
import { getChainMeta } from "./chains.js";
import type { FetchHandler } from "./test-support.js";

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;
let lastRequest: { url: string; body: unknown } | undefined;

function stubFetch(handler: FetchHandler): void {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    lastRequest = { url, body };
    const result = handler({ url, body });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      headers: { "content-type": "application/json" },
    });
  };
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  lastRequest = undefined;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// formatUnits
// ---------------------------------------------------------------------------

describe("formatUnits", () => {
  it.each([
    [0n, 18, "0"],
    [1n, 0, "1"],
    [123n, 0, "123"],
    [1_000_000_000_000_000_000n, 18, "1"],
    [1_500_000_000_000_000_000n, 18, "1.5"],
    [123_456n, 6, "0.123456"],
    [1n, 9, "0.000000001"],
    [-1_500_000_000_000_000_000n, 18, "-1.5"],
  ])("formatUnits(%p, %p) === %p", (value, decimals, expected) => {
    expect(formatUnits(value, decimals)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// EVM native
// ---------------------------------------------------------------------------

describe("getEvmNativeBalanceLite", () => {
  const base = getChainMeta("eip155:8453");
  if (!base) {
    throw new Error("Base chain meta missing");
  }

  it("decodes hex balance and formats with chain decimals", async () => {
    stubFetch(() => "0x0de0b6b3a7640000"); // 1e18 wei
    const result = await getEvmNativeBalanceLite("0xabc", "https://rpc.test", base);
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("1000000000000000000");
    expect(value.balance_formatted).toBe("1");
    expect(value.decimals).toBe(18);
    expect(value.symbol).toBe(base.symbol);
    expect(lastRequest?.body).toMatchObject({
      method: "eth_getBalance",
      params: ["0xabc", "latest"],
    });
  });

  it("returns fetch_failed when the RPC errors out", async () => {
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    const result = await getEvmNativeBalanceLite("0xabc", "https://rpc.test", base);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe("fetch_failed");
  });
});

// ---------------------------------------------------------------------------
// EVM ERC-20
// ---------------------------------------------------------------------------

describe("getEvmTokenBalanceLite", () => {
  const base = getChainMeta("eip155:8453");
  if (!base) {
    throw new Error("Base chain meta missing");
  }

  it("decodes balance, decimals, and symbol from three eth_call results", async () => {
    // 100.5 USDC at 6 decimals = 100_500_000 atomic
    const balanceHex = `0x${100_500_000n.toString(16).padStart(64, "0")}`;
    const decimalsHex = `0x${(6).toString(16).padStart(64, "0")}`;
    // ABI string "USDC": offset=0x20, length=4, payload=USDC right-padded to 32 bytes
    const symbolHex = `0x${"20".padStart(64, "0")}${"4".padStart(64, "0")}${Buffer.from("USDC").toString("hex").padEnd(64, "0")}`;
    let call = 0;
    stubFetch(() => {
      const responses = [balanceHex, decimalsHex, symbolHex];
      return responses[call++];
    });

    const result = await getEvmTokenBalanceLite("0xtoken", "0xwallet", "https://rpc.test", base);
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("100500000");
    expect(value.balance_formatted).toBe("100.5");
    expect(value.decimals).toBe(6);
    expect(value.symbol).toBe("USDC");
  });

  it("falls back to chain meta symbol when symbol() returns nothing", async () => {
    const balanceHex = `0x${1n.toString(16).padStart(64, "0")}`;
    const decimalsHex = `0x${(18).toString(16).padStart(64, "0")}`;
    let call = 0;
    stubFetch(() => {
      const responses = [balanceHex, decimalsHex, "0x"];
      return responses[call++];
    });
    const result = await getEvmTokenBalanceLite("0xtoken", "0xwallet", "https://rpc.test", base);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().symbol).toBe(base.symbol);
  });

  it("falls back to chain meta symbol when symbol() RPC errors out", async () => {
    // Older tokens (MKR, etc.) revert `symbol()` — keep balance + decimals
    // available with a meta-driven symbol instead of failing the whole call.
    const balanceHex = `0x${42n.toString(16).padStart(64, "0")}`;
    const decimalsHex = `0x${(18).toString(16).padStart(64, "0")}`;
    let call = 0;
    const stub: typeof globalThis.fetch = async (_, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const responses = [balanceHex, decimalsHex];
      const current = call++;
      if (current === 2) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "execution reverted" },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: body?.id ?? 1, result: responses[current] }),
        { headers: { "content-type": "application/json" } },
      );
    };
    // Bun's `fetch` type requires a `preconnect` field; tests never exercise it.
    stub.preconnect = () => undefined;
    globalThis.fetch = stub;

    const result = await getEvmTokenBalanceLite("0xtoken", "0xwallet", "https://rpc.test", base);
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("42");
    expect(value.decimals).toBe(18);
    expect(value.symbol).toBe(base.symbol);
  });
});

// ---------------------------------------------------------------------------
// fetch* dispatch — caip2 routing
// ---------------------------------------------------------------------------

describe("fetchNativeBalanceLite", () => {
  const base = getChainMeta("eip155:8453");
  if (!base) {
    throw new Error("Base chain meta missing");
  }

  it("routes EVM requests through the chainRef-derived RPC", async () => {
    stubFetch(() => "0x01");
    const result = await fetchNativeBalanceLite(
      "eip155",
      "8453",
      "0xabc",
      base,
      "https://evm.test",
    );
    expect(result.isOk()).toBe(true);
    expect(lastRequest?.url).toBe("https://evm.test");
  });

  it("uses the rpcOverride for solana regardless of chainRef", async () => {
    // chainRef passes through toCaip2 → "solana:<chainRef>", and
    // rpcOverride wins over any chains.ts mapping. The dispatcher must
    // honor it instead of hardcoding a mainnet endpoint.
    stubFetch(() => ({ context: { slot: 1 }, value: 1_000_000_000 }));
    const result = await fetchNativeBalanceLite(
      "solana",
      "EtWTRABZaYq6iMfeYKouRu166VU2iUKtZ9aP1tfgexcq", // devnet genesis
      "addr",
      base,
      "https://devnet.test",
    );
    expect(result.isOk()).toBe(true);
    expect(lastRequest?.url).toBe("https://devnet.test");
  });
});

describe("fetchTokenBalanceLite", () => {
  const base = getChainMeta("eip155:8453");
  if (!base) {
    throw new Error("Base chain meta missing");
  }

  it("uses the rpcOverride for solana regardless of chainRef", async () => {
    stubFetch(() => ({ context: { slot: 1 }, value: [] }));
    const result = await fetchTokenBalanceLite(
      "solana",
      "EtWTRABZaYq6iMfeYKouRu166VU2iUKtZ9aP1tfgexcq",
      "mint",
      "wallet",
      base,
      "https://devnet.test",
    );
    expect(result.isOk()).toBe(true);
    expect(lastRequest?.url).toBe("https://devnet.test");
  });
});

// ---------------------------------------------------------------------------
// Solana native
// ---------------------------------------------------------------------------

describe("getSvmNativeBalanceLite", () => {
  it("returns lamport balance formatted with 9 decimals", async () => {
    stubFetch(() => ({ context: { slot: 1 }, value: 1_500_000_000 })); // 1.5 SOL
    const result = await getSvmNativeBalanceLite("addr", "https://svm.test");
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("1500000000");
    expect(value.balance_formatted).toBe("1.5");
    expect(value.symbol).toBe("SOL");
    expect(value.decimals).toBe(9);
  });

  it("returns fetch_failed when the response shape is wrong", async () => {
    stubFetch(() => ({ unexpected: true }));
    const result = await getSvmNativeBalanceLite("addr", "https://svm.test");
    expect(result.isErr()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SPL
// ---------------------------------------------------------------------------

describe("getSplTokenBalanceLite", () => {
  it("returns the first token account's balance", async () => {
    stubFetch(() => ({
      context: { slot: 1 },
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: { amount: "123456", decimals: 6 },
                },
              },
            },
          },
        },
      ],
    }));
    const result = await getSplTokenBalanceLite("mint", "wallet", "https://svm.test");
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("123456");
    expect(value.balance_formatted).toBe("0.123456");
    expect(value.decimals).toBe(6);
  });

  it("returns zero when no token account exists for the mint", async () => {
    stubFetch(() => ({ context: { slot: 1 }, value: [] }));
    const result = await getSplTokenBalanceLite("mint", "wallet", "https://svm.test");
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.balance_atomic).toBe("0");
    expect(value.balance_formatted).toBe("0");
    expect(value.decimals).toBe(0);
  });
});
