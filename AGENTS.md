# Printr Monorepo

Monorepo containing the Printr SDK and MCP server for AI agents to launch tokens across EVM chains and Solana.

## Packages

| Package | Description |
|---------|-------------|
| `@printr/sdk` | Core TypeScript SDK with pure blockchain/API functionality |
| `@printr/mcp` | MCP server that wraps the SDK for AI agent integration |

## Commands

```
bun run dev       # Hot reload MCP server
bun run check     # typecheck + lint + test (CI gate)
bun run test      # Unit & integration tests (all packages)
bun run build     # Build all packages
bun run lint:fix  # Auto-fix linting issues
```

Package-specific commands:
```
bun run --cwd packages/sdk test      # SDK tests only
bun run --cwd packages/mcp test      # MCP tests only
```

## Structure

```
packages/
├── sdk/                    @printr/sdk - Core SDK
│   └── src/
│       ├── index.ts        Barrel export
│       ├── client.ts       API client factory
│       ├── chains.ts       Chain metadata & RPC
│       ├── caip.ts         CAIP-2/10 utilities
│       ├── evm.ts          EVM signing
│       ├── svm.ts          Solana signing
│       ├── balance.ts      Balance queries
│       ├── transfer.ts     Native transfers
│       ├── token.ts        Token creation
│       ├── image.ts        Image processing
│       ├── keystore.ts     Wallet encryption
│       ├── state.ts        Persistent state
│       ├── fees-api.ts     Protocol fees
│       ├── schemas.ts      Shared Zod schemas
│       └── env.ts          SDK environment config
│
└── mcp/                    @printr/mcp - MCP Server
    └── src/
        ├── index.ts        CLI entry (setup, skill, --help, default → MCP)
        ├── mcp.ts          MCP server setup, tool registration
        ├── tools/          One file per tool: register<Name>Tool(server)
        ├── server/         Browser signing server (Hono, ports 5174–5200)
        ├── cli/            setup + skill sub-commands (Ink TUI)
        └── lib/
            ├── env.ts              MCP env (extends SDK env)
            ├── wallet-sessions.ts  Active wallet tracking
            └── qr.ts               QR code generation
```

## Patterns

**Errors:** `neverthrow` for business logic. `toToolResponseAsync()` terminates pipelines. `toolOk()`/`toolError()` for simple tools.

**Imports:**
- SDK: Relative imports (`./file.js`). Always `.js` extension.
- MCP: `@printr/sdk` for SDK imports, `~/` for MCP-internal files.

**Tool responses:** `structuredContent` must mirror `content[0].text` JSON.

**Validation:** Zod schemas for all I/O. Shared schemas in `@printr/sdk` (`schemas.ts`).

**Wallets:** `activeWallets` set by wallet tools, cleared on restart. `AGENT_MODE=1` uses env keys directly.

## Adding a Tool (MCP)

1. `packages/mcp/src/tools/<name>.ts` — Zod `inputSchema`/`outputSchema`, export `register<Name>Tool`
2. Register in `packages/mcp/src/mcp.ts`
3. Test in `packages/mcp/src/tools/<name>.spec.ts`

## Adding SDK Functionality

1. Create/modify file in `packages/sdk/src/`
2. Export from `packages/sdk/src/index.ts`
3. Test in `packages/sdk/src/<name>.spec.ts`
4. Import in MCP via `@printr/sdk`

## Commits

Conventional: `type(scope): description`
Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`
Scopes: `sdk`, `mcp`, or omit for root changes
