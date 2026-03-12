import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { commandExists } from "../../setup/lib/clients.js";

export type AgentDef = {
  id: string;
  label: string;
  detect: () => boolean;
  /** Path to SKILL.md inside the skill directory */
  skillPath: () => string;
};

export type InstallResult = "installed" | "already_exists" | "failed";

/**
 * Agent Skills standard locations:
 * - Claude Code: ~/.claude/skills/<name>/SKILL.md
 * - Cursor: ~/.cursor/skills/<name>/SKILL.md (also supports ~/.claude/skills/)
 * - Gemini CLI: ~/.gemini/skills/<name>/SKILL.md
 *
 * Note: Windsurf uses a different system (.windsurf/rules/) and is not supported.
 */
export const AGENTS: AgentDef[] = [
  {
    id: "claude-code",
    label: "Claude Code (~/.claude/skills/)",
    detect: () => commandExists("claude"),
    skillPath: () => join(homedir(), ".claude", "skills", "printr", "SKILL.md"),
  },
  {
    id: "cursor",
    label: "Cursor (~/.cursor/skills/)",
    detect: () => commandExists("cursor") || existsSync(join(homedir(), ".cursor")),
    skillPath: () => join(homedir(), ".cursor", "skills", "printr", "SKILL.md"),
  },
  {
    id: "gemini",
    label: "Gemini CLI (~/.gemini/skills/)",
    detect: () => commandExists("gemini") || existsSync(join(homedir(), ".gemini")),
    skillPath: () => join(homedir(), ".gemini", "skills", "printr", "SKILL.md"),
  },
  {
    id: "local",
    label: "Local project (.claude/skills/)",
    detect: () => existsSync(".claude") || existsSync(".git"),
    skillPath: () => join(process.cwd(), ".claude", "skills", "printr", "SKILL.md"),
  },
];

export const ALL_AGENT_IDS = AGENTS.map((a) => a.id);

export function installSkill(agent: AgentDef, content: string): InstallResult {
  try {
    const path = agent.skillPath();
    if (existsSync(path)) return "already_exists";
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return "installed";
  } catch {
    return "failed";
  }
}
