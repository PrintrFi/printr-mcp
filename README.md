# @printr/mcp

MCP server for [Printr](https://printr.money) — enables AI agents to create, discover, and track tokens across chains.

## Tools

| Tool                     | Description                                  |
| ------------------------ | -------------------------------------------- |
| `printr_quote`           | Get cost estimates for token creation        |
| `printr_create_token`    | Generate unsigned token creation tx payload  |
| `printr_get_token`       | Look up token details by ID or address       |
| `printr_get_deployments` | Check deployment status across target chains |

## Setup

```json
{
    "mcpServers": {
        "printr": {
            "command": "bun",
            "args": ["run", "/path/to/printr-mcp/src/index.ts"],
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

| Variable              | Required | Description                                                         |
| --------------------- | -------- | ------------------------------------------------------------------- |
| `PRINTR_API_KEY`      | Yes      | Partner API key (Bearer JWT)                                        |
| `PRINTR_API_BASE_URL` | No       | Override API base URL (default: `https://api-preview.printr.money`) |
