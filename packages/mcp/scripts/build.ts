#!/usr/bin/env bun
import { $ } from "bun";

const isWatch = process.argv.includes("--watch");

console.log("Building MCP server...");

const args = [
  "bun",
  "build",
  "./src/index.ts",
  "--outdir",
  "./dist",
  "--target",
  "node",
  "--format",
  "esm",
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
