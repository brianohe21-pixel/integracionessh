#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

while IFS= read -r lambda_addr; do
  [[ -z "$lambda_addr" ]] && continue
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
    import_attempts="${TF_IMPORT_ATTEMPTS:-3}"
    import_retry_delay="${TF_IMPORT_RETRY_DELAY_SECONDS:-15}"
    for attempt in $(seq 1 "$import_attempts"); do
      set +e
      import_output="$(terraform import -lock-timeout=10m "$log_addr" "$log_group" 2>&1)"
      import_status=$?
      set -e
      if [ "$import_status" -eq 0 ]; then
        echo "$import_output"
        break
      fi
      if echo "$import_output" | grep -Eqi 'Error acquiring the state lock|PreconditionFailed|lock'; then
        echo "State lock detected while importing ${log_group} (attempt $attempt/$import_attempts); retrying in ${import_retry_delay}s" >&2
        if [ "$attempt" -lt "$import_attempts" ]; then
          sleep "$import_retry_delay"
          continue
        fi
      fi
      echo "$import_output" >&2
      exit "$import_status"
    done
  fi
done < <(terraform state list 2>/dev/null | grep '^module\.lambda\.aws_lambda_function\.functions\[' || true)
