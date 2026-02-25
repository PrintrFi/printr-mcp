import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { caip10ToChainId } from "~/lib/chains.js";
import { toolError, toolOk } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { signAndSubmitEvm } from "~/lib/evm.js";
import { insufficientFundsMessage, resolveWallet } from "~/lib/wallet-elicit.js";

const inputSchema = z.object({
  payload: z.object({
    to: z.string().describe("Target contract (CAIP-10, e.g. 'eip155:8453:0x...')"),
    calldata: z.string().describe("Hex-encoded calldata"),
    value: z.string().describe("Native token value in wei (atomic units)"),
    gas_limit: z.number().describe("Max gas"),
  }),
  private_key: z
    .string()
    .optional()
    .describe(
      "Hex private key for the creator wallet (with or without 0x prefix). " +
        "WARNING: handle with care — never share or commit this value. " +
        "Falls back to EVM_WALLET_PRIVATE_KEY env var or interactive wallet selection.",
    ),
  rpc_url: z
    .url()
    .optional()
    .describe(
      "HTTP RPC endpoint for the target chain. Falls back to the chain's default public RPC if omitted.",
    ),
});

const outputSchema = z.object({
  tx_hash: z.string().describe("Transaction hash"),
  block_number: z.string().describe("Block number (as string)"),
  status: z.enum(["success", "reverted"]).describe("Transaction status"),
});

export function registerSignAndSubmitEvmTool(server: McpServer): void {
  server.registerTool(
    "printr_sign_and_submit_evm",
    {
      description:
        "Sign and submit an EVM transaction payload returned by printr_create_token. " +
        "If no private_key is provided, the user will be prompted to select or provision a wallet. " +
        "Returns the transaction hash and receipt once confirmed. " +
        `After successful confirmation, present the trade page URL to the user: ` +
        `${env.PRINTR_APP_URL}/trade/{token_id} using the token_id from the prior ` +
        `printr_create_token call.`,
      inputSchema,
      outputSchema,
    },
    async ({ payload, private_key, rpc_url }) => {
      try {
        if (private_key) {
          return toolOk(await signAndSubmitEvm(payload, private_key, rpc_url));
        }

        const resolution = await resolveWallet(server, caip10ToChainId(payload.to), {
          type: "evm",
          caip10To: payload.to,
          gasLimit: payload.gas_limit,
          rpcUrl: rpc_url,
        });

        if (resolution.kind === "ready") {
          return toolOk(await signAndSubmitEvm(payload, resolution.privateKey, rpc_url));
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
