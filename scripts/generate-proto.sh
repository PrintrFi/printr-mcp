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

# Temp dir for working files - cleaned up on exit
WORK_DIR=""
cleanup() {
  [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

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

# Create working directory for template and temp output
WORK_DIR=$(mktemp -d)
WORK_TEMPLATE="$WORK_DIR/buf.gen.yaml"
TEMP_OUT="$WORK_DIR/proto"
mkdir -p "$TEMP_OUT"

# Generate into temp directory first
sed "s|PRINTR_MCP_SDK_PROTO_OUT|$TEMP_OUT|g" "$TEMPLATE" > "$WORK_TEMPLATE"

cd "$PRINTR_REPO"
buf generate --template "$WORK_TEMPLATE"

# Only replace output after successful generation
rm -rf "$OUT_DIR"
mv "$TEMP_OUT" "$OUT_DIR"

echo "Done. Proto types generated in $OUT_DIR"
