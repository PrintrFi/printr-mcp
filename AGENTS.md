# Printr MCP

MCP server for the Printr API. Enables AI agents to launch tokens across EVM chains and Solana.

## Commands

```
bun run dev       # Hot reload
bun run check     # typecheck + lint + test (CI gate)
bun run test      # Unit & integration
bun run build     # Distribution build
bun run lint:fix  # Auto-fix
```

## Structure

```
src/index.ts    CLI routing (setup, skill, --help, default → MCP)
src/mcp.ts      MCP server setup, tool registration
src/lib/        Pure utilities (client, keystore, chains, schemas)
src/tools/      One file per tool: register<Name>Tool(server, client?)
src/server/     Browser signing server (Hono, ports 5174–5200)
src/cli/        setup + skill sub-commands (Ink TUI)
```

## Patterns

**Errors:** `neverthrow` for business logic. `toToolResponseAsync()` terminates pipelines. `toolOk()`/`toolError()` for simple tools.

**Imports:** `~/` → `./src/`. Always `.js` extension.

**Tool responses:** `structuredContent` must mirror `content[0].text` JSON.

**Validation:** Zod schemas for all I/O. Shared in `src/lib/schemas.ts`.

**Wallets:** `activeWallets` set by wallet tools, cleared on restart. `AGENT_MODE=1` uses env keys directly.

## Adding a Tool

1. `src/tools/<name>.ts` — Zod `inputSchema`/`outputSchema`, export `register<Name>Tool`
2. Register in `src/mcp.ts`
3. Test in `src/tools/<name>.spec.ts`

## Commits

Conventional: `type(scope): description`
Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`
