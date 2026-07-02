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
    terraform import "$log_addr" "$log_group"
  fi
done < <(terraform state list 2>/dev/null | grep '^module\.lambda\.aws_lambda_function\.functions\[' || true)
