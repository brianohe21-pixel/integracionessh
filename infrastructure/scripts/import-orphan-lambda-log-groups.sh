#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MAX_IMPORTS_PER_RUN="${TF_IMPORT_MAX_PER_RUN:-10}"
IMPORT_TIMEOUT_SECONDS="${TF_IMPORT_LOCK_TIMEOUT_SECONDS:-30}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

imported_count=0
while IFS= read -r lambda_addr; do
  [[ -z "$lambda_addr" ]] && continue
  if [ "$imported_count" -ge "$MAX_IMPORTS_PER_RUN" ]; then
    echo "Reached max imports per run (${MAX_IMPORTS_PER_RUN}); stopping orphan log-group import" >&2
    break
  fi
  key="${lambda_addr#module.lambda.aws_lambda_function.functions[\"}"
  key="${key%\"]}"
  log_addr="module.lambda.aws_cloudwatch_log_group.lambda_logs[\"${key}\"]"
  if terraform state show "$log_addr" >/dev/null 2>&1; then
    continue
  fi
  slug="${key//_/-}"
  log_group="/aws/lambda/${PROJECT}-${ENVIRONMENT}-${slug}"
  existing="$(
    aws logs describe-log-groups \
      --region "$AWS_REGION" \
      --log-group-name-prefix "$log_group" \
      --query "logGroups[?logGroupName=='${log_group}'].logGroupName" \
      --output text 2>/dev/null || true
  )"
  if [[ "$existing" == "$log_group" ]]; then
    echo "Importing orphan log group ${log_group} -> ${log_addr}"
    imported_count=$((imported_count + 1))
    set +e
    import_output="$(terraform import -input=false -no-color -lock-timeout="${IMPORT_TIMEOUT_SECONDS}s" "$log_addr" "$log_group" 2>&1)"
    import_status=$?
    set -e
    if [ "$import_status" -eq 0 ]; then
      echo "$import_output"
      continue
    fi
    if echo "$import_output" | grep -Eqi 'Error acquiring the state lock|PreconditionFailed|lock'; then
      echo "Skipping import for ${log_group}; state lock could not be acquired within ${IMPORT_TIMEOUT_SECONDS}s" >&2
      continue
    fi
    echo "$import_output" >&2
  fi
done < <(terraform state list 2>/dev/null | grep '^module\.lambda\.aws_lambda_function\.functions\[' || true)
