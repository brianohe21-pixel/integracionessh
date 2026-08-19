#!/usr/bin/env bash
set -euo pipefail

PLAN_FILE="${1:-plan.txt}"
MAX_INTEGRATION_DESTROYS="${MAX_INTEGRATION_DESTROYS:-5}"
MAX_ROUTE_DESTROYS="${MAX_ROUTE_DESTROYS:-10}"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Plan file not found: $PLAN_FILE" >&2
  exit 1
fi

integration_destroy_count="$(
  grep -E 'aws_apigatewayv2_integration\.integrations\[' "$PLAN_FILE" \
    | grep -c 'will be destroyed' || true
)"
route_destroy_count="$(
  grep -E 'aws_apigatewayv2_route\.routes\[' "$PLAN_FILE" \
    | grep -c 'will be destroyed' || true
)"
integration_create_count="$(
  grep -E 'aws_apigatewayv2_integration\.integrations\[' "$PLAN_FILE" \
    | grep -c 'will be created' || true
)"

echo "Plan safety check:"
echo "  integration destroys: ${integration_destroy_count}"
echo "  integration creates: ${integration_create_count}"
echo "  route destroys: ${route_destroy_count}"

if (( integration_destroy_count > MAX_INTEGRATION_DESTROYS )); then
  echo "::error::Plan would destroy ${integration_destroy_count} API Gateway integrations (limit ${MAX_INTEGRATION_DESTROYS}). Run state migration before apply."
  exit 1
fi

if (( route_destroy_count > MAX_ROUTE_DESTROYS )); then
  echo "::error::Plan would destroy ${route_destroy_count} API Gateway routes (limit ${MAX_ROUTE_DESTROYS})."
  exit 1
fi

if grep -q 'Error:' "$PLAN_FILE"; then
  echo "::error::Terraform plan contains errors."
  exit 1
fi

echo "Terraform plan safety check passed."
