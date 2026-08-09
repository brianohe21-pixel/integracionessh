#!/usr/bin/env bash
set -euo pipefail

API_ID="${API_ID:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

if [[ -z "$API_ID" ]]; then
  API_ID="$(aws apigatewayv2 get-apis \
    --region "$AWS_REGION" \
    --query "Items[?Name=='${PROJECT}-${ENVIRONMENT}'].ApiId | [0]" \
    --output text)"
fi

if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  echo "API Gateway API not found for ${PROJECT}-${ENVIRONMENT}" >&2
  exit 1
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

deleted=0
mapfile -t integration_ids < <(
  aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq -r '.Items[]?.IntegrationId'
)

for id in "${integration_ids[@]}"; do
  if [[ -z "${referenced_map[$id]:-}" ]]; then
    aws apigatewayv2 delete-integration \
      --api-id "$API_ID" \
      --integration-id "$id" \
      --region "$AWS_REGION" \
      --no-cli-pager >/dev/null
    deleted=$((deleted + 1))
  fi
done

echo "Deleted ${deleted} orphan API Gateway integration(s) from ${API_ID}."
