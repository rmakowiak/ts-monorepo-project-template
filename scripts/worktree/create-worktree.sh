#!/usr/bin/env bash
# Create a new git worktree with automatic environment setup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Source library scripts
source "$SCRIPT_DIR/port-allocator.sh"
source "$SCRIPT_DIR/file-copier.sh"
source "$SCRIPT_DIR/datasource-manager.sh"

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

# Validate or create branch
validate_or_create_branch() {
  local branch="$1"

  # Check if branch exists (local or remote)
  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    echo "Branch '$branch' exists, will use it"
    return 0
  fi

  # Check if it exists as remote branch
  if git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    echo "Branch 'origin/$branch' exists remotely, will use it"
    return 0
  fi

  # Branch doesn't exist, create it from latest origin/main
  echo "Branch '$branch' does not exist, creating from latest origin/main..."

  # Fetch latest main
  echo "  Fetching latest origin/main..."
  if ! git fetch origin main; then
    echo "Error: Failed to fetch origin/main" >&2
    return 1
  fi

  # Create the branch
  echo "  Creating branch '$branch' from origin/main..."
  if ! git branch "$branch" origin/main; then
    echo "Error: Failed to create branch '$branch'" >&2
    return 1
  fi

  echo "✓ Branch '$branch' created successfully"
  return 0
}

# Validate worktree name is available
validate_worktree_name() {
  local name="$1"

  # Check if directory already exists
  local parent_dir
  parent_dir=$(dirname "$REPO_ROOT")
  local repo_name
  repo_name=$(basename "$REPO_ROOT")
  local worktree_path="${parent_dir}/${repo_name}.worktree.${name}"

  if [[ -d "$worktree_path" ]]; then
    echo "Error: Directory already exists: $worktree_path" >&2
    return 1
  fi
}

