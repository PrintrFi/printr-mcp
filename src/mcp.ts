import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPrintrClient } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { registerClaimFeesTool } from "~/tools/claim-fees.js";
import { registerCreateTokenTool } from "~/tools/create-token.js";
import { registerDrainDeploymentWalletTool } from "~/tools/drain-deployment-wallet.js";
import { registerFundDeploymentWalletTool } from "~/tools/fund-deployment-wallet.js";
import { registerGenerateImageTool } from "~/tools/generate-image.js";
import { registerGetBalanceTool } from "~/tools/get-balance.js";
import { registerGetCreatorFeesTool } from "~/tools/get-creator-fees.js";
import { registerGetDeploymentsTool } from "~/tools/get-deployments.js";
import { registerGetTokenTool } from "~/tools/get-token.js";
import { registerGetTokenBalanceTool } from "~/tools/get-token-balance.js";
import { registerLaunchTokenTool } from "~/tools/launch-token.js";
import { registerOpenWebSignerTool } from "~/tools/open-web-signer.js";
import { registerQuoteTool } from "~/tools/quote.js";
import { registerSetTreasuryWalletTool } from "~/tools/set-treasury-wallet.js";
import { registerSignAndSubmitEvmTool } from "~/tools/sign-and-submit-evm.js";
import { registerSignAndSubmitSvmTool } from "~/tools/sign-and-submit-svm.js";
import { registerSupportedChainsTool } from "~/tools/supported-chains.js";
import { registerTransferTool } from "~/tools/transfer.js";
import { registerWalletTools } from "~/tools/wallet.js";
import { version } from "../package.json";

export async function startMcpServer() {
  const client = createPrintrClient({
    apiKey: env.PRINTR_API_KEY,
    baseUrl: env.PRINTR_API_BASE_URL,
  });

  const server = new McpServer({
    name: "printr",
    version,
  });

  registerQuoteTool(server, client);
  registerCreateTokenTool(server, client);
  registerLaunchTokenTool(server, client);
  registerGetTokenTool(server, client);
  registerGetDeploymentsTool(server, client);
  registerSignAndSubmitEvmTool(server);
  registerSignAndSubmitSvmTool(server);
  registerOpenWebSignerTool(server);
  registerWalletTools(server);
  registerSetTreasuryWalletTool(server);
  registerGetBalanceTool(server);
  registerGetTokenBalanceTool(server);
  registerTransferTool(server);
  registerFundDeploymentWalletTool(server);
  registerDrainDeploymentWalletTool(server);
  registerSupportedChainsTool(server);
  registerGetCreatorFeesTool(server);
  registerClaimFeesTool(server);
  if (env.OPENROUTER_API_KEY) {
    registerGenerateImageTool(server);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
