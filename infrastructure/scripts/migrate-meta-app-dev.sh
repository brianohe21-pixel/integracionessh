#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PROJECT="${PROJECT:-chatbot-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LAMBDA_PREFIX="${PROJECT}-${ENVIRONMENT}"

NEW_APP_ID="${NEW_APP_ID:-1496986695785834}"
NEW_APP_SECRET="${NEW_APP_SECRET:-}"
NEW_EMBEDDED_CONFIG_ID="${NEW_EMBEDDED_CONFIG_ID:-}"

DEV_API_URL="${DEV_API_URL:-https://ccti8rpoj1.execute-api.us-east-1.amazonaws.com}"
WEBHOOK_URL="${WEBHOOK_URL:-${DEV_API_URL%/}/webhook}"
VERIFY_TOKEN="${VERIFY_TOKEN:-36KWwUeHGWoeuIfQgfU9gQZ5ue7ZxTXHe8QGpeZIfRzRkPolxc3CagQxWqDCVjt0}"

WABA_ID="${WABA_ID:-1703105757623340}"
TENANT_ID="${TENANT_ID:-c8548fc4-5611-4a05-8347-3526835faf0d}"
OLD_APP_ID="${OLD_APP_ID:-4505851696405995}"

FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-${REPO_ROOT}/frontend/.env.local}"
GRAPH_API_VERSION="${GRAPH_API_VERSION:-v22.0}"

LAMBDA_FUNCTIONS=(webhook whatsapp-connect messenger-connect)
WEBHOOK_FIELDS="${WEBHOOK_FIELDS:-messages,calls,message_template_status_update,message_template_quality_update,account_update,account_alerts,phone_number_quality_update,phone_number_name_update,security}"

DRY_RUN=0
SKIP_FRONTEND=0
SKIP_LAMBDA=0
SKIP_WEBHOOK=0
SKIP_WABA=0
UNSUBSCRIBE_OLD_APP=0
UPDATE_GITHUB=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options] [command]

Migrate the ${ENVIRONMENT} environment to a new Meta app (WhatsApp Cloud API).

Commands:
  all        Run frontend, lambda, webhook, waba, and verify (default)
  frontend   Update frontend/.env.local
  lambda     Update Lambda environment variables
  webhook    Subscribe Meta app webhook to ${WEBHOOK_URL}
  waba       Subscribe WABA to the new app (requires tenant WhatsApp token)
  verify     Run post-migration checks
  help       Show this help

Required environment variables:
  NEW_APP_SECRET              App secret for NEW_APP_ID
  NEW_EMBEDDED_CONFIG_ID      Embedded Signup configuration ID

Optional environment variables:
  NEW_APP_ID                  Default: ${NEW_APP_ID}
  DEV_API_URL                 Default: ${DEV_API_URL}
  WEBHOOK_URL                 Default: \${DEV_API_URL}/webhook
  VERIFY_TOKEN                Webhook verify token used by Lambda
  WABA_ID                     Default: ${WABA_ID}
  TENANT_ID                   Default: ${TENANT_ID}
  OLD_APP_ID                  Default: ${OLD_APP_ID}
  ACCESS_TOKEN                Override tenant token for WABA subscription
  FRONTEND_ENV_FILE           Default: frontend/.env.local

Options:
  --dry-run                   Print actions without applying changes
  --skip-frontend             Skip .env.local update
  --skip-lambda               Skip Lambda env update
  --skip-webhook              Skip Meta webhook subscription
  --skip-waba                 Skip WABA subscribed_apps step
  --unsubscribe-old-app       Remove old app from WABA (needs OLD_APP_SECRET)
  --update-github             Update GitHub dev variables/secrets via gh CLI
  --old-app-secret <secret>   Required with --unsubscribe-old-app

Examples:
  export NEW_APP_SECRET='...'
  export NEW_EMBEDDED_CONFIG_ID='...'
  $(basename "$0")

  $(basename "$0") verify
  $(basename "$0") --dry-run all
EOF
}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "${cmd} is required"
}

require_secrets() {
  [[ -n "${NEW_APP_SECRET}" ]] || die "NEW_APP_SECRET is required"
  [[ -n "${NEW_EMBEDDED_CONFIG_ID}" ]] || die "NEW_EMBEDDED_CONFIG_ID is required"
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: $*"
    return 0
  fi
  log "RUN: $*"
  "$@"
}

