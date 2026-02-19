import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PrintrClient } from "~/lib/client.js";
import { toToolResponseAsync, unwrapResultAsync } from "~/lib/client.js";
import { tokenId } from "~/lib/schemas.js";

const curveProperties = z.object({
  homeChain: z.string().describe("Home chain (CAIP-2)"),
  basePairAddresses: z.array(z.string()),
  referenceAssetId: z.string(),
  maxSupplyExponent: z.number().describe("8 = 100M, 9 = 1B, 10 = 10B"),
  completionThresholdBasisPoints: z.number(),
  graduationThresholdRefAtomic: z.string(),
  initialPriceRefAtomic: z.string(),
});

const inputSchema = z.object({
  id: tokenId,
});

const outputSchema = z.object({
  id: z.string().describe("Telecoin ID (hex)"),
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  imageUrl: z.string().describe("URL to token image"),
  creatorAddresses: z.array(z.string()).describe("CAIP-10 creator addresses"),
  chains: z.array(z.string()).describe("CAIP-2 chain IDs"),
  externalLinks: z
    .object({
      website: z.string().optional(),
      telegram: z.string().optional(),
      x: z.string().optional(),
      github: z.string().optional(),
    })
    .optional(),
  curveProperties,
});

export function registerGetTokenTool(server: McpServer, client: PrintrClient) {
  server.registerTool(
    "printr_get_token",
    {
      description:
        "Get details about a Printr token by its telecoin ID or CAIP-10 contract address. " +
        "Returns name, symbol, description, image, creator addresses, deployed chains, " +
        "bonding curve properties, and external links.",
      inputSchema,
      outputSchema,
    },
    async ({ id }) => {
      return toToolResponseAsync(
        unwrapResultAsync(client.GET("/tokens/{id}", { params: { path: { id } } })),
      );
    },
  );
}
