import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const toolsDir = resolve(import.meta.dir, "../../../packages/mcp/src/tools");
const mcpDocPath = resolve(import.meta.dir, "../content/docs/mcp.mdx");

/** Every `printr_*` name passed to `server.registerTool(...)` across the MCP tools. */
function registeredToolNames(): string[] {
  const names = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".spec.ts")) {
      continue;
    }
    const src = readFileSync(resolve(toolsDir, file), "utf8");
    for (const match of src.matchAll(/registerTool\(\s*["']([a-z0-9_]+)["']/g)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

describe("MCP tool docs stay in sync with the code", () => {
  const doc = readFileSync(mcpDocPath, "utf8");
  const tools = registeredToolNames();

  it("finds the registered tool surface", () => {
    expect(tools.length).toBeGreaterThan(20);
  });

  // Drift guard: a tool added/renamed in code but missing from mcp.mdx fails here.
  it.each(tools)("documents %s in mcp.mdx", (name) => {
    expect(doc).toContain(name);
  });

  it("does not document a printr_ tool that no longer exists in code", () => {
    const registered = new Set(tools);
    const documented = new Set([...doc.matchAll(/`(printr_[a-z0-9_]+)`/g)].map((m) => m[1]));
    const orphans = [...documented].filter((name) => !registered.has(name));
    expect(orphans).toEqual([]);
  });
});
