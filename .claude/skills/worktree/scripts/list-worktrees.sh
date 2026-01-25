#!/usr/bin/env bash
# List all active worktrees

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source library scripts
source "$SCRIPT_DIR/port-allocator.sh"

# Main function
main() {
  local registry_path
  registry_path=$(get_registry_path)

  if [[ ! -f "$registry_path" ]]; then
    echo "No worktrees found (registry not initialized)"
    exit 0
  fi

  local worktrees
  worktrees=$(jq -r '.worktrees' "$registry_path")

  local count
  count=$(echo "$worktrees" | jq 'length')

  if [[ "$count" -eq 0 ]]; then
    echo "No active worktrees"
    exit 0
  fi

  echo "Active worktrees: $count"
  echo ""

  # List each worktree
  echo "$worktrees" | jq -c '.[]' | while IFS= read -r worktree; do
    local name
    name=$(echo "$worktree" | jq -r '.name')
    local branch
    branch=$(echo "$worktree" | jq -r '.branch')
    local path
    path=$(echo "$worktree" | jq -r '.path')
    local created
    created=$(echo "$worktree" | jq -r '.created')
    local apps
    apps=$(echo "$worktree" | jq -c '.apps')

    echo "[$name]"
    echo "  Branch: $branch"
    echo "  Path: $path"
    echo "  Created: $created"
    echo "  Apps:"
    echo "$apps" | jq -r 'to_entries[] | "    \(.key):\n\(.value.ports | to_entries[] | "      \(.key)=\(.value)")"'
    echo ""
  done
}

main "$@"
