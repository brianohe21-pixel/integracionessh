#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
EXPECTED_INTEGRATIONS="${EXPECTED_INTEGRATIONS:-43}"

API_ID="${API_ID:-}"
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

STATE_INTEGRATIONS="$(
  terraform state list 2>/dev/null \
    | grep -c 'module.api_gateway.aws_apigatewayv2_integration.integrations\[' || true
)"
STATE_ROUTES="$(
  terraform state list 2>/dev/null \
    | grep -c 'module.api_gateway.aws_apigatewayv2_route.routes\[' || true
)"
LIVE_INTEGRATIONS="$(
  aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq '.Items | length'
)"
LIVE_ROUTES="$(
  aws apigatewayv2 get-routes \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --output json \
    | jq '.Items | length'
)"
ORPHAN_INTEGRATIONS="$(
  bash "$(dirname "$0")/count-orphan-api-integrations.sh"
)"

echo "API Gateway preflight (${ENVIRONMENT}):"
echo "  API ID: ${API_ID}"
echo "  Terraform state integrations: ${STATE_INTEGRATIONS}"
echo "  Terraform state routes: ${STATE_ROUTES}"
echo "  Live AWS integrations: ${LIVE_INTEGRATIONS}"
echo "  Live AWS routes: ${LIVE_ROUTES}"
echo "  Live orphan integrations: ${ORPHAN_INTEGRATIONS}"
echo "  Expected canonical integrations: ${EXPECTED_INTEGRATIONS}"

if (( STATE_INTEGRATIONS > EXPECTED_INTEGRATIONS )); then
  echo "::warning::Terraform state still has ${STATE_INTEGRATIONS} integration addresses; migration may be required."
fi

if (( LIVE_INTEGRATIONS > EXPECTED_INTEGRATIONS + 5 )); then
  echo "::warning::Live AWS has ${LIVE_INTEGRATIONS} integrations; cleanup may be required before apply."
fi

if (( LIVE_ROUTES >= 300 )); then
  echo "::warning::Live AWS has ${LIVE_ROUTES} routes, at the HTTP API quota. Stale route cleanup must run before apply."
elif (( LIVE_ROUTES >= 280 )); then
  echo "::warning::Live AWS has ${LIVE_ROUTES} routes, near the HTTP API quota of 300."
fi
