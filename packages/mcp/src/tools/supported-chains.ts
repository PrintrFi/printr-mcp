import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHAIN_META, toolOk } from "@printr/sdk";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";

const outputSchema = z.object({
  chains: z.array(
    z.object({
      chain_id: z.string().describe("CAIP-2 chain ID"),
      name: z.string().describe("Human-readable chain name"),
      symbol: z.string().describe("Native token symbol"),
      decimals: z.number().describe("Native token decimals"),
      has_rpc: z.boolean().describe("Whether a default RPC endpoint is configured"),
    }),
  ),
});

/**
 * Registers the `printr_supported_chains` MCP tool, which lists all blockchain networks
 * supported by Printr MCP along with their chain IDs, names, native token info, and RPC
 * availability.
 *
 * @param server - MCP server instance to register the tool against
 */
export function registerSupportedChainsTool(server: McpServer): void {
  server.registerTool(
    "printr_supported_chains",
    {
      description:
        "List all blockchain networks supported by Printr MCP. " +
        "Returns chain IDs, names, native token info, and RPC availability.",
      inputSchema: z.object({}),
      outputSchema,
    },
    logToolExecution("printr_supported_chains", () => {
      const chains = Object.entries(CHAIN_META).map(([chainId, meta]) => ({
        chain_id: chainId,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
        has_rpc: "defaultRpc" in meta && !!meta.defaultRpc,
      }));

      return toolOk({ chains });
    }),
  );
}
