import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { env } from "~/lib/env.js";
import { DEFAULT_SVM_RPC, signAndSubmitSvm } from "~/lib/svm.js";
import { resolveWallet, type WalletResolution } from "~/lib/wallet-elicit.js";

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

function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

function toolOk(data: Record<string, unknown>) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function browserRequiredMessage(
  resolution: Extract<WalletResolution, { kind: "browser_required" }>,
): string {
  const { action, url, newWallet } = resolution;
  const prefix =
    action === "new" && newWallet
      ? `New wallet created for ${newWallet.chain}.\n\nAddress: ${newWallet.address}\n\n` +
        `Fund it with ${newWallet.symbol} then ask me to sign again.\n\n`
      : "";
  const prompts: Record<typeof action, string> = {
    unlock: "unlock your wallet",
    provide: "enter your private key",
    new: "save your new wallet",
  };
  return `${prefix}Open this URL to ${prompts[action]}:\n\n${url}\n\nOnce complete, ask me to sign again.`;
}

function insufficientFundsMessage(
  r: Extract<WalletResolution, { kind: "insufficient_funds" }>,
): string {
  return (
    `Wallet ${r.address} on ${r.chain} has insufficient ${r.symbol}.\n` +
    `Balance:  ${r.balance} ${r.symbol}\n` +
    `Required: ${r.required} ${r.symbol}\n\nFund the wallet and try again.`
  );
}

/** Extract CAIP-2 from a CAIP-10 address (first two colon-separated segments). */
function caip10ToCaip2(caip10: string): string {
  const parts = caip10.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : caip10;
}

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

        const caip2 = caip10ToCaip2(payload.mint_address);
        const resolution = await resolveWallet(server, caip2, { type: "svm", rpcUrl: rpc_url });

        if (resolution.kind === "ready") {
          return toolOk(await signAndSubmitSvm(payload, resolution.privateKey, rpc_url));
        }
        if (resolution.kind === "browser_required")
          return toolError(browserRequiredMessage(resolution));
        if (resolution.kind === "insufficient_funds")
          return toolError(insufficientFundsMessage(resolution));
        if (resolution.kind === "declined")
          return toolError("Wallet selection cancelled. Provide a private_key to sign.");
        return toolError(resolution.message);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
