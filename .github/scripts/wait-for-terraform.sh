#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:?Usage: wait-for-terraform.sh <branch> <sha>}"
SHA="${2:?Usage: wait-for-terraform.sh <branch> <sha>}"
WORKFLOW="${WORKFLOW:-terraform.yml}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
FIND_TIMEOUT="${FIND_TIMEOUT:-600}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-3600}"

echo "Waiting for Terraform workflow (${WORKFLOW}) on ${BRANCH}@${SHA}..."

elapsed=0
run_id=""
while [ "$elapsed" -lt "$FIND_TIMEOUT" ]; do
  run_id=$(gh run list \
    --workflow="$WORKFLOW" \
    --branch="$BRANCH" \
    --json databaseId,headSha,status,conclusion \
    --limit 30 \
    | jq -r --arg sha "$SHA" '[.[] | select(.headSha == $sha)] | .[0].databaseId // empty')
  if [ -n "$run_id" ]; then
    break
  fi
  echo "Terraform run not found yet (${elapsed}s)..."
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

if [ -z "$run_id" ]; then
  echo "::error::No Terraform workflow run found for ${SHA} within ${FIND_TIMEOUT}s"
  exit 1
fi

echo "Found Terraform run ${run_id}; watching..."
gh run watch "$run_id" --exit-status --interval "$POLL_INTERVAL" || {
  conclusion=$(gh run view "$run_id" --json conclusion -q '.conclusion')
  echo "::error::Terraform workflow finished with conclusion: ${conclusion}"
  exit 1
}

echo "Terraform workflow completed successfully."
