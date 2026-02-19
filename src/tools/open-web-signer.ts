import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createSession, startSessionServer } from "~/server";

const PRINTR_APP_DEFAULT = "https://app.printr.money";

const inputSchema = z.object({
  chain_type: z.enum(["evm", "svm"]).describe("Chain type of the unsigned transaction"),
  payload: z.unknown().describe("Full unsigned tx payload returned by printr_create_token"),
  token_id: z.string().describe("Telecoin ID (hex) returned by printr_create_token"),
  rpc_url: z.url().optional().describe("Optional RPC endpoint override for signing"),
  printr_app_url: z
    .string()
    .url()
    .optional()
    .describe(
      `Base URL of the Printr web app (default: ${PRINTR_APP_DEFAULT}). ` +
      "Override with e.g. http://localhost:3000 when testing against a local dev server.",
    ),
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
    async ({ chain_type, payload, token_id, rpc_url, printr_app_url }) => {
      try {
        const port = await startSessionServer();
        const session = createSession({ chain_type, payload, token_id, rpc_url });

        const appBase = printr_app_url ?? PRINTR_APP_DEFAULT;
        const apiUrl = `http://localhost:${port}`;
        const url = `${appBase}/sign?session=${session.token}&api=${encodeURIComponent(apiUrl)}`;

        const result = {
          url,
          session_token: session.token,
          api_port: port,
          expires_at: session.expires_at,
        };

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
