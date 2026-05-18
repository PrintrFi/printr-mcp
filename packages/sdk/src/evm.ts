import { err, errAsync, ok, okAsync, type Result, ResultAsync } from "neverthrow";
import { type Address, createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createViemChain, getChainMeta, getRpcUrls } from "./chains.js";
import { ensureHex } from "./hex.js";
import { type RpcInput, withRpcFallback } from "./rpc.js";

const toMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Error returned by {@link tryParseEvmCaip10}. */
export type ParseEvmCaip10Error =
  | { kind: "malformed"; input: string }
  | { kind: "invalid_chain_id"; input: string };

/**
 * Safe parser variant of {@link parseEvmCaip10} — returns a {@link Result}
 * instead of throwing. Prefer this at any boundary where the input is untrusted.
 */
export function tryParseEvmCaip10(
  caip10: string,
): Result<{ chainId: number; address: Address }, ParseEvmCaip10Error> {
  const parts = caip10.split(":");
  if (parts.length < 3) {
    return err({ kind: "malformed", input: caip10 });
  }
  const chainId = Number(parts[1]);
  const address = parts.slice(2).join(":") as Address;
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return err({ kind: "invalid_chain_id", input: caip10 });
  }
  return ok({ chainId, address });
}

/**
 * Parse chain ID and address from a CAIP-10 string (e.g. `"eip155:8453:0x..."`).
 * Throws on malformed input — prefer {@link tryParseEvmCaip10} for untrusted input.
 */
export function parseEvmCaip10(caip10: string): { chainId: number; address: Address } {
  return tryParseEvmCaip10(caip10).match(
    (parsed) => parsed,
    (e) => {
      const reason =
        e.kind === "malformed" ? "Invalid CAIP-10 address" : "Invalid chain ID in CAIP-10";
      throw new Error(`${reason}: ${e.input}`);
    },
  );
}

/** Normalise a hex private key to have a 0x prefix */
export function normalisePrivateKey(key: string): Hex {
  return key.startsWith("0x") ? (key as Hex) : `0x${key}`;
}

export type EvmPayload = {
  to: string;
  calldata: string;
  value: string;
  gas_limit: number;
};

export type EvmSubmitResult = {
  tx_hash: Hex;
  block_number: string;
  status: "success" | "reverted";
};

/** Discriminated error union returned by {@link signAndSubmitEvm}. */
export type EvmSubmitError =
  | { kind: "invalid_caip10"; input: string }
  | { kind: "no_rpc"; caip2: string }
  | { kind: "signing_failed"; message: string }
  | { kind: "broadcast_failed"; message: string }
  | { kind: "receipt_failed"; tx_hash: Hex; message: string }
  | { kind: "tx_reverted"; tx_hash: Hex; block_number: string };

/** Render an {@link EvmSubmitError} into a human-readable message. */
export function formatEvmSubmitError(e: EvmSubmitError): string {
  switch (e.kind) {
    case "invalid_caip10":
      return `Invalid CAIP-10 address: ${e.input}`;
    case "no_rpc":
      return `No RPC URL for chain ${e.caip2}. Pass rpc_url explicitly or set RPC_URLS.`;
    case "signing_failed":
      return `EVM signing failed: ${e.message}`;
    case "broadcast_failed":
      return `Transaction broadcast failed: ${e.message}`;
    case "receipt_failed":
      return `Transaction receipt fetch failed (tx ${e.tx_hash}): ${e.message}`;
    case "tx_reverted":
      return `Transaction reverted: ${e.tx_hash} (block ${e.block_number})`;
  }
}

/**
 * Sign an EVM transaction payload with `privateKey`, broadcast it, and wait for the receipt.
 *
 * `rpcUrl` may be a single URL or an ordered priority list — on transport-level
 * failures the call retries the next URL (see {@link withRpcFallback}). Resolves
 * RPC from chain metadata when omitted.
 *
 * Returns a {@link ResultAsync} with a discriminated {@link EvmSubmitError} so
 * callers can branch on the failure mode (transport vs on-chain revert vs bad
 * input) without inspecting an error message string.
 *
 * Broadcast and receipt-wait are independent phases, each with its own fallback
 * pass over `urls`. The transaction is therefore broadcast at most once: once a
 * hash is obtained, only the receipt-wait retries against subsequent URLs — the
 * transaction is never re-sent, which would risk nonce reuse or a duplicate.
 */
export function signAndSubmitEvm(
  payload: EvmPayload,
  privateKey: string,
  rpcUrl?: RpcInput,
): ResultAsync<EvmSubmitResult, EvmSubmitError> {
  const parsed = tryParseEvmCaip10(payload.to);
  if (parsed.isErr()) {
    return errAsync({ kind: "invalid_caip10", input: parsed.error.input });
  }
  const { chainId, address: toAddress } = parsed.value;
  const caip2 = `eip155:${chainId}`;
  const meta = getChainMeta(caip2);
  const urls = getRpcUrls(caip2, rpcUrl);
  if (urls.length === 0) {
    return errAsync({ kind: "no_rpc", caip2 });
  }

  let account: ReturnType<typeof privateKeyToAccount>;
  try {
    account = privateKeyToAccount(normalisePrivateKey(privateKey));
  } catch (e) {
    return errAsync({ kind: "signing_failed", message: toMessage(e) });
  }

  const broadcast = (rpc: string): Promise<Hex> =>
    createWalletClient({
      account,
      chain: createViemChain(chainId, rpc, meta),
      transport: http(rpc),
    }).sendTransaction({
      to: toAddress,
      data: ensureHex(payload.calldata),
      value: BigInt(payload.value),
      gas: BigInt(payload.gas_limit),
    });

  const waitReceipt = (hash: Hex) => (rpc: string) =>
    createPublicClient({
      chain: createViemChain(chainId, rpc, meta),
      transport: http(rpc),
    }).waitForTransactionReceipt({ hash });

  return ResultAsync.fromPromise(
    withRpcFallback(urls, broadcast),
    (e): EvmSubmitError => ({ kind: "broadcast_failed", message: toMessage(e) }),
  ).andThen((hash) =>
    ResultAsync.fromPromise(
      withRpcFallback(urls, waitReceipt(hash)),
      (e): EvmSubmitError => ({
        kind: "receipt_failed",
        tx_hash: hash,
        message: toMessage(e),
      }),
    ).andThen<EvmSubmitResult, EvmSubmitError>((receipt) =>
      receipt.status === "reverted"
        ? errAsync({
            kind: "tx_reverted",
            tx_hash: hash,
            block_number: String(receipt.blockNumber),
          })
        : okAsync({
            tx_hash: hash,
            block_number: String(receipt.blockNumber),
            status: "success",
          }),
    ),
  );
}
