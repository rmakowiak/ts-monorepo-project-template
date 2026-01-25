#!/usr/bin/env bash
# Port allocation library for worktree management
# This script is sourced, not executed directly

set -euo pipefail

# Base ports
BASE_PORT=8000
OTEL_PORT=9464  # Shared across all worktrees

# Get repo root
get_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || echo ""
}

# Get all used ports by reading .env.local files from all worktrees
get_used_ports() {
  local repo_root
  repo_root=$(get_repo_root)

  if [[ -z "$repo_root" ]]; then
    echo ""
    return 0
  fi

  local used_ports=()

  # Add base port (main repo)
  used_ports+=("$BASE_PORT")

  # Get all worktree paths
  local worktree_paths
  worktree_paths=$(git -C "$repo_root" worktree list --porcelain | grep "^worktree " | cut -d' ' -f2)

  # Read PORT from each worktree's .env.local
  while IFS= read -r worktree_path; do
    [[ -z "$worktree_path" ]] && continue
    [[ "$worktree_path" == "$repo_root" ]] && continue  # Skip main repo

    local env_file="${worktree_path}/apps/example-service/.env.local"
    if [[ -f "$env_file" ]]; then
      local port
      port=$(grep "^PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '\r\n ')
      if [[ -n "$port" ]]; then
        used_ports+=("$port")
      fi
    fi
  done <<< "$worktree_paths"

  # Return unique sorted ports
  printf '%s\n' "${used_ports[@]}" | sort -n | uniq
}

# Check if a port is available on the system
is_port_available() {
  local port="$1"

  # Check if port is in use using lsof
  if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 1  # Port in use
  fi

  return 0  # Port available
}

# Find next available port
find_next_port() {
  local used_ports
  used_ports=$(get_used_ports)

  # Start from base_port + 1 (worktrees start at base+1)
  local candidate_port=$((BASE_PORT + 1))

  while true; do
    # Check if port is used by any worktree
    if echo "$used_ports" | grep -q "^${candidate_port}$"; then
      candidate_port=$((candidate_port + 1))
      continue
    fi

    # Double-check port is actually available on system
    if is_port_available "$candidate_port"; then
      echo "$candidate_port"
      return 0
    fi

    # Port in use by non-worktree process, try next
    candidate_port=$((candidate_port + 1))
  done
}

# Allocate ports for an app
allocate_ports_for_app() {
  local app_name="$1"

  local port
  port=$(find_next_port)

  # Return JSON object with PORT and OTEL_METRICS_PORT
  echo "{\"PORT\": $port, \"OTEL_METRICS_PORT\": $OTEL_PORT}"
}
