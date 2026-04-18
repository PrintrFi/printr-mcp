#!/usr/bin/env sh
# Generate proto types from the printr repo into the SDK.
#
# Usage:
#   bun run generate:proto
#
# Requires:
#   - buf CLI installed (https://buf.build/docs/installation)
#   - PRINTR_REPO env var or ~/dev/printr directory

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRINTR_REPO="${PRINTR_REPO:-$HOME/dev/printr}"
OUT_DIR="$REPO_ROOT/packages/sdk/src/proto"
TEMPLATE="$SCRIPT_DIR/buf.gen.proto.yaml"

if [ ! -d "$PRINTR_REPO" ]; then
  echo "Error: printr repo not found at $PRINTR_REPO"
  echo "Set PRINTR_REPO env var to the correct path"
  exit 1
fi

if ! command -v buf >/dev/null 2>&1; then
  echo "Error: buf CLI not found. Install from https://buf.build/docs/installation"
  exit 1
fi

echo "Generating proto types from $PRINTR_REPO..."
echo "Output: $OUT_DIR"

# Clean existing generated files (keep directory structure)
find "$OUT_DIR" -name "*.ts" -type f -delete 2>/dev/null || true

# Create a working copy of the template with the correct output path
WORK_TEMPLATE=$(mktemp -d)/buf.gen.yaml
sed "s|PRINTR_MCP_SDK_PROTO_OUT|$OUT_DIR|g" "$TEMPLATE" > "$WORK_TEMPLATE"

cd "$PRINTR_REPO"
buf generate --template "$WORK_TEMPLATE"

rm -rf "$(dirname "$WORK_TEMPLATE")"

echo "Done. Proto types generated in $OUT_DIR"
