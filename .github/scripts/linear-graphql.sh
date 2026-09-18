#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY is required" >&2
  exit 1
fi

linear_graphql() {
  local query="$1"
  local variables="${2:-{}}"

  local payload
  payload="$(jq -n --arg query "$query" --argjson variables "$variables" '{query: $query, variables: $variables}')"

  local response
  response="$(curl -sS -X POST 'https://api.linear.app/graphql' \
    -H 'Content-Type: application/json' \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data "$payload")"

  if jq -e '.errors' >/dev/null <<<"$response"; then
    echo "Linear GraphQL error: $(jq -c '.errors' <<<"$response")" >&2
    exit 1
  fi

  printf '%s' "$response"
}
