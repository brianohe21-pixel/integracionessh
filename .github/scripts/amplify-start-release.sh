#!/usr/bin/env bash
set -euo pipefail

: "${AMPLIFY_APP_ID:?AMPLIFY_APP_ID is required}"
: "${AMPLIFY_BRANCH:?AMPLIFY_BRANCH is required}"

MAX_WAIT_SECONDS="${AMPLIFY_MAX_WAIT_SECONDS:-1800}"
POLL_INTERVAL_SECONDS="${AMPLIFY_POLL_INTERVAL_SECONDS:-30}"

latest_job_status() {
  aws amplify list-jobs \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$AMPLIFY_BRANCH" \
    --max-results 1 \
    --query 'jobSummaries[0].status' \
    --output text \
    --no-cli-pager 2>/dev/null || echo "NONE"
}

wait_for_idle() {
  local elapsed=0
  while true; do
    local status
    status="$(latest_job_status)"
    if [[ "$status" == "None" || "$status" == "NONE" || "$status" == "SUCCEED" || "$status" == "FAILED" || "$status" == "CANCELLED" ]]; then
      return 0
    fi
    if [[ "$status" == "PENDING" || "$status" == "RUNNING" ]]; then
      echo "Amplify job is ${status} on ${AMPLIFY_BRANCH}; waiting ${POLL_INTERVAL_SECONDS}s..."
      sleep "$POLL_INTERVAL_SECONDS"
      elapsed=$((elapsed + POLL_INTERVAL_SECONDS))
      if (( elapsed >= MAX_WAIT_SECONDS )); then
        echo "Timed out after ${MAX_WAIT_SECONDS}s waiting for Amplify job on ${AMPLIFY_BRANCH}"
        exit 1
      fi
      continue
    fi
    echo "Unknown Amplify job status: ${status}"
    return 0
  done
}

wait_for_idle

aws amplify start-job \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$AMPLIFY_BRANCH" \
  --job-type RELEASE \
  --no-cli-pager
