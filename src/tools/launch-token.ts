import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { PrintrClient } from "~/lib/client.js";
import { PrintrApiError, toToolResponseAsync } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { type EvmPayload, signAndSubmitEvm } from "~/lib/evm.js";
import {
  caip2ChainId,
  caip10Address,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
} from "~/lib/schemas.js";
import { DEFAULT_SVM_RPC, type SvmPayload, signAndSubmitSvm } from "~/lib/svm.js";
import { buildToken } from "~/lib/token.js";
import { createSession, LOCAL_SESSION_ORIGIN, startSessionServer } from "~/server";

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
      "Absolute path to a local image file. Auto-compressed if needed. " +
      "Mutually exclusive with image. If neither is provided and OPENROUTER_API_KEY is set, " +
      "an image is generated automatically.",
    ),
  chains: z.array(caip2ChainId).min(1).describe("Chains to deploy on"),
  initial_buy: initialBuy,
  graduation_threshold_per_chain_usd: graduationThreshold,
  external_links: externalLinks,
  private_key: z
    .string()
    .optional()
    .describe(
      "Private key to sign immediately after token creation. " +
      "EVM: hex (with or without 0x prefix). SVM: base58 64-byte keypair. " +
      "WARNING: handle with care — never share or commit this value. " +
      "If omitted, a browser signing session is started instead.",
    ),
  rpc_url: z
    .url()
    .optional()
    .describe(
      `RPC endpoint. Required for EVM when private_key is provided. SVM defaults to ${DEFAULT_SVM_RPC}.`,
    ),
});

const outputSchema = z.object({
  status: z
    .enum(["awaiting_signature", "submitted"])
    .describe(
      "awaiting_signature: open the returned URL to sign. submitted: tx confirmed on-chain.",
    ),
  token_id: z.string().describe("Cross-chain telecoin ID (hex)"),
  quote: quoteOutput.describe("Full cost breakdown"),
  // browser signing
  url: z.string().optional().describe("Deep link to the Printr web app signing page"),
  session_token: z.string().optional().describe("Ephemeral session token"),
  api_port: z.number().optional().describe("Port of the local session API"),
  expires_at: z.number().optional().describe("Session expiry timestamp (epoch ms)"),
  // EVM submitted
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  block_number: z.string().optional().describe("Block number (as string)"),
  tx_status: z.enum(["success", "reverted"]).optional().describe("EVM transaction status"),
  // SVM submitted
  signature: z.string().optional().describe("Solana transaction signature (base58)"),
  slot: z.number().optional().describe("Slot the transaction was confirmed in"),
  confirmation_status: z
    .enum(["finalized", "confirmed", "processed"])
    .optional()
    .describe("Solana confirmation level"),
});

function mapErr(e: unknown): PrintrApiError {
  return new PrintrApiError(0, e instanceof Error ? e.message : String(e));
}

function isEvmPayload(payload: unknown): payload is EvmPayload {
  return typeof payload === "object" && payload !== null && "calldata" in payload;
}

export function registerLaunchTokenTool(server: McpServer, client: PrintrClient): void {
  server.registerTool(
    "printr_launch_token",
    {
      description:
        "Create a token and sign it in one call — collapses printr_create_token + " +
        "printr_sign_and_submit_evm/svm or printr_open_web_signer into a single round-trip. " +
        "Supply image (base64) or image_path (auto-compressed). " +
        "If neither is provided and OPENROUTER_API_KEY is set, an image is auto-generated. " +
        "With private_key: token is created and submitted on-chain immediately. " +
        "Without private_key: token is created and a browser signing URL is returned. " +
        `After submission, present the trade page URL: ${env.PRINTR_APP_URL}/trade/{token_id}.`,
      inputSchema,
      outputSchema,
    },
    ({ private_key, rpc_url, ...tokenParams }) =>
      toToolResponseAsync(
        buildToken(tokenParams, client).andThen(({ token_id, payload, quote }) => {
          if (private_key) {
            if (isEvmPayload(payload)) {
              if (!rpc_url) {
                return errAsync(
                  new PrintrApiError(400, "rpc_url is required for EVM signing"),
                );
              }
              return ResultAsync.fromPromise(
                signAndSubmitEvm(payload, private_key, rpc_url),
                mapErr,
              ).map(({ tx_hash, block_number, status: tx_status }) => ({
                status: "submitted" as const,
                token_id,
                quote,
                tx_hash,
                block_number,
                tx_status,
              }));
            }
            return ResultAsync.fromPromise(
              signAndSubmitSvm(payload as SvmPayload, private_key, rpc_url),
              mapErr,
            ).map(({ signature, slot, confirmation_status }) => ({
              status: "submitted" as const,
              token_id,
              quote,
              signature,
              slot,
              confirmation_status,
            }));
          }

          const chain_type = isEvmPayload(payload) ? ("evm" as const) : ("svm" as const);
          const image_url = `${env.PRINTR_CDN_URL}/t/${token_id}/media/image`;
          return ResultAsync.fromPromise(
            startSessionServer().then((port) => {
              const session = createSession({
                chain_type,
                payload,
                token_id,
                token_meta: {
                  name: tokenParams.name,
                  symbol: tokenParams.symbol,
                  description: tokenParams.description,
                  image_url,
                },
              });
              const apiUrl = `${LOCAL_SESSION_ORIGIN}:${port}`;
              const url = `${env.PRINTR_APP_URL}/sign?session=${session.token}&api=${encodeURIComponent(apiUrl)}`;
              return {
                status: "awaiting_signature" as const,
                token_id,
                quote,
                url,
                session_token: session.token,
                api_port: port,
                expires_at: session.expires_at,
              };
            }),
            mapErr,
          );
        }),
      ),
  );
}
