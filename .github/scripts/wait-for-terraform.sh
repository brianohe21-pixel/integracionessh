#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:?Usage: wait-for-terraform.sh <branch> <sha>}"
SHA="${2:?Usage: wait-for-terraform.sh <branch> <sha>}"
BEFORE="${3:-}"
WORKFLOW="${WORKFLOW:-terraform.yml}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
FIND_TIMEOUT="${FIND_TIMEOUT:-600}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-3600}"
GH_RETRIES="${GH_RETRIES:-5}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

terraform_paths_changed() {
  "$SCRIPT_DIR/changed-files-in-push.sh" "$SHA" "$BEFORE" \
    | grep -qE '^(infrastructure/|\.github/workflows/terraform\.yml|\.github/scripts/terraform-plan-apply\.sh|\.github/scripts/terraform-unlock-stale\.sh)'
}

gh_retry() {
  local attempt=1
  local out=""
  while [ "$attempt" -le "$GH_RETRIES" ]; do
    if out="$("$@" 2>&1)"; then
      printf '%s' "$out"
      return 0
    fi
    if ! printf '%s' "$out" | grep -qE 'HTTP 5[0-9]{2}|Service Unavailable|rate limit'; then
      printf '%s' "$out" >&2
      return 1
    fi
    echo "GitHub API transient error (attempt ${attempt}/${GH_RETRIES}); retrying in ${POLL_INTERVAL}s..." >&2
    printf '%s' "$out" >&2
    sleep "$POLL_INTERVAL"
    attempt=$((attempt + 1))
  done
  printf '%s' "$out" >&2
  return 1
}

run_status() {
  local run_id="$1"
  gh_retry gh run view "$run_id" --json status,conclusion \
    | jq -r '[.status // "", .conclusion // ""] | @tsv'
}

watch_terraform_run() {
  local run_id="$1"
  local elapsed=0
  local attempt=1

  while [ "$elapsed" -lt "$WAIT_TIMEOUT" ]; do
    if gh run watch "$run_id" --exit-status --interval "$POLL_INTERVAL"; then
      return 0
    fi

    local status conclusion
    IFS=$'\t' read -r status conclusion < <(run_status "$run_id" || echo $'\t')

    if [ "$conclusion" = "success" ]; then
      echo "Terraform workflow completed successfully (gh run watch failed; verified conclusion=${conclusion})."
      return 0
    fi

    if [ "$status" = "completed" ] && [ -n "$conclusion" ] && [ "$conclusion" != "success" ]; then
      echo "::error::Terraform workflow finished with conclusion: ${conclusion}"
      return 1
    fi

    if [ "$attempt" -ge "$GH_RETRIES" ] && [ "$status" = "completed" ]; then
      echo "::error::Terraform workflow finished with conclusion: ${conclusion:-unknown}"
      return 1
    fi

    echo "gh run watch interrupted (attempt ${attempt}/${GH_RETRIES}); status=${status:-unknown} conclusion=${conclusion:-pending}..."
    attempt=$((attempt + 1))
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  echo "::error::Timed out waiting for Terraform workflow ${run_id} after ${WAIT_TIMEOUT}s"
  return 1
}

echo "Waiting for Terraform workflow (${WORKFLOW}) on ${BRANCH}@${SHA}..."

if ! terraform_paths_changed; then
  echo "No Terraform-related changes in this push; skipping wait."
  exit 0
fi

elapsed=0
run_id=""
while [ "$elapsed" -lt "$FIND_TIMEOUT" ]; do
  run_id=$(gh_retry gh run list \
    --workflow="$WORKFLOW" \
    --branch="$BRANCH" \
    --json databaseId,headSha,status,conclusion \
    --limit 30 \
    | jq -r --arg sha "$SHA" '[.[] | select(.headSha == $sha)] | .[0].databaseId // empty') || true
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
watch_terraform_run "$run_id"
