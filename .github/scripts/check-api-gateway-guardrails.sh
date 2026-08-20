#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ORPHAN_INTEGRATIONS="${MAX_ORPHAN_INTEGRATIONS:-0}"
ENFORCE_ORPHAN_LIMIT="${ENFORCE_ORPHAN_LIMIT:-false}"
FAIL_ON_ROUTE_LIMIT_WARNING="${FAIL_ON_ROUTE_LIMIT_WARNING:-false}"

bash "${SCRIPT_DIR}/validate-api-gateway-integrations.sh"

if [[ "${FAIL_ON_ROUTE_LIMIT_WARNING}" == "true" ]]; then
  if python3 "${SCRIPT_DIR}/../../infrastructure/scripts/validate-api-gateway-integrations.py" 2>&1 | grep -q 'Route count .* is near AWS HTTP API limit'; then
    echo "::error::Route count is near the AWS HTTP API limit. Request a route quota increase or consolidate routes."
    exit 1
  fi
fi

if command -v aws >/dev/null 2>&1 && command -v terraform >/dev/null 2>&1; then
  orphan_count="$(bash "${SCRIPT_DIR}/count-orphan-api-integrations.sh")"
  if [[ "${ENFORCE_ORPHAN_LIMIT}" == "true" ]]; then
    if (( orphan_count > MAX_ORPHAN_INTEGRATIONS )); then
      echo "::error::Found ${orphan_count} orphan API Gateway integrations (allowed ${MAX_ORPHAN_INTEGRATIONS})."
      exit 1
    fi
  elif (( orphan_count > 0 )); then
    echo "::warning::Found ${orphan_count} orphan API Gateway integrations. Cleanup runs before apply."
  fi
  echo "Orphan API Gateway integrations: ${orphan_count}"
fi

echo "API Gateway guardrails passed."
