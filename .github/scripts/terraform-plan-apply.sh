#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:?Usage: terraform-plan-apply.sh refresh-only|plan|apply}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-10m}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
RETRY_SLEEP="${RETRY_SLEEP:-15}"

build_plan_args() {
  PLAN_ARGS=(
    -no-color
    -var="github_access_token=${GH_ACCESS_TOKEN}"
    -var="whatsapp_verify_token=${WHATSAPP_VERIFY_TOKEN}"
    -var="repository_url=${REPOSITORY_URL}"
  )

  if [ -f terraform.tfvars ]; then
    PLAN_ARGS+=(-var-file=terraform.tfvars)
  fi
  if [ "${ENABLE_MONITORING:-false}" = "true" ]; then
    PLAN_ARGS+=(-var="enable_monitoring=true")
  fi
  if [ -n "${OPS_ALERT_EMAIL:-}" ]; then
    PLAN_ARGS+=(-var="ops_alert_email=${OPS_ALERT_EMAIL}")
  fi
  SES_SENDER="${SES_FROM_EMAIL:-${OPS_ALERT_EMAIL:-}}"
  if [ -n "${SES_SENDER}" ]; then
    PLAN_ARGS+=(-var="ses_from_email=${SES_SENDER}")
  fi
  if [ -n "${META_APP_ID:-}" ]; then
    PLAN_ARGS+=(-var="meta_app_id=${META_APP_ID}")
  fi
  if [ -n "${META_APP_SECRET:-}" ]; then
    PLAN_ARGS+=(-var="meta_app_secret=${META_APP_SECRET}")
  fi
  if [ -n "${META_EMBEDDED_SIGNUP_CONFIG_ID:-}" ]; then
    PLAN_ARGS+=(-var="meta_embedded_signup_config_id=${META_EMBEDDED_SIGNUP_CONFIG_ID}")
  fi
  if [ -n "${FRONTEND_URL:-}" ]; then
    PLAN_ARGS+=(-var="frontend_url=${FRONTEND_URL}")
  fi
  if [ -n "${CUSTOM_DOMAIN:-}" ]; then
    PLAN_ARGS+=(-var="custom_domain=${CUSTOM_DOMAIN}")
  fi
  if [ -n "${API_CUSTOM_DOMAIN:-}" ]; then
    PLAN_ARGS+=(-var="api_custom_domain=${API_CUSTOM_DOMAIN}")
  fi
  if [ -n "${WOMPI_PUBLIC_KEY:-}" ]; then
    PLAN_ARGS+=(-var="wompi_public_key=${WOMPI_PUBLIC_KEY}")
  fi
  if [ -n "${WOMPI_PRIVATE_KEY:-}" ]; then
    PLAN_ARGS+=(-var="wompi_private_key=${WOMPI_PRIVATE_KEY}")
  fi
  if [ -n "${WOMPI_INTEGRITY_SECRET:-}" ]; then
    PLAN_ARGS+=(-var="wompi_integrity_secret=${WOMPI_INTEGRITY_SECRET}")
  fi
  if [ -n "${WOMPI_EVENTS_SECRET:-}" ]; then
    PLAN_ARGS+=(-var="wompi_events_secret=${WOMPI_EVENTS_SECRET}")
  fi
  if [ -n "${EXTRA_ALLOWED_ORIGINS:-}" ]; then
    PLAN_ARGS+=(-var="extra_allowed_origins=${EXTRA_ALLOWED_ORIGINS}")
  fi
  if [ -n "${EXTRA_CALLBACK_URLS:-}" ]; then
    PLAN_ARGS+=(-var="extra_callback_urls=${EXTRA_CALLBACK_URLS}")
  fi
  if [ -n "${EXTRA_LOGOUT_URLS:-}" ]; then
    PLAN_ARGS+=(-var="extra_logout_urls=${EXTRA_LOGOUT_URLS}")
  fi
}

run_with_lock_retry() {
  local log_file="$1"
  shift
  local attempt
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    set +e
    "$@" 2>&1 | tee "$log_file"
    local status=${PIPESTATUS[0]}
    set -e
    if [ "$status" -eq 0 ]; then
      return 0
    fi
    if grep -Eqi 'Error acquiring the state lock|PreconditionFailed|lock' "$log_file"; then
      echo "::warning::Terraform hit a transient state lock (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_SLEEP}s"
      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        sleep "$RETRY_SLEEP"
        continue
      fi
    fi
    return "$status"
  done
}

build_plan_args

case "$ACTION" in
  refresh-only)
    run_with_lock_retry refresh.txt \
      terraform plan -refresh-only "${PLAN_ARGS[@]}" -lock-timeout="$LOCK_TIMEOUT"
    ;;
  plan)
    OUTPUT_ARGS=()
    if [ "${TF_PLAN_OUT:-false}" = "true" ]; then
      OUTPUT_ARGS=(-out=tfplan)
    fi
    run_with_lock_retry plan.txt \
      terraform plan "${PLAN_ARGS[@]}" "${OUTPUT_ARGS[@]}" -lock-timeout="$LOCK_TIMEOUT"
    ;;
  apply)
    test -f tfplan
    run_with_lock_retry apply.txt \
      terraform apply -auto-approve -parallelism=1 -lock-timeout="$LOCK_TIMEOUT" tfplan
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
