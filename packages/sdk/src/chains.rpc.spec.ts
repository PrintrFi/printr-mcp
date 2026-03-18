/**
 * RPC endpoint validation tests.
 * Run with: bun run test:rpc
 *
 * These tests verify that each chain's default RPC endpoint is valid and responsive.
 * Isolated from the main test suite to avoid CI flakiness from network issues.
 */

import { describe, expect, test } from "bun:test";
import { CHAIN_META } from "./chains.js";

const TIMEOUT_MS = 10_000;

type JsonRpcResponse = {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
};

/** Extract numeric chain ID from CAIP-2 identifier (e.g., "eip155:8453" → 8453) */
function extractChainId(caip2: string): number {
  const match = caip2.match(/^eip155:(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/** Convert number to hex string (e.g., 8453 → "0x2105") */
function toHex(n: number): string {
  return `0x${n.toString(16)}`;
}

/** Make a JSON-RPC request */
async function jsonRpc(
  url: string,
  method: string,
  params: unknown[] = [],
): Promise<JsonRpcResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.json();
}

// Build test cases from CHAIN_META (only chains with defaultRpc)
const evmChains = Object.entries(CHAIN_META)
  .filter(([caip2, meta]) => caip2.startsWith("eip155:") && meta.defaultRpc)
  .map(([caip2, meta]) => ({
    caip2,
    name: meta.name,
    rpc: meta.defaultRpc!,
    expectedChainId: toHex(extractChainId(caip2)),
  }));

const solanaChains = Object.entries(CHAIN_META)
  .filter(([caip2, meta]) => caip2.startsWith("solana:") && meta.defaultRpc)
  .map(([caip2, meta]) => ({
    caip2,
    name: meta.name,
    rpc: meta.defaultRpc!,
  }));

describe("EVM RPC endpoints", () => {
  test.each(evmChains)("$name ($caip2) responds with correct chain ID", async ({
    rpc,
    expectedChainId,
  }) => {
    const result = await jsonRpc(rpc, "eth_chainId");

    expect(result.error).toBeUndefined();
    expect(result.result).toBe(expectedChainId);
  });
});

describe("Solana RPC endpoints", () => {
  test.each(solanaChains)("$name ($caip2) is healthy", async ({ rpc }) => {
    const result = await jsonRpc(rpc, "getHealth");

    expect(result.error).toBeUndefined();
    expect(result.result).toBe("ok");
  });
});
