import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainProtocolFeesSimple,
  chainTypeFromCaip2,
  type EvmPayload,
  getProtocolFees,
  type PayloadEVM,
  type PayloadSolana,
  type SvmPayload,
  signAndSubmitEvm,
  signAndSubmitSvm,
  toolError,
  toolOk,
} from "@printr/sdk";
import { z } from "zod";
import { getTreasuryAddress, getTreasuryKey } from "~/lib/treasury.js";

const inputSchema = z.object({
  token_id: z.string().describe("Telecoin ID (hex) or CAIP-10 token address"),
  chain: z
    .string()
    .describe("CAIP-2 chain ID to claim fees on (e.g., 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')"),
});

const outputSchema = z.object({
  token_id: z.string().describe("Telecoin ID"),
  chain: z.string().describe("Chain where fees were claimed"),
  claimed_amount_usd: z.number().describe("Amount claimed in USD"),
  claimed_amount_native: z.string().describe("Amount claimed in native token (atomic)"),
  native_symbol: z.string().describe("Native token symbol"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
});

/**
 * Convert backend PayloadEVM to our EvmPayload format
 */
function toEvmPayload(payload: PayloadEVM, chainId: string): EvmPayload {
  return {
    to: `${chainId}:${payload.txTo}`,
    calldata: payload.calldata,
    value: payload.txValue || "0",
    gas_limit: Number(payload.gasLimit) || 200000,
  };
}

/**
 * Convert backend PayloadSolana to our SvmPayload format
 */
function toSvmPayload(payload: PayloadSolana): SvmPayload {
  return {
    ixs: payload.ixs.map((ix) => ({
      program_id: ix.programId?.address || "",
      accounts: ix.accounts.map((acc) => ({
        pubkey: acc.pubkey?.address || "",
        is_signer: acc.isSigner,
        is_writable: acc.isWritable,
      })),
      data: ix.dataBase64,
    })),
    lookup_table: payload.lookupTable,
    mint_address: payload.telecoinMintAddress?.address || "",
  };
}

export function registerClaimFeesTool(server: McpServer): void {
  server.registerTool(
    "printr_claim_fees",
    {
      description:
        "Claim accumulated creator fees for a token on a specific chain. " +
        "First use printr_get_creator_fees to check available fees, then call this to claim. " +
        "Uses the treasury wallet to sign and submit the claim transaction. " +
        "Returns the transaction hash/signature on success.",
      inputSchema,
      outputSchema,
    },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-chain claim logic
    async ({ token_id, chain }) => {
      try {
        const chainType = chainTypeFromCaip2(chain);

        // Get treasury key for signing
        const treasuryKey = getTreasuryKey(chainType);
        if (!treasuryKey) {
          return toolError(
            `Treasury wallet not configured for ${chainType.toUpperCase()}. ` +
              `Use printr_set_treasury_wallet or set ${chainType === "svm" ? "SVM" : "EVM"}_WALLET_PRIVATE_KEY.`,
          );
        }

        // Get treasury address for API request
        const treasuryAddress = getTreasuryAddress(chainType);
        if (!treasuryAddress) {
          return toolError("Failed to derive treasury address.");
        }

        // Fetch protocol fees with collection payload
        const response = await getProtocolFees({
          telecoinId: token_id,
          chainIds: [chain],
          payers: [{ chainId: chain, address: treasuryAddress }],
        });

        const chainFees: ChainProtocolFeesSimple | undefined = response.perChain[chain];
        if (!chainFees) {
          return toolError(`No fee data returned for chain ${chain}.`);
        }

        if (!chainFees.canCollect) {
          return toolError(
            `No fees available to claim on ${chain}. ` +
              `Creator fees: $${chainFees.devFees?.amountUsd?.toFixed(2) ?? "0.00"}`,
          );
        }

        const payload = chainFees.collectionPayload;
        if (!payload || payload.payload.case === undefined) {
          return toolError(
            "No collection payload returned from API. Fees may not be claimable yet.",
          );
        }

        const claimedAmountUsd = chainFees.devFees?.amountUsd ?? 0;
        const claimedAmountNative = chainFees.devFees?.amountAtomic ?? "0";
        const nativeSymbol = chainType === "svm" ? "SOL" : "ETH";

        // Execute claim based on chain type
        if (payload.payload.case === "evm") {
          const evmPayload = toEvmPayload(payload.payload.value, chain);
          const result = await signAndSubmitEvm(evmPayload, treasuryKey);

          return toolOk({
            token_id: response.telecoinId || token_id,
            chain,
            claimed_amount_usd: claimedAmountUsd,
            claimed_amount_native: claimedAmountNative,
            native_symbol: nativeSymbol,
            tx_hash: result.tx_hash,
          });
        }

        if (payload.payload.case === "svm") {
          const svmPayload = toSvmPayload(payload.payload.value);
          const result = await signAndSubmitSvm(svmPayload, treasuryKey);

          return toolOk({
            token_id: response.telecoinId || token_id,
            chain,
            claimed_amount_usd: claimedAmountUsd,
            claimed_amount_native: claimedAmountNative,
            native_symbol: nativeSymbol,
            tx_signature: result.signature,
          });
        }

        if (payload.payload.case === "svmRaw") {
          // Raw SVM payload - hex-encoded versioned transaction
          // We'd need to deserialize and sign this differently
          return toolError(
            "Raw SVM payload not yet supported. Please use the web UI to claim fees on this chain.",
          );
        }

        return toolError(
          `Unknown payload type: ${String((payload.payload as { case?: string }).case)}`,
        );
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
