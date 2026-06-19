import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrintrClient } from "@printr/sdk";

import { registerCreateTokenTool } from "~/tools/create-token.js";
import { registerGetBalanceTool } from "~/tools/get-balance.js";
import { registerGetCreatorFeesTool } from "~/tools/get-creator-fees.js";
import { registerGetDeploymentsTool } from "~/tools/get-deployments.js";
import { registerGetStakingPositionsTool } from "~/tools/get-staking-positions.js";
import { registerGetTokenTool } from "~/tools/get-token.js";
import { registerGetTokenBalanceTool } from "~/tools/get-token-balance.js";
import { registerQuoteTool } from "~/tools/quote.js";
import { registerSupportedChainsTool } from "~/tools/supported-chains.js";

/**
 * Register the tools that are safe to expose from a remote, network-hosted MCP
 * server: read/query tools plus the unsigned token-build path. None of these
 * touch the local filesystem, a keystore, or a private key, and none of their
 * modules pull `node:*` imports — so this module is safe to bundle for
 * Cloudflare Workers / edge runtimes.
 *
 * Excluded by design (local-only): keystore wallet management, transfers,
 * treasury/deployment wallets, `launch_token` (signs+submits), the local
 * web-signer, and image generation.
 *
 * @param server - MCP server instance to register the tools against
 * @param client - Printr API client
 */
export function registerRemoteSafeTools(server: McpServer, client: PrintrClient): void {
  registerQuoteTool(server, client);
  registerGetTokenTool(server, client);
  registerGetDeploymentsTool(server, client);
  registerCreateTokenTool(server, client);
  registerGetBalanceTool(server);
  registerGetTokenBalanceTool(server);
  registerSupportedChainsTool(server);
  registerGetCreatorFeesTool(server);
  registerGetStakingPositionsTool(server);
}
