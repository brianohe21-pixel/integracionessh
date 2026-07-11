#!/usr/bin/env bash
set -euo pipefail

SHA="${1:?Usage: changed-files-in-push.sh <head-sha> [before-sha]}"
BEFORE="${2:-}"

if [ -z "$BEFORE" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  git diff-tree --no-commit-id --name-only -r "$SHA"
else
  git diff --name-only "$BEFORE" "$SHA"
fi
