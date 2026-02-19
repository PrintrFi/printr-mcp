import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { signAndSubmitEvm } from "~/lib/evm.js";

const inputSchema = z.object({
  payload: z.object({
    to: z.string().describe("Target contract (CAIP-10, e.g. 'eip155:8453:0x...')"),
    calldata: z.string().describe("Hex-encoded calldata"),
    value: z.string().describe("Native token value in wei (atomic units)"),
    gas_limit: z.number().describe("Max gas"),
  }),
  private_key: z
    .string()
    .describe(
      "Hex private key for the creator wallet (with or without 0x prefix). " +
        "WARNING: handle with care — never share or commit this value.",
    ),
  rpc_url: z.string().url().describe("HTTP RPC endpoint for the target chain"),
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
        "Requires the creator wallet private key and an RPC URL for the target chain. " +
        "Returns the transaction hash and receipt once confirmed. " +
        "After successful confirmation, present the trade page URL to the user: " +
        "https://app.printr.money/trade/{token_id} using the token_id from the prior " +
        "printr_create_token call.",
      inputSchema,
      outputSchema,
    },
    async ({ payload, private_key, rpc_url }) => {
      try {
        const result = await signAndSubmitEvm(payload, private_key, rpc_url);
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true as const,
        };
      }
    },
  );
}
