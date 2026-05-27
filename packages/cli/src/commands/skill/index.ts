import { render } from "ink";
import { createElement } from "react";
import { z } from "zod";
import { SkillApp } from "./app.js";
import { type AgentId, AgentIdSchema } from "./lib/agents.js";

const RawSkillArgsSchema = z.object({
  agents: z.array(z.string()).default([]),
});

type RawSkillArgs = z.infer<typeof RawSkillArgsSchema>;

function tokenize(args: string[]): RawSkillArgs {
  const agents: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent" || arg === "-a") {
      const value = args[++i];
      if (value) {
        agents.push(value);
      }
    } else if (arg?.startsWith("--agent=")) {
      agents.push(arg.slice("--agent=".length));
    }
  }
  return { agents };
}

function parseSkillArgs(args: string[]): AgentId[] | null {
  const raw = tokenize(args);
  const valid: AgentId[] = [];
  for (const candidate of raw.agents) {
    const parsed = AgentIdSchema.safeParse(candidate);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      process.stderr.write(
        `Warning: ignoring unknown --agent "${candidate}". Valid: ${AgentIdSchema.options.join(", ")}\n`,
      );
    }
  }
  return valid.length > 0 ? valid : null;
}

export async function runSkillInstall(args: string[]): Promise<void> {
  const preselectedIds = parseSkillArgs(args);
  const { waitUntilExit } = render(createElement(SkillApp, { preselectedIds }));
  await waitUntilExit();
}
