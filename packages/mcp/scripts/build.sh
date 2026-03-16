#!/usr/bin/env sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Build the wallet provisioning SPA (only if the app exists)
if [ -d "$REPO_ROOT/apps/wallet" ]; then
  (cd "$REPO_ROOT/apps/wallet" && bunx vite build)
fi

# Build the MCP server
bun build "$REPO_ROOT/src/index.ts" --outdir "$REPO_ROOT/dist" --target node --format esm
bunx tsc --emitDeclarationOnly --outDir "$REPO_ROOT/dist"
chmod +x "$REPO_ROOT/dist/index.js"
