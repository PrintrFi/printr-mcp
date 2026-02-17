import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PrintrClient } from "~/lib/client.js";
import { toToolResponse, unwrapResult } from "~/lib/client.js";
import {
  caip2ChainId,
  caip10Address,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
} from "~/lib/schemas.js";

const evmPayload = z.object({
  to: z.string().describe("Target contract (CAIP-10)"),
  calldata: z.string().describe("Encoded transaction data (hex)"),
  value: z.string().describe("Native token value to send"),
  gas_limit: z.number().describe("Max gas"),
});

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

const svmPayload = z.object({
  mint_address: z.string().describe("Expected telecoin mint (CAIP-10)"),
  ixs: z.array(svmInstruction).describe("Solana instructions"),
  lookup_table: z.string().optional().describe("Address lookup table (base58)"),
});

const inputSchema = z.object({
  creator_accounts: z
    .array(caip10Address)
    .min(1)
    .describe("One creator address per chain being deployed to"),
  name: z.string().min(1).max(32).describe("Token name"),
  symbol: z.string().min(1).max(10).describe("Token ticker symbol"),
  description: z.string().max(500).describe("Token description"),
  image: z.string().describe("Base64-encoded image data (max 500KB). JPEG or PNG."),
  chains: z.array(caip2ChainId).min(1).describe("Chains to deploy on"),
  initial_buy: initialBuy,
  graduation_threshold_per_chain_usd: graduationThreshold,
  external_links: externalLinks,
});

const outputSchema = z.object({
  token_id: z.string().describe("Cross-chain telecoin ID (hex)"),
  payload: z
    .object({ hash: z.string().optional().describe("Payload hash") })
    .and(z.union([evmPayload, svmPayload]))
    .describe("Unsigned transaction payload"),
  quote: quoteOutput.describe("Full cost breakdown"),
});

export function registerCreateTokenTool(server: McpServer, client: PrintrClient) {
  server.registerTool(
    "printr_create_token",
    {
      description:
        "Create a new token on Printr. Returns an UNSIGNED transaction payload that must be " +
        "signed by the creator's wallet and submitted on-chain. The payload will be EVM calldata " +
        "or Solana instructions depending on the home chain. " +
        "You need separate wallet infrastructure to sign and submit the transaction. " +
        "Use printr_quote first to estimate costs.",
      inputSchema,
      outputSchema,
    },
    async (params) => {
      // Body is already validated by MCP inputSchema; response is fully typed
      return toToolResponse(
        unwrapResult(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await client.POST("/print", { body: params as any }),
        ),
      );
    },
  );
}
