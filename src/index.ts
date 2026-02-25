#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
import { registerWalletTools } from "~/tools/wallet.js";
import { version } from "../package.json";

// Must happen before MCP server startup so that CLI commands don't connect stdio.
const [, , command] = process.argv;

switch (command) {
  // biome-ignore lint/suspicious/noFallthroughSwitchClause: process.exit() never returns
  case "setup": {
    const { runSetup } = await import("./cli/setup/index.js");
    await runSetup(process.argv.slice(3));
    process.exit(0);
  }
  case "--version":
  // biome-ignore lint/suspicious/noFallthroughSwitchClause: process.exit() never returns
  case "-v": {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }
  case "--help":
  case "-h": {
    process.stdout.write(`
Usage: printr-mcp [command] [options]

Commands:
  setup     Configure Printr MCP for all detected AI clients.

            Options:
              --client <name>              Target a specific client (repeatable).
                                           Values: claude-desktop, cursor,
                                                   windsurf, gemini, claude-code
              --openrouter-api-key <key>   Add OPENROUTER_API_KEY to the config.
                                           Falls back to OPENROUTER_API_KEY env var.

  (none)    Start the MCP server over stdio — default mode for AI clients.

Version: ${version}
Docs:    https://github.com/PrintrFi/printr-mcp
`);
    process.exit(0);
  }
}

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
if (env.OPENROUTER_API_KEY) {
  registerGenerateImageTool(server);
}

const transport = new StdioServerTransport();
await server.connect(transport);
