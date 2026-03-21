# @printr/mcp

MCP server for [Printr](https://printr.money) — lets AI agents create, discover, and track tokens across chains.

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

### Skills

If your agent runtime supports skills, you can install Printr directly:

```sh
npx skills add PrintrFi/printr-mcp
```

See the [skill definition](packages/cli/skills/printr/SKILL.md) for details.

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
| `printr_quote`              | Get cost estimates for token creation                                |
| `printr_create_token`       | Generate an unsigned token creation tx payload                       |
| `printr_launch_token`       | Create and sign a token in one call                                  |
| `printr_get_token`          | Look up token details by ID or address                               |
| `printr_get_deployments`    | Check deployment status across target chains                         |
| `printr_sign_and_submit_evm`| Sign and submit an EVM tx payload                                    |
| `printr_sign_and_submit_svm`| Sign and submit a Solana tx payload                                  |
| `printr_open_web_signer`    | Start a browser signing session (MetaMask / Phantom)                 |
| `printr_generate_image`     | Generate a token avatar via OpenRouter (requires `OPENROUTER_API_KEY`)|

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
- `@printr/sdk` — Core TypeScript SDK (framework-agnostic)
- `@printr/mcp` — MCP server wrapping the SDK
- `@printr/cli` — CLI for setup and configuration

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
