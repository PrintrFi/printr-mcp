import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { env } from "~/lib/env.js";
import { appendQr } from "~/lib/qr.js";
import { createSession, LOCAL_SESSION_ORIGIN, startSessionServer } from "~/server";

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
    .describe(
      "Token metadata to display in the signing UI. Include name, symbol, description, and " +
        "current image URL so the user can preview the token and optionally replace its image " +
        "before signing.",
    ),
  rpc_url: z.url().optional().describe("Optional RPC endpoint override for signing"),
});

const outputSchema = z.object({
  url: z.string().describe("Deep link to the Printr web app signing page"),
  session_token: z.string().describe("Ephemeral session token"),
  api_port: z.number().describe("Port of the local session API"),
  expires_at: z.number().describe("Session expiry timestamp (epoch ms)"),
});

export function registerOpenWebSignerTool(server: McpServer): void {
  server.registerTool(
    "printr_open_web_signer",
    {
      description:
        "Starts an ephemeral local signing session and returns a deep link to the Printr web " +
        "app where the user can sign the transaction using their browser wallet (MetaMask / " +
        "Phantom). Call this after printr_create_token when the user wants to sign via browser " +
        "rather than providing a raw private key. Present the returned URL to the user and ask " +
        "them to open it. After the user confirms they have signed, proceed to poll " +
        "printr_get_deployments.",
      inputSchema,
      outputSchema,
    },
    async ({ chain_type, payload, token_id, token_meta, rpc_url }) => {
      try {
        const port = await startSessionServer();
        const session = createSession({ chain_type, payload, token_id, token_meta, rpc_url });

        const appBase = env.PRINTR_APP_URL;
        const apiUrl = `${LOCAL_SESSION_ORIGIN}:${port}`;
        const url = `${appBase}/sign?session=${session.token}&api=${encodeURIComponent(apiUrl)}`;

        const result = {
          url,
          session_token: session.token,
          api_port: port,
          expires_at: session.expires_at,
        };

        return {
          structuredContent: result,
          content: [
            { type: "text" as const, text: await appendQr(JSON.stringify(result, null, 2), url) },
          ],
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
