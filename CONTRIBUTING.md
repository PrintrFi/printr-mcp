# Contributing to Printr

Thanks for contributing. This guide covers local setup, the conventions the CI gate and git
hooks enforce, and how to add functionality. For the monorepo map and patterns, see
[`AGENTS.md`](./AGENTS.md); for domain terms, see [`CONTEXT.md`](./CONTEXT.md).

## Prerequisites

- [Bun](https://bun.sh) (the repo uses Bun as runtime, package manager, and test runner)
- Node-compatible toolchain is not required — everything runs through Bun

## Setup

```bash
bun install        # install workspace dependencies + set up git hooks (husky)
bun run build      # build all packages
bun run check      # typecheck + lint + test (the CI gate)
```

`bun install` runs the `prepare` script, which installs the husky hooks. If hooks do not fire,
run `bun run prepare` once.

## Workspace layout

| Package | Description |
|---------|-------------|
| `@printr/sdk` | Core TypeScript SDK — pure blockchain/API functionality |
| `@printr/mcp` | MCP server wrapping the SDK for AI agent integration |
| `@printr/cli` | CLI to configure MCP servers and install agent skills |

See [`AGENTS.md`](./AGENTS.md) for the per-file structure.

## Common commands

```bash
bun run dev          # hot-reload CLI dev entry
bun run dev:mcp      # hot-reload MCP server
bun run check        # typecheck + lint + test (run before every PR)
bun run test         # tests across all packages
bun run lint:fix     # auto-fix lint issues
bun run format       # format with Biome
bun run check:tsdoc  # verify TSDoc on public exports

# scoped to one package
bun run --cwd packages/sdk test
bun run --cwd packages/mcp test
```

## Code style

Style is enforced by [Biome](./biome.json) and a few project conventions:

- **Errors:** use `neverthrow` `Result`/`ResultAsync` for failable business logic. Reserve
  `try/catch` for tool-handler boundaries. Prefer `.match(okFn, errFn)` over `.isErr()`/`.isOk()`.
- **Functions:** use named `function` declarations for multiline bodies; reserve arrow functions
  for single expressions.
- **Validation:** Zod schemas for all I/O. Shared schemas live in `@printr/sdk` (`schemas.ts`).
- **Imports:** SDK uses relative imports with explicit `.js` extensions; MCP imports the SDK as
  `@printr/sdk` and internal files via `~/`.
- **TSDoc:** every function re-exported from `packages/sdk/src/index.ts` and every `register*Tool`
  in the MCP package must carry TSDoc. `bun run check:tsdoc` enforces this.

## Tests

- Runtime tests use `bun:test` in `*.spec.ts` next to the code under test.
- Run `bun run check` before opening a PR — `pre-commit` runs lint + typecheck + tests, so a
  green `check` keeps commits fast.

## Commits

The `commit-msg` hook runs commitlint and rejects `Co-Authored-By:` trailers.

- **Format:** Conventional Commits — `type(scope): description`
- **Types:** `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`, `build`, `perf`, `revert`
- **Scopes:** `sdk`, `mcp`, `cli`, or omit for root-level changes
- **No `Co-Authored-By:` trailers** — the hook will reject the commit.

## Pull requests

1. Branch off `main`.
2. Keep changes scoped; split unrelated work into separate commits.
3. Ensure `bun run check` passes locally.
4. Open the PR against `main`. Releases are automated via release-please.

## Adding a tool (MCP)

1. Create `packages/mcp/src/tools/<name>.ts` with Zod `inputSchema`/`outputSchema` and an exported
   `register<Name>Tool`.
2. Register it in `packages/mcp/src/mcp.ts`.
3. Add `packages/mcp/src/tools/<name>.spec.ts`.

Tool responses must keep `structuredContent` mirroring the JSON in `content[0].text`.

## Adding SDK functionality

1. Create or modify a file in `packages/sdk/src/`.
2. Export it from `packages/sdk/src/index.ts` (with TSDoc).
3. Add `packages/sdk/src/<name>.spec.ts`.
4. Consume it in MCP via `@printr/sdk`.
