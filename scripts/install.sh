#!/usr/bin/env bash
# Printr MCP Installer
#
# Adds @printr/mcp to Claude Desktop, Cursor, and Claude Code.
#
# Usage (one-liner):
#   curl -fsSL https://raw.githubusercontent.com/PrintrFi/printr-mcp/main/scripts/install.sh | bash
#
# Optional env vars:
#   OPENROUTER_API_KEY=sk-...   enables AI-generated token images

set -euo pipefail

# ── Colors (disabled when not writing to a terminal) ─────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  GREEN='\033[32m'
  YELLOW='\033[33m'
  RED='\033[31m'
  CYAN='\033[36m'
  RESET='\033[0m'
else
  BOLD='' DIM='' GREEN='' YELLOW='' RED='' CYAN='' RESET=''
fi

# ── Print helpers ─────────────────────────────────────────────────────────────
step()  { printf "\n${BOLD}  %s${RESET}\n" "$*"; }
ok()    { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
skip()  { printf "  ${DIM}–  %s${RESET}\n" "$*"; }
warn()  { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
fail()  { printf "\n  ${RED}error:${RESET} %s\n\n" "$*" >&2; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n"
printf "${BOLD}  Printr MCP${RESET}${DIM}  —  launch tokens from any AI client${RESET}\n"
printf "  ${CYAN}https://github.com/PrintrFi/printr-mcp${RESET}\n"

# ── Platform ──────────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      fail "unsupported OS: $(uname -s) (macOS and Linux only)" ;;
esac

# ── Requirements ──────────────────────────────────────────────────────────────
step "Checking requirements"

# Prefer bun; fall back to node/npx
if command -v bun >/dev/null 2>&1; then
  RUNTIME="bun"
  RUNTIME_VERSION="$(bun --version)"
  ok "bun v$RUNTIME_VERSION"
else
  RUNTIME="node"
  if ! command -v node >/dev/null 2>&1; then
    fail "Neither bun nor Node.js found. Install bun (https://bun.sh) or Node.js 18+ (https://nodejs.org) and re-run."
  fi
  NODE_VERSION="$(node --version | tr -d 'v')"
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js $NODE_VERSION is too old — need v18+. Install bun (https://bun.sh) or upgrade Node.js."
  fi
  ok "Node.js v$NODE_VERSION (bun not found — using npx fallback)"
  if ! command -v npx >/dev/null 2>&1; then
    fail "npx not found — ensure npm is installed alongside Node.js."
  fi
fi

# ── Config paths ──────────────────────────────────────────────────────────────
if [ "$PLATFORM" = "macos" ]; then
  CLAUDE_DESKTOP_CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  CLAUDE_DESKTOP_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json"
fi

CURSOR_CFG="$HOME/.cursor/mcp.json"

# ── JSON config merge (via node/bun) ──────────────────────────────────────────
# Injects { mcpServers: { printr: { ... } } } into a JSON config file.
# Backs up malformed files. Prints "configured" or "already_configured".
# Env: PRINTR_CFG_PATH, PRINTR_RUNTIME, OPENROUTER_API_KEY (optional)
_merge_config() {
  local cfg_path="$1"
  if PRINTR_CFG_PATH="$cfg_path" \
     PRINTR_RUNTIME="$RUNTIME" \
     OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
     node - <<'NODEEOF'
const fs   = require('fs');
const path = require('path');

const cfgPath  = process.env.PRINTR_CFG_PATH;
const runtime  = process.env.PRINTR_RUNTIME; // "bun" or "node"
const apiKey   = process.env.OPENROUTER_API_KEY || '';

let cfg = {};
if (fs.existsSync(cfgPath)) {
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (_) {
    // Back up malformed config before overwriting
    fs.copyFileSync(cfgPath, cfgPath + '.bak');
    cfg = {};
  }
}

cfg.mcpServers = cfg.mcpServers || {};
if (cfg.mcpServers.printr) {
  process.stdout.write('already_configured');
  process.exit(0);
}

const entry = runtime === 'bun'
  ? { command: 'bunx', args: ['@printr/mcp@latest'] }
  : { command: 'npx',  args: ['-y', '@printr/mcp@latest'] };
if (apiKey) entry.env = { OPENROUTER_API_KEY: apiKey };
cfg.mcpServers.printr = entry;

fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
process.stdout.write('configured');
NODEEOF
  then
    return 0
  else
    return 1
  fi
}

# ── Detect & configure clients ────────────────────────────────────────────────
step "Detecting MCP clients"

CONFIGURED=0

# Claude Desktop
_has_claude_desktop() {
  [ -f "$CLAUDE_DESKTOP_CFG" ] && return 0
  [ "$PLATFORM" = "macos" ]  && [ -d "/Applications/Claude.app" ] && return 0
  [ "$PLATFORM" = "linux" ]  && [ -d "$(dirname "$CLAUDE_DESKTOP_CFG")" ] && return 0
  return 1
}

if _has_claude_desktop; then
  if result="$(_merge_config "$CLAUDE_DESKTOP_CFG")"; then
    case "$result" in
      configured)         ok "Claude Desktop  →  $CLAUDE_DESKTOP_CFG"
                          CONFIGURED=$((CONFIGURED + 1)) ;;
      already_configured) warn "Claude Desktop — already configured, skipping" ;;
    esac
  else
    warn "Claude Desktop — could not write config: $CLAUDE_DESKTOP_CFG"
  fi
else
  skip "Claude Desktop not detected"
fi

# Cursor
if command -v cursor >/dev/null 2>&1 || [ -d "$HOME/.cursor" ]; then
  if result="$(_merge_config "$CURSOR_CFG")"; then
    case "$result" in
      configured)         ok "Cursor  →  $CURSOR_CFG"
                          CONFIGURED=$((CONFIGURED + 1)) ;;
      already_configured) warn "Cursor — already configured, skipping" ;;
    esac
  else
    warn "Cursor — could not write config: $CURSOR_CFG"
  fi
