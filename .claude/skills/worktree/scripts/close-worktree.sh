#!/usr/bin/env bash
# Close and cleanup a git worktree

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print usage
usage() {
  echo "Usage: $0 [worktree-name-or-path] [--force]"
  echo ""
  echo "Removes a git worktree. If no worktree specified, closes the current one."
  echo ""
  echo "Arguments:"
  echo "  worktree-name-or-path   Optional: Name or path of worktree to close"
  echo "                          If not provided, closes current worktree"
  echo "  --force                 Skip uncommitted changes check"
  exit 1
}

# Get git repo root
get_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || echo ""
}

# Get current worktree path (if we're in a worktree)
get_current_worktree_path() {
  local current_dir
  current_dir=$(pwd)

  local repo_root
  repo_root=$(get_repo_root)

  if [[ -z "$repo_root" ]]; then
    echo ""
    return 0
  fi

  # Get all worktree paths
  local main_worktree
  main_worktree=$(git -C "$repo_root" worktree list --porcelain | head -n 1 | cut -d' ' -f2)

  # Check if we're not in the main worktree
  if [[ "$repo_root" != "$main_worktree" ]]; then
    echo "$repo_root"
  else
    echo ""
  fi
}

# Find worktree path by name or use provided path
find_worktree_path() {
  local identifier="$1"

  # If it's already a path that exists, use it
  if [[ -d "$identifier" ]]; then
    echo "$identifier"
    return 0
  fi

  # Otherwise, try to find by name
  local repo_root
  repo_root=$(get_repo_root)

  if [[ -z "$repo_root" ]]; then
    echo "Error: Not in a git repository" >&2
    return 1
  fi

  local parent_dir
  parent_dir=$(dirname "$repo_root")
  local repo_name
  repo_name=$(basename "$(git -C "$repo_root" worktree list --porcelain | head -n 1 | cut -d' ' -f2)")

  local worktree_path="${parent_dir}/${repo_name}.worktree.${identifier}"

  if [[ -d "$worktree_path" ]]; then
    echo "$worktree_path"
    return 0
  fi

  echo "Error: Worktree not found: $identifier" >&2
  return 1
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


# Main function
main() {
  local worktree_identifier=""
  local force="false"

  # Parse arguments
  for arg in "$@"; do
    if [[ "$arg" == "--force" ]]; then
      force="true"
    elif [[ -z "$worktree_identifier" ]]; then
      worktree_identifier="$arg"
    fi
  done

  # If no worktree specified, try to close current worktree
  if [[ -z "$worktree_identifier" ]]; then
    worktree_identifier=$(get_current_worktree_path)
    if [[ -z "$worktree_identifier" ]]; then
      echo "Error: Not in a worktree and no worktree specified" >&2
      echo "Usage: $0 [worktree-name-or-path] [--force]" >&2
      exit 1
    fi
    echo "Closing current worktree..."
  else
    echo "Closing worktree: $worktree_identifier"
  fi
  echo ""

  # Find worktree path
  local worktree_path
  worktree_path=$(find_worktree_path "$worktree_identifier") || exit 1

  echo "  Path: $worktree_path"

  # Get repo root for git commands
  local repo_root
  repo_root=$(git -C "$worktree_path" rev-parse --show-toplevel 2>/dev/null)

  # Get main worktree root
  local main_repo_root
  main_repo_root=$(git -C "$repo_root" worktree list --porcelain | head -n 1 | cut -d' ' -f2)

  # Read allocated ports before removal (for display)
  local port otel_port
  local env_file="${worktree_path}/apps/example-service/.env.local"
  if [[ -f "$env_file" ]]; then
    port=$(grep "^PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '\r\n ')
    otel_port=$(grep "^OTEL_METRICS_PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '\r\n ')
  fi

  # Check for uncommitted changes
  if [[ -d "$worktree_path" ]]; then
    check_uncommitted_changes "$worktree_path" "$force" || exit 1
  fi

  # Remove worktree
  echo ""
  echo "Removing worktree..."
  if [[ -d "$worktree_path" ]]; then
    git -C "$main_repo_root" worktree remove "$worktree_path" 2>/dev/null || {
      # If remove fails, try with force
      echo "  Standard removal failed, forcing..."
      git -C "$main_repo_root" worktree remove --force "$worktree_path"
    }
  else
    echo "  Worktree directory not found"
  fi

  # Prune worktrees
  git -C "$main_repo_root" worktree prune

  # Success message
  echo ""
  echo "✓ Worktree closed successfully!"

  if [[ -n "${port:-}" ]]; then
    echo ""
    echo "Freed ports:"
    echo "  example-service:"
    echo "    PORT=${port}"
    [[ -n "${otel_port:-}" ]] && echo "    OTEL_METRICS_PORT=${otel_port}"
  fi
}

main "$@"
