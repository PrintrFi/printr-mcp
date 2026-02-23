import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PrintrClient } from "~/lib/client.js";
import { toToolResponseAsync } from "~/lib/client.js";
import {
  caip2ChainId,
  caip10Address,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
} from "~/lib/schemas.js";
import { buildToken } from "~/lib/token.js";

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
  image: z
    .string()
    .optional()
    .describe(
      "Base64-encoded image data (max 500KB). JPEG or PNG. Mutually exclusive with image_path.",
    ),
  image_path: z
    .string()
    .optional()
    .describe(
      "Absolute path to a local image file. The server reads, auto-compresses if needed, and " +
      "encodes it. Mutually exclusive with image. If neither image nor image_path is provided " +
      "and OPENROUTER_API_KEY is configured, an image is generated automatically.",
    ),
  chains: z.array(caip2ChainId).min(1).describe("Chains to deploy on"),
  initial_buy: initialBuy,
  graduation_threshold_per_chain_usd: graduationThreshold,
  external_links: externalLinks,
});

const outputSchema = z.object({
  token_id: z.string().describe("Cross-chain telecoin ID (hex)"),
  payload: z
    .union([
      evmPayload.extend({ hash: z.string().nullish().describe("Payload hash") }),
      svmPayload.extend({ hash: z.string().nullish().describe("Payload hash") }),
    ])
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
        "Use printr_quote first to estimate costs. " +
        "Supply image (base64) or image_path (local file path — auto-compressed). " +
        "If neither is provided and OPENROUTER_API_KEY is set, an image is generated from the " +
        "token name, symbol, and description. " +
        "The response includes a token_id (telecoin ID, hex) which can be used to construct the " +
        "trade page URL: https://app.printr.money/trade/{token_id}. " +
        "Present this URL to the user after the transaction is confirmed.",
      inputSchema,
      outputSchema,
    },
    (params) => toToolResponseAsync(buildToken(params, client)),
  );
}
