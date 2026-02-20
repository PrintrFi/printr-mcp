# Printr MCP - Project Conventions

MCP server for the Printr API. Enables AI agents to create, discover, and track tokens across chains.

## Runtime & Tooling

- **Runtime:** Bun (not Node.js). Use `bun` for all commands.
- **Package manager:** `bun install` / `bun add` / `bun remove` (not npm/yarn/pnpm)
- **Linter & Formatter:** Biome (not ESLint/Prettier). Config: `biome.json`
- **Type checking:** `tsc --noEmit` (strict mode)
- **Environment:** Bun auto-loads `.env` files. Do not use dotenv.

## Key Commands

| Command                | Purpose                              |
| ---------------------- | ------------------------------------ |
| `bun run dev`          | Start with hot reload                |
| `bun run test`         | Run unit & integration tests         |
| `bun run test:coverage`| Run unit & integration tests with lcov coverage |
| `bun run test:e2e`     | Run E2E tests (requires API env vars)|
| `bun run test:all`     | Run all tests (unit + integration + E2E) |
| `bun run build`        | Build for distribution               |
| `bun run lint`         | Check with Biome                     |
| `bun run lint:fix`     | Auto-fix Biome issues                |
| `bun run format`       | Format with Biome                    |
| `bun run typecheck`    | Type-check without emitting          |
| `bun run check`        | typecheck + lint + test (full CI)    |
| `bun run generate:api` | Regenerate OpenAPI types             |

## Architecture

```
src/
  index.ts              # Entry point: creates MCP server, registers tools, connects stdio transport
  api.gen.d.ts          # Auto-generated OpenAPI types. Never edit by hand.
  integration.spec.ts   # Integration tests (MCP client-server via InMemoryTransport)
  e2e.spec.ts           # E2E tests against real Printr preview API
  lib/
    client.ts           # Typed HTTP client (openapi-fetch), error unwrapping (neverthrow)
    schemas.ts          # Shared Zod schemas for tool input/output validation
    test-helpers.ts     # Mock server, mock client, response factories, verbose logging
  tools/
    quote.ts            # printr_quote tool
    create-token.ts     # printr_create_token tool
    get-token.ts        # printr_get_token tool
    get-deployments.ts  # printr_get_deployments tool
```

Each MCP tool lives in `src/tools/<name>.ts` and exports a `register*Tool(server, client)` function. Tools are wired together in `src/index.ts`.

## Coding Conventions

### Imports

- Path alias: `~/` maps to `./src/` (tsconfig paths)
- Source files: use `~/` alias (e.g., `import { foo } from "~/lib/client.js"`)
- Test files (`*.spec.ts`): use regular relative paths (e.g., `import { foo } from "./lib/client.js"`)
- Always use `.js` extension in import specifiers
- Required by `verbatimModuleSyntax: true`

### Error Handling

- Use `neverthrow` Result types, not try/catch
- For async operations that can fail: use `ResultAsync`, never `Promise<Result<T, E>>`
- `unwrapResult()` converts a single openapi-fetch response to `Result<T, PrintrApiError>`; use `unwrapResultAsync()` for promises so the pipeline stays as `ResultAsync`
- `toToolResponse()` / `toToolResponseAsync()` convert a Result or ResultAsync into the MCP tool response format

### Validation

- Use Zod for all input/output schemas
- Define schemas alongside the tool that uses them, or in `src/lib/schemas.ts` for shared ones

### Style (enforced by Biome)

- 2-space indentation, double quotes, semicolons, trailing commas
- LF line endings, 100 character line width
- `const` over `let`; template literals over concatenation (warn)

## Testing

- Framework: `bun:test` (import from `"bun:test"`)
- Test files: `*.spec.ts` co-located with source files
- Integration tests: `src/integration.spec.ts` (uses MCP SDK `InMemoryTransport`)
- Mock helpers in `src/lib/test-helpers.ts`: `createMockServer`, `createMockClient`, `mockSuccessResponse`, `mockErrorResponse`
- Verbose logging helpers in `src/lib/test-helpers.ts`: `log`, `logResult` (enabled via `VERBOSE=1`)
- Unit/integration tests use mock client/server pattern; no real API calls
- E2E tests in `src/e2e.spec.ts` hit the real preview API; skipped when env vars are absent

