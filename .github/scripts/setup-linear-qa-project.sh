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

for arg in "$@"; do
  case "$arg" in
    --apply-github)
      APPLY_GITHUB_SETTINGS="true"
      ;;
  esac
done

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
  local labels_response
  labels_response="$(linear_graphql "$(cat <<'EOF'
query($teamId: String!) {
  team(id: $teamId) {
    labels {
      nodes {
        id
        name
      }
    }
  }
}
EOF
)" "$(jq -n --arg teamId "$TEAM_ID" '{teamId: $teamId}')")"

  local label_id
  label_id="$(jq -r --arg name "$label_name" '.data.team.labels.nodes[] | select(.name == $name) | .id' <<<"$labels_response" | head -n 1)"

  if [[ -n "$label_id" ]]; then
    echo "Label exists: ${label_name} (${label_id})" >&2
    printf '%s' "$label_id"
    return
  fi

  local create_response
  create_response="$(linear_graphql "$(cat <<'EOF'
mutation($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) {
    success
    issueLabel {
      id
      name
    }
  }
}
EOF
)" "$(jq -n --arg teamId "$TEAM_ID" --arg name "$label_name" '{input: {teamId: $teamId, name: $name}}')")"

  label_id="$(jq -r '.data.issueLabelCreate.issueLabel.id' <<<"$create_response")"
  echo "Label created: ${label_name} (${label_id})" >&2
  printf '%s' "$label_id"
}

QA_LABEL_ID="$(resolve_or_create_label qa)"
NEEDS_TESTING_LABEL_ID="$(resolve_or_create_label needs-testing)"

echo "Resolving project (${PROJECT_NAME})..."
projects_response="$(linear_graphql "$(cat <<'EOF'
query($teamId: String!) {
  team(id: $teamId) {
    projects {
      nodes {
        id
        name
      }
    }
  }
}
EOF
)" "$(jq -n --arg teamId "$TEAM_ID" '{teamId: $teamId}')")"

PROJECT_ID="$(jq -r --arg name "$PROJECT_NAME" '.data.team.projects.nodes[] | select(.name == $name) | .id' <<<"$projects_response" | head -n 1)"

if [[ -z "$PROJECT_ID" ]]; then
  create_project_response="$(linear_graphql "$(cat <<'EOF'
mutation($input: ProjectCreateInput!) {
  projectCreate(input: $input) {
    success
    project {
      id
      name
      url
    }
  }
}
EOF
)" "$(jq -n \
    --arg name "$PROJECT_NAME" \
    --arg description "$PROJECT_DESCRIPTION" \
    --arg teamId "$TEAM_ID" \
    '{input: {name: $name, description: $description, teamIds: [$teamId]}}')")"

  PROJECT_ID="$(jq -r '.data.projectCreate.project.id' <<<"$create_project_response")"
  PROJECT_URL="$(jq -r '.data.projectCreate.project.url' <<<"$create_project_response")"
  echo "Project created: ${PROJECT_NAME} (${PROJECT_ID})"
else
  PROJECT_URL="$(linear_graphql "$(cat <<'EOF'
query($id: String!) {
  project(id: $id) {
    id
    name
    url
  }
}
EOF
)" "$(jq -n --arg id "$PROJECT_ID" '{id: $id}')" | jq -r '.data.project.url')"
  echo "Project exists: ${PROJECT_NAME} (${PROJECT_ID})"
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
