# Printr MCP

MCP server for the Printr API. Enables AI agents to create, discover, and track tokens across chains.

## Commands

```
bun run dev          # Start with hot reload
bun run check        # typecheck + lint + test (CI gate)
bun run test         # Unit & integration tests
bun run build        # Build for distribution
bun run lint:fix     # Auto-fix Biome issues
```

## Architecture

- `src/index.ts` — CLI routing + MCP server entry
- `src/lib/` — pure utilities (client, keystore, wallet, chains, schemas)
- `src/tools/` — one file per MCP tool, exports `register<Name>Tool(server, client?)`
- `src/server/` — ephemeral HTTPS server for browser signing (Hono, ports 5174–5200)
- `src/cli/` — `setup` sub-command (detects AI clients, writes MCP config)

## Patterns

**Error handling:** Use `neverthrow` (`Result`, `ResultAsync`) for business logic. try/catch only at MCP handler boundaries. `toToolResponseAsync()` terminates pipelines. `toolOk(data)` / `toolError(msg)` for simple tools.

**Imports:** Path alias `~/` → `./src/`. Always include `.js` extension. Test files use relative paths.

**Tool responses:** `structuredContent` must mirror `content[0].text` JSON. Extra text (QR codes) goes in `content[0].text` only.

**Validation:** Zod schemas for all tool I/O. Shared schemas in `src/lib/schemas.ts`.

**Wallets:** `activeWallets` set by wallet tools, cleared on restart. `AGENT_MODE=1` uses env-var keys directly. scrypt needs `maxmem: SCRYPT_MAXMEM` (256 MB).

## Adding a Tool

1. Create `src/tools/<name>.ts` with Zod `inputSchema`/`outputSchema`
2. Export `register<Name>Tool(server, client?)`
3. Register in `src/index.ts`
4. Add tests in `src/tools/<name>.spec.ts`

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`
Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`
