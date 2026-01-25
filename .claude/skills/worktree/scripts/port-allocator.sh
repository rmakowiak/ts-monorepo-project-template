#!/usr/bin/env bash
# Port allocation library for worktree management
# This script is sourced, not executed directly

set -euo pipefail

# Get base port for a given port variable
get_base_port() {
  local port_var="$1"
  case "$port_var" in
    PORT)
      echo "8000"
      ;;
    OTEL_METRICS_PORT)
      echo "9464"
      ;;
    *)
      echo "ERROR: Unknown port variable: $port_var" >&2
      return 1
      ;;
  esac
}

# Get all port variable names
get_port_variables() {
  echo "PORT"
  echo "OTEL_METRICS_PORT"
}

# Get the registry file path
get_registry_path() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$script_dir/../.worktree-registry.json"
}

# Get all used ports from the registry for a specific port variable
get_used_ports() {
  local port_var="$1"
  local registry_path
  registry_path=$(get_registry_path)

  if [[ ! -f "$registry_path" ]]; then
    echo ""
    return
  fi

  # Extract all ports for the given port variable across all worktrees
  jq -r ".worktrees[].apps[].ports.${port_var} // empty" "$registry_path" 2>/dev/null || echo ""
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

# Find next available port for a given port variable
find_next_port() {
  local port_var="$1"
  local base_port
  base_port=$(get_base_port "$port_var")

  # Get used ports from registry
  local used_ports
  used_ports=$(get_used_ports "$port_var")

  # Start from base_port + 1 (worktrees start at base+1)
  local candidate_port=$((base_port + 1))

  while true; do
    # Check if port is in registry
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

# Allocate all ports for an app
allocate_ports_for_app() {
  local app_name="$1"

  # Allocate each port type
  local allocated_ports=()
  while IFS= read -r port_var; do
    local port
    port=$(find_next_port "$port_var")
    allocated_ports+=("\"$port_var\": $port")
  done < <(get_port_variables)

  # Return JSON object
  local IFS=","
  echo "{${allocated_ports[*]}}"
}