COMMAND="all"

parse_args() {
  COMMAND="all"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --skip-frontend)
        SKIP_FRONTEND=1
        shift
        ;;
      --skip-lambda)
        SKIP_LAMBDA=1
        shift
        ;;
      --skip-webhook)
        SKIP_WEBHOOK=1
        shift
        ;;
      --skip-waba)
        SKIP_WABA=1
        shift
        ;;
      --unsubscribe-old-app)
        UNSUBSCRIBE_OLD_APP=1
        shift
        ;;
      --update-github)
        UPDATE_GITHUB=1
        shift
        ;;
      --old-app-secret)
        OLD_APP_SECRET="${2:-}"
        [[ -n "${OLD_APP_SECRET}" ]] || die "--old-app-secret requires a value"
        shift 2
        ;;
      all|frontend|lambda|webhook|waba|verify|help|-h|--help)
        COMMAND="$1"
        shift
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

graph_get() {
  local path="$1"
  curl -fsS "https://graph.facebook.com/${GRAPH_API_VERSION}/${path}"
}

graph_post_form() {
  local path="$1"
  shift
  curl -fsS -X POST "https://graph.facebook.com/${GRAPH_API_VERSION}/${path}" "$@"
}

resolve_access_token() {
  if [[ -n "${ACCESS_TOKEN:-}" ]]; then
    printf '%s' "$ACCESS_TOKEN"
    return 0
  fi

  local secret_id="/${ENVIRONMENT}/tenants/${TENANT_ID}/whatsapp"
  aws secretsmanager get-secret-value \
    --region "$AWS_REGION" \
    --secret-id "$secret_id" \
    --query 'SecretString' \
    --output text \
    | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))"
}

resolve_token_app_id() {
  local token="$1"
  local app_id="${2:-}"
  local app_secret="${3:-}"

  [[ -n "$token" ]] || return 1
  [[ -n "$app_id" && -n "$app_secret" ]] || return 1

  curl -fsS "https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?input_token=${token}&access_token=${app_id}|${app_secret}" \
    | python3 -c "import sys, json; data=json.load(sys.stdin).get('data', {}); print(data.get('app_id', ''))"
}

update_frontend_env() {
  require_secrets
  [[ -f "$FRONTEND_ENV_FILE" ]] || die "Missing ${FRONTEND_ENV_FILE}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: update ${FRONTEND_ENV_FILE}"
    log "DRY-RUN: set NEXT_PUBLIC_META_APP_ID=${NEW_APP_ID}"
    log "DRY-RUN: set NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID=${NEW_EMBEDDED_CONFIG_ID}"
    return 0
  fi

  log "Updating ${FRONTEND_ENV_FILE}"

  python3 - "$FRONTEND_ENV_FILE" "$NEW_APP_ID" "$NEW_EMBEDDED_CONFIG_ID" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
app_id = sys.argv[2]
config_id = sys.argv[3]
updates = {
    "NEXT_PUBLIC_META_APP_ID": app_id,
    "NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID": config_id,
}

lines = path.read_text(encoding="utf-8").splitlines()
seen = set()
out = []

for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)

for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

  log "Frontend env updated. Restart pnpm dev if it is running."
}

update_lambda_env() {
  require_secrets
  require_cmd aws
  require_cmd python3

  local fn tmp_in tmp_out
  for fn in "${LAMBDA_FUNCTIONS[@]}"; do
    local lambda_name="${LAMBDA_PREFIX}-${fn}"
    log "Updating Lambda ${lambda_name}"

    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "DRY-RUN: META_APP_ID=${NEW_APP_ID}, META_APP_SECRET=***, WHATSAPP_APP_SECRET=*** on ${lambda_name}"
      continue
    fi

    tmp_in="$(mktemp)"
    tmp_out="$(mktemp)"

    aws lambda get-function-configuration \
      --region "$AWS_REGION" \
      --function-name "$lambda_name" \
      --query 'Environment.Variables' \
      --output json >"$tmp_in"

    python3 - "$tmp_in" "$tmp_out" "$NEW_APP_ID" "$NEW_APP_SECRET" <<'PY'
import json
import sys

src, dst, app_id, app_secret = sys.argv[1:5]
vars = json.load(open(src, encoding="utf-8"))
vars["META_APP_ID"] = app_id
vars["META_APP_SECRET"] = app_secret
vars["WHATSAPP_APP_SECRET"] = app_secret
json.dump({"Variables": vars}, open(dst, "w", encoding="utf-8"))
PY

    aws lambda update-function-configuration \
      --region "$AWS_REGION" \
      --function-name "$lambda_name" \
      --environment "file://${tmp_out}" \
      --no-cli-pager >/dev/null

    rm -f "$tmp_in" "$tmp_out"
    log "Lambda updated: ${lambda_name}"
  done
}

