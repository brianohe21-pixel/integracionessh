#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/linear-graphql.sh"

QA_EMAIL="${QA_EMAIL:-yonavicp@gmail.com}"
PROJECT_NAME="${LINEAR_PROJECT_NAME:-QA Develop}"
PROJECT_DESCRIPTION="${LINEAR_PROJECT_DESCRIPTION:-Cola de verificación de cambios desplegados en develop.}"
TEAM_NAME="${LINEAR_TEAM_NAME:-}"
APPLY_GITHUB_SETTINGS="${APPLY_GITHUB_SETTINGS:-false}"

TEAM_LABELS_QUERY='query($teamId: ID!) { team(id: $teamId) { labels { nodes { id name } } } } }'
LABEL_CREATE_MUTATION='mutation($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { success issueLabel { id name } } } }'
TEAM_PROJECTS_QUERY='query($teamId: ID!) { team(id: $teamId) { projects { nodes { id name } } } } }'
PROJECT_CREATE_MUTATION='mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name url } } } }'
PROJECT_URL_QUERY='query($id: ID!) { project(id: $id) { id name url } }'

for arg in "$@"; do
  case "$arg" in
    --apply-github)
      APPLY_GITHUB_SETTINGS="true"
      ;;
  esac
done

team_variables() {
  jq -nc --arg teamId "$TEAM_ID" '{teamId: $teamId}'
}

echo "Resolving Linear team..."
teams_response="$(linear_graphql 'query { teams { nodes { id name key } } }')"
team_count="$(jq '.data.teams.nodes | length' <<<"$teams_response")"

if [[ "$team_count" -eq 0 ]]; then
  echo "No Linear teams found in workspace." >&2
  exit 1
fi

if [[ -n "$TEAM_NAME" ]]; then
  TEAM_ID="$(jq -r --arg name "$TEAM_NAME" '.data.teams.nodes[] | select(.name == $name or .key == $name) | .id' <<<"$teams_response" | head -n 1)"
  if [[ -z "$TEAM_ID" ]]; then
    echo "Team not found: ${TEAM_NAME}" >&2
    jq -r '.data.teams.nodes[] | "- \(.name) (\(.key))"' <<<"$teams_response" >&2
    exit 1
  fi
else
  TEAM_ID="$(jq -r '.data.teams.nodes[0].id' <<<"$teams_response")"
  TEAM_NAME="$(jq -r '.data.teams.nodes[0].name' <<<"$teams_response")"
fi

echo "Using team: ${TEAM_NAME} (${TEAM_ID})"

echo "Resolving QA assignee (${QA_EMAIL})..."
users_response="$(linear_graphql 'query { users { nodes { id name email active } } }')"
ASSIGNEE_ID="$(jq -r --arg email "$QA_EMAIL" '.data.users.nodes[] | select(.email == $email and .active == true) | .id' <<<"$users_response" | head -n 1)"

if [[ -z "$ASSIGNEE_ID" ]]; then
  echo "WARNING: QA user not found or inactive: ${QA_EMAIL}" >&2
  echo "Invite this user to the Linear workspace and re-run this script to enable auto-assignment." >&2
else
  ASSIGNEE_NAME="$(jq -r --arg id "$ASSIGNEE_ID" '.data.users.nodes[] | select(.id == $id) | .name' <<<"$users_response")"
  echo "Using assignee: ${ASSIGNEE_NAME} (${ASSIGNEE_ID})"
fi

resolve_or_create_label() {
  local label_name="$1"
  local labels_variables create_variables labels_response create_response label_id

  labels_variables="$(team_variables)"
  labels_response="$(linear_graphql "$TEAM_LABELS_QUERY" "$labels_variables")"

  label_id="$(jq -r --arg name "$label_name" '.data.team.labels.nodes[] | select(.name == $name) | .id' <<<"$labels_response" | head -n 1)"

  if [[ -n "$label_id" ]]; then
    echo "Label exists: ${label_name} (${label_id})" >&2
    printf '%s' "$label_id"
    return
  fi

  create_variables="$(jq -nc --arg teamId "$TEAM_ID" --arg name "$label_name" '{input: {teamId: $teamId, name: $name}}')"
  create_response="$(linear_graphql "$LABEL_CREATE_MUTATION" "$create_variables")"

  label_id="$(jq -r '.data.issueLabelCreate.issueLabel.id' <<<"$create_response")"
  if [[ -z "$label_id" || "$label_id" == "null" ]]; then
    echo "Failed to create label: ${label_name}" >&2
    exit 1
  fi

  echo "Label created: ${label_name} (${label_id})" >&2
  printf '%s' "$label_id"
}

