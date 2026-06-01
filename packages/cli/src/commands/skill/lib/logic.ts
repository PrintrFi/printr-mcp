import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StepResult } from "../types.js";
import { AGENTS, type InstallFailure, type InstallSuccess, installSkill } from "./agents.js";

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
    if (!agent) {
      continue;
    }

    onStep({ id, label: agent.label, status: "running" });

    installed += installSkill(agent, content).match(
      (success: InstallSuccess): number => {
        const status = success.kind === "installed" ? "ok" : "warn";
        const detail = success.kind === "installed" ? success.path : "already exists";
        onStep({ id, label: agent.label, status, detail });
        return success.kind === "installed" ? 1 : 0;
      },
      (failure: InstallFailure): number => {
        const reason = failure.cause instanceof Error ? failure.cause.message : "unknown error";
        onStep({
          id,
          label: agent.label,
          status: "error",
          detail: `failed to install: ${reason}`,
        });
        return 0;
      },
    );
  }

  return installed;
}
