#!/usr/bin/env sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bun build "$REPO_ROOT/src/index.ts" --outdir "$REPO_ROOT/dist" --target node --format esm
tsc --emitDeclarationOnly --outDir "$REPO_ROOT/dist"
chmod +x "$REPO_ROOT/dist/index.js"
