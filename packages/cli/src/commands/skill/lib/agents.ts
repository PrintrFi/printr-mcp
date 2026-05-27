import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { commandExists } from "../../setup/lib/clients.js";

export const AGENT_IDS = ["claude-code", "cursor", "gemini", "local"] as const;

export const AgentIdSchema = z.enum(AGENT_IDS);

export type AgentId = z.infer<typeof AgentIdSchema>;

export type AgentDef = {
  id: AgentId;
  label: string;
  detect: () => boolean;
  /** Path to SKILL.md inside the skill directory */
  skillPath: () => string;
};

export type InstallSuccess = { kind: "installed" | "already_exists"; path: string };

export type InstallFailure = { kind: "write_failed"; path: string; cause: unknown };

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

/**
 * Write SKILL.md to the agent's expected location. Returns the resolved path
 * alongside a discriminated `kind`, or a `write_failed` failure preserving
 * the underlying cause so callers can render a precise error.
 */
export function installSkill(
  agent: AgentDef,
  content: string,
): Result<InstallSuccess, InstallFailure> {
  const path = agent.skillPath();
  if (existsSync(path)) {
    return ok({ kind: "already_exists", path });
  }
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return ok({ kind: "installed", path });
  } catch (cause) {
    return err({ kind: "write_failed", path, cause });
  }
}
