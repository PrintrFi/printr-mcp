# Printr MCP — Setup Instructions

These instructions are written for an autonomous agent. Read them fully, then execute each step in order.

---

## What you are installing

`@printr/mcp` is an MCP server that lets AI clients create and manage tokens on-chain via the Printr API. It runs via `npx` — no global install required.

---

## Step 1 — Validate requirements

Run these checks before doing anything else.

### Runtime (bun preferred, Node.js fallback)

Check for bun first:

```bash
bun --version
```

- If found: use `bunx` as the runner. Record `RUNTIME=bun`.
- If not found: fall back to Node.js:

```bash
node --version
```

- If `node` is not found: stop and tell the user to install bun (`https://bun.sh`) or Node.js 18+
- If the Node.js major version is less than 18: stop and tell the user to upgrade
- If Node.js is present: also verify `npx --version`. If missing, stop and tell the user to reinstall Node.js.
- Record `RUNTIME=node`.

Install bun (if the user wants it):

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Step 2 — Detect operating system

```bash
uname -s
```

- `Darwin` → macOS
- `Linux`  → Linux
- Anything else → stop; only macOS and Linux are supported

---

## Step 3 — Run the installer (preferred)

### Option A — via npm package (bun/node already installed)

```bash
bunx @printr/mcp setup
```

Or with Node.js:

```bash
npx @printr/mcp setup
```

To target a specific client only:

```bash
bunx @printr/mcp setup --client claude-desktop
bunx @printr/mcp setup --client cursor
bunx @printr/mcp setup --client windsurf
bunx @printr/mcp setup --client gemini
bunx @printr/mcp setup --client claude-code
```

To include an OpenRouter API key for AI-generated token images:

```bash
bunx @printr/mcp setup --openrouter-api-key <key>
# or via env var
OPENROUTER_API_KEY=<key> bunx @printr/mcp setup
```

### Option B — one-liner shell script (bun/node not yet installed)

```bash
curl -fsSL https://raw.githubusercontent.com/PrintrFi/printr-mcp/main/scripts/install.sh | bash
```

With an OpenRouter API key:

```bash
OPENROUTER_API_KEY=<key> curl -fsSL https://raw.githubusercontent.com/PrintrFi/printr-mcp/main/scripts/install.sh | bash
```

Both options are idempotent — safe to re-run. Already-configured clients are skipped.

If the installer succeeds, skip to **Step 5 — Verify**.

---

## Step 4 — Manual configuration (fallback)

Use this section only if the install script fails or is unavailable.

### MCP server entry

Use the entry that matches the detected runtime (`RUNTIME`).

**If `RUNTIME=bun`:**

```json
"printr": {
  "command": "bunx",
  "args": ["@printr/mcp@latest"]
}
```

**If `RUNTIME=node`:**

```json
"printr": {
  "command": "npx",
  "args": ["-y", "@printr/mcp@latest"]
}
```

If the user has an `OPENROUTER_API_KEY`, add an `env` block to whichever entry you use:

```json
"env": {
  "OPENROUTER_API_KEY": "<key>"
}
```

**Important:** merge into `mcpServers` — do not overwrite the entire file. Preserve all existing entries.

---

### Claude Desktop

Config file locations:

| OS    | Path |
|-------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` (respects `$XDG_CONFIG_HOME`) |

Detection: the file exists, or `/Applications/Claude.app` exists (macOS), or the config directory exists (Linux).

Minimal config structure if the file does not exist:

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

After writing, tell the user to **fully quit and restart Claude Desktop**.

---

### Cursor

Config file: `~/.cursor/mcp.json`

Detection: `cursor` command exists in PATH, or `~/.cursor/` directory exists.

Minimal config structure if the file does not exist:

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

After writing, tell the user to **restart Cursor**.

---

### Claude Code CLI

Detection: `claude` command exists in PATH.

Use the CLI — do not write files directly.

**If `RUNTIME=bun`:**

```bash
claude mcp add --scope user printr -- bunx @printr/mcp@latest
```

**If `RUNTIME=node`:**

```bash
claude mcp add --scope user printr -- npx -y @printr/mcp@latest
```

To verify it was added:

```bash
claude mcp list
```

The output should include a line containing `printr`.

---

### VS Code (Claude extension)

Config file: `.vscode/mcp.json` (project-level) or via VS Code settings.

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "printr": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@printr/mcp@latest"]
    }
  }
}
```

---

## Step 5 — Verify

After configuring at least one client, confirm by asking the AI client:

> "List the available Printr tools."

Expected: the client responds with tools such as `printr_quote`, `printr_create_token`, `printr_get_token`, `printr_get_deployments`, `printr_launch_token`.

If tools are not visible, the client likely needs to be restarted.

---

## Optional environment variables

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Enables AI-generated token images when no image is supplied |
| `OPENROUTER_IMAGE_MODEL` | Override image model (default: `google/gemini-2.5-flash-image`) |
| `EVM_WALLET_PRIVATE_KEY` | EVM private key for autonomous signing (`AGENT_MODE=1`) |
| `SVM_WALLET_PRIVATE_KEY` | Solana private key (base58) for autonomous signing (`AGENT_MODE=1`) |
| `SVM_RPC_URL` | Solana RPC endpoint (default: `https://api.mainnet-beta.solana.com`) |
| `AGENT_MODE` | Set to `1` to sign automatically using env-var keys instead of interactive wallet selection |
| `PRINTR_API_KEY` | Partner API key (falls back to the default public key) |
| `PRINTR_API_BASE_URL` | Override API base URL |
| `PRINTR_APP_URL` | Override Printr web app URL |

Set these in the `env` block of the server entry in the relevant config file.

---

## Reference

- GitHub: https://github.com/PrintrFi/printr-mcp
- npm: https://www.npmjs.com/package/@printr/mcp
- MCP protocol: https://modelcontextprotocol.io
