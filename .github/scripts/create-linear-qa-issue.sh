#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY secret is not configured. Run .github/scripts/setup-linear-qa-project.sh first." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/linear-graphql.sh"

required_vars=(
  LINEAR_TEAM_ID
  LINEAR_PROJECT_ID
  PR_NUMBER
  PR_TITLE
  PR_URL
  PR_AUTHOR
  GITHUB_REPOSITORY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required" >&2
    exit 1
  fi
done

DEVELOP_FRONTEND_URL="${DEVELOP_FRONTEND_URL:-https://develop.d5sepmwbbwly9.amplifyapp.com}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
MAX_CHANGED_FILES="${MAX_CHANGED_FILES:-40}"
MARKER="<!-- linear-qa-issue -->"

fetch_changed_files() {
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "_No se pudo obtener la lista de archivos (GITHUB_TOKEN ausente)._"
    return
  fi

  local files_json
  files_json="$(curl -sS \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/files?per_page=100")"

  local files
  files="$(jq -r '.[].filename' <<<"$files_json" | head -n "$MAX_CHANGED_FILES")"

  if [[ -z "$files" ]]; then
    echo "_Sin archivos listados en el PR._"
    return
  fi

  local total_count
  total_count="$(jq 'length' <<<"$files_json")"
  local shown_count
  shown_count="$(printf '%s\n' "$files" | sed '/^$/d' | wc -l | tr -d ' ')"

  {
    printf '%s\n' "$files" | sed 's/^/- /'
    if (( total_count > MAX_CHANGED_FILES )); then
      echo ""
      echo "_Mostrando ${shown_count} de ${total_count} archivos._"
    fi
  }
}

SEARCH_ISSUES_QUERY='query($term: String!) { searchIssues(term: $term, first: 10) { nodes { id identifier url description } } }'
ISSUE_CREATE_MUTATION='mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title } } }'

find_existing_issue() {
  local search_variables search_response
  search_variables="$(jq -nc --arg term "$PR_URL" '{term: $term}')"
  search_response="$(linear_graphql "$SEARCH_ISSUES_QUERY" "$search_variables")"

  jq -r --arg pr_url "$PR_URL" '
    .data.searchIssues.nodes[]
    | select(.description != null and (.description | contains($pr_url)))
    | .url
  ' <<<"$search_response" | head -n 1
}

build_issue_description() {
  local changed_files="$1"
  local merge_sha="${PR_MERGE_SHA:-}"

  cat <<EOF
## Contexto

- **PR:** [#${PR_NUMBER} ${PR_TITLE}](${PR_URL})
- **Autor:** @${PR_AUTHOR}
- **Rama base:** develop
- **Commit de merge:** \`${merge_sha:-desconocido}\`

## Entorno de prueba

- **Ambiente:** develop
- **Frontend:** ${DEVELOP_FRONTEND_URL}

> Espera a que terminen los workflows de deploy (Backend y Frontend) antes de iniciar las pruebas.

## Archivos cambiados

${changed_files}

## Checklist QA

- [ ] Validar el flujo principal del cambio
- [ ] Revisar regresiones en el área afectada
- [ ] Confirmar comportamiento en develop
- [ ] Marcar como Done o reportar bug con evidencia
EOF
}

create_issue() {
  local title="$1"
  local description="$2"
  local label_ids=()

  if [[ -n "${LINEAR_LABEL_QA_ID:-}" ]]; then
    label_ids+=("$LINEAR_LABEL_QA_ID")
  fi
  if [[ -n "${LINEAR_LABEL_NEEDS_TESTING_ID:-}" ]]; then
    label_ids+=("$LINEAR_LABEL_NEEDS_TESTING_ID")
  fi

  local variables
  variables="$(jq -n \
    --arg teamId "$LINEAR_TEAM_ID" \
    --arg projectId "$LINEAR_PROJECT_ID" \
    --arg assigneeId "${LINEAR_QA_ASSIGNEE_ID:-}" \
    --arg title "$title" \
    --arg description "$description" \
    --argjson labelIds "$(if ((${#label_ids[@]} > 0)); then printf '%s\n' "${label_ids[@]}" | jq -R . | jq -s .; else echo '[]'; fi)" \
    '{
      input: (
        {
          teamId: $teamId,
          projectId: $projectId,
          title: $title,
          description: $description,
          labelIds: $labelIds
        }
        + (if $assigneeId != "" then {assigneeId: $assigneeId} else {} end)
      )
    }')"

  local create_response
  create_response="$(linear_graphql "$ISSUE_CREATE_MUTATION" "$variables")"

  jq -r '.data.issueCreate.issue.url' <<<"$create_response"
}

comment_on_pr() {
  local issue_url="$1"

  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "Skipping PR comment because GITHUB_TOKEN is not set."
    return
  fi

  local body
  body="${MARKER}
Issue de QA creado en Linear: ${issue_url}"

  local comments_json
  comments_json="$(curl -sS \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments")"

  local existing_comment_id
  existing_comment_id="$(jq -r --arg marker "$MARKER" '
    .[]
    | select(.body != null and (.body | contains($marker)))
    | .id
  ' <<<"$comments_json" | head -n 1)"

  if [[ -n "$existing_comment_id" && "$existing_comment_id" != "null" ]]; then
    curl -sS -X PATCH \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/comments/${existing_comment_id}" \
      --data "$(jq -n --arg body "$body" '{body: $body}')" >/dev/null
    echo "Updated PR comment #${existing_comment_id}"
    return
  fi

  curl -sS -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
    --data "$(jq -n --arg body "$body" '{body: $body}')" >/dev/null

  echo "Created PR comment on #${PR_NUMBER}"
}

existing_issue_url="$(find_existing_issue || true)"
if [[ -n "$existing_issue_url" ]]; then
  echo "Linear issue already exists for PR: ${existing_issue_url}"
  comment_on_pr "$existing_issue_url"
  exit 0
fi

changed_files="$(fetch_changed_files)"
issue_title="QA: ${PR_TITLE}"
issue_description="$(build_issue_description "$changed_files")"
issue_url="$(create_issue "$issue_title" "$issue_description")"

echo "Created Linear issue: ${issue_url}"
comment_on_pr "$issue_url"
