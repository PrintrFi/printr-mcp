#!/usr/bin/env bun
import { $ } from "bun";

const isWatch = process.argv.includes("--watch");

console.log("Building MCP server...");

// Externalize every declared runtime dep. Inlining a CJS dep makes Bun's `node`
// target prepend a `createRequire(import.meta.url)` shim, which throws on
// Cloudflare Workers (`node:module` isn't part of `nodejs_compat` and
// `import.meta.url` is undefined there). Mirrors the SDK build so the
// `remote-safe` subpath is Workers-safe; the CLI resolves deps from node_modules
// at runtime.
const pkg = (await Bun.file(`${import.meta.dir}/../package.json`).json()) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const externalDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];
const externalArgs = [
  ...externalDeps.flatMap((dep) => ["--external", dep]),
  "--external",
  "node:*",
];

const args = [
  "bun",
  "build",
  // CLI / stdio entry.
  "./src/index.ts",
  // Workers-safe subpath: read + build-unsigned tool registration only.
  "./src/tools/remote-safe.ts",
  "--outdir",
  "./dist",
  // `browser` (not `node`) avoids the createRequire CJS-interop shim; with deps
  // externalized the source is clean ESM that runs on Node, Bun, and Workers.
  "--target",
  "browser",
  "--format",
  "esm",
  ...externalArgs,
  "--root",
  "./src",
];

if (isWatch) {
  args.push("--watch");
}

// Run the bun build
await $`${args}`;

// Make entry point executable for CLI usage
await $`chmod +x ./dist/index.js`;

// Generate type declarations
if (!isWatch) {
  console.log("Generating type declarations...");
  await $`bunx tsc --emitDeclarationOnly --outDir ./dist`;
  console.log("Type declarations generated.");
}
