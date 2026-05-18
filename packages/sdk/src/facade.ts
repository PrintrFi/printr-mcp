/**
 * Namespaced ergonomic facade for the SDK's signing/balance surface.
 *
 * Wraps the existing free functions in {@link "./transfer.js"} and
 * {@link "./balance.js"} with single-params-object signatures, CAIP-2 chain
 * ids in place of `(namespace, chainRef)` pairs, and internal `ChainMeta`
 * resolution. Use these in place of the long positional signatures when
 * possible.
 *
 * @example
 * ```ts
 * import { tx, balance } from "@printr/sdk";
 *
 * await tx.native.send({
 *   chain: "eip155:8453",
 *   to: "0x...",
 *   amount: "0.01",
 *   privateKey: env.SIGNER_KEY,
 * });
 *
 * await balance.token.get({
 *   chain: "eip155:8453",
 *   address: "0x...",
 *   token: "eip155:8453:0xA0b8...eB48",
 * });
 * ```
 */

import { errAsync, type ResultAsync } from "neverthrow";
import {
  type BalanceError,
  fetchNativeBalance,
  fetchTokenBalance,
  type SimpleBalanceResult,
} from "./balance.js";
import { parseCaip2, parseCaip10 } from "./caip.js";
import { getChainMeta } from "./chains.js";
import {
  executeTokenTransfer,
  executeTransfer,
  type TransferError,
  type TransferResult,
} from "./transfer.js";

/** Common shape for any operation targeting a specific chain. */
type ChainScopedParams = {
  /** CAIP-2 chain id, e.g. `"eip155:8453"` or `"solana:5eykt..."`. */
  chain: string;
  /** Optional RPC URL override. */
  rpcUrl?: string;
};

/** Params for `tx.native.send`. */
export type SendNativeParams = ChainScopedParams & {
  /** Recipient address (raw, not CAIP-10). */
  to: string;
  /** Human-readable amount, e.g. `"0.01"`. Converted to atomic units internally. */
  amount: string;
  /** Sender private key (hex for EVM, base58 secret key for Solana). */
  privateKey: string;
};

/** Params for `tx.token.send`. */
export type SendTokenParams = SendNativeParams & {
  /** CAIP-10 token id, e.g. `"eip155:8453:0xA0b8..."` — must match `chain`. */
  token: string;
};

/** Params for `balance.native.get`. */
export type GetNativeBalanceParams = ChainScopedParams & {
  /** Wallet address (raw, not CAIP-10). */
  address: string;
};

/** Params for `balance.token.get`. */
export type GetTokenBalanceParams = GetNativeBalanceParams & {
  /** CAIP-10 token id, e.g. `"eip155:8453:0xA0b8..."` — must match `chain`. */
  token: string;
};

const parseChain = (chain: string) => {
  const parsed = parseCaip2(chain);
  if (!parsed) {
    return null;
  }
  const meta = getChainMeta(chain);
  return meta ? { ...parsed, meta } : null;
};

const sendNative = (params: SendNativeParams): ResultAsync<TransferResult, TransferError> => {
  const resolved = parseChain(params.chain);
  if (!resolved) {
    return errAsync({ message: `Unsupported or malformed chain: ${params.chain}` });
  }
  return executeTransfer(
    resolved.namespace,
    resolved.chainRef,
    params.to,
    params.amount,
    params.privateKey,
    resolved.meta,
    params.rpcUrl,
  );
};

const sendToken = (params: SendTokenParams): ResultAsync<TransferResult, TransferError> => {
  const resolved = parseChain(params.chain);
  if (!resolved) {
    return errAsync({ message: `Unsupported or malformed chain: ${params.chain}` });
  }
  return executeTokenTransfer(
    resolved.namespace,
    resolved.chainRef,
    params.to,
    params.token,
    params.amount,
    params.privateKey,
    resolved.meta,
    params.rpcUrl,
  );
};

const getNativeBalance = (
  params: GetNativeBalanceParams,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const resolved = parseChain(params.chain);
  if (!resolved) {
    return errAsync("no_rpc");
  }
  return fetchNativeBalance(
    resolved.namespace,
    resolved.chainRef,
    params.address,
    resolved.meta,
    params.rpcUrl,
  );
};

const getTokenBalance = (
  params: GetTokenBalanceParams,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const resolved = parseChain(params.chain);
  if (!resolved) {
    return errAsync("no_rpc");
  }
  const tokenParts = parseCaip10(params.token);
  if (!tokenParts) {
    return errAsync("no_rpc");
  }
  return fetchTokenBalance(
    resolved.namespace,
    resolved.chainRef,
    tokenParts.address,
    params.address,
    resolved.meta,
    params.rpcUrl,
  );
};

/** Signing / broadcasting operations grouped by asset kind. */
export const tx = {
  native: { send: sendNative },
  token: { send: sendToken },
} as const;

/** Read-only balance queries grouped by asset kind. */
export const balance = {
  native: { get: getNativeBalance },
  token: { get: getTokenBalance },
} as const;
