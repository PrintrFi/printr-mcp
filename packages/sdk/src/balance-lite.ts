/**
 * Fetch-only balance queries — drop-in alternative to `@printr/sdk/balance`
 * that doesn't pull `@solana/web3.js` (~600 KB minified) or `viem` (~370 KB)
 * into a consumer bundle. Same `SimpleBalanceResult` and `BalanceError`
 * shapes as the heavy variant, so swapping is mechanical.
 *
 * Trade-off: no contract typings, no batching, no provider abstraction.
 * Use the heavy variant in `@printr/sdk/balance` when those matter.
 *
 * @module @printr/sdk/balance-lite
 */
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { ChainMeta } from "./chains.js";
import { getRpcUrl, toCaip2 } from "./chains.js";

export type SimpleBalanceResult = {
  readonly balance_atomic: string;
  readonly balance_formatted: string;
  readonly symbol: string;
  readonly decimals: number;
};

export type BalanceError = "no_rpc" | "fetch_failed" | "chain_mismatch";

const DEFAULT_SVM_RPC = "https://api.mainnet-beta.solana.com";

// ERC-20 ABI function selectors (first 4 bytes of keccak256(signature)).
const SELECTOR_BALANCE_OF = "0x70a08231";
const SELECTOR_DECIMALS = "0x313ce567";
const SELECTOR_SYMBOL = "0x95d89b41";

// ---------------------------------------------------------------------------
// JSON-RPC plumbing
// ---------------------------------------------------------------------------

const RpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

function rpcCall(rpcUrl: string, method: string, params: readonly unknown[]) {
  return ResultAsync.fromPromise(
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }).then((r) => r.json()),
    (): BalanceError => "fetch_failed",
  ).andThen((raw) => {
    const parsed = RpcResponseSchema.safeParse(raw);
    if (!parsed.success || parsed.data.error || parsed.data.result === undefined) {
      return err<unknown, BalanceError>("fetch_failed");
    }
    return ok(parsed.data.result);
  });
}

// ---------------------------------------------------------------------------
// Pure helpers (no Node deps)
// ---------------------------------------------------------------------------

/**
 * Format an atomic-units bigint as a human-readable decimal string with
 * trailing zeros trimmed. Mirrors viem's `formatUnits` for the values we
 * care about without pulling viem into the bundle.
 */
export function formatUnits(value: bigint, decimals: number): string {
  if (decimals === 0) {
    return value.toString();
  }
  const s = value.toString();
  const negative = s.startsWith("-");
  const digits = negative ? s.slice(1) : s;
  const padded = digits.padStart(decimals + 1, "0");
  const i = padded.length - decimals;
  const int = padded.slice(0, i);
  const frac = padded.slice(i).replace(/0+$/, "");
  const body = frac ? `${int}.${frac}` : int;
  return negative ? `-${body}` : body;
}

function stripHexPrefix(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

function pad32(addressHex: string): string {
  return stripHexPrefix(addressHex).toLowerCase().padStart(64, "0");
}

function encodeBalanceOf(addr: string): string {
  return `${SELECTOR_BALANCE_OF}${pad32(addr)}`;
}

function decodeUint(hex: string): bigint {
  const stripped = stripHexPrefix(hex);
  return stripped.length === 0 ? 0n : BigInt(`0x${stripped}`);
}

/**
 * Decode an ABI-encoded `string` return value. Falls back to bytes32 decoding
 * (older ERC-20s like MKR return a fixed-size bytes32 instead of `string`);
 * returns an empty string if neither shape matches.
 */
function decodeAbiString(hex: string): string {
  const data = stripHexPrefix(hex);
  if (data.length === 0) {
    return "";
  }

  // Dynamic string: offset (32 bytes) + length (32 bytes) + UTF-8 payload.
  if (data.length >= 128) {
    const length = Number(BigInt(`0x${data.slice(64, 128)}`));
    const start = 128;
    const end = start + length * 2;
    if (length > 0 && data.length >= end) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = Number.parseInt(data.slice(start + i * 2, start + i * 2 + 2), 16);
      }
      return new TextDecoder().decode(bytes);
    }
  }

  // bytes32 fallback: 32-byte right-padded ASCII.
  if (data.length === 64) {
    const bytes: number[] = [];
    for (let i = 0; i < 64; i += 2) {
      const byte = Number.parseInt(data.slice(i, i + 2), 16);
      if (byte === 0) {
        break;
      }
      bytes.push(byte);
    }
    return String.fromCharCode(...bytes);
  }

  return "";
}

/**
 * Resolve an RPC URL for a CAIP-2 chain, preferring `rpcOverride`. Returns
 * a Solana mainnet default when the namespace is `solana:` and nothing else
 * is configured; otherwise `no_rpc` if no endpoint is known.
 */
export function resolveRpcUrlLite(caip2: string, rpcOverride?: string) {
  if (caip2.startsWith("solana:")) {
    return ok(getRpcUrl(caip2, rpcOverride) ?? DEFAULT_SVM_RPC);
  }
  const resolved = getRpcUrl(caip2, rpcOverride);
  return resolved ? ok(resolved) : err<string, BalanceError>("no_rpc");
}

// ---------------------------------------------------------------------------
// EVM
// ---------------------------------------------------------------------------

function ethCall(rpcUrl: string, to: string, data: string) {
  return rpcCall(rpcUrl, "eth_call", [{ to, data }, "latest"]).andThen((raw) =>
    typeof raw === "string" ? ok(raw) : err<string, BalanceError>("fetch_failed"),
  );
}

