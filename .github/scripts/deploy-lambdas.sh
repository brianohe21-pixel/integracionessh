#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: deploy-lambdas.sh dev|prod}"
PROJECT="${PROJECT:-chatbot-platform}"
PARALLEL="${PARALLEL:-5}"
MANIFEST="${MANIFEST:-backend/dist/lambda-manifest.json}"
ZIP="${ZIP:-backend/dist/functions.zip}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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

deploy_one() {
  local fn="$1"
  local function_name="${PROJECT}-${ENV}-${fn//_/-}"
  echo "Deploying ${function_name}..."
  aws lambda update-function-code \
    --region "$AWS_REGION" \
    --function-name "$function_name" \
    --zip-file "fileb://${ZIP}" \
    --no-cli-pager
  aws lambda wait function-updated \
    --region "$AWS_REGION" \
    --function-name "$function_name"
  echo "Done ${function_name}"
}

export -f deploy_one
export PROJECT ENV ZIP AWS_REGION

mapfile -t functions < <(jq -r '.functions[]' "$MANIFEST")

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