configure_meta_webhook() {
  require_secrets
  require_cmd curl

  log "Subscribing Meta app ${NEW_APP_ID} webhook to ${WEBHOOK_URL}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: POST /${NEW_APP_ID}/subscriptions"
    return 0
  fi

  local response
  response="$(graph_post_form "${NEW_APP_ID}/subscriptions" \
    -d "object=whatsapp_business_account" \
    -d "callback_url=${WEBHOOK_URL}" \
    -d "verify_token=${VERIFY_TOKEN}" \
    -d "fields=${WEBHOOK_FIELDS}" \
    -d "access_token=${NEW_APP_ID}|${NEW_APP_SECRET}")"

  log "Meta webhook response: ${response}"
}

subscribe_waba() {
  require_cmd aws
  require_cmd curl
  require_cmd python3

  local token token_app_id
  token="$(resolve_access_token)"
  [[ -n "$token" ]] || die "Could not resolve ACCESS_TOKEN. Reconnect WhatsApp first or set ACCESS_TOKEN."

  if [[ -n "${NEW_APP_SECRET:-}" ]]; then
    token_app_id="$(resolve_token_app_id "$token" "$NEW_APP_ID" "$NEW_APP_SECRET" || true)"
    if [[ -n "$token_app_id" && "$token_app_id" != "$NEW_APP_ID" ]]; then
      die "Tenant token belongs to app ${token_app_id}, not ${NEW_APP_ID}. Reconnect the bot in UI (Embedded Signup) before running waba."
    fi
  fi

  log "Subscribing WABA ${WABA_ID} to app ${NEW_APP_ID}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: POST /${WABA_ID}/subscribed_apps"
    return 0
  fi

  local response
  response="$(curl -fsS -X POST "https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/subscribed_apps" \
    -H "Authorization: Bearer ${token}")"
  log "WABA subscribe response: ${response}"
}

unsubscribe_old_app() {
  local old_secret="${OLD_APP_SECRET:-}"
  [[ -n "$old_secret" ]] || die "OLD_APP_SECRET is required with --unsubscribe-old-app"

  log "Unsubscribing old app ${OLD_APP_ID} from WABA ${WABA_ID}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: DELETE /${WABA_ID}/subscribed_apps for app ${OLD_APP_ID}"
    return 0
  fi

  curl -fsS -X DELETE "https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/subscribed_apps" \
    -d "access_token=${OLD_APP_ID}|${old_secret}" >/dev/null

  log "Old app unsubscribed from WABA"
}

update_github_vars() {
  require_secrets
  require_cmd gh

  log "Updating GitHub environment variables for ${ENVIRONMENT}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: gh variable set META_APP_ID / META_EMBEDDED_SIGNUP_CONFIG_ID / NEXT_PUBLIC_*"
    log "DRY-RUN: gh secret set META_APP_SECRET"
    return 0
  fi

  gh variable set META_APP_ID --body "$NEW_APP_ID" --env "$ENVIRONMENT"
  gh secret set META_APP_SECRET --body "$NEW_APP_SECRET" --env "$ENVIRONMENT"
  gh variable set META_EMBEDDED_SIGNUP_CONFIG_ID --body "$NEW_EMBEDDED_CONFIG_ID" --env "$ENVIRONMENT"
  gh variable set NEXT_PUBLIC_META_APP_ID --body "$NEW_APP_ID"
  gh variable set NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID --body "$NEW_EMBEDDED_CONFIG_ID"

  log "GitHub variables updated"
}

