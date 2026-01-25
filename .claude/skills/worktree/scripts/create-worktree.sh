#!/usr/bin/env bash
# Create a new git worktree with automatic environment setup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source library scripts
source "$SCRIPT_DIR/port-allocator.sh"
source "$SCRIPT_DIR/file-copier.sh"

# Print usage
usage() {
  echo "Usage: $0 <branch-name> [worktree-name]"
  echo ""
  echo "Creates a new git worktree with automatic port allocation and environment setup."
  echo ""
  echo "Arguments:"
  echo "  branch-name     Branch to checkout in the worktree"
  echo "  worktree-name   Optional custom name for the worktree directory"
  echo "                  (defaults to sanitized branch name)"
  exit 1
}

# Sanitize branch name for directory usage
sanitize_name() {
  echo "$1" | sed 's|/|-|g' | sed 's|[^a-zA-Z0-9_-]|-|g'
}

# Validate branch exists
validate_branch() {
  local branch="$1"
  if ! git rev-parse --verify "$branch" >/dev/null 2>&1; then
    echo "Error: Branch '$branch' does not exist" >&2
    return 1
  fi
}

# Validate worktree name is available
validate_worktree_name() {
  local name="$1"
  local registry_path="$2"

  # Check if name exists in registry
  if [[ -f "$registry_path" ]]; then
    local exists
    exists=$(jq -r ".worktrees[] | select(.name == \"$name\") | .name" "$registry_path" 2>/dev/null || echo "")
    if [[ -n "$exists" ]]; then
      echo "Error: Worktree name '$name' already exists in registry" >&2
      return 1
    fi
  fi

  # Check if directory already exists
  local parent_dir
  parent_dir=$(dirname "$REPO_ROOT")
  local repo_name
  repo_name=$(basename "$REPO_ROOT")
  local worktree_path="${parent_dir}/${repo_name}-${name}"

  if [[ -d "$worktree_path" ]]; then
    echo "Error: Directory already exists: $worktree_path" >&2
    return 1
  fi
}

# Update registry with new worktree
update_registry() {
  local registry_path="$1"
  local worktree_entry="$2"

  local tmp_file="${registry_path}.tmp"
  jq ".worktrees += [$worktree_entry]" "$registry_path" > "$tmp_file"
  mv "$tmp_file" "$registry_path"
}

# Main function
main() {
  # Parse arguments
  if [[ $# -lt 1 ]]; then
    usage
  fi

  local branch="$1"
  local worktree_name="${2:-}"

  # Default worktree name from branch
  if [[ -z "$worktree_name" ]]; then
    worktree_name=$(sanitize_name "$branch")
  fi

  local registry_path
  registry_path=$(get_registry_path)

  echo "Creating worktree..."
  echo "  Branch: $branch"
  echo "  Name: $worktree_name"

  # Validate inputs
  validate_branch "$branch" || exit 1
  validate_worktree_name "$worktree_name" "$registry_path" || exit 1

  # Calculate paths
  local parent_dir
  parent_dir=$(dirname "$REPO_ROOT")
  local repo_name
  repo_name=$(basename "$REPO_ROOT")
  local worktree_path="${parent_dir}/${repo_name}-${worktree_name}"

  echo "  Path: $worktree_path"
  echo ""

  # Setup cleanup trap
  trap 'echo "Error occurred, cleaning up..."; git worktree remove "$worktree_path" 2>/dev/null || true; exit 1' ERR

  # Create git worktree
  echo "Creating git worktree..."
  git -C "$REPO_ROOT" worktree add "$worktree_path" "$branch"
  echo ""

  # Get manifest to find apps
  local manifest_path="$SCRIPT_DIR/../config/file-manifest.json"
  local apps
  apps=$(jq -r '.apps | keys[]' "$manifest_path")

  # Allocate ports and copy files for each app
  local worktree_apps=()

  for app_name in $apps; do
    echo "Setting up app: $app_name"

    # Allocate ports
    local ports_json
    ports_json=$(allocate_ports_for_app "$app_name")
    echo "  Allocated ports: $ports_json"

    # Copy and transform files
    local app_source="${REPO_ROOT}/apps/${app_name}"
    local app_dest="${worktree_path}/apps/${app_name}"

    if [[ -d "$app_source" ]]; then
      copy_app_files "$app_name" "$app_source" "$app_dest" "$ports_json"
    else
      echo "  Warning: App directory not found: $app_source"
    fi

    # Build app entry for registry
    local app_entry
    app_entry=$(jq -n \
      --argjson ports "$ports_json" \
      '{ports: $ports}')

    worktree_apps+=("\"$app_name\": $app_entry")

    echo ""
  done

  # Install dependencies
  echo "Installing dependencies..."
  (cd "$worktree_path" && pnpm install)
  echo ""

  # Build registry entry
  local apps_json="{$(IFS=,; echo "${worktree_apps[*]}")}"
  local worktree_entry
  worktree_entry=$(jq -n \
    --arg name "$worktree_name" \
    --arg branch "$branch" \
    --arg path "$worktree_path" \
    --arg created "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --argjson apps "$apps_json" \
    '{name: $name, branch: $branch, path: $path, created: $created, apps: $apps}')

  # Update registry
  update_registry "$registry_path" "$worktree_entry"

  # Success message
  echo "✓ Worktree created successfully!"
  echo ""
  echo "Next steps:"
  echo "  cd $worktree_path"
  echo ""
  echo "Allocated ports:"
  echo "$apps_json" | jq -r 'to_entries[] | "  \(.key): \(.value.ports | to_entries[] | "\(.key)=\(.value)") | @text"' | sed 's/|/@/g' | while IFS=@ read -r app ports; do
    echo "  $app"
    echo "    $ports" | tr ' ' '\n' | sed 's/^/    /'
  done
}

main "$@"