/** Read native gas-token balance on an EVM chain via `eth_getBalance`. */
export function getEvmNativeBalanceLite(
  address: `0x${string}`,
  rpcUrl: string,
  meta: ChainMeta,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  return rpcCall(rpcUrl, "eth_getBalance", [address, "latest"])
    .andThen((raw) =>
      typeof raw === "string" ? ok(decodeUint(raw)) : err<bigint, BalanceError>("fetch_failed"),
    )
    .map((balance) => ({
      balance_atomic: balance.toString(),
      balance_formatted: formatUnits(balance, meta.decimals),
      symbol: meta.symbol,
      decimals: meta.decimals,
    }));
}

/**
 * Read ERC-20 balance, decimals, and symbol via three parallel `eth_call`s.
 * Falls back to the chain's native symbol if the token's `symbol()` reverts
 * or returns nothing.
 */
export function getEvmTokenBalanceLite(
  tokenAddress: `0x${string}`,
  walletAddress: `0x${string}`,
  rpcUrl: string,
  meta: ChainMeta,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  // `symbol()` is non-fatal: many older / proxy tokens revert it. Recover the
  // symbol leg to "0x" before `combine` so a symbol-only revert still yields
  // balance + decimals; the meta-driven fallback applies in `.map`.
  return ResultAsync.combine([
    ethCall(rpcUrl, tokenAddress, encodeBalanceOf(walletAddress)),
    ethCall(rpcUrl, tokenAddress, SELECTOR_DECIMALS),
    ethCall(rpcUrl, tokenAddress, SELECTOR_SYMBOL).orElse(() => ok<string, BalanceError>("0x")),
  ]).map(([balanceHex, decimalsHex, symbolHex]) => {
    const balance = decodeUint(balanceHex);
    const decimals = Number(decodeUint(decimalsHex));
    const symbol = decodeAbiString(symbolHex) || meta.symbol;
    return {
      balance_atomic: balance.toString(),
      balance_formatted: formatUnits(balance, decimals),
      symbol,
      decimals,
    };
  });
}

// ---------------------------------------------------------------------------
// Solana
// ---------------------------------------------------------------------------

const SvmGetBalanceSchema = z.object({ value: z.number() });

const SvmTokenAccountsSchema = z.object({
  value: z.array(
    z.object({
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              tokenAmount: z.object({
                amount: z.string(),
                decimals: z.number(),
              }),
            }),
          }),
        }),
      }),
    }),
  ),
});

/** Read native SOL balance via the `getBalance` JSON-RPC method. */
export function getSvmNativeBalanceLite(
  address: string,
  rpcUrl: string,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  return rpcCall(rpcUrl, "getBalance", [address]).andThen((raw) => {
    const parsed = SvmGetBalanceSchema.safeParse(raw);
    if (!parsed.success) {
      return err<SimpleBalanceResult, BalanceError>("fetch_failed");
    }
    const lamports = BigInt(parsed.data.value);
    return ok({
      balance_atomic: lamports.toString(),
      balance_formatted: formatUnits(lamports, 9),
      symbol: "SOL",
      decimals: 9,
    });
  });
}

/**
 * Read SPL token balance from the wallet's first associated token account
 * via `getTokenAccountsByOwner`. Returns zero balance when no account exists
 * for the mint.
 */
export function getSplTokenBalanceLite(
  mintAddress: string,
  walletAddress: string,
  rpcUrl: string,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  return rpcCall(rpcUrl, "getTokenAccountsByOwner", [
    walletAddress,
    { mint: mintAddress },
    { encoding: "jsonParsed" },
  ]).andThen((raw) => {
    const parsed = SvmTokenAccountsSchema.safeParse(raw);
    if (!parsed.success) {
      return err<SimpleBalanceResult, BalanceError>("fetch_failed");
    }
    const first = parsed.data.value[0];
    if (!first) {
      return ok({ balance_atomic: "0", balance_formatted: "0", symbol: "SPL", decimals: 0 });
    }
    const { amount, decimals } = first.account.data.parsed.info.tokenAmount;
    return ok({
      balance_atomic: amount,
      balance_formatted: formatUnits(BigInt(amount), decimals),
      symbol: "SPL",
      decimals,
    });
  });
}

// ---------------------------------------------------------------------------
// Chain-agnostic dispatch
// ---------------------------------------------------------------------------

/**
 * Chain-agnostic native balance fetch. Dispatches to
 * {@link getSvmNativeBalanceLite} or {@link getEvmNativeBalanceLite}
 * based on namespace.
 */
export function fetchNativeBalanceLite(
  namespace: "eip155" | "solana",
  chainRef: string,
  address: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  const caip2 = toCaip2(namespace, chainRef);
  const rpcResult = resolveRpcUrlLite(caip2, rpcOverride);
  if (rpcResult.isErr()) {
    return errAsync(rpcResult.error);
  }
  return namespace === "solana"
    ? getSvmNativeBalanceLite(address, rpcResult.value)
    : getEvmNativeBalanceLite(address as `0x${string}`, rpcResult.value, meta);
}

/**
 * Chain-agnostic token balance fetch. Dispatches to
 * {@link getSplTokenBalanceLite} or {@link getEvmTokenBalanceLite} based on
 * namespace.
 */
export function fetchTokenBalanceLite(
  namespace: "eip155" | "solana",
  chainRef: string,
  tokenAddress: string,
  walletAddress: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<SimpleBalanceResult, BalanceError> {
  const caip2 = toCaip2(namespace, chainRef);
  const rpcResult = resolveRpcUrlLite(caip2, rpcOverride);
  if (rpcResult.isErr()) {
    return errAsync(rpcResult.error);
  }
  return namespace === "solana"
    ? getSplTokenBalanceLite(tokenAddress, walletAddress, rpcResult.value)
    : getEvmTokenBalanceLite(
        tokenAddress as `0x${string}`,
        walletAddress as `0x${string}`,
        rpcResult.value,
        meta,
      );
}
