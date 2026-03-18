import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProtocolFees, toolError, toolOk } from "@printr/sdk";
import { z } from "zod";
import { env } from "~/lib/env.js";

const inputSchema = z.object({
  token_id: z.string().describe("Telecoin ID (hex) or CAIP-10 token address"),
  chains: z
    .array(z.string())
    .optional()
    .describe("Optional: subset of CAIP-2 chain IDs to query. If empty, queries all chains."),
});

const outputSchema = z.object({
  token_id: z.string().describe("Telecoin ID"),
  total_fees_usd: z.number().describe("Total claimable creator fees in USD"),
  chains: z
    .array(
      z.object({
        chain_id: z.string().describe("CAIP-2 chain ID"),
        creator_address: z.string().optional().describe("Creator wallet address"),
        creator_fees_usd: z.number().describe("Claimable creator fees in USD"),
        creator_fees_native: z.string().describe("Claimable creator fees in native token (atomic)"),
        can_claim: z.boolean().describe("Whether fees can be claimed on this chain"),
        native_symbol: z.string().describe("Native token symbol"),
      }),
    )
    .describe("Per-chain fee breakdown"),
  claim_url: z.string().describe("URL to claim fees in the web UI"),
  message: z.string().describe("Status message"),
});

function deriveCreatorFeesMessage(totalFeesUsd: number, claimableChainsCount: number): string {
  if (totalFeesUsd === 0) {
    return "No creator fees have accumulated yet.";
  }

  if (claimableChainsCount === 0) {
    return `$${totalFeesUsd.toFixed(2)} in fees accumulated, but none are claimable yet (minimum threshold not reached).`;
  }

  return `$${totalFeesUsd.toFixed(2)} in creator fees available across ${claimableChainsCount} chain(s).`;
}

export function registerGetCreatorFeesTool(server: McpServer): void {
  server.registerTool(
    "printr_get_creator_fees",
    {
      description:
        "Check accumulated creator fees for a token across all deployed chains. " +
        "Returns fee amounts and whether they can be claimed. " +
        "Use printr_claim_fees to claim the fees to the treasury.",
      inputSchema,
      outputSchema,
    },
    async ({ token_id, chains }) => {
      try {
        const response = await getProtocolFees({
          telecoinId: token_id,
          chainIds: chains,
        });

        const chainFees = Object.entries(response.perChain).map(([chainId, fees]) => {
          const isEvm = chainId.startsWith("eip155:");
          return {
            chain_id: chainId,
            creator_address: fees.dev ? `${fees.dev.chainId}:${fees.dev.address}` : undefined,
            creator_fees_usd: fees.devFees?.amountUsd ?? 0,
            creator_fees_native: fees.devFees?.amountAtomic ?? "0",
            can_claim: fees.canCollect,
            native_symbol: isEvm ? "ETH" : "SOL",
          };
        });

        const totalFeesUsd = chainFees.reduce((sum, cf) => sum + cf.creator_fees_usd, 0);
        const claimableChains = chainFees.filter((cf) => cf.can_claim);

        const appUrl = env.PRINTR_APP_URL ?? "https://app.printr.money";
        const claimUrl = `${appUrl}/profile?section=claim-fees`;

        return toolOk({
          token_id: response.telecoinId || token_id,
          total_fees_usd: totalFeesUsd,
          chains: chainFees,
          claim_url: claimUrl,
          message: deriveCreatorFeesMessage(totalFeesUsd, claimableChains.length),
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
