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
SPEC_SUBDIR="backend/golang/spec/omegastar/v0"
CLONE_DIR="$REPO_ROOT/.tmp/spec"
SPEC_FILE="$CLONE_DIR/$SPEC_SUBDIR/openapi.yml"
OUT="$REPO_ROOT/packages/sdk/src/api.gen.d.ts"

echo "Fetching OpenAPI spec…"
rm -rf "$CLONE_DIR"
mkdir -p "$CLONE_DIR"
git -C "$CLONE_DIR" init -q
git -C "$CLONE_DIR" remote add origin git@github.com:printrfi/printr.git
git -C "$CLONE_DIR" sparse-checkout init
git -C "$CLONE_DIR" sparse-checkout set "$SPEC_SUBDIR"
git -C "$CLONE_DIR" fetch --depth=1 origin HEAD -q
git -C "$CLONE_DIR" checkout FETCH_HEAD -q

echo "Generating TypeScript types…"
bunx openapi-typescript "$SPEC_FILE" -o "$OUT"

echo "Done. $OUT updated."
