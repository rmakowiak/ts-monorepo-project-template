#!/usr/bin/env bash
# Close and cleanup a git worktree

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source library scripts
source "$SCRIPT_DIR/port-allocator.sh"

# Print usage
usage() {
  echo "Usage: $0 <worktree-name> [--force]"
  echo ""
  echo "Removes a git worktree and cleans up the registry."
  echo ""
  echo "Arguments:"
  echo "  worktree-name   Name of the worktree to close"
  echo "  --force         Skip uncommitted changes check"
  exit 1
}

# Get worktree info from registry
get_worktree_info() {
  local name="$1"
  local registry_path="$2"

  if [[ ! -f "$registry_path" ]]; then
    echo "Error: Registry not found at $registry_path" >&2
    return 1
  fi

  local info
  info=$(jq -c ".worktrees[] | select(.name == \"$name\")" "$registry_path")

  if [[ -z "$info" ]]; then
    echo "Error: Worktree '$name' not found in registry" >&2
    return 1
  fi

  echo "$info"
}

# Check for uncommitted changes
check_uncommitted_changes() {
  local worktree_path="$1"
  local force="$2"

  if [[ "$force" == "true" ]]; then
    return 0
  fi

  if [[ ! -d "$worktree_path" ]]; then
    return 0
  fi

  # Check git status
  if ! git -C "$worktree_path" diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Error: Worktree has uncommitted changes" >&2
    echo "Commit or stash your changes, or use --force to ignore" >&2
    return 1
  fi

  # Check for untracked files
  local untracked
  untracked=$(git -C "$worktree_path" ls-files --others --exclude-standard)
  if [[ -n "$untracked" ]]; then
    echo "Warning: Worktree has untracked files" >&2
    echo "Use --force to proceed anyway" >&2
    return 1
  fi

  return 0
}

# Remove worktree from registry
remove_from_registry() {
  local name="$1"
  local registry_path="$2"

  local tmp_file="${registry_path}.tmp"
  jq "del(.worktrees[] | select(.name == \"$name\"))" "$registry_path" > "$tmp_file"
  mv "$tmp_file" "$registry_path"
}

# Main function
main() {
  # Parse arguments
  if [[ $# -lt 1 ]]; then
    usage
  fi

  local worktree_name="$1"
  local force="false"

  if [[ "${2:-}" == "--force" ]]; then
    force="true"
  fi

  local registry_path
  registry_path=$(get_registry_path)

  echo "Closing worktree: $worktree_name"
  echo ""

  # Get worktree info
  local worktree_info
  worktree_info=$(get_worktree_info "$worktree_name" "$registry_path") || exit 1

  local worktree_path
  worktree_path=$(echo "$worktree_info" | jq -r '.path')

  echo "  Path: $worktree_path"

  # Check for uncommitted changes
  if [[ -d "$worktree_path" ]]; then
    check_uncommitted_changes "$worktree_path" "$force" || exit 1
  fi

  # Get ports before removal (for display)
  local freed_ports
  freed_ports=$(echo "$worktree_info" | jq -c '.apps')

  # Remove worktree
  echo ""
  echo "Removing worktree..."
  if [[ -d "$worktree_path" ]]; then
    git -C "$REPO_ROOT" worktree remove "$worktree_path" 2>/dev/null || {
      # If remove fails, try with force
      echo "  Standard removal failed, forcing..."
      git -C "$REPO_ROOT" worktree remove --force "$worktree_path"
    }
  else
    echo "  Worktree directory not found, cleaning up registry only"
  fi

  # Remove from registry
  remove_from_registry "$worktree_name" "$registry_path"

  # Prune worktrees
  git -C "$REPO_ROOT" worktree prune

  # Success message
  echo ""
  echo "✓ Worktree closed successfully!"
  echo ""
  echo "Freed ports:"
  echo "$freed_ports" | jq -r 'to_entries[] | "  \(.key):\n\(.value.ports | to_entries[] | "    \(.key)=\(.value)")"'
}

main "$@"
