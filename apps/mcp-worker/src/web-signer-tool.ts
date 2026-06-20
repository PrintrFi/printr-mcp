import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SigningSessionDO } from "./signing-session.js";

interface WebSignerDeps {
  /** Durable Object namespace backing signing sessions. */
  sessions: DurableObjectNamespace<SigningSessionDO>;
  /** Printr web app base URL (hosts the `/sign` page). */
  appUrl: string;
  /** This Worker's public origin, handed to the web app as the session API. */
  publicOrigin: string;
}

const tokenMeta = z.object({
  name: z.string().describe("Token name"),
  symbol: z.string().describe("Token ticker symbol"),
  description: z.string().optional().describe("Token description"),
  image_url: z.url().optional().describe("URL of the current token image"),
});

const inputSchema = z.object({
  chain_type: z.enum(["evm", "svm"]).describe("Chain type of the unsigned transaction"),
  payload: z.unknown().describe("Full unsigned tx payload returned by printr_create_token"),
  token_id: z.string().describe("Telecoin ID (hex) returned by printr_create_token"),
  token_meta: tokenMeta
    .optional()
    .describe("Token metadata to preview in the signing UI (name, symbol, description, image)."),
  rpc_url: z.url().optional().describe("Optional RPC endpoint override for signing"),
});

const outputSchema = z.object({
  url: z.string().describe("Deep link to the Printr web app signing page"),
  session_token: z.string().describe("Ephemeral session token"),
  expires_at: z.number().describe("Session expiry timestamp (epoch ms)"),
});

/**
 * Registers the hosted `printr_open_web_signer` tool. Mints a signing session
 * in a Durable Object and returns a deep link to the Printr web app, where the
 * user signs with their browser wallet (MetaMask / Phantom). The signature
 * never touches the server — the flow stays human-gated, same as the local
 * stdio server, but the session API is this Worker's public origin.
 *
 * @param server - MCP server instance to register the tool against
 * @param deps - Durable Object namespace, web app URL, and this Worker's origin
 */
export function registerRemoteWebSignerTool(server: McpServer, deps: WebSignerDeps): void {
  server.registerTool(
    "printr_open_web_signer",
    {
      description:
        "Starts an ephemeral signing session and returns a deep link to the Printr web app " +
        "where the user signs the transaction with their browser wallet (MetaMask / Phantom). " +
        "Call this after printr_create_token. Present the returned URL to the user; after they " +
        "confirm they have signed, poll printr_get_deployments.",
      inputSchema,
      outputSchema,
    },
    async ({ chain_type, payload, token_id, token_meta, rpc_url }) => {
      const token = crypto.randomUUID();
      const stub = deps.sessions.get(deps.sessions.idFromName(token));
      const { expires_at } = await stub.create(
        {
          chain_type,
          payload,
          token_id,
          ...(token_meta ? { token_meta } : {}),
          ...(rpc_url ? { rpc_url } : {}),
        },
        token,
      );

      const url = `${deps.appUrl}/sign?session=${token}&api=${encodeURIComponent(deps.publicOrigin)}`;
      const result = { url, session_token: token, expires_at };

      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
