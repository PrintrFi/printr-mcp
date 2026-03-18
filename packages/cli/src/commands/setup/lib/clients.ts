import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ClientDef, ConfigureResult, McpEntry, Runtime } from "../types.js";

export function commandExists(cmd: string): boolean {
  return spawnSync("which", [cmd], { stdio: "ignore", timeout: 3_000 }).status === 0;
}

export function detectRuntime(): Runtime {
  if ((process.versions as Record<string, string | undefined>).bun) return "bun";
  return spawnSync("bun", ["--version"], { stdio: "ignore", timeout: 3_000 }).status === 0
    ? "bun"
    : "node";
}

export function makeEntry(runtime: Runtime, openrouterApiKey: string): McpEntry {
  const entry: McpEntry =
    runtime === "bun"
      ? { command: "bunx", args: ["@printr/mcp@latest"] }
      : { command: "npx", args: ["-y", "@printr/mcp@latest"] };
  if (openrouterApiKey) entry.env = { OPENROUTER_API_KEY: openrouterApiKey };
  return entry;
}

export function mergeJsonConfig(
  cfgPath: string,
  entry: McpEntry,
): "configured" | "already_configured" {
  let cfg: Record<string, unknown> = {};
  if (existsSync(cfgPath)) {
    try {
      cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
    } catch {
      copyFileSync(cfgPath, `${cfgPath}.bak`);
      cfg = {};
    }
  }
  const servers = (cfg.mcpServers as Record<string, unknown> | undefined) ?? {};
  if (servers.printr) return "already_configured";
  cfg.mcpServers = { ...servers, printr: entry };
  mkdirSync(dirname(cfgPath), { recursive: true });
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  return "configured";
}

function claudeDesktopPath(): string {
  return process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
    : join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
        "Claude",
        "claude_desktop_config.json",
      );
}

export const CLIENTS: ClientDef[] = [
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    detect() {
      const p = claudeDesktopPath();
      return (
        existsSync(p) ||
        (process.platform === "darwin" && existsSync("/Applications/Claude.app")) ||
        existsSync(dirname(p))
      );
    },
    configure: (entry) => mergeJsonConfig(claudeDesktopPath(), entry),
  },
  {
    id: "cursor",
    label: "Cursor",
    detect: () => commandExists("cursor") || existsSync(join(homedir(), ".cursor")),
    configure: (entry) => mergeJsonConfig(join(homedir(), ".cursor", "mcp.json"), entry),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    detect: () => commandExists("windsurf") || existsSync(join(homedir(), ".codeium", "windsurf")),
    configure: (entry) =>
      mergeJsonConfig(join(homedir(), ".codeium", "windsurf", "mcp_config.json"), entry),
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    detect: () => commandExists("gemini") || existsSync(join(homedir(), ".gemini")),
    configure: (entry) => mergeJsonConfig(join(homedir(), ".gemini", "settings.json"), entry),
  },
  {
    id: "claude-code",
    label: "Claude Code",
    detect: () => commandExists("claude"),
    configure(_, runtime) {
      const list = spawnSync("claude", ["mcp", "list"], { encoding: "utf8" });
      if (list.stdout?.toLowerCase().includes("printr")) return "already_configured";

      const runner = runtime === "bun" ? "bunx" : "npx";
      const runnerArgs = runtime === "bun" ? ["@printr/mcp@latest"] : ["-y", "@printr/mcp@latest"];

      const result = spawnSync(
        "claude",
        ["mcp", "add", "--scope", "user", "printr", "--", runner, ...runnerArgs],
        { stdio: "pipe" },
      );
      return result.status === 0 ? "configured" : "failed";
    },
  },
];

export const ALL_CLIENT_IDS = CLIENTS.map((c) => c.id);

export const RESULT_STATUS: Record<ConfigureResult, import("../types.js").StepStatus> = {
  configured: "ok",
  already_configured: "warn",
  not_detected: "skip",
  failed: "error",
};

export const RESULT_DETAIL: Partial<Record<ConfigureResult, string>> = {
  already_configured: "already configured",
  failed: "configuration failed — run manually",
};
