#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noFallthroughSwitchClause: process.exit() never returns

import { z } from "zod";
import { version } from "../package.json";

const CommandSchema = z.enum(["quickstart", "setup", "skill"]);
type Command = z.infer<typeof CommandSchema>;

const HelpFlagSchema = z.enum(["--help", "-h"]);
const VersionFlagSchema = z.enum(["--version", "-v"]);

type Dispatch =
  | { kind: "command"; name: Command }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "unknown"; raw: string }
  | { kind: "missing" };

function classify(raw: string | undefined): Dispatch {
  if (raw === undefined) {
    return { kind: "missing" };
  }
  if (HelpFlagSchema.safeParse(raw).success) {
    return { kind: "help" };
  }
  if (VersionFlagSchema.safeParse(raw).success) {
    return { kind: "version" };
  }
  const command = CommandSchema.safeParse(raw);
  if (command.success) {
    return { kind: "command", name: command.data };
  }
  return { kind: "unknown", raw };
}

function helpText(): string {
  return `
Usage: printr [command] [options]

Commands:
  quickstart  Configure Printr MCP and install the Printr skill in one go.
              Runs 'setup' followed by 'skill'. Recommended for first-time users.

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
`;
}

async function runCommand(name: Command, args: string[]): Promise<void> {
  switch (name) {
    case "quickstart": {
      const { runSetup } = await import("./commands/setup/index.js");
      const { runSkillInstall } = await import("./commands/skill/index.js");
      await runSetup(args);
      await runSkillInstall(args);
      process.stdout.write(
        `\n✓ Printr quickstart complete.\n  Restart your AI client, then ask the agent: "Call printr_supported_chains."\n`,
      );
      return;
    }
    case "setup": {
      const { runSetup } = await import("./commands/setup/index.js");
      await runSetup(args);
      return;
    }
    case "skill": {
      const { runSkillInstall } = await import("./commands/skill/index.js");
      await runSkillInstall(args);
      return;
    }
  }
}

const [, , raw] = process.argv;
const dispatch = classify(raw);

switch (dispatch.kind) {
  case "command":
    await runCommand(dispatch.name, process.argv.slice(3));
    process.exit(0);
  case "help":
    process.stdout.write(helpText());
    process.exit(0);
  case "version":
    process.stdout.write(`${version}\n`);
    process.exit(0);
  case "unknown":
    process.stderr.write(`Unknown command: ${dispatch.raw}\nRun 'printr --help' for usage.\n`);
    process.exit(1);
  case "missing":
    process.stderr.write(`No command specified. Run 'printr --help' for usage.\n`);
    process.exit(1);
}
