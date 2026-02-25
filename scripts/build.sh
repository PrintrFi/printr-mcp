#!/usr/bin/env sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Build the wallet provisioning SPA
cd "$REPO_ROOT/apps/wallet" && bunx vite build && cd "$REPO_ROOT"

# Build the MCP server
bun build "$REPO_ROOT/src/index.ts" --outdir "$REPO_ROOT/dist" --target node --format esm
tsc --emitDeclarationOnly --outDir "$REPO_ROOT/dist"
chmod +x "$REPO_ROOT/dist/index.js"
