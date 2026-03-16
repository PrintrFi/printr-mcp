#!/usr/bin/env sh
# Fetch the Omegastar OpenAPI spec from the private printrfi/printr repo and
# regenerate src/api.gen.d.ts.
#
# Usage:
#   bun run generate:api
#
# Requires SSH access to github.com/printrfi/printr.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_DIR="$REPO_ROOT/.tmp/spec"
OUT="$REPO_ROOT/src/api.gen.d.ts"

echo "Fetching OpenAPI spec…"
bunx degit printrfi/printr/backend/golang/spec/omegastar/v0 "$SPEC_DIR" --mode=git --force

echo "Generating TypeScript types…"
bunx openapi-typescript "$SPEC_DIR/openapi.yml" -o "$OUT"

echo "Done. $OUT updated."
