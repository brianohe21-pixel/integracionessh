#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-chatbot-platform}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
PREFIX="${PROJECT}-${ENVIRONMENT}"

CORE_QUEUE_SUFFIX="-messages.fifo"
IDLE_QUEUE_SUFFIXES=(
  "-bulk-send.fifo"
  "-campaign-send.fifo"
  "-integration-events.fifo"
  "-automation-run.fifo"
  "-knowledge-index.fifo"
  "-flow-run.fifo"
  "-call-events.fifo"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") <action> [environment]

Actions:
  status              Show trigger state for the environment
  on                  Enable all SQS triggers
  off                 Disable all SQS triggers
  on-core             Enable only the messages trigger (recommended for prod)
  off-idle            Disable idle triggers, keep messages enabled

Environments: dev (default), prod

Environment variables:
  PROJECT      Default: chatbot-platform
  ENVIRONMENT  Default: dev (overridden by second argument)
  AWS_REGION   Default: us-east-1

Examples:
  $(basename "$0") status dev
  $(basename "$0") off dev
  $(basename "$0") status prod
  $(basename "$0") on-core prod
  $(basename "$0") off-idle prod
EOF
}

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required" >&2
    exit 1
  fi
}

resolve_environment() {
  local arg="${1:-}"
  if [[ -n "$arg" && "$arg" != "status" && "$arg" != "on" && "$arg" != "off" && "$arg" != "on-core" && "$arg" != "off-idle" ]]; then
  :
  fi
}

list_sqs_mappings() {
  aws lambda list-event-source-mappings \
    --region "$AWS_REGION" \
    --output json \
    --no-cli-pager \
    | jq -r --arg prefix "$PREFIX" '
        .EventSourceMappings[]
        | select(.EventSourceArn | contains($prefix))
        | select(.EventSourceArn | contains(":sqs:"))
        | [.UUID, .State, (if .State == "Enabled" then "enabled" else "disabled" end), (.EventSourceArn | split(":")[-1]), (.FunctionArn | split(":")[-1])]
        | @tsv
      '
}

queue_matches_suffix() {
  local queue="$1"
  local suffix="$2"
  [[ "$queue" == *"$suffix" ]]
}

is_core_queue() {
  queue_matches_suffix "$1" "$CORE_QUEUE_SUFFIX"
}

is_idle_queue() {
  local queue="$1"
  local suffix
  for suffix in "${IDLE_QUEUE_SUFFIXES[@]}"; do
    if queue_matches_suffix "$queue" "$suffix"; then
      return 0
    fi
  done
  return 1
}

should_toggle_mapping() {
  local mode="$1"
  local queue="$2"

  case "$mode" in
    all)
      return 0
      ;;
    core-only)
      is_core_queue "$queue"
      ;;
    idle-only)
      is_idle_queue "$queue"
      ;;
    *)
      return 1
      ;;
  esac
}

set_mappings_enabled() {
  local enabled="$1"
  local mode="${2:-all}"
  local flag=()
  if [[ "$enabled" == "true" ]]; then
    flag=(--enabled)
  else
    flag=(--no-enabled)
  fi

  local target_state
  target_state="$([[ "$enabled" == "true" ]] && echo enabled || echo disabled)"

  local mappings
  mappings="$(list_sqs_mappings)"

  if [[ -z "$mappings" ]]; then
    echo "No SQS event source mappings found for ${PREFIX} in ${AWS_REGION}."
    exit 1
  fi

  local count=0
  while IFS=$'\t' read -r uuid state current_enabled queue function; do
    [[ -z "$uuid" ]] && continue
    if ! should_toggle_mapping "$mode" "$queue"; then
      continue
    fi
    if [[ "$current_enabled" == "$target_state" ]]; then
      echo "skip  ${queue} -> ${function} (already ${current_enabled})"
      continue
    fi
    aws lambda update-event-source-mapping \
      --region "$AWS_REGION" \
      --uuid "$uuid" \
      "${flag[@]}" \
      --no-cli-pager >/dev/null
    echo "set   ${queue} -> ${function} (${current_enabled} -> ${target_state}, was ${state})"
    count=$((count + 1))
  done <<< "$mappings"

  echo
  echo "Updated ${count} mapping(s) for ${PREFIX}."
}

print_status() {
  local mappings
  mappings="$(list_sqs_mappings)"

  if [[ -z "$mappings" ]]; then
    echo "No SQS event source mappings found for ${PREFIX} in ${AWS_REGION}."
    exit 1
  fi

  local enabled_count=0
  local disabled_count=0
  local core_enabled="no"
  local idle_enabled=0
  local idle_disabled=0

  printf "%-38s %-12s %-10s %-6s %s\n" "QUEUE" "STATE" "ENABLED" "ROLE" "FUNCTION"
  while IFS=$'\t' read -r uuid state enabled queue function; do
    [[ -z "$uuid" ]] && continue
    local role="other"
    if is_core_queue "$queue"; then
      role="core"
      if [[ "$enabled" == "enabled" ]]; then
        core_enabled="yes"
      fi
    elif is_idle_queue "$queue"; then
      role="idle"
      if [[ "$enabled" == "enabled" ]]; then
        idle_enabled=$((idle_enabled + 1))
      else
        idle_disabled=$((idle_disabled + 1))
      fi
    fi
    printf "%-38s %-12s %-10s %-6s %s\n" "$queue" "$state" "$enabled" "$role" "$function"
    if [[ "$enabled" == "enabled" ]]; then
      enabled_count=$((enabled_count + 1))
    else
      disabled_count=$((disabled_count + 1))
    fi
  done <<< "$mappings"

  echo
  echo "Environment: ${ENVIRONMENT}"
  echo "SQS polling: ${enabled_count} enabled, ${disabled_count} disabled"
  echo "Core messages trigger: ${core_enabled}"
  echo "Idle triggers: ${idle_enabled} enabled, ${idle_disabled} disabled"

  if [[ "$core_enabled" == "no" && "$ENVIRONMENT" == "prod" ]]; then
    echo
    echo "WARNING: prod messages trigger is disabled. WhatsApp inbound processing is paused."
    echo "Run: $(basename "$0") on-core prod"
  fi
}

main() {
  local action="${1:-}"
  local env_arg="${2:-}"

  if [[ -n "$env_arg" ]]; then
    ENVIRONMENT="$env_arg"
    PREFIX="${PROJECT}-${ENVIRONMENT}"
  fi

  if [[ -z "$action" ]]; then
    usage
    exit 1
  fi

  require_aws

  case "$action" in
    on)
      set_mappings_enabled true all
      ;;
    off)
      set_mappings_enabled false all
      ;;
    on-core)
      set_mappings_enabled true core-only
      ;;
    off-idle)
      set_mappings_enabled false idle-only
      set_mappings_enabled true core-only
      ;;
    status)
      print_status
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      if [[ "$action" == "dev" || "$action" == "prod" ]]; then
        echo "Missing action. Pass action first, environment second." >&2
      else
        echo "Unknown action: ${action}" >&2
      fi
      usage
      exit 1
      ;;
  esac
}

main "$@"
