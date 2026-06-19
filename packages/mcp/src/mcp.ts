import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPrintrClient } from "@printr/sdk";
import { env } from "~/lib/env.js";
import { registerClaimFeesTool } from "~/tools/claim-fees.js";
import { registerClaimStakingRewardsTool } from "~/tools/claim-staking-rewards.js";
import { registerCreateStakePositionTool } from "~/tools/create-stake-position.js";
import { registerDrainDeploymentWalletTool } from "~/tools/drain-deployment-wallet.js";
import { registerFundDeploymentWalletTool } from "~/tools/fund-deployment-wallet.js";
import { registerGenerateImageTool } from "~/tools/generate-image.js";
import { registerLaunchTokenTool } from "~/tools/launch-token.js";
import { registerOpenWebSignerTool } from "~/tools/open-web-signer.js";
import { registerRemoteSafeTools } from "~/tools/remote-safe.js";
import { registerSetTreasuryWalletTool } from "~/tools/set-treasury-wallet.js";
import { registerSignAndSubmitEvmTool } from "~/tools/sign-and-submit-evm.js";
import { registerSignAndSubmitSvmTool } from "~/tools/sign-and-submit-svm.js";
import { registerTransferTool } from "~/tools/transfer.js";
import { registerTransferTokenTool } from "~/tools/transfer-token.js";
import { registerWalletTools } from "~/tools/wallet.js";
import { version } from "../package.json";

/**
 * Bootstraps the Printr MCP server: creates the Printr API client, constructs the
 * `McpServer` instance, registers every Printr tool (and the image-generation tool when
 * `OPENROUTER_API_KEY` is set), and connects over stdio.
 */
export async function startMcpServer() {
  const client = createPrintrClient({
    apiKey: env.PRINTR_API_KEY,
    baseUrl: env.PRINTR_API_BASE_URL,
  });

  const server = new McpServer({
    name: "printr",
    version,
  });

  // Read + build-unsigned tools, shared with the remote (Workers) server.
  registerRemoteSafeTools(server, client);

  // Local-only tools: signing, keystore, transfers, treasury/deployment wallets.
  registerLaunchTokenTool(server, client);
  registerSignAndSubmitEvmTool(server);
  registerSignAndSubmitSvmTool(server);
  registerOpenWebSignerTool(server);
  registerWalletTools(server);
  registerSetTreasuryWalletTool(server);
  registerTransferTool(server);
  registerTransferTokenTool(server);
  registerFundDeploymentWalletTool(server);
  registerDrainDeploymentWalletTool(server);
  registerClaimFeesTool(server);
  registerClaimStakingRewardsTool(server);
  registerCreateStakePositionTool(server);
  if (env.OPENROUTER_API_KEY) {
    registerGenerateImageTool(server, env.OPENROUTER_API_KEY);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
