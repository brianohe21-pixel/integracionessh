#!/usr/bin/env bash
set -euo pipefail

API_ID="${API_ID:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
DRY_RUN="${DRY_RUN:-false}"

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

declare -A state_map=()
if command -v terraform >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  pull_json="$(terraform state pull 2>/dev/null || true)"
  if [[ -n "$pull_json" ]]; then
    if ! echo "$pull_json" | jq -e '.resources' >/dev/null 2>&1; then
      pull_json="$(echo "$pull_json" | jq -r '.stdout // empty')"
    fi
    if [[ -n "$pull_json" ]]; then
      mapfile -t state_ids < <(
        echo "$pull_json" | jq -r '
          .resources[]?
          | select(.type == "aws_apigatewayv2_integration" and .name == "integrations")
          | .instances[]?.attributes.id // empty
        ' | awk 'NF'
      )
      for id in "${state_ids[@]:-}"; do
        state_map[$id]=1
      done
    fi
  fi
fi

deleted=0
skipped_state=0
mapfile -t integration_ids < <(
  aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq -r '.Items[]?.IntegrationId'
)

for id in "${integration_ids[@]}"; do
  if [[ -n "${referenced_map[$id]:-}" ]]; then
    continue
  fi
  if [[ -n "${state_map[$id]:-}" ]]; then
    skipped_state=$((skipped_state + 1))
    continue
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] Would delete orphan integration ${id}"
    deleted=$((deleted + 1))
    continue
  fi
  aws apigatewayv2 delete-integration \
    --api-id "$API_ID" \
    --integration-id "$id" \
    --region "$AWS_REGION" \
    --no-cli-pager >/dev/null
  deleted=$((deleted + 1))
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Would delete ${deleted} orphan API Gateway integration(s) from ${API_ID} (${skipped_state} kept because they are in Terraform state)."
else
  echo "Deleted ${deleted} orphan API Gateway integration(s) from ${API_ID} (${skipped_state} kept because they are in Terraform state)."
fi
