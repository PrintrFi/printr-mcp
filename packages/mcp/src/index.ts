#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noFallthroughSwitchClause: process.exit() never returns

import { version } from "../package.json";
import { startMcpServer } from "./mcp.js";

// Must happen before MCP server startup so that CLI commands don't connect stdio.
const [, , command] = process.argv;

switch (command) {
  case "setup": {
    const { runSetup } = await import("./cli/setup/index.js");
    await runSetup(process.argv.slice(3));
    process.exit(0);
  }
  case "skill": {
    const { runSkillInstall } = await import("./cli/skill/index.js");
    await runSkillInstall(process.argv.slice(3));
    process.exit(0);
  }
  case "--version":
  case "-v": {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }
  case "--help":
  case "-h": {
    process.stdout.write(`
Usage: bunx @printr/mcp@latest [command] [options]

Commands:
  setup     Configure Printr MCP for all detected AI clients.

            Options:
              --client <name>              Target a specific client (repeatable).
                                           Values: claude-desktop, cursor,
                                                   windsurf, gemini, claude-code
              --openrouter-api-key <key>   Add OPENROUTER_API_KEY to the config.
                                           Falls back to OPENROUTER_API_KEY env var.

  skill     Install the Printr agent skill to selected AI agents.

            Options:
              --agent <name>               Target a specific agent (repeatable).
                                           Values: claude-code, cursor, gemini, local

  (none)    Start the MCP server over stdio — default mode for AI clients.

Version: ${version}
Docs:    https://github.com/PrintrFi/printr-mcp
`);
    process.exit(0);
  }
}

await startMcpServer();
