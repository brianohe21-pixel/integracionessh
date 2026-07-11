#!/usr/bin/env bash
set -euo pipefail

STALE_MINUTES="${STALE_MINUTES:-5}"
BUCKET="${TF_STATE_BUCKET:-chatbot-platform-tfstate-979054355542}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "${TF_STATE_KEY:-}" ]; then
  TF_STATE_KEY=$(grep -E '^\s*key\s*=' main.tf | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/' || true)
fi

if [ -z "${TF_STATE_KEY}" ]; then
  echo "Could not determine Terraform state key; skipping stale lock check" >&2
  exit 0
fi

LOCK_KEY="${TF_STATE_KEY}.tflock"

if ! lock_body=$(aws s3 cp "s3://${BUCKET}/${LOCK_KEY}" - --region "$REGION" 2>/dev/null); then
  echo "No state lock at s3://${BUCKET}/${LOCK_KEY}"
  exit 0
fi

echo "Found state lock at s3://${BUCKET}/${LOCK_KEY}"
echo "$lock_body"

lock_id=$(echo "$lock_body" | jq -r '.ID // .LockID // empty')
created=$(echo "$lock_body" | jq -r '.Created // empty')
who=$(echo "$lock_body" | jq -r '.Who // "unknown"')

if [ -z "$lock_id" ]; then
  echo "::warning::Lock file exists but lock ID is missing; manual cleanup may be required"
  exit 0
fi

echo "Lock holder: ${who}"
echo "Lock ID: ${lock_id}"

if [ -z "$created" ]; then
  echo "::warning::Lock Created timestamp missing; not auto-unlocking"
  exit 0
fi

created_epoch=$(date -u -d "$created" +%s 2>/dev/null || echo 0)
now_epoch=$(date -u +%s)
age_minutes=$(( (now_epoch - created_epoch) / 60 ))

echo "Lock age: ${age_minutes} minute(s) (stale threshold: ${STALE_MINUTES})"

if [ "$age_minutes" -lt "$STALE_MINUTES" ]; then
  echo "Lock is recent; leaving it in place"
  exit 0
fi

echo "::warning::Force-unlocking stale Terraform state lock (${age_minutes}m old)"
terraform force-unlock -force "$lock_id"
