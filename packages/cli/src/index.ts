#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noFallthroughSwitchClause: process.exit() never returns

import { version } from "../package.json";

const [, , command] = process.argv;

switch (command) {
  case "setup": {
    const { runSetup } = await import("./commands/setup/index.js");
    await runSetup(process.argv.slice(3));
    process.exit(0);
  }
  case "skill": {
    const { runSkillInstall } = await import("./commands/skill/index.js");
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
Usage: printr [command] [options]

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

Version: ${version}
Docs:    https://github.com/PrintrFi/printr-mcp
`);
    process.exit(0);
  }
  default: {
    if (command) {
      process.stderr.write(`Unknown command: ${command}\nRun 'printr --help' for usage.\n`);
      process.exit(1);
    }
    process.stderr.write(`No command specified. Run 'printr --help' for usage.\n`);
    process.exit(1);
  }
}
