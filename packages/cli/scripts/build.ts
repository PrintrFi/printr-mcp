#!/usr/bin/env bun
import { Glob, $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const isWatch = process.argv.includes("--watch");
const rootDir = join(import.meta.dir, "..");
const distDir = join(rootDir, "dist");
const skillsSourceDir = join(rootDir, "skills");
const skillsDestDir = join(distDir, "skills");

// Get all .ts/.tsx files excluding .spec.ts and .d.ts files
const srcGlob = new Glob("src/**/*.{ts,tsx}");
const files: string[] = [];
for await (const file of srcGlob.scan({ cwd: rootDir })) {
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
  "--external",
  "ink",
  "--external",
  "react",
  "--external",
  "ink-spinner",
  "--root",
  "./src",
];

if (isWatch) {
  args.push("--watch");
}

// Run the bun build
await $`${args}`;

// Make CLI entry point executable
await $`chmod +x ./dist/index.js`;

// Copy skills directory
if (!isWatch) {
  console.log("Copying skills directory...");
  await mkdir(skillsDestDir, { recursive: true });
  await $`cp -r ${skillsSourceDir} ${skillsDestDir}/..`;
  console.log("Skills directory copied.");
}

// Generate type declarations
if (!isWatch) {
  console.log("Generating type declarations...");
  await $`bunx tsc --emitDeclarationOnly --outDir ./dist`;
  console.log("Type declarations generated.");
}
