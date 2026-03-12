import { render } from "ink";
import { createElement } from "react";
import { SkillApp } from "./app.js";
import { ALL_AGENT_IDS } from "./lib/agents.js";

function parseSkillArgs(args: string[]): string[] | null {
  const agentIds: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent" || arg === "-a") {
      const value = args[++i];
      if (value && ALL_AGENT_IDS.includes(value)) {
        agentIds.push(value);
      }
    }
  }
  return agentIds.length > 0 ? agentIds : null;
}

export async function runSkillInstall(args: string[]): Promise<void> {
  const preselectedIds = parseSkillArgs(args);
  const { waitUntilExit } = render(createElement(SkillApp, { preselectedIds }));
  await waitUntilExit();
}
