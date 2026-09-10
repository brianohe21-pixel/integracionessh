#!/usr/bin/env bash
set -euo pipefail

SHA="${1:?Usage: resolve-lambda-deploy-targets.sh <head-sha> [before-sha]}"
BEFORE="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${MANIFEST:-backend/dist/lambda-manifest.json}"

mapfile -t changed_files < <("$SCRIPT_DIR/changed-files-in-push.sh" "$SHA" "$BEFORE")

deploy_all=false
declare -A targets=()

for file in "${changed_files[@]}"; do
  case "$file" in
    backend/scripts/build.js \
    | backend/package.json \
    | backend/tsconfig.json \
    | package.json \
    | pnpm-lock.yaml \
    | pnpm-workspace.yaml \
    | infrastructure/modules/lambda/* \
    | .github/workflows/backend.yml \
    | .github/scripts/deploy-lambdas.sh \
    | .github/scripts/validate-lambda-manifest.sh \
    | .github/scripts/resolve-lambda-deploy-targets.sh)
      deploy_all=true
      break
      ;;
    backend/src/lib/* | backend/src/test/*)
      deploy_all=true
      break
      ;;
    backend/src/functions/*/*)
      folder="${file#backend/src/functions/}"
      folder="${folder%%/*}"
      targets["${folder//-/_}"]=1
      ;;
  esac
done

if [[ "$deploy_all" == "true" ]]; then
  functions_csv=""
elif ((${#targets[@]} == 0)); then
  functions_csv=""
else
  if [[ -f "$MANIFEST" ]] && command -v jq >/dev/null 2>&1; then
    mapfile -t manifest_funcs < <(jq -r '.functions[]' "$MANIFEST" | sort)
    unknown=()
    for key in "${!targets[@]}"; do
      if ! printf '%s\n' "${manifest_funcs[@]}" | grep -qx "$key"; then
        unknown+=("$key")
      fi
    done
    if ((${#unknown[@]} > 0)); then
      echo "Unknown Lambda function key(s) in changed paths:" >&2
      printf '  - %s\n' "${unknown[@]}" >&2
      exit 1
    fi
  fi
  mapfile -t sorted_targets < <(printf '%s\n' "${!targets[@]}" | sort)
  functions_csv=$(IFS=,; echo "${sorted_targets[*]}")
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "deploy_all=${deploy_all}" >> "$GITHUB_OUTPUT"
  echo "functions=${functions_csv}" >> "$GITHUB_OUTPUT"
fi

if [[ "$deploy_all" == "true" ]]; then
  echo "Lambda deploy targets: all functions"
elif [[ -z "$functions_csv" ]]; then
  echo "Lambda deploy targets: none"
else
  echo "Lambda deploy targets: ${functions_csv}"
fi