# Setup databases for worktree (create DB, run migrations, seed)
setup_worktree_databases() {
  local worktree_name="$1"
  local worktree_path="$2"

  # Check if Docker postgres container is running
  if ! docker ps --filter "name=postgres" --format "{{.Names}}" | grep -q "^postgres$"; then
    echo "  Warning: PostgreSQL container not running. Skipping database setup."
    echo "  To start: cd infrastructure && docker-compose up -d postgres"
    return 0
  fi

  # Transform worktree name to database suffix (replace - with _)
  local db_suffix
  db_suffix=$(echo "$worktree_name" | sed 's/-/_/g')

  # Database names
  local dev_db="example_dev_${db_suffix}"

  echo "  Creating database: $dev_db"

  # Create development database
  if docker exec postgres psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "$dev_db"; then
    echo "    Database $dev_db already exists, skipping creation"
  else
    if docker exec postgres psql -U postgres -c "CREATE DATABASE ${dev_db};" >/dev/null 2>&1; then
      echo "    ✓ Created database: $dev_db"
    else
      echo "    Warning: Failed to create database $dev_db" >&2
      return 0
    fi
  fi

  # Run migrations for example-service if it exists
  local service_path="${worktree_path}/apps/example-service"
  if [[ -d "$service_path" ]] && [[ -f "$service_path/prisma/schema.prisma" ]]; then
    echo "  Running Prisma migrations..."

    if (cd "$service_path" && pnpm prisma migrate deploy >/dev/null 2>&1); then
      echo "    ✓ Migrations applied"

      # Run seed
      echo "  Seeding database..."
      if (cd "$service_path" && pnpm prisma:seed >/dev/null 2>&1); then
        echo "    ✓ Database seeded with sample data"
      else
        echo "    Warning: Failed to seed database (non-fatal)" >&2
      fi
    else
      echo "    Warning: Failed to run migrations (non-fatal)" >&2
    fi
  fi
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

  echo "Creating worktree..."
  echo "  Branch: $branch"
  echo "  Name: $worktree_name"
  echo ""

  # Validate inputs
  validate_or_create_branch "$branch" || exit 1
  validate_worktree_name "$worktree_name" || exit 1

  # Calculate paths
  local parent_dir
  parent_dir=$(dirname "$REPO_ROOT")
  local repo_name
  repo_name=$(basename "$REPO_ROOT")
  local worktree_path="${parent_dir}/${repo_name}.worktree.${worktree_name}"

  echo "  Path: $worktree_path"
  echo ""

  # Setup cleanup function for error handling
  cleanup_on_error() {
    local exit_code=$?
    echo "" >&2
    echo "Error occurred (exit code: $exit_code), cleaning up..." >&2

    # Remove git worktree if it was created
    if [[ -n "${worktree_path:-}" ]] && [[ -d "$worktree_path" ]]; then
      echo "Removing worktree: $worktree_path" >&2
      if git -C "$REPO_ROOT" worktree remove "$worktree_path" 2>&1; then
        echo "Cleanup completed successfully" >&2
      else
        echo "Warning: Failed to remove worktree automatically" >&2
        echo "Manual cleanup may be required: git worktree remove \"$worktree_path\"" >&2
      fi
    fi

    exit 1
  }

  # Setup cleanup trap
  trap cleanup_on_error ERR

  # Create git worktree
  echo "Creating git worktree..."
  git -C "$REPO_ROOT" worktree add "$worktree_path" "$branch"
  echo ""

  # Get manifest to find apps
  local manifest_path="$SCRIPT_DIR/config/file-manifest.json"
  local apps
  apps=$(jq -r '.apps | keys[]' "$manifest_path")

  # Allocate ports and copy files for each app
  local allocated_ports_display=""

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
      copy_app_files "$app_name" "$app_source" "$app_dest" "$ports_json" "$worktree_name"
    else
      echo "  Warning: App directory not found: $app_source"
    fi

    # Save for display
    local port otel_port
    port=$(echo "$ports_json" | jq -r '.PORT')
    otel_port=$(echo "$ports_json" | jq -r '.OTEL_METRICS_PORT')
    allocated_ports_display+="  ${app_name}:\n    PORT=${port}\n    OTEL_METRICS_PORT=${otel_port}\n"

    echo ""
  done

  # Install dependencies
  echo "Installing dependencies..."
  if ! (cd "$worktree_path" && pnpm install); then
    echo "" >&2
    echo "Error: Failed to install dependencies with pnpm" >&2
    echo "Worktree was created but dependencies were not installed." >&2
    echo "Cleaning up incomplete worktree..." >&2
    git -C "$REPO_ROOT" worktree remove "$worktree_path" 2>&1 || true
    exit 1
  fi
  echo ""

  # Build the project
  echo "Building project..."
  if ! (cd "$worktree_path" && pnpm run build); then
    echo "" >&2
    echo "Error: Failed to build project with pnpm" >&2
    echo "Worktree was created and dependencies installed, but build failed." >&2
    echo "Cleaning up incomplete worktree..." >&2
    git -C "$REPO_ROOT" worktree remove "$worktree_path" 2>&1 || true
    exit 1
  fi
  echo ""

  # Setup databases for worktree
  echo "Setting up databases..."
  setup_worktree_databases "$worktree_name" "$worktree_path"
  echo ""

  # Update .idea/dataSources.xml if it exists
  echo "Updating IDE datasources..."
  local db_suffix
  db_suffix=$(echo "$worktree_name" | sed 's/-/_/g')
  local dev_db="example_dev_${db_suffix}"
  copy_and_update_datasources "$REPO_ROOT" "$worktree_path" "$worktree_name" "$dev_db"
  echo ""

  # Success message
  echo "✓ Worktree created successfully!"
  echo ""
  echo "Next steps:"
  echo "  cd $worktree_path"
  echo ""
  echo "Allocated ports:"
  printf "$allocated_ports_display"
}

main "$@"