QA_LABEL_ID="$(resolve_or_create_label qa)"
NEEDS_TESTING_LABEL_ID="$(resolve_or_create_label needs-testing)"

echo "Resolving project (${PROJECT_NAME})..."
projects_variables="$(team_variables)"
projects_response="$(linear_graphql "$TEAM_PROJECTS_QUERY" "$projects_variables")"

PROJECT_ID="$(jq -r --arg name "$PROJECT_NAME" '.data.team.projects.nodes[] | select(.name == $name) | .id' <<<"$projects_response" | head -n 1)"

if [[ -z "$PROJECT_ID" ]]; then
  create_project_variables="$(jq -nc \
    --arg name "$PROJECT_NAME" \
    --arg description "$PROJECT_DESCRIPTION" \
    --arg teamId "$TEAM_ID" \
    '{input: {name: $name, description: $description, teamIds: [$teamId]}}')"
  create_project_response="$(linear_graphql "$PROJECT_CREATE_MUTATION" "$create_project_variables")"

  PROJECT_ID="$(jq -r '.data.projectCreate.project.id' <<<"$create_project_response")"
  PROJECT_URL="$(jq -r '.data.projectCreate.project.url' <<<"$create_project_response")"
  echo "Project created: ${PROJECT_NAME} (${PROJECT_ID})"
else
  project_variables="$(jq -nc --arg id "$PROJECT_ID" '{id: $id}')"
  PROJECT_URL="$(linear_graphql "$PROJECT_URL_QUERY" "$project_variables" | jq -r '.data.project.url')"
  echo "Project exists: ${PROJECT_NAME} (${PROJECT_ID})"
fi

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "Failed to resolve Linear project ID" >&2
  exit 1
fi

cat <<EOF

Linear QA setup complete.

Project URL: ${PROJECT_URL}

Configure GitHub repository settings with:

gh secret set LINEAR_API_KEY

gh variable set LINEAR_TEAM_ID --body "${TEAM_ID}"
gh variable set LINEAR_PROJECT_ID --body "${PROJECT_ID}"
$(if [[ -n "$ASSIGNEE_ID" ]]; then echo "gh variable set LINEAR_QA_ASSIGNEE_ID --body \"${ASSIGNEE_ID}\""; fi)
gh variable set LINEAR_LABEL_QA_ID --body "${QA_LABEL_ID}"
gh variable set LINEAR_LABEL_NEEDS_TESTING_ID --body "${NEEDS_TESTING_LABEL_ID}"

EOF

if [[ "$APPLY_GITHUB_SETTINGS" == "true" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI is required when using --apply-github" >&2
    exit 1
  fi

  gh variable set LINEAR_TEAM_ID --body "${TEAM_ID}"
  gh variable set LINEAR_PROJECT_ID --body "${PROJECT_ID}"
  if [[ -n "$ASSIGNEE_ID" ]]; then
    gh variable set LINEAR_QA_ASSIGNEE_ID --body "${ASSIGNEE_ID}"
  fi
  gh variable set LINEAR_LABEL_QA_ID --body "${QA_LABEL_ID}"
  gh variable set LINEAR_LABEL_NEEDS_TESTING_ID --body "${NEEDS_TESTING_LABEL_ID}"

  if ! gh secret list | grep -q '^LINEAR_API_KEY'; then
    echo "Set LINEAR_API_KEY manually with: gh secret set LINEAR_API_KEY"
  fi

  echo "GitHub variables configured."
fi
