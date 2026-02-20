# @printr/mcp

MCP server for [Printr](https://printr.money) — enables AI agents to create, discover, and track tokens across chains.

## Tools

| Tool                        | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `printr_quote`              | Get cost estimates for token creation                                |
| `printr_create_token`       | Generate unsigned token creation tx payload                          |
| `printr_get_token`          | Look up token details by ID or address                               |
| `printr_get_deployments`    | Check deployment status across target chains                         |
| `printr_sign_and_submit_evm`| Sign and submit an EVM tx payload using a private key or env var     |
| `printr_sign_and_submit_svm`| Sign and submit a Solana tx payload using a private key or env var   |
| `printr_open_web_signer`    | Start a browser-based signing session (MetaMask / Phantom)           |
| `printr_generate_image`     | Generate a token image via OpenRouter (requires `OPENROUTER_API_KEY`)|

## Setup

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
    "mcpServers": {
        "printr": {
            "command": "bunx",
            "args": ["@printr/mcp@latest"],
            "env": {
                "PRINTR_API_KEY": "<your-api-key>"
            }
        }
    }
}
```

Or with `npx`:

```json
{
    "mcpServers": {
        "printr": {
            "command": "npx",
            "args": ["-y", "@printr/mcp@latest"],
            "env": {
                "PRINTR_API_KEY": "<your-api-key>"
            }
        }
    }
}
```

## Development

```sh
bun install
PRINTR_API_KEY=xxx bun dev
```

### Testing

```sh
bun test
```

## Environment variables

| Variable                  | Required | Description                                                            |
| ------------------------- | -------- | ---------------------------------------------------------------------- |
| `PRINTR_API_KEY`          | Yes      | Partner API key (Bearer JWT)                                           |
| `PRINTR_API_BASE_URL`     | No       | Override API base URL (default: `https://api-preview.printr.money`)    |
| `PRINTR_APP_URL`          | No       | Override app base URL (default: `https://app.printr.money`)            |
| `EVM_WALLET_PRIVATE_KEY`  | No       | Default EVM hex private key — avoids passing it per call to `printr_sign_and_submit_evm` |
| `SVM_WALLET_PRIVATE_KEY`  | No       | Default Solana base58 keypair secret — avoids passing it per call to `printr_sign_and_submit_svm` |
| `OPENROUTER_API_KEY`      | No       | Enables `printr_generate_image` and auto image generation in `printr_create_token` |
| `OPENROUTER_IMAGE_MODEL`  | No       | Image model used for generation (default: `google/gemini-2.5-flash-image`) |
| `VERBOSE`                 | No       | Set to `1` or `true` to enable verbose test/debug logging              |
