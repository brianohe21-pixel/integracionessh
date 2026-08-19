#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

API_ID="${API_ID:-}"
if [[ -z "$API_ID" ]]; then
  API_ID="$(aws apigatewayv2 get-apis \
    --region "$AWS_REGION" \
    --query "Items[?Name=='${PROJECT}-${ENVIRONMENT}'].ApiId | [0]" \
    --output text)"
fi

if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  echo "0"
  exit 0
fi

mapfile -t referenced < <(
  aws apigatewayv2 get-routes \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq -r '.Items[]?.Target? // empty' \
    | sed -n 's#integrations/##p' \
    | sort -u
)

declare -A referenced_map=()
for id in "${referenced[@]}"; do
  referenced_map[$id]=1
done

orphan_count=0
mapfile -t integration_ids < <(
  aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq -r '.Items[]?.IntegrationId'
)

for id in "${integration_ids[@]}"; do
  if [[ -z "${referenced_map[$id]:-}" ]]; then
    orphan_count=$((orphan_count + 1))
  fi
done

echo "$orphan_count"