## Adding a New Tool

1. Create `src/tools/<name>.ts`
2. Define Zod `inputSchema` and `outputSchema`
3. Export `register<Name>Tool(server: McpServer, client: PrintrClient)`
4. Call `server.registerTool(toolName, { description, inputSchema, outputSchema }, handler)`
5. Handler pattern: `return toToolResponseAsync(unwrapResultAsync(client.METHOD(...)))` (keep pipelines as ResultAsync; avoid `await` + `unwrapResult` which yields `Promise<Result>`)
6. Register the tool in `src/index.ts`
7. Add unit tests in `src/tools/<name>.spec.ts` following existing patterns

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Format: `type(scope): description` — all lowercase, no period, imperative mood
- Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`
- Scope is optional but preferred (e.g., `test(e2e):`, `feat(quote):`, `chore(deps):`)
- Keep messages terse — one line, no body unless essential
- No co-author trailers

Commit messages are validated locally by [commitlint](https://commitlint.js.org/) via the `commit-msg` Husky hook. Invalid messages are rejected before the commit is created.

## Quality Gates

Enforced locally via [Husky](https://typicode.github.io/husky/):

| Hook | Command | Runs on |
| ------------ | -------------- | -------------- |
| `commit-msg` | `commitlint` | every commit |
| `pre-commit` | `bun test` | every commit |

Config: [`commitlint.config.cjs`](./commitlint.config.cjs)

## Release

Releases are published to npm automatically via GitHub Actions (`.github/workflows/release.yml`) when a version tag is pushed.

**To cut a release:**

```sh
# 1. bump version in package.json
# 2. commit the bump
git commit -m "chore(release): bump version to x.y.z"
# 3. tag and push
git tag vx.y.z && git push && git push --tags
```

The workflow then runs typecheck → tests → build → `npm publish`, and creates a GitHub Release with auto-generated notes from commits.

**Required secret:** `NPM_TOKEN` — an npm Automation token added to repo Settings → Secrets → Actions.

## Environment Variables

| Variable                 | Required | Description                                                                                    |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| `PRINTR_API_KEY`         | Yes      | Partner API key (Bearer JWT)                                                                   |
| `PRINTR_API_BASE_URL`    | No       | Override API base URL (default: `https://api-preview.printr.money`)                           |
| `PRINTR_APP_URL`         | No       | Override Printr web app URL (default: `https://app.printr.money`)                             |
| `PRINTR_TEST_TOKEN_ID`   | No       | Known token ID used in E2E tests for `get_token` / `get_deployments`                          |
| `OPENROUTER_API_KEY`     | No       | Enables auto-generated token images via OpenRouter when no `image`/`image_path` is supplied   |
| `OPENROUTER_IMAGE_MODEL` | No       | OpenRouter model for image generation (default: `google/gemini-2.5-flash-image`)              |

## Documentation References

- **MCP SDK (TypeScript):** `node_modules/@modelcontextprotocol/sdk/dist/esm/` for type definitions; upstream docs at https://github.com/modelcontextprotocol/typescript-sdk/tree/main/docs
- **MCP Protocol spec:** https://modelcontextprotocol.io/docs
- **openapi-fetch:** https://openapi-ts.dev/openapi-fetch/
- **Bun APIs:** `node_modules/bun-types/docs/**.mdx` for local reference
- **neverthrow:** https://github.com/supermacro/neverthrow
- **Zod:** https://zod.dev
- **Biome:** https://biomejs.dev

This is a backend MCP server project. Currently there is no frontend or HTML. The dist bundle must remain compatible with Node.js ≥ 18 (see `engines` in package.json) so it can run via `npx` as well as `bunx`.
