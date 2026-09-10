#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:-backend/dist/lambda-manifest.json}"
LAMBDA_TF_FILE="${2:-infrastructure/modules/lambda/main.tf}"
COGNITO_TF_FILE="${3:-infrastructure/modules/cognito/main.tf}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if [[ ! -f "$LAMBDA_TF_FILE" ]]; then
  echo "Terraform file not found: $LAMBDA_TF_FILE" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

mapfile -t manifest_funcs < <(jq -r '.functions[]' "$MANIFEST" | sort)

mapfile -t lambda_module_funcs < <(
  sed -n '/^  functions = {/,/^  }/p' "$LAMBDA_TF_FILE" \
    | grep -E '^    [a-z_]+ = \{' \
    | sed -E 's/^    ([a-z_]+) = \{.*/\1/'
)

standalone_funcs=()
if [[ -f "$COGNITO_TF_FILE" ]]; then
  mapfile -t standalone_funcs < <(
    grep -E '^resource "aws_lambda_function" "[a-z_]+"' "$COGNITO_TF_FILE" \
      | sed -E 's/^resource "aws_lambda_function" "([a-z_]+)".*/\1/'
  )
fi

mapfile -t terraform_funcs < <(
  printf '%s\n' "${lambda_module_funcs[@]}" "${standalone_funcs[@]}" | sort
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

DIST_DIR="${DIST_DIR:-backend/dist}"
missing_packages=()
for fn in "${manifest_funcs[@]}"; do
  zip_rel=$(jq -r --arg fn "$fn" '.packages[$fn] // empty' "$MANIFEST")
  if [[ -z "$zip_rel" ]]; then
    missing_packages+=("$fn (missing manifest package entry)")
    continue
  fi
  zip_path="${DIST_DIR}/${zip_rel}"
  if [[ ! -f "$zip_path" ]]; then
    missing_packages+=("$fn (${zip_path})")
  fi
done

if ((${#missing_packages[@]} > 0)); then
  echo "Missing Lambda package(s):"
  printf '  - %s\n' "${missing_packages[@]}"
  failed=1
fi

if (( failed )); then
  exit 1
fi

echo "Lambda manifest matches Terraform (${#manifest_funcs[@]} functions)."
