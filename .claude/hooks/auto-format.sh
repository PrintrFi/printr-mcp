#!/bin/bash
# Auto-format edited files with Biome
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE" ]]; then
  exit 0
fi

# Only format TypeScript/JavaScript files
if [[ "$FILE" == *.ts ]] || [[ "$FILE" == *.tsx ]] || [[ "$FILE" == *.js ]] || [[ "$FILE" == *.jsx ]] || [[ "$FILE" == *.json ]]; then
  # Run Biome format silently
  bunx biome format --write "$FILE" 2>/dev/null || true
fi

exit 0