verify_webhook_challenge() {
  require_cmd curl

  log "Verifying webhook challenge on ${WEBHOOK_URL}"
  local body status
  body="$(curl -fsS "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=migrate-meta-app-dev")"
  status=$?

  if [[ "$status" -ne 0 ]]; then
    die "Webhook challenge request failed"
  fi

  if [[ "$body" != "migrate-meta-app-dev" ]]; then
    die "Webhook challenge mismatch. Expected 'migrate-meta-app-dev', got '${body}'"
  fi

  log "Webhook challenge OK"
}

verify_lambda_env() {
  require_cmd aws
  require_cmd jq

  local fn lambda_name actual_app_id actual_secret
  for fn in "${LAMBDA_FUNCTIONS[@]}"; do
    lambda_name="${LAMBDA_PREFIX}-${fn}"
    actual_app_id="$(aws lambda get-function-configuration \
      --region "$AWS_REGION" \
      --function-name "$lambda_name" \
      --query 'Environment.Variables.META_APP_ID' \
      --output text)"

    if [[ "$actual_app_id" != "$NEW_APP_ID" ]]; then
      die "Lambda ${lambda_name} META_APP_ID=${actual_app_id} (expected ${NEW_APP_ID})"
    fi
    log "Lambda ${lambda_name}: META_APP_ID OK"
  done
}

verify_frontend_env() {
  [[ -f "$FRONTEND_ENV_FILE" ]] || die "Missing ${FRONTEND_ENV_FILE}"

  local actual_app_id actual_config_id
  actual_app_id="$(grep '^NEXT_PUBLIC_META_APP_ID=' "$FRONTEND_ENV_FILE" | cut -d= -f2-)"
  actual_config_id="$(grep '^NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID=' "$FRONTEND_ENV_FILE" | cut -d= -f2-)"

  [[ "$actual_app_id" == "$NEW_APP_ID" ]] || die "Frontend app id mismatch: ${actual_app_id}"
  [[ "$actual_config_id" == "$NEW_EMBEDDED_CONFIG_ID" ]] || die "Frontend embedded config mismatch: ${actual_config_id}"
  log "Frontend env OK"
}

verify_waba_subscription() {
  require_cmd curl
  require_cmd python3

  local token response token_app_id
  token="$(resolve_access_token)"
  [[ -n "$token" ]] || die "Could not resolve ACCESS_TOKEN for WABA verification"

  if [[ -n "${NEW_APP_SECRET:-}" ]]; then
    token_app_id="$(resolve_token_app_id "$token" "$NEW_APP_ID" "$NEW_APP_SECRET" || true)"
    if [[ -z "$token_app_id" ]]; then
      log "WARN: Could not verify token app with NEW_APP_SECRET. Token may still belong to app ${OLD_APP_ID}."
    elif [[ "$token_app_id" != "$NEW_APP_ID" ]]; then
      die "Tenant token belongs to app ${token_app_id}, not ${NEW_APP_ID}. Reconnect bot via Embedded Signup, then run: $(basename "$0") waba"
    else
      log "Tenant token app OK: ${token_app_id}"
    fi
  fi

  response="$(curl -fsS "https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/subscribed_apps" \
    -H "Authorization: Bearer ${token}")"

  python3 - "$response" "$NEW_APP_ID" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
expected = sys.argv[2]
apps = payload.get("data", [])
ids = [item.get("whatsapp_business_api_data", {}).get("id") for item in apps]
if expected not in ids:
    raise SystemExit(f"WABA is not subscribed to app {expected}. Current apps: {ids}")
print(f"WABA subscribed apps OK: {ids}")
PY
}

verify_recent_webhook_logs() {
  require_cmd aws

  log "Checking recent webhook logs for signature errors"
  local events
  events="$(aws logs filter-log-events \
    --region "$AWS_REGION" \
    --log-group-name "/aws/lambda/${LAMBDA_PREFIX}-webhook" \
    --start-time $(($(date +%s) * 1000 - 900000)) \
    --filter-pattern "Invalid webhook signature" \
    --limit 5 \
    --output json 2>/dev/null || echo '{"events":[]}')"

  local count
  count="$(printf '%s' "$events" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('events', [])))")"

  if [[ "$count" -gt 0 ]]; then
    die "Found ${count} 'Invalid webhook signature' events in the last 15 minutes"
  fi

  log "No recent invalid webhook signatures"
}

