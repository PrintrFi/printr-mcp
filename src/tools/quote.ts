import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PrintrClient, paths } from "~/lib/client.js";
import { toToolResponseAsync, unwrapResultAsync } from "~/lib/client.js";
import { caip2ChainId, graduationThreshold, initialBuy, quoteOutput } from "~/lib/schemas.js";

type QuoteRequestBody = paths["/print/quote"]["post"]["requestBody"]["content"]["application/json"];

const inputSchema = z.object({
  chains: z.array(caip2ChainId).min(1).describe("Chains to deploy on"),
  initial_buy: initialBuy,
  graduation_threshold_per_chain_usd: graduationThreshold,
});

const outputSchema = quoteOutput;

export function registerQuoteTool(server: McpServer, client: PrintrClient) {
  server.registerTool(
    "printr_quote",
    {
      description:
        "Get a cost estimate for creating a token on Printr. Returns itemized costs per chain, " +
        "total cost in USD and native tokens, and the number of tokens from the initial buy. " +
        "Use this before printr_create_token to understand costs.",
      inputSchema,
      outputSchema,
    },
    async (params) => {
      return toToolResponseAsync(
        unwrapResultAsync(client.POST("/print/quote", { body: params as QuoteRequestBody })).map(
          (response) => response.quote,
        ),
      );
    },
  );
}
