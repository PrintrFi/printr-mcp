#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "../package.json";
import { createPrintrClient } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { registerCreateTokenTool } from "~/tools/create-token.js";
import { registerGenerateImageTool } from "~/tools/generate-image.js";
import { registerGetDeploymentsTool } from "~/tools/get-deployments.js";
import { registerGetTokenTool } from "~/tools/get-token.js";
import { registerLaunchTokenTool } from "~/tools/launch-token.js";
import { registerOpenWebSignerTool } from "~/tools/open-web-signer.js";
import { registerQuoteTool } from "~/tools/quote.js";
import { registerSignAndSubmitEvmTool } from "~/tools/sign-and-submit-evm.js";
import { registerSignAndSubmitSvmTool } from "~/tools/sign-and-submit-svm.js";

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
if (env.OPENROUTER_API_KEY) {
  registerGenerateImageTool(server);
}

const transport = new StdioServerTransport();
await server.connect(transport);