else
  skip "Cursor not detected"
fi

# Claude Code CLI
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -qi "printr"; then
    warn "Claude Code — already configured, skipping"
  else
    if [ "$RUNTIME" = "bun" ]; then
      CLAUDE_MCP_CMD="claude mcp add --scope user printr -- bunx @printr/mcp@latest"
    else
      CLAUDE_MCP_CMD="claude mcp add --scope user printr -- npx -y @printr/mcp@latest"
    fi
    if $CLAUDE_MCP_CMD 2>/dev/null; then
      ok "Claude Code  →  user scope"
      CONFIGURED=$((CONFIGURED + 1))
    else
      warn "Claude Code — auto-config failed; run manually:"
      warn "  $CLAUDE_MCP_CMD"
    fi
  fi
else
  skip "Claude Code CLI not detected"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n"

if [ "$CONFIGURED" -gt 0 ]; then
  if [ "$CONFIGURED" -eq 1 ]; then PLURAL=""; else PLURAL="s"; fi
  printf "${GREEN}${BOLD}  Installed for $CONFIGURED client${PLURAL}.${RESET}\n\n"
  printf "  Restart your client(s) to load the MCP server, then try:\n"
  printf "    ${DIM}\"Quote me the cost of creating a token on Base\"${RESET}\n"
  if [ -n "${OPENROUTER_API_KEY:-}" ]; then
    printf "\n  ${DIM}OPENROUTER_API_KEY set — AI image generation enabled.${RESET}\n"
  else
    printf "\n  ${DIM}Tip: set OPENROUTER_API_KEY to enable AI-generated token images.${RESET}\n"
  fi
  printf "\n  Docs: ${CYAN}https://github.com/PrintrFi/printr-mcp${RESET}\n\n"
else
  printf "${YELLOW}${BOLD}  Nothing to configure.${RESET}\n\n"
  printf "  No supported clients were detected or all were already set up.\n"
  printf "  Supported: Claude Desktop, Cursor, Claude Code CLI\n\n"
fi
