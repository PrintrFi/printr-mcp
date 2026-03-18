import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StepResult } from "../types.js";
import { AGENTS, installSkill } from "./agents.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dist: dist/commands/skill/lib/logic.js -> dist/skills/printr/SKILL.md
const SKILL_PATH = join(__dirname, "..", "..", "..", "skills", "printr", "SKILL.md");

function getSkillContent(): string {
  return readFileSync(SKILL_PATH, "utf8");
}

export async function runSkillInstall(
  agentIds: string[],
  onStep: (step: StepResult) => void,
): Promise<number> {
  const content = getSkillContent();
  let installed = 0;

  for (const id of agentIds) {
    const agent = AGENTS.find((a) => a.id === id);
    if (!agent) continue;

    onStep({ id, label: agent.label, status: "running" });

    const result = installSkill(agent, content);

    const status = result === "installed" ? "ok" : result === "already_exists" ? "warn" : "error";
    const detail =
      result === "installed"
        ? agent.skillPath()
        : result === "already_exists"
          ? "already exists"
          : "failed to install";

    onStep({ id, label: agent.label, status, detail });

    if (result === "installed") installed++;
  }

  return installed;
}
