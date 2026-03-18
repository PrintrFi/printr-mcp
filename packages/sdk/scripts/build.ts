#!/usr/bin/env bun
import { Glob, $ } from "bun";

const isWatch = process.argv.includes("--watch");

// Get all .ts files excluding .spec.ts and .d.ts files
const srcGlob = new Glob("src/**/*.ts");
const files: string[] = [];
for await (const file of srcGlob.scan({ cwd: import.meta.dir + "/.." })) {
  if (!file.includes(".spec.") && !file.endsWith(".d.ts")) {
    files.push(file);
  }
}

const entrypoints = files.map((f) => `./${f}`);

console.log(`Building ${entrypoints.length} entry points...`);

const args = [
  "bun",
  "build",
  ...entrypoints,
  "--outdir",
  "./dist",
  "--target",
  "node",
  "--format",
  "esm",
  "--external",
  "sharp",
  "--root",
  "./src",
];

if (isWatch) {
  args.push("--watch");
}

// Run the bun build
await $`${args}`;

// Generate type declarations
if (!isWatch) {
  console.log("Generating type declarations...");
  await $`bunx tsc --emitDeclarationOnly --outDir ./dist`;
  console.log("Type declarations generated.");
}
