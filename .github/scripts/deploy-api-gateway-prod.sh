#!/usr/bin/env bash
set -euo pipefail

export ENVIRONMENT=prod
export DRY_RUN="${DRY_RUN:-false}"
export SKIP_STATE_BACKUP="${SKIP_STATE_BACKUP:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/deploy-api-gateway-migration.sh"
