#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY is required" >&2
  exit 1
fi

linear_graphql() {
  local query="$1"
  local variables="${2:-"{}"}"

  if [[ -z "$variables" ]]; then
    variables="{}"
  fi

  if ! jq -e . >/dev/null 2>&1 <<<"$variables"; then
    echo "Invalid Linear GraphQL variables JSON: ${variables}" >&2
    return 1
  fi

  local payload
  if ! payload="$(jq -nc --arg query "$query" --argjson variables "$variables" '{query: $query, variables: $variables}')"; then
    echo "Failed to build Linear GraphQL payload" >&2
    return 1
  fi

  local response
  if ! response="$(curl -fsS -X POST 'https://api.linear.app/graphql' \
    -H 'Content-Type: application/json' \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data "$payload")"; then
    echo "Linear GraphQL request failed" >&2
    return 1
  fi

  if jq -e '.errors' >/dev/null <<<"$response"; then
    echo "Linear GraphQL error: $(jq -c '.errors' <<<"$response")" >&2
    return 1
  fi

  printf '%s' "$response"
}
