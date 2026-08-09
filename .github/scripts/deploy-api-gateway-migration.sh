#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-dev}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_STATE_BACKUP="${SKIP_STATE_BACKUP:-false}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export ENVIRONMENT

echo "Starting API Gateway migration workflow for ${ENVIRONMENT}"

bash "${SCRIPT_DIR}/validate-api-gateway-integrations.sh"
bash "${SCRIPT_DIR}/preflight-api-gateway-migration.sh"

MIGRATE_ARGS=()
if [[ "$DRY_RUN" == "true" ]]; then
  MIGRATE_ARGS+=(--dry-run)
fi
if [[ "$SKIP_STATE_BACKUP" == "true" ]]; then
  MIGRATE_ARGS+=(--no-backup)
fi

python3 "${SCRIPT_DIR}/../../infrastructure/scripts/migrate-api-gateway-integration-state.py" "${MIGRATE_ARGS[@]}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run migration completed for ${ENVIRONMENT}."
  exit 0
fi

bash "${SCRIPT_DIR}/preflight-api-gateway-migration.sh"
echo "API Gateway migration workflow completed for ${ENVIRONMENT}."
