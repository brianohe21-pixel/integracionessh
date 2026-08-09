#!/usr/bin/env bash
set -euo pipefail

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required" >&2
  exit 1
fi

mapfile -t addresses < <(terraform state list | rg 'aws_apigatewayv2_integration\.integrations\[' || true)
if ((${#addresses[@]} == 0)); then
  echo "No per-route API Gateway integrations in state; migration skipped."
  exit 0
fi

declare -A keep_for_uri
declare -A uri_for_addr

for addr in "${addresses[@]}"; do
  uri="$(terraform state show -no-color "$addr" | awk '/integration_uri/ {print $3; exit}')"
  key="$(sed -n 's/.*\["\(.*\)"\]/\1/p' <<<"$addr")"
  if [[ -z "$uri" || -z "$key" ]]; then
    echo "Skipping unreadable state address: $addr" >&2
    continue
  fi
  uri_for_addr[$addr]="$uri"
  if [[ -z "${keep_for_uri[$uri]:-}" || "$key" < "${keep_for_uri[$uri]}" ]]; then
    keep_for_uri[$uri]="$key"
  fi
done

removed=0
for addr in "${addresses[@]}"; do
  uri="${uri_for_addr[$addr]:-}"
  key="$(sed -n 's/.*\["\(.*\)"\]/\1/p' <<<"$addr")"
  keep="${keep_for_uri[$uri]:-}"
  if [[ -n "$keep" && "$key" != "$keep" ]]; then
    echo "Removing duplicate integration from state: integrations[\"$key\"] (keeping integrations[\"$keep\"])"
    terraform state rm "$addr" >/dev/null
    removed=$((removed + 1))
  fi
done

echo "API Gateway integration state migration complete (${removed} duplicate(s) removed)."
