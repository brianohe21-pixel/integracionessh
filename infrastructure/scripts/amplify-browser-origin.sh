#!/usr/bin/env sh
set -eu

project="${1:?project}"
environment="${2:?environment}"
region="${3:?region}"
branch="${4:?branch}"

app_name="${project}-${environment}"
row="$(aws amplify list-apps --region "$region" \
  --query "apps[?name=='${app_name}'].[defaultDomain] | [0]" --output text 2>/dev/null || true)"

if [ -z "$row" ] || [ "$row" = "None" ] || [ "$row" = "null" ]; then
  printf '%s\n' '{"origin":""}'
  exit 0
fi

domain="$(printf '%s' "$row" | awk '{print $1}')"
printf '%s\n' "{\"origin\":\"https://${branch}.${domain}\"}"
