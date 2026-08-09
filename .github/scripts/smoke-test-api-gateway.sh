#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-${API_PUBLIC_URL:-}}"
if [[ -z "$API_BASE_URL" ]]; then
  echo "API_BASE_URL or API_PUBLIC_URL is required for smoke tests" >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
FAILED=0

check_endpoint() {
  local method="$1"
  local path="$2"
  local expected_regex="$3"
  local url="${API_BASE_URL}${path}"
  local status
  status="$(curl -s -o /tmp/smoke-response.txt -w "%{http_code}" -X "$method" "$url" || true)"

  if [[ ! "$status" =~ $expected_regex ]]; then
    echo "FAIL ${method} ${path}: HTTP ${status} (expected ${expected_regex})"
    FAILED=1
    return
  fi
  echo "OK   ${method} ${path}: HTTP ${status}"
}

echo "Running API Gateway smoke tests against ${API_BASE_URL}"

check_endpoint GET "/webhook" '^(200|400|403|404)$'
check_endpoint GET "/email-marketing/health" '^(200|401|403|404|502)$'
check_endpoint POST "/email-marketing/webhook" '^(200|400|401|403|404|502)$'
check_endpoint GET "/tenants" '^(401|403)$'
check_endpoint GET "/bots" '^(401|403)$'
check_endpoint GET "/conversations" '^(401|403)$'

if (( FAILED > 0 )); then
  echo "API Gateway smoke tests failed."
  exit 1
fi

echo "API Gateway smoke tests passed."