send_meta_test_webhook() {
  require_secrets
  require_cmd curl

  log "Sending Meta test webhook for messages"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: skipped Meta test webhook"
    return 0
  fi

  curl -fsS -X POST "https://graph.facebook.com/${GRAPH_API_VERSION}/${NEW_APP_ID}/subscriptions" \
    -d "object=whatsapp_business_account" \
    -d "callback_url=${WEBHOOK_URL}" \
    -d "verify_token=${VERIFY_TOKEN}" \
    -d "fields=messages" \
    -d "access_token=${NEW_APP_ID}|${NEW_APP_SECRET}" >/dev/null || true

  sleep 3
  verify_recent_webhook_logs
}

run_verify() {
  [[ -n "${NEW_APP_SECRET}" ]] || log "WARN: NEW_APP_SECRET not set; skipping lambda/frontend strict checks"
  [[ -n "${NEW_EMBEDDED_CONFIG_ID}" ]] || log "WARN: NEW_EMBEDDED_CONFIG_ID not set; skipping frontend strict checks"

  verify_webhook_challenge

  if [[ -n "${NEW_APP_SECRET}" ]]; then
    verify_lambda_env
  fi

  if [[ -n "${NEW_EMBEDDED_CONFIG_ID}" && -f "$FRONTEND_ENV_FILE" ]]; then
    verify_frontend_env
  fi

  if [[ "$SKIP_WABA" -eq 0 ]]; then
    verify_waba_subscription || log "WARN: WABA not subscribed yet. Reconnect bot in UI, then run: $(basename "$0") waba"
  fi

  if [[ -n "${NEW_APP_SECRET}" ]]; then
    send_meta_test_webhook
  fi

  log "Verification completed"
}

run_all() {
  require_secrets
  require_cmd aws
  require_cmd curl
  require_cmd python3

  if [[ "$UPDATE_GITHUB" -eq 1 ]]; then
    update_github_vars
  fi

  if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
    update_frontend_env
  fi

  if [[ "$SKIP_LAMBDA" -eq 0 ]]; then
    update_lambda_env
  fi

  if [[ "$SKIP_WEBHOOK" -eq 0 ]]; then
    configure_meta_webhook
    if [[ "$DRY_RUN" -eq 0 ]]; then
      verify_webhook_challenge
    fi
  fi

  if [[ "$SKIP_WABA" -eq 0 ]]; then
  subscribe_waba || log "WARN: WABA subscribe failed. Reconnect bot in UI, then run: $(basename "$0") waba"
  fi

  if [[ "$UNSUBSCRIBE_OLD_APP" -eq 1 ]]; then
    unsubscribe_old_app
  fi

  if [[ "$DRY_RUN" -eq 0 ]]; then
    run_verify
  else
    log "DRY-RUN: skipped verify step"
  fi

  cat <<EOF

Next manual steps:
  1. Restart frontend: cd frontend && pnpm dev
  2. Bots -> Agente de Pruebas -> WhatsApp -> reconnect with Embedded Signup
  3. Run: $(basename "$0") waba
  4. Send "Hola" from your phone to +57 321 7455642
  5. Open /conversations and confirm the inbound message

Optional Terraform apply (persistent infra state):
  cd infrastructure/environments/dev
  terraform apply \\
    -var="meta_app_id=${NEW_APP_ID}" \\
    -var="meta_app_secret=${NEW_APP_SECRET}" \\
    -var="meta_embedded_signup_config_id=${NEW_EMBEDDED_CONFIG_ID}"
EOF
}

main() {
  parse_args "$@"

  case "$COMMAND" in
    help|-h|--help)
      usage
      ;;
    all)
      run_all
      ;;
    frontend)
      update_frontend_env
      ;;
    lambda)
      update_lambda_env
      ;;
    webhook)
      configure_meta_webhook
      verify_webhook_challenge
      ;;
    waba)
      subscribe_waba
      verify_waba_subscription
      ;;
    verify)
      run_verify
      ;;
    *)
      die "Unknown command: ${COMMAND}"
      ;;
  esac
}

main "$@"
