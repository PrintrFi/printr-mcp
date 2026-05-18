import {
  type AddressLookupTableAccount,
  type Commitment,
  Connection,
  Keypair,
  PublicKey,
  type Signer,
  type Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { sleep } from "./async.js";
import { getRpcUrl, getRpcUrls } from "./chains.js";
import { type RpcInput, withRpcFallback } from "./rpc.js";

export const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Default public RPC for Solana mainnet */
export const DEFAULT_SVM_RPC = "https://api.mainnet-beta.solana.com";

/** Get the RPC URL for Solana, respecting RPC_URLS config */
export const getSvmRpcUrl = (rpcOverride?: string): string =>
  getRpcUrl(SOLANA_MAINNET_CAIP2, rpcOverride) ?? DEFAULT_SVM_RPC;

/**
 * Resolve all viable Solana RPC URLs in priority order, falling back to
 * {@link DEFAULT_SVM_RPC} when nothing else is configured.
 */
export const getSvmRpcUrls = (rpcOverride?: RpcInput): readonly string[] => {
  const urls = getRpcUrls(SOLANA_MAINNET_CAIP2, rpcOverride);
  return urls.length > 0 ? urls : [DEFAULT_SVM_RPC];
};

type ConfirmationStatus = "finalized" | "confirmed" | "processed";
type ConfirmationResult = { slot: number; confirmationStatus: ConfirmationStatus };

/** Check if the actual confirmation status meets the required commitment level */
function hasReachedCommitment(actual: ConfirmationStatus, required: Commitment): boolean {
  if (required === "finalized") {
    return actual === "finalized";
  }
  if (required === "confirmed") {
    return actual === "finalized" || actual === "confirmed";
  }
  return true; // "processed" is always reached if we have any status
}

/**
 * Poll-based transaction confirmation that doesn't use WebSocket subscriptions.
 * Works with HTTP-only RPC providers like Alchemy Solana.
 */
async function confirmTransactionPolling(
  connection: Connection,
  signature: string,
  commitment: Commitment = "confirmed",
  timeoutMs = 60_000,
  pollIntervalMs = 1_000,
): Promise<ConfirmationResult> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await connection.getSignatureStatus(signature);

    if (status.value?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
    }

    const confirmationStatus = status.value?.confirmationStatus;
    if (confirmationStatus && hasReachedCommitment(confirmationStatus, commitment)) {
      return { slot: status.context.slot, confirmationStatus };
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Transaction confirmation timeout after ${timeoutMs}ms`);
}

/**
 * WebSocket-based transaction confirmation using Solana's native confirmTransaction.
 * Faster when WebSocket is supported, but fails on HTTP-only RPC providers.
 */
async function confirmTransactionWebSocket(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  commitment: Commitment = "confirmed",
): Promise<ConfirmationResult> {
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    commitment,
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  const status = await connection.getSignatureStatus(signature);
  return {
    slot: status.context.slot,
    confirmationStatus: (status.value?.confirmationStatus as ConfirmationStatus) ?? "confirmed",
  };
}

/** Check if an error indicates WebSocket is not supported */
function isWebSocketError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("websocket") ||
    msg.includes("ws://") ||
    msg.includes("wss://") ||
    msg.includes("subscription") ||
    msg.includes("socket") ||
    msg.includes("signaturesubscribe") ||
    (msg.includes("method") && msg.includes("not found")) // JSON-RPC -32601
  );
}

/** Check if RPC URL is known to not support WebSocket subscriptions */
export function isHttpOnlyRpc(rpcUrl: string): boolean {
  const url = rpcUrl.toLowerCase();
  return url.includes("alchemy.com") || url.includes("ankr.com");
}

/**
 * Confirm a transaction, trying WebSocket first and falling back to polling.
 * This provides optimal performance on WebSocket-capable RPCs while maintaining
 * compatibility with HTTP-only providers like Alchemy Solana.
 *
 * For known HTTP-only providers (Alchemy, Ankr), skips WebSocket entirely to
 * avoid noisy console errors from the Solana web3.js retry logic.
 */
async function confirmTransaction(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  commitment: Commitment = "confirmed",
): Promise<ConfirmationResult> {
  // Skip WebSocket for known HTTP-only RPC providers
  if (isHttpOnlyRpc(connection.rpcEndpoint)) {
    return confirmTransactionPolling(connection, signature, commitment);
  }

  try {
    return await confirmTransactionWebSocket(
      connection,
      signature,
      blockhash,
      lastValidBlockHeight,
      commitment,
    );
  } catch (error) {
    if (isWebSocketError(error)) {
      return confirmTransactionPolling(connection, signature, commitment);
    }
    throw error;
  }
}

export type SvmInstruction = {
  program_id: string;
  accounts: { pubkey: string; is_signer: boolean; is_writable: boolean }[];
  data: string;
};

export type SvmPayload = {
  ixs: SvmInstruction[];
  lookup_table?: string | undefined;
  mint_address: string;
};

export type SvmSubmitResult = {
  signature: string;
  slot: number;
  confirmation_status: "finalized" | "confirmed" | "processed";
};

/**
 * Sign a Solana versioned transaction (with optional address lookup table),
 * broadcast it, and wait for `confirmed` status.
 * `privateKey` is the base58-encoded secret key. `rpcUrlOverride` may be a
 * single URL or an ordered priority list — on transport-level failures the
 * call retries against the next URL (see {@link withRpcFallback}).
 *
 * Broadcast happens at most once. Once a signature has been obtained, only
 * confirmation is retried against subsequent URLs — the transaction is NOT
 * re-signed with a fresh blockhash or re-broadcast, which would risk a
 * duplicate, non-idempotent on-chain effect.
 */
export async function signAndSubmitSvm(
  payload: SvmPayload,
  privateKey: string,
  rpcUrlOverride?: RpcInput,
): Promise<SvmSubmitResult> {
  const urls = getSvmRpcUrls(rpcUrlOverride);
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

  const instructions = payload.ixs.map(
    (ix) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.program_id),
        keys: ix.accounts.map((a) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.is_signer,
          isWritable: a.is_writable,
        })),
        data: Buffer.from(ix.data, "base64"),
      }),
  );

  let signature: string | undefined;
  let blockhash: string | undefined;
  let lastValidBlockHeight: number | undefined;

  return withRpcFallback(urls, async (rpcUrl) => {
    const connection = new Connection(rpcUrl, "confirmed");

    if (signature === undefined) {
      let altAccounts: AddressLookupTableAccount[] = [];
      if (payload.lookup_table) {
        const altResponse = await connection.getAddressLookupTable(
          new PublicKey(payload.lookup_table),
        );
        if (altResponse.value) {
          altAccounts = [altResponse.value];
        }
      }

      const latest = await connection.getLatestBlockhash();
      blockhash = latest.blockhash;
      lastValidBlockHeight = latest.lastValidBlockHeight;

      const message = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(altAccounts);

      const tx = new VersionedTransaction(message);
      tx.sign([keypair]);

      signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    }

    const { slot, confirmationStatus } = await confirmTransaction(
      connection,
      signature,
      // biome-ignore lint/style/noNonNullAssertion: set in the same branch as signature
      blockhash!,
      // biome-ignore lint/style/noNonNullAssertion: set in the same branch as signature
      lastValidBlockHeight!,
      "confirmed",
    );

    return { signature, slot, confirmation_status: confirmationStatus };
  });
}

/**
 * Send and confirm a legacy Transaction with WebSocket fallback to polling.
 * Drop-in replacement for sendAndConfirmTransaction that works with HTTP-only RPCs.
 */
export async function sendAndConfirmSvmTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
  commitment: Commitment = "confirmed",
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.sign(...signers);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: commitment,
  });

  await confirmTransaction(connection, signature, blockhash, lastValidBlockHeight, commitment);

  return signature;
}
