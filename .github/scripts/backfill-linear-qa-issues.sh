#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY is required" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/linear-graphql.sh"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/linear-qa-content.sh"

required_vars=(LINEAR_TEAM_ID LINEAR_PROJECT_ID)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "${var_name} is required" >&2
    exit 1
  fi
done

BASE_REF="${BASE_REF:-origin/main}"
TARGET_REF="${TARGET_REF:-origin/develop}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-$(git remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/](.+)(\.git)?#\1#')}"
DEVELOP_FRONTEND_URL="${DEVELOP_FRONTEND_URL:-https://develop.d5sepmwbbwly9.amplifyapp.com}"

SEARCH_ISSUES_QUERY='query($term: String!) { searchIssues(term: $term, first: 5) { nodes { id url description } } }'
ISSUE_CREATE_MUTATION='mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title } } }'
ISSUE_UPDATE_MUTATION='mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id url title } } }'

find_existing_issue() {
  local marker_url="$1"
  local sha_short="${marker_url##*/}"
  sha_short="${sha_short:0:7}"
  local search_response issue_line

  for term in "$marker_url" "$sha_short"; do
    search_response="$(linear_graphql "$SEARCH_ISSUES_QUERY" "$(jq -nc --arg term "$term" '{term: $term}')")"
    issue_line="$(jq -r --arg url "$marker_url" --arg sha "$sha_short" '
      .data.searchIssues.nodes[]
      | select(.description != null and ((.description | contains($url)) or (.description | contains($sha))))
      | .id + "|" + .url
    ' <<<"$search_response" | head -n 1)"
    if [[ -n "$issue_line" ]]; then
      printf '%s' "$issue_line"
      return
    fi
  done
}

create_or_update_issue() {
  local title="$1"
  local description="$2"
  local marker_url="$3"
  local existing issue_id issue_url label_ids=()

  existing="$(find_existing_issue "$marker_url" || true)"
  if [[ -n "$existing" ]]; then
    issue_id="${existing%%|*}"
    issue_url="${existing#*|}"
    linear_graphql "$ISSUE_UPDATE_MUTATION" "$(jq -n \
      --arg id "$issue_id" \
      --arg title "$title" \
      --arg description "$description" \
      '{id: $id, input: {title: $title, description: $description}}')" >/dev/null
    echo "UPDATED: ${title} -> ${issue_url}"
    return
  fi

  if [[ -n "${LINEAR_LABEL_QA_ID:-}" ]]; then
    label_ids+=("$LINEAR_LABEL_QA_ID")
  fi
  if [[ -n "${LINEAR_LABEL_NEEDS_TESTING_ID:-}" ]]; then
    label_ids+=("$LINEAR_LABEL_NEEDS_TESTING_ID")
  fi

  issue_url="$(linear_graphql "$ISSUE_CREATE_MUTATION" "$(jq -n \
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
    }')" | jq -r '.data.issueCreate.issue.url')"

  echo "CREATED: ${title} -> ${issue_url}"
}

while IFS='|' read -r sha subject author; do
  commit_url="https://github.com/${GITHUB_REPOSITORY}/commit/${sha}"
  files="$(git diff-tree --no-commit-id --name-only -r "$sha" | sed 's/^/- /' | head -40)"
  if [[ -z "$files" ]]; then
    files="_Sin archivos listados._"
  fi

  context_block="- **Commit:** [\`${sha:0:7}\` ${subject}](${commit_url})
- **Autor:** ${author}
- **Rama:** develop"

  title="$(spanish_qa_title "$subject")"
  description="$(build_qa_issue_description "$context_block" "$files" "$DEVELOP_FRONTEND_URL")"
  create_or_update_issue "$title" "$description" "$commit_url"
done < <(git log "${BASE_REF}..${TARGET_REF}" --reverse --format='%H|%s|%an')
