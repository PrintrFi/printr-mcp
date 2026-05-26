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

// Externalize every declared runtime dep so the published bundle never inlines
// other packages. Inlining a CJS dep makes Bun emit a
// `createRequire(import.meta.url)` shim at the top of every entry — Cloudflare
// Workers reject this because `node:module` is not part of `nodejs_compat`.
// Listing each dep here also keeps Workers + browser consumers free to swap in
// their own bundler's CJS interop.
const pkg = (await Bun.file(`${import.meta.dir}/../package.json`).json()) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const externalDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];
// Also externalize all `node:*` imports so the browser target leaves them as
// bare specifiers. Node + Workers (with `nodejs_compat`) resolve them at
// runtime; consumer bundlers handle them however they need.
const externalArgs = [
  ...externalDeps.flatMap((dep) => ["--external", dep]),
  "--external",
  "node:*",
];

console.log(
  `Building ${entrypoints.length} entry points (externalizing ${externalDeps.length} deps)...`,
);

// Use `--target browser` rather than `node`. The node target prepends a
// `createRequire(import.meta.url)` shim to every entry as a CJS-interop helper;
// Cloudflare Workers reject `node:module` (not part of `nodejs_compat`) so any
// import of the SDK throws on Worker startup. With all deps externalized the
// SDK source itself has no CJS — the browser target produces clean ESM that
// works on Node, Workers, and browsers identically.
const args = [
  "bun",
  "build",
  ...entrypoints,
  "--outdir",
  "./dist",
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

// Generate type declarations
if (!isWatch) {
  console.log("Generating type declarations...");
  await $`bunx tsc --emitDeclarationOnly --outDir ./dist`;
  console.log("Type declarations generated.");
}
