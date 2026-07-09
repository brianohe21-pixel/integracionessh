#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:-backend/dist/lambda-manifest.json}"
TF_FILE="${2:-infrastructure/modules/lambda/main.tf}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if [[ ! -f "$TF_FILE" ]]; then
  echo "Terraform file not found: $TF_FILE" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

mapfile -t manifest_funcs < <(jq -r '.functions[]' "$MANIFEST" | sort)
mapfile -t terraform_funcs < <(
  sed -n '/^  functions = {/,/^  }/p' "$TF_FILE" \
    | grep -E '^    [a-z_]+ = \{' \
    | sed -E 's/^    ([a-z_]+) = \{.*/\1/' \
    | sort
)

manifest_only=$(comm -23 \
  <(printf '%s\n' "${manifest_funcs[@]}") \
  <(printf '%s\n' "${terraform_funcs[@]}") || true)
terraform_only=$(comm -13 \
  <(printf '%s\n' "${manifest_funcs[@]}") \
  <(printf '%s\n' "${terraform_funcs[@]}") || true)

failed=0

if [[ -n "$manifest_only" ]]; then
  echo "In build.js manifest but missing in Terraform:"
  printf '  - %s\n' $manifest_only
  failed=1
fi

if [[ -n "$terraform_only" ]]; then
  echo "In Terraform but missing in build.js manifest:"
  printf '  - %s\n' $terraform_only
  failed=1
fi

if (( failed )); then
  echo
  echo "Lambda manifest drift detected between build.js and Terraform."
  exit 1
fi

echo "Lambda manifest matches Terraform (${#manifest_funcs[@]} functions)."
