#!/usr/bin/env bun
/**
 * Advisory lint: flags a `//` line comment placed directly above a function
 * declaration and suggests converting it to a TSDoc block (`/** ... *\/`), so
 * documentation is picked up by editors and API docs instead of being a plain
 * inline comment.
 *
 * Warn-only — always exits 0, so it never blocks CI. Run with `bun run check:tsdoc`.
 */
import { Glob } from "bun";

type Finding = {
  file: string;
  line: number;
  comment: string;
  fn: string;
};

/**
 * Lines that begin a module-level named function-shaped declaration: `function`
 * declarations and arrow functions bound to a `const`. Anchored at column 0, so
 * indented inner helpers and class methods are intentionally out of scope —
 * their preceding comments are usually implementation notes, not API docs.
 */
const FUNCTION_RES = [
  // `function f`, `export default async function f`
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b/,
  // `const f = () =>`, `export const f = async (x) =>`, `const f: T = x =>`
  /^(?:export\s+)?const\s+[\w$]+\s*(?::.+)?=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]+?)?=>/,
];

/** Matches a `//` line comment, but not a `///` triple-slash directive. */
const LINE_COMMENT_RE = /^\s*\/\/(?!\/)/;

/** Tool pragmas / task markers that are not documentation and should be ignored. */
const PRAGMA_RE = /^\s*\/\/\s*(biome-ignore|@ts-|eslint-|prettier-|TODO|FIXME|HACK)\b/;

/** Scan one source file for `//` comments sitting directly above a function. */
async function findInFile(path: string): Promise<Finding[]> {
  const lines = (await Bun.file(path).text()).split("\n");
  const findings: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i] ?? "";
    if (!FUNCTION_RES.some((re) => re.test(current))) {
      continue;
    }
    const prev = lines[i - 1];
    if (prev === undefined || !LINE_COMMENT_RE.test(prev) || PRAGMA_RE.test(prev)) {
      continue;
    }
    findings.push({ file: path, line: i + 1, comment: prev.trim(), fn: current.trim() });
  }
  return findings;
}

async function main(): Promise<void> {
  const glob = new Glob("packages/*/src/**/*.{ts,tsx}");
  const findings: Finding[] = [];
  for await (const path of glob.scan(".")) {
    if (path.includes("/proto/") || path.endsWith(".spec.ts") || path.endsWith(".test.ts")) {
      continue;
    }
    findings.push(...(await findInFile(path)));
  }

  if (findings.length === 0) {
    console.log("check:tsdoc — no `//` comments found directly above a function.");
    return;
  }

  console.warn(
    `check:tsdoc — ${findings.length} function(s) preceded by a \`//\` comment. ` +
      "Prefer a TSDoc block (/** ... */) so the doc is surfaced by tooling:\n",
  );
  for (const f of findings) {
    console.warn(`  ${f.file}:${f.line}`);
    console.warn(`    ${f.comment}`);
    console.warn(`    ${f.fn}\n`);
  }
}

await main();
