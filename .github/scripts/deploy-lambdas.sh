#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: deploy-lambdas.sh dev|prod}"
PROJECT="${PROJECT:-chatbot-platform}"
PARALLEL="${PARALLEL:-5}"
MANIFEST="${MANIFEST:-backend/dist/lambda-manifest.json}"
ZIP="${ZIP:-backend/dist/functions.zip}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MAX_RETRIES="${MAX_RETRIES:-6}"
RETRY_DELAY="${RETRY_DELAY:-30}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Environment must be dev or prod" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

if [[ ! -f "$ZIP" ]]; then
  echo "Zip not found: $ZIP" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

mapfile -t functions < <(jq -r '.functions[]' "$MANIFEST")

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

deploy_one() {
  local fn="$1"
  local function_name="${PROJECT}-${ENV}-${fn//_/-}"
  local attempt=1

  while (( attempt <= MAX_RETRIES )); do
    set +e
    output=$(aws lambda update-function-code \
      --region "$AWS_REGION" \
      --function-name "$function_name" \
      --zip-file "fileb://${ZIP}" \
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
export PROJECT ENV ZIP AWS_REGION MAX_RETRIES RETRY_DELAY

echo "Deploying ${#functions[@]} Lambda function(s) to ${ENV}..."

running=0
for fn in "${functions[@]}"; do
  while (( running >= PARALLEL )); do
    if ! wait -n 2>/dev/null; then
      wait || true
    fi
    running=$((running - 1))
  done
  deploy_one "$fn" &
  running=$((running + 1))
done

while (( running > 0 )); do
  if ! wait -n 2>/dev/null; then
    wait || true
  fi
  running=$((running - 1))
done

echo "Deployed ${#functions[@]} Lambda function(s) to ${ENV}."
