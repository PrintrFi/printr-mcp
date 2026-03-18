# @printr/cli

CLI for [Printr](https://printr.money) — configure MCP servers and install agent skills for AI clients.

## Features

- 🔧 **Automatic setup** — Configure Printr MCP for all detected AI clients
- 🤖 **Multi-client support** — Works with Claude Desktop, Cursor, Windsurf, Gemini, and Claude Code
- 📦 **Skill installation** — Install Printr agent skills for enhanced AI capabilities
- 🎨 **Interactive UI** — Beautiful terminal interface built with Ink
- ⚡ **Zero config** — Works out of the box with sensible defaults

## Installation

### Global installation (recommended)

```bash
npm install -g @printr/cli
# or
bun add -g @printr/cli
# or
yarn global add @printr/cli
```

### Run without installing

```bash
npx @printr/cli setup
# or
bunx @printr/cli setup
```

## Commands

### `printr setup`

Configure Printr MCP for all detected AI clients.

```bash
printr setup
```

The setup command will:
1. Detect installed AI clients (Claude Desktop, Cursor, Windsurf, Gemini, Claude Code)
2. Add `@printr/mcp` to each client's MCP server configuration
3. Optionally configure environment variables (like `OPENROUTER_API_KEY`)

#### Options

##### `--client <name>`

Target specific AI clients (can be used multiple times):

```bash
# Configure only Claude Desktop
printr setup --client claude-desktop

# Configure multiple clients
printr setup --client claude-desktop --client cursor
```

Available clients:
- `claude-desktop` — Claude Desktop app
- `cursor` — Cursor editor
- `windsurf` — Windsurf editor
- `gemini` — Google Gemini
- `claude-code` — Claude Code CLI

##### `--openrouter-api-key <key>`

Add OpenRouter API key for AI-powered image generation:

```bash
printr setup --openrouter-api-key sk-or-...

# Or use environment variable
OPENROUTER_API_KEY=sk-or-... printr setup
```

### `printr skill`

Install the Printr agent skill to selected AI agents.

```bash
printr skill
```

The skill command will:
1. Detect compatible AI agents
2. Install the Printr skill definition
3. Enable enhanced token creation capabilities

#### Options

##### `--agent <name>`

Target specific agents (can be used multiple times):

```bash
# Install to Claude Code only
printr skill --agent claude-code

# Install to multiple agents
printr skill --agent claude-code --agent cursor
```

Available agents:
- `claude-code` — Claude Code CLI
- `cursor` — Cursor editor
- `gemini` — Google Gemini
- `local` — Local skill installation

## Examples

### Basic setup

```bash
# Install globally
npm install -g @printr/cli

# Run setup
printr setup
```

### Setup with OpenRouter API key

```bash
# Use flag
printr setup --openrouter-api-key sk-or-v1-...

# Or environment variable
OPENROUTER_API_KEY=sk-or-v1-... printr setup
```

### Setup specific clients

```bash
# Only configure Claude Desktop
printr setup --client claude-desktop

# Configure Claude Desktop and Cursor
printr setup --client claude-desktop --client cursor
```

### Install agent skills

```bash
# Install to all detected agents
printr skill

# Install to specific agents
printr skill --agent claude-code --agent cursor
```

## Configuration Files

The CLI modifies configuration files for each AI client:

### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "printr": {
      "command": "npx",
      "args": ["-y", "@printr/mcp@latest"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-..."
      }
    }
  }
}
```

### Cursor

**All platforms**: `~/.cursor/mcp.json`

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

### Claude Code

**All platforms**: `~/.claude/settings.json`

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

### Windsurf

**macOS**: `~/Library/Application Support/Windsurf/mcp.json`
**Windows**: `%APPDATA%\Windsurf\mcp.json`
**Linux**: `~/.config/Windsurf/mcp.json`

### Gemini

Configuration path varies by platform and Gemini setup.

## Environment Variables

When using `--openrouter-api-key` or the `OPENROUTER_API_KEY` environment variable, the CLI will add it to your MCP configuration. This enables:

- Automatic token image generation
- Access to the `printr_generate_image` tool

See [@printr/mcp documentation](https://github.com/PrintrFi/printr-mcp) for more environment variables.

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run locally
bun run start setup

# Watch mode
bun run dev
```

## Requirements

- Node.js 18+ or Bun 1.0+
- TypeScript 5.9+ (peer dependency)

## Related Packages

- [`@printr/sdk`](https://www.npmjs.com/package/@printr/sdk) — Core TypeScript SDK
- [`@printr/mcp`](https://www.npmjs.com/package/@printr/mcp) — MCP server

## Troubleshooting

### Command not found after installation

Make sure your global npm/bun/yarn bin directory is in your PATH:

```bash
# npm
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Configuration not applied

1. Restart your AI client after running `printr setup`
2. Verify the configuration file was modified correctly
3. Check file permissions on the config directory

### MCP server not starting

1. Ensure `@printr/mcp` can be installed:
   ```bash
   npx @printr/mcp@latest
   ```
2. Check the AI client's logs for errors
3. Try using `bunx` instead of `npx` if you have Bun installed

## License

Apache-2.0

## Links

- [Documentation](https://github.com/PrintrFi/printr-mcp)
- [npm](https://www.npmjs.com/package/@printr/cli)
- [GitHub](https://github.com/PrintrFi/printr-mcp)
- [Printr](https://printr.money)
