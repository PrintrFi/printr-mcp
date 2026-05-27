import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getChainMeta } from "./chains.js";
import { executeTokenTransfer, executeTransfer } from "./transfer.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE = getChainMeta("eip155:8453");
if (!BASE) {
  throw new Error("Base chain meta missing");
}

const SOLANA = getChainMeta("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
if (!SOLANA) {
  throw new Error("Solana mainnet chain meta missing");
}

// 32-byte hex private key (test fixture — not a real wallet).
const FAKE_EVM_KEY = `0x${"11".repeat(32)}`;
// Base58-encoded zero key (placeholder; pure-validation tests never sign).
const FAKE_SVM_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

type FetchHandler = (req: { url: string; body: unknown }) => unknown;

let originalFetch: typeof globalThis.fetch;
let lastRequest: { url: string; body: unknown } | undefined;
let fetchCalls = 0;

function stubFetch(handler: FetchHandler): void {
  fetchCalls = 0;
  const stub: typeof globalThis.fetch = async (input, init) => {
    fetchCalls += 1;
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    lastRequest = { url, body };
    const result = handler({ url, body });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body?.id ?? 1, result }), {
      headers: { "content-type": "application/json" },
    });
  };
  stub.preconnect = () => undefined;
  globalThis.fetch = stub;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  lastRequest = undefined;
  fetchCalls = 0;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// executeTokenTransfer — pre-flight validation (no network)
// ---------------------------------------------------------------------------

describe("executeTokenTransfer — pre-flight validation", () => {
  it("rejects an invalid CAIP-10 token id without making any RPC call", async () => {
    stubFetch(() => {
      throw new Error("unexpected RPC call");
    });

    const result = await executeTokenTransfer(
      "eip155",
      "8453",
      "0xrecipient",
      "not-a-caip10",
      "1",
      FAKE_EVM_KEY,
      BASE,
      "https://rpc.test",
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/Invalid CAIP-10 token/);
    expect(fetchCalls).toBe(0);
  });

  it("rejects a CAIP-10 token whose chain doesn't match the recipient chain", async () => {
    stubFetch(() => {
      throw new Error("unexpected RPC call");
    });

    // Token on Ethereum mainnet (eip155:1), recipient on Base (eip155:8453).
    const result = await executeTokenTransfer(
      "eip155",
      "8453",
      "0xrecipient",
      "eip155:1:0xtokenOnMainnet",
      "1",
      FAKE_EVM_KEY,
      BASE,
      "https://rpc.test",
    );

    expect(result.isErr()).toBe(true);
    const message = result._unsafeUnwrapErr().message;
    expect(message).toMatch(/Token chain mismatch/);
    expect(message).toMatch(/eip155:1/);
    expect(message).toMatch(/eip155:8453/);
    expect(fetchCalls).toBe(0);
  });

  it("rejects a Solana token sent to an EVM chain", async () => {
    stubFetch(() => {
      throw new Error("unexpected RPC call");
    });

    const result = await executeTokenTransfer(
      "eip155",
      "8453",
      "0xrecipient",
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:mintAddress",
      "1",
      FAKE_EVM_KEY,
      BASE,
      "https://rpc.test",
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/chain mismatch/i);
    expect(fetchCalls).toBe(0);
  });

  it("rejects an EVM token sent to a Solana chain", async () => {
    stubFetch(() => {
      throw new Error("unexpected RPC call");
    });

    const result = await executeTokenTransfer(
      "solana",
      "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "recipientPubkey",
      "eip155:8453:0xUsdc",
      "1",
      FAKE_SVM_KEY,
      SOLANA,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/chain mismatch/i);
    expect(fetchCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// executeTransfer — EVM RPC resolution
// ---------------------------------------------------------------------------

describe("executeTransfer — RPC resolution", () => {
  it("returns a clear error when no RPC URL is configured for an EVM chain", async () => {
    stubFetch(() => {
      throw new Error("unexpected RPC call");
    });

    // Use an EVM chain we don't have in CHAIN_META and don't pass an override.
    // 999_999_999 is reserved-for-private-use and won't match any default RPC mapping.
    const result = await executeTransfer(
      "eip155",
      "999999999",
      "0xrecipient",
      "0.001",
      FAKE_EVM_KEY,
      BASE,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/No RPC URL/);
    expect(fetchCalls).toBe(0);
  });

  it("accepts an rpcOverride and routes the EVM transfer to it", async () => {
    // Bail on the first request — we only care that some viem read lands on
    // the override URL, not which RPC method it happens to pick.
    stubFetch(() => {
      throw new Error("simulated rpc disconnect");
    });

    const result = await executeTransfer(
      "eip155",
      "8453",
      "0x0000000000000000000000000000000000000001",
      "0.001",
      FAKE_EVM_KEY,
      BASE,
      "https://evm-override.test",
    );

    expect(result.isErr()).toBe(true);
    expect(fetchCalls).toBeGreaterThan(0);
    // viem's HTTP transport normalises the URL with a trailing slash.
    expect(lastRequest?.url.startsWith("https://evm-override.test")).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/rpc disconnect|HTTP|fetch/i);
  });
});
