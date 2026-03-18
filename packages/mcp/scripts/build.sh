#!/usr/bin/env sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Build the MCP server (server-only library)
bun build "$REPO_ROOT/src/index.ts" --outdir "$REPO_ROOT/dist" --target node --format esm
bunx tsc --emitDeclarationOnly --outDir "$REPO_ROOT/dist"

# NOTE: No chmod +x needed - MCP is now a server-only library
# The CLI binary is in @printr/cli package
