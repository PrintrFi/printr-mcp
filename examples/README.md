# Examples

Runnable examples demonstrating `@printr/sdk` and `@printr/mcp` usage.

## Setup

From the repo root:

```bash
bun install
bun run build
```

## Examples

### sdk-basic

Demonstrates core SDK functionality:
- Creating a Printr client
- Getting quotes for token creation
- Fetching token details
- Checking deployment status
- Listing supported chains

```bash
bun run --cwd examples/sdk-basic start
```

### mcp-client

Demonstrates programmatic MCP server interaction:
- Spawning the MCP server
- Connecting via stdio transport
- Listing available tools
- Calling tools directly

```bash
bun run --cwd examples/mcp-client start
```

## CI Validation

These examples can be used for post-publish smoke testing:

```bash
# Run all examples
bun run examples:test

# Or individually
bun run --cwd examples/sdk-basic test
bun run --cwd examples/mcp-client test
```

## Notes

- Examples use `workspace:*` dependencies for local development
- For published packages, update to specific versions (e.g., `"@printr/sdk": "^0.2.0"`)
- No API key required for read-only operations (quotes, token lookup, chains)
