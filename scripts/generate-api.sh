#!/usr/bin/env sh
# Fetch the Omegastar OpenAPI spec and regenerate src/api.gen.d.ts.
#
# Usage:
#   bun run generate:api          # Fetches from GitHub
#   bun run generate:api:local    # Uses local ~/dev/printr
#   PRINTR_REPO=/path/to/printr bun run generate:api  # Uses custom local path
#
# Requires SSH access to github.com/printrfi/printr when fetching from remote.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_SUBDIR="backend/golang/spec/omegastar/v0"
OUT="$REPO_ROOT/packages/sdk/src/api.gen.d.ts"

# Check if we should use a local printr repo
if [ -n "$PRINTR_REPO" ]; then
  SPEC_FILE="$PRINTR_REPO/$SPEC_SUBDIR/openapi.yml"
  if [ ! -f "$SPEC_FILE" ]; then
    echo "Error: OpenAPI spec not found at $SPEC_FILE"
    exit 1
  fi
  echo "Using local printr repo: $PRINTR_REPO"
else
  # Fetch from GitHub
  CLONE_DIR="$REPO_ROOT/.tmp/spec"
  SPEC_FILE="$CLONE_DIR/$SPEC_SUBDIR/openapi.yml"

  echo "Fetching OpenAPI spec from GitHub…"
  rm -rf "$CLONE_DIR"
  mkdir -p "$CLONE_DIR"
  git -C "$CLONE_DIR" init -q
  git -C "$CLONE_DIR" remote add origin git@github.com:printrfi/printr.git
  git -C "$CLONE_DIR" sparse-checkout init
  git -C "$CLONE_DIR" sparse-checkout set "$SPEC_SUBDIR"
  git -C "$CLONE_DIR" fetch --depth=1 origin HEAD -q
  git -C "$CLONE_DIR" checkout FETCH_HEAD -q
fi

echo "Generating TypeScript types…"
bunx openapi-typescript "$SPEC_FILE" -o "$OUT"

echo "Done. $OUT updated."
