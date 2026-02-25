# Printr MCP — Project Conventions

MCP server for the Printr API. Enables AI agents to create, discover, and track tokens across chains.

## Runtime & Tooling

- **Runtime:** Bun only (`bun`, `bunx`). Never use npm, yarn, or pnpm.
- **Linter/Formatter:** Biome (`biome.json`). Never touch ESLint or Prettier config.
- **Type checking:** `tsc --noEmit` (strict mode, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`)
- **Env loading:** Bun auto-loads `.env`. Do not add dotenv.

## Key Commands

| Command                 | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `bun run dev`           | Start with hot reload                            |
| `bun run check`         | typecheck + lint + test (full CI gate)           |
| `bun run test`          | Unit & integration tests                         |
| `bun run test:e2e`      | E2E tests (hits preview API — needs env vars)    |
| `bun run build`         | Build for distribution                           |
| `bun run lint:fix`      | Auto-fix Biome issues                            |
| `bun run generate:api`  | Regenerate OpenAPI types from spec               |

## Architecture

`src/index.ts` — CLI routing + MCP server entry. All tools registered here.

`src/lib/` — pure utilities: `client.ts` (HTTP + neverthrow + toolOk/toolError), `keystore.ts` (AES-GCM+scrypt wallet store), `wallet-elicit.ts` (wallet resolution), `evm.ts`, `svm.ts`, `chains.ts`, `qr.ts`, `schemas.ts`

`src/server/` — ephemeral local HTTPS server for browser signing sessions (Hono, ports 5174–5200)

`src/tools/` — one file per MCP tool, each exporting `register<Name>Tool(server, client?)`

`src/cli/` — `setup` sub-command (detects AI clients, writes MCP config)

## Non-Obvious Rules

### Error handling
- **Never use try/catch for business logic.** Use `neverthrow` (`Result`, `ResultAsync`).
- try/catch is allowed only at MCP tool handler boundaries (outermost level).
- For async pipelines: use `ResultAsync`, never `Promise<Result<T,E>>` (breaks chaining).
- `toToolResponseAsync()` is the standard way to terminate a `ResultAsync` pipeline into an MCP response.
- `toolOk(data)` / `toolError(text)` (from `~/lib/client.js`) for tools that don't use neverthrow pipelines. **Do not redeclare these locally.**

### Imports
- Path alias `~/` maps to `./src/`. Always use it for source imports.
- Test files (`*.spec.ts`) use relative paths (e.g. `"./client.js"`), not `~/`.
- Always include `.js` extension — required by `verbatimModuleSyntax`.

### Tool response pattern
- Tools using neverthrow: `return toToolResponseAsync(pipeline)`
- Tools using try/catch at boundary: `return toolOk(data)` / `return toolError(msg)`
- `structuredContent` must always mirror the `content[0].text` JSON — do not diverge.
- When appending extra text (e.g. QR code) to a response, update `content[0].text` only; `structuredContent` stays as the plain data object.

### Validation
- Zod schemas for all tool inputs and outputs (`inputSchema`, `outputSchema`).
- Shared schemas go in `src/lib/schemas.ts`. Tool-specific ones stay local.

### Wallet / signing flow
- `activeWallets` (in-memory) is set by `printr_wallet_new`, `printr_wallet_import`, `printr_wallet_unlock`. It is cleared on server restart.
- `AGENT_MODE=1` bypasses interactive wallet selection — uses `EVM_WALLET_PRIVATE_KEY` / `SVM_WALLET_PRIVATE_KEY` directly.
- scrypt KDF uses N=131072 (needs 128 MB) — always pass `maxmem: SCRYPT_MAXMEM` (256 MB) to both `encryptKey` and `decryptKey`.

### Style
- No section-divider comments (`// ── foo ──────`). Use blank lines to separate logical blocks.
- 2-space indent, double quotes, semicolons, trailing commas (enforced by Biome).

## Adding a New Tool

1. Create `src/tools/<name>.ts`
2. Define Zod `inputSchema` and `outputSchema`
3. Export `register<Name>Tool(server: McpServer, client?: PrintrClient)`
4. Call `server.registerTool(id, { description, inputSchema, outputSchema }, handler)`
5. Register in `src/index.ts`
6. Add tests in `src/tools/<name>.spec.ts`

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description` — lowercase, no period, imperative.
- Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`
- No co-author trailers. Validated by commitlint via Husky `commit-msg` hook.

## Quality Gates (Husky)

| Hook         | Command      |
| ------------ | ------------ |
| `commit-msg` | `commitlint` |
| `pre-commit` | `bun test`   |

## Release

Automated via release-please. Merge the release PR → triggers typecheck → tests → build → `npm publish`.
Required secret: `NPM_TOKEN` in repo Settings → Secrets → Actions.

## Environment Variables

| Variable                 | Required | Description                                                                  |
| ------------------------ | -------- | ---------------------------------------------------------------------------- |
| `PRINTR_API_KEY`         | No       | Partner API key. Falls back to default public AI-integration key.            |
| `PRINTR_API_BASE_URL`    | No       | Override API base URL (default: `https://api-preview.printr.money`)          |
| `PRINTR_APP_URL`         | No       | Override web app URL (default: `https://app.printr.money`)                   |
| `PRINTR_CDN_URL`         | No       | Override CDN URL (default: `https://cdn.printr.money`)                       |
| `OPENROUTER_API_KEY`     | No       | Enables auto-generated token images via OpenRouter                           |
| `OPENROUTER_IMAGE_MODEL` | No       | OpenRouter model (default: `google/gemini-2.5-flash-image`)                  |
| `EVM_WALLET_PRIVATE_KEY` | No       | EVM private key for AGENT_MODE autonomous signing                            |
| `SVM_WALLET_PRIVATE_KEY` | No       | Solana private key (base58) for AGENT_MODE autonomous signing                |
| `SVM_RPC_URL`            | No       | Solana RPC endpoint (default: `https://api.mainnet-beta.solana.com`)         |
| `AGENT_MODE`             | No       | Set to `1` to use env-var keys instead of interactive wallet selection       |
| `PRINTR_WALLET_STORE`    | No       | Override keystore path (default: `~/.printr/wallets.json`)                   |
