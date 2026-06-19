import { resolve } from "node:path";
import ts from "typescript";

// Resolve @printr/* to source (not built dist) so hover types never go stale.
// Used by the MDX pipeline (source.config.ts) to compile every ```ts twoslash
// fence against the real package source. Build/codegen always run from
// apps/docs, so the repo root is two levels up.
const repoRoot = resolve(process.cwd(), "../..");

export const twoslashCompilerOptions = {
  baseUrl: repoRoot,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  paths: {
    "@printr/sdk": ["packages/sdk/src/index.ts"],
    "@printr/mcp": ["packages/mcp/src/index.ts"],
    "@printr/cli": ["packages/cli/src/index.ts"],
  },
};
