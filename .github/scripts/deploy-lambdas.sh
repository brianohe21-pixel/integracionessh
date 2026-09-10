#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: deploy-lambdas.sh dev|prod [all|function_key ...]}"
PROJECT="${PROJECT:-chatbot-platform}"
PARALLEL="${PARALLEL:-5}"
DIST_DIR="${DIST_DIR:-backend/dist}"
MANIFEST="${MANIFEST:-backend/dist/lambda-manifest.json}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MAX_RETRIES="${MAX_RETRIES:-6}"
RETRY_DELAY="${RETRY_DELAY:-30}"
LAMBDA_DEPLOY_ALL="${LAMBDA_DEPLOY_ALL:-false}"
LAMBDA_DEPLOY_FUNCTIONS="${LAMBDA_DEPLOY_FUNCTIONS:-}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Environment must be dev or prod" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

mapfile -t all_functions < <(jq -r '.functions[]' "$MANIFEST")

functions=()
if [[ "$LAMBDA_DEPLOY_ALL" == "true" ]] || [[ "${2:-}" == "all" ]]; then
  functions=("${all_functions[@]}")
elif [[ -n "$LAMBDA_DEPLOY_FUNCTIONS" ]]; then
  IFS=',' read -ra requested <<< "$LAMBDA_DEPLOY_FUNCTIONS"
  for fn in "${requested[@]}"; do
    fn="${fn// /}"
    [[ -n "$fn" ]] && functions+=("$fn")
  done
elif (("$#" >= 2)); then
  for fn in "${@:2}"; do
    functions+=("$fn")
  done
else
  functions=("${all_functions[@]}")
fi

if ((${#functions[@]} == 0)); then
  echo "No Lambda functions selected for deploy."
  exit 0
fi

invalid=()
for fn in "${functions[@]}"; do
  if ! jq -e --arg fn "$fn" '.functions | index($fn) != null' "$MANIFEST" >/dev/null; then
    invalid+=("$fn")
  fi
done

if ((${#invalid[@]} > 0)); then
  echo "Unknown Lambda function key(s):" >&2
  printf '  - %s\n' "${invalid[@]}" >&2
  exit 1
fi

missing_packages=()
for fn in "${functions[@]}"; do
  zip_rel=$(jq -r --arg fn "$fn" '.packages[$fn] // empty' "$MANIFEST")
  if [[ -z "$zip_rel" ]]; then
    missing_packages+=("$fn")
    continue
  fi
  zip_path="${DIST_DIR}/${zip_rel}"
  if [[ ! -f "$zip_path" ]]; then
    missing_packages+=("$fn (${zip_path})")
  fi
done

if ((${#missing_packages[@]} > 0)); then
  echo "Missing Lambda package(s):" >&2
  printf '  - %s\n' "${missing_packages[@]}" >&2
  exit 1
fi

missing=()
for fn in "${functions[@]}"; do
  function_name="${PROJECT}-${ENV}-${fn//_/-}"
  if ! aws lambda get-function \
    --region "$AWS_REGION" \
    --function-name "$function_name" \
    --no-cli-pager >/dev/null 2>&1; then
    missing+=("$function_name")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "Lambda functions not found in AWS (Terraform may still be creating shells):" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
ARTIFACTS_BUCKET="${ARTIFACTS_BUCKET:-${PROJECT}-${ENV}-artifacts-${ACCOUNT_ID}}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-$(date +%s)}"

deploy_one() {
  local fn="$1"
  local function_name="${PROJECT}-${ENV}-${fn//_/-}"
  local zip_rel
  local zip_path
  local s3_key
  local attempt=1

  zip_rel=$(jq -r --arg fn "$fn" '.packages[$fn]' "$MANIFEST")
  zip_path="${DIST_DIR}/${zip_rel}"
  s3_key="lambda/${fn}-${DEPLOY_RUN_ID}.zip"

  echo "Uploading ${zip_path} to s3://${ARTIFACTS_BUCKET}/${s3_key}..."
  aws s3 cp "$zip_path" "s3://${ARTIFACTS_BUCKET}/${s3_key}" --region "$AWS_REGION" --no-cli-pager

  while (( attempt <= MAX_RETRIES )); do
    set +e
    output=$(aws lambda update-function-code \
      --region "$AWS_REGION" \
      --function-name "$function_name" \
      --s3-bucket "$ARTIFACTS_BUCKET" \
      --s3-key "$s3_key" \
      --no-cli-pager 2>&1)
    status=$?
    set -e

    if [ "$status" -eq 0 ]; then
      aws lambda wait function-updated \
        --region "$AWS_REGION" \
        --function-name "$function_name"
      echo "Done ${function_name}"
      return 0
    fi

    if echo "$output" | grep -qi 'ResourceNotFoundException'; then
      echo "Function ${function_name} not found (attempt ${attempt}/${MAX_RETRIES}) — waiting for Terraform to create shell..."
      if (( attempt < MAX_RETRIES )); then
        sleep "$RETRY_DELAY"
        attempt=$((attempt + 1))
        continue
      fi
    fi

    echo "$output" >&2
    return "$status"
  done
}

export -f deploy_one
export PROJECT ENV AWS_REGION MAX_RETRIES RETRY_DELAY ARTIFACTS_BUCKET DEPLOY_RUN_ID DIST_DIR MANIFEST

echo "Deploying ${#functions[@]} Lambda function(s) to ${ENV}..."

failures=0
running=0
for fn in "${functions[@]}"; do
  while (( running >= PARALLEL )); do
    if ! wait -n; then
      failures=$((failures + 1))
    fi
    running=$((running - 1))
  done
  deploy_one "$fn" &
  running=$((running + 1))
done

while (( running > 0 )); do
  if ! wait -n; then
    failures=$((failures + 1))
  fi
  running=$((running - 1))
done

if (( failures > 0 )); then
  echo "Failed to deploy ${failures} Lambda function(s) to ${ENV}." >&2
  exit 1
fi

echo "Deployed ${#functions[@]} Lambda function(s) to ${ENV}."
