import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { caip10ToChainId } from "~/lib/chains.js";
import { toolError, toolOk } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { DEFAULT_SVM_RPC, signAndSubmitSvm } from "~/lib/svm.js";
import { insufficientFundsMessage, resolveWallet } from "~/lib/wallet-elicit.js";

const svmInstruction = z.object({
  program_id: z.string().describe("Program ID (base58)"),
  accounts: z.array(
    z.object({
      pubkey: z.string(),
      is_signer: z.boolean(),
      is_writable: z.boolean(),
    }),
  ),
  data: z.string().describe("Instruction data (base64)"),
});

const inputSchema = z.object({
  payload: z.object({
    ixs: z.array(svmInstruction).min(1).describe("Solana instructions from printr_create_token"),
    lookup_table: z.string().optional().describe("Address lookup table (base58)"),
    mint_address: z.string().describe("Expected mint address (CAIP-10)"),
  }),
  private_key: z
    .string()
    .optional()
    .describe(
      "base58-encoded 64-byte Solana keypair secret. " +
        "WARNING: handle with care — never share or commit this value. " +
        "If omitted, the user will be prompted to select or provision a wallet.",
    ),
  rpc_url: z.url().optional().describe(`Solana RPC endpoint (default: ${DEFAULT_SVM_RPC})`),
});

const outputSchema = z.object({
  signature: z.string().describe("Transaction signature (base58)"),
  slot: z.number().describe("Slot the transaction was confirmed in"),
  confirmation_status: z
    .enum(["finalized", "confirmed", "processed"])
    .describe("Confirmation level"),
});

export function registerSignAndSubmitSvmTool(server: McpServer): void {
  server.registerTool(
    "printr_sign_and_submit_svm",
    {
      description:
        "Sign and submit a Solana transaction payload returned by printr_create_token. " +
        "If no private_key is provided, the user will be prompted to select or provision a wallet. " +
        "Returns the transaction signature once confirmed. " +
        `After successful confirmation, present the trade page URL to the user: ` +
        `${env.PRINTR_APP_URL}/trade/{token_id} using the token_id from the prior ` +
        `printr_create_token call.`,
      inputSchema,
      outputSchema,
    },
    async ({ payload, private_key, rpc_url }) => {
      try {
        if (private_key) {
          return toolOk(await signAndSubmitSvm(payload, private_key, rpc_url));
        }

        const caip2 = caip10ToChainId(payload.mint_address);
        const resolution = await resolveWallet(server, caip2, { type: "svm", rpcUrl: rpc_url });

        if (resolution.kind === "ready") {
          return toolOk(await signAndSubmitSvm(payload, resolution.privateKey, rpc_url));
        }
        if (resolution.kind === "insufficient_funds")
          return toolError(insufficientFundsMessage(resolution));
        return toolError(resolution.message);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
