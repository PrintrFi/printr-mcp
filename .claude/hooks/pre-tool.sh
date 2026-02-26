#!/bin/bash
# Pre-tool validation: block forbidden commands and protected files
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$TOOL" in
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    [[ -z "$CMD" ]] && exit 0

    # Block npm/yarn/pnpm/npx
    if echo "$CMD" | grep -qE '^\s*(npm|yarn|pnpm)\s'; then
      echo "Use bun instead (bun install, bun add, bun remove)" >&2
      exit 2
    fi
    if echo "$CMD" | grep -qE '^\s*npx\s'; then
      echo "Use bunx instead of npx" >&2
      exit 2
    fi
    ;;

  Edit|Write)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    [[ -z "$FILE" ]] && exit 0

    # Block secrets and wrong tooling configs
    case "$FILE" in
      *.env*) echo "Blocked: .env files contain secrets" >&2; exit 2 ;;
      *package-lock.json*|*yarn.lock*|*pnpm-lock.yaml*) echo "Blocked: use bun.lockb" >&2; exit 2 ;;
      *.eslintrc*|*eslint.config*|*.prettierrc*|*prettier.config*) echo "Blocked: use Biome" >&2; exit 2 ;;
    esac
    ;;
esac

exit 0
