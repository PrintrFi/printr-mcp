# @printr/mcp

[![npm version](https://img.shields.io/npm/v/@printr/mcp.svg)](https://www.npmjs.com/package/@printr/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@printr/mcp.svg)](https://www.npmjs.com/package/@printr/mcp)
[![license](https://img.shields.io/npm/l/@printr/mcp.svg)](https://github.com/PrintrFi/printr-mcp/blob/main/LICENSE)
[![CI](https://github.com/PrintrFi/printr-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/PrintrFi/printr-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/PrintrFi/printr-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/PrintrFi/printr-mcp)
[![skills.sh](https://skills.sh/b/PrintrFi/printr-mcp)](https://skills.sh/PrintrFi/printr-mcp)

MCP server for [Printr](https://printr.money) — the cross-chain token launchpad built for holders. Lets AI agents launch, stake, and graduate tokens across EVM chains and Solana.

No API key required. Works out of the box.

## Setup

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
    "mcpServers": {
        "printr": {
            "command": "npx",
            "args": ["-y", "@printr/mcp@latest"]
        }
    }
}
```

Or with `bunx`:

```json
{
    "mcpServers": {
        "printr": {
            "command": "bunx",
            "args": ["@printr/mcp@latest"]
        }
    }
}
```

## Skill (optional, complements the MCP config above)

In addition to the MCP config, install the Printr skill to give your agent built-in guidance on when and how to use these tools. Compatible with Claude Code, Cursor, Codex, OpenCode, and [50+ other runtimes](https://www.skills.sh).

```sh
npx skills add PrintrFi/printr-mcp
```

Preview without installing:

```sh
npx skills add PrintrFi/printr-mcp --list
```

The skill is auto-discovered from `packages/cli/skills/printr/SKILL.md`. See the [skill definition](packages/cli/skills/printr/SKILL.md) for the full tool list and behavioral hints.

## Optional capabilities

### Auto-generate token images

Set `OPENROUTER_API_KEY` and the agent will generate an image automatically when you create a token without supplying one. The `printr_generate_image` tool also becomes available for standalone image generation.

```json
"env": {
    "OPENROUTER_API_KEY": "<your-openrouter-key>"
}
```

### Let the agent sign transactions autonomously

By default, token creation returns an unsigned transaction that you sign via browser wallet or by passing a private key per call. If you want the agent to sign and submit without prompting, set a default key:

```json
"env": {
    "EVM_WALLET_PRIVATE_KEY": "<hex-private-key>",
    "SVM_WALLET_PRIVATE_KEY": "<base58-keypair-secret>"
}
```

> Keep private keys out of shared configs. Use environment-level secrets when possible.

## Tools

| Tool                        | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| [`printr_quote`](packages/mcp/src/tools/quote.ts) | Get cost estimates for token creation                                |
| [`printr_create_token`](packages/mcp/src/tools/create-token.ts) | Generate an unsigned token creation tx payload                       |
| [`printr_launch_token`](packages/mcp/src/tools/launch-token.ts) | Create and sign a token in one call                                  |
| [`printr_get_token`](packages/mcp/src/tools/get-token.ts) | Look up token details by ID or address                               |
| [`printr_get_deployments`](packages/mcp/src/tools/get-deployments.ts) | Check deployment status across target chains                         |
| [`printr_sign_and_submit_evm`](packages/mcp/src/tools/sign-and-submit-evm.ts) | Sign and submit an EVM tx payload                                    |
| [`printr_sign_and_submit_svm`](packages/mcp/src/tools/sign-and-submit-svm.ts) | Sign and submit a Solana tx payload                                  |
| [`printr_open_web_signer`](packages/mcp/src/tools/open-web-signer.ts) | Start a browser signing session (MetaMask / Phantom)                 |
| [`printr_generate_image`](packages/mcp/src/tools/generate-image.ts) | Generate a token avatar via OpenRouter (requires `OPENROUTER_API_KEY`)|

For the full tool list including wallet, balance, transfer, fees, and staking tools, see [`packages/cli/skills/printr/SKILL.md`](packages/cli/skills/printr/SKILL.md).

## Environment variables

| Variable                      | Description                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| `PRINTR_API_KEY`              | Partner API key. Falls back to the default public AI-integration key.  |
| `OPENROUTER_API_KEY`          | Enables auto image generation and the `printr_generate_image` tool     |
| `OPENROUTER_IMAGE_MODEL`      | Image model override (default: `google/gemini-2.5-flash-image`)        |
| `EVM_WALLET_PRIVATE_KEY`      | Default EVM private key for autonomous signing                         |
| `SVM_WALLET_PRIVATE_KEY`      | Default Solana keypair secret for autonomous signing                   |
| `PRINTR_DEPLOYMENT_PASSWORD`  | Master password for encrypting deployment wallets (min 16 chars). Required for `printr_fund_deployment_wallet`. Generate with: `openssl rand -base64 32` |

### Dev / self-hosting

| Variable                  | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `PRINTR_API_BASE_URL`     | Override API base URL (default: `https://api-preview.printr.money`)    |
| `PRINTR_APP_URL`          | Override app URL (default: `https://app.printr.money`)                 |

## Development

This is a monorepo with three packages:
- [`@printr/sdk`](packages/sdk) — Core TypeScript SDK (framework-agnostic)
- [`@printr/mcp`](packages/mcp) — MCP server wrapping the SDK
- [`@printr/cli`](packages/cli) — CLI for setup and configuration

```sh
bun install
bun dev          # Run MCP server with hot reload
bun test         # Run all tests
bun run check    # typecheck + lint + test
```

### Package-specific commands

```sh
# SDK
bun run --cwd packages/sdk test
bun run --cwd packages/sdk build

# MCP
bun run --cwd packages/mcp test
bun run --cwd packages/mcp build
```

### Using the SDK directly

Uses [`createPrintrClient`](packages/sdk/src/client.ts) and [`buildToken`](packages/sdk/src/token.ts):

```typescript
import { createPrintrClient, buildToken } from '@printr/sdk';

const client = createPrintrClient({
  apiKey: process.env.PRINTR_API_KEY,
});

const result = await buildToken({
  creator_accounts: ['eip155:8453:0x...'],
  name: 'My Token',
  symbol: 'TKN',
  description: 'A cool token',
  chains: ['eip155:8453'],
  initial_buy: { spend_usd: 10 },
}, client);
```
