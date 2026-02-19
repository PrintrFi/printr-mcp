#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPrintrClient } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { registerCreateTokenTool } from "~/tools/create-token.js";
import { registerGetDeploymentsTool } from "~/tools/get-deployments.js";
import { registerGetTokenTool } from "~/tools/get-token.js";
import { registerQuoteTool } from "~/tools/quote.js";
import { registerSignAndSubmitEvmTool } from "~/tools/sign-and-submit-evm.js";
import { registerSignAndSubmitSvmTool } from "~/tools/sign-and-submit-svm.js";

if (!env.PRINTR_API_KEY) {
  console.error(
    "PRINTR_API_KEY environment variable is required. " +
      "Get your API key from the Printr partner portal.",
  );
  process.exit(1);
}

const client = createPrintrClient({
  apiKey: env.PRINTR_API_KEY,
  baseUrl: env.PRINTR_API_BASE_URL,
});

const server = new McpServer({
  name: "printr",
  version: "0.1.0",
});

registerQuoteTool(server, client);
registerCreateTokenTool(server, client);
registerGetTokenTool(server, client);
registerGetDeploymentsTool(server, client);
registerSignAndSubmitEvmTool(server);
registerSignAndSubmitSvmTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
