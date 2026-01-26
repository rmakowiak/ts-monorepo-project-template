#!/usr/bin/env bash
# File copying and transformation library for worktree management
# This script is sourced, not executed directly

set -euo pipefail

# Get the manifest file path
get_manifest_path() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$script_dir/config/file-manifest.json"
}

# Get port value from JSON
get_port_value() {
  local ports_json="$1"
  local port_var="$2"
  echo "$ports_json" | jq -r ".${port_var}"
}

# Apply transformation to a file
apply_transform() {
  local transform_type="$1"
  local file_path="$2"
  local ports_json="$3"
  local worktree_name="$4"

  case "$transform_type" in
    update_ports)
      # Replace PORT and OTEL_METRICS_PORT in the file
      local port
      port=$(get_port_value "$ports_json" "PORT")
      local otel_port
      otel_port=$(get_port_value "$ports_json" "OTEL_METRICS_PORT")

      # Verify port values are valid
      if [[ -z "$port" ]] || [[ -z "$otel_port" ]]; then
        echo "Error: Failed to extract port values from ports JSON" >&2
        return 1
      fi

      # Use sed to replace port values (macOS compatible)
      # Pattern handles optional leading whitespace
      if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! sed -i '' "s/^[[:space:]]*PORT=.*/PORT=${port}/" "$file_path" 2>&1; then
          echo "Error: Failed to update PORT in $file_path" >&2
          return 1
        fi
        if ! sed -i '' "s/^[[:space:]]*OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path" 2>&1; then
          echo "Error: Failed to update OTEL_METRICS_PORT in $file_path" >&2
          return 1
        fi
      else
        if ! sed -i "s/^[[:space:]]*PORT=.*/PORT=${port}/" "$file_path" 2>&1; then
          echo "Error: Failed to update PORT in $file_path" >&2
          return 1
        fi
        if ! sed -i "s/^[[:space:]]*OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path" 2>&1; then
          echo "Error: Failed to update OTEL_METRICS_PORT in $file_path" >&2
          return 1
        fi
      fi

      # Verify the transformations actually happened (allow optional leading whitespace)
      if ! grep -qE "^[[:space:]]*PORT=${port}$" "$file_path"; then
        echo "Error: PORT transformation verification failed in $file_path" >&2
        echo "Expected PORT=${port}, but it was not found" >&2
        return 1
      fi
      if ! grep -qE "^[[:space:]]*OTEL_METRICS_PORT=${otel_port}$" "$file_path"; then
        echo "Error: OTEL_METRICS_PORT transformation verification failed in $file_path" >&2
        echo "Expected OTEL_METRICS_PORT=${otel_port}, but it was not found" >&2
        return 1
      fi
      ;;

    update_env_vars)
      # Combined transformation: update ports AND database URL
      # First, update ports
      local port
      port=$(get_port_value "$ports_json" "PORT")
      local otel_port
      otel_port=$(get_port_value "$ports_json" "OTEL_METRICS_PORT")

      if [[ -z "$port" ]] || [[ -z "$otel_port" ]]; then
        echo "Error: Failed to extract port values from ports JSON" >&2
        return 1
      fi

      # Update ports
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^[[:space:]]*PORT=.*/PORT=${port}/" "$file_path"
        sed -i '' "s/^[[:space:]]*OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path"
      else
        sed -i "s/^[[:space:]]*PORT=.*/PORT=${port}/" "$file_path"
        sed -i "s/^[[:space:]]*OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path"
      fi

      # Update DATABASE_URL if worktree_name is provided
      if [[ -n "$worktree_name" ]]; then
        local db_suffix
        db_suffix=$(echo "$worktree_name" | sed 's/-/_/g')

        if [[ "$OSTYPE" == "darwin"* ]]; then
          sed -i '' -E "s|(^[[:space:]]*DATABASE_URL=postgresql://[^/]+/)([^?]+)|\1\2_${db_suffix}|" "$file_path"
        else
          sed -i -E "s|(^[[:space:]]*DATABASE_URL=postgresql://[^/]+/)([^?]+)|\1\2_${db_suffix}|" "$file_path"
        fi
      fi
      ;;

    update_base_url)
      # Update baseUrl in JSON file
      local port
      port=$(get_port_value "$ports_json" "PORT")

      if [[ -z "$port" ]]; then
        echo "Error: Failed to extract PORT value for base URL update" >&2
        return 1
      fi

      local base_url="http://localhost:${port}"

      # Validate input file is JSON
      if ! jq empty "$file_path" 2>/dev/null; then
        echo "Error: File is not valid JSON: $file_path" >&2
        return 1
      fi

      # Use jq to update the baseUrl
      local tmp_file="${file_path}.tmp"
      if ! jq ".dev.baseUrl = \"${base_url}\"" "$file_path" > "$tmp_file" 2>&1; then
        echo "Error: Failed to update baseUrl in $file_path" >&2
        rm -f "$tmp_file"
        return 1
      fi

      # Validate output is valid JSON
      if ! jq empty "$tmp_file" 2>/dev/null; then
        echo "Error: Transformation produced invalid JSON for $file_path" >&2
        rm -f "$tmp_file"
        return 1
      fi

      if ! mv "$tmp_file" "$file_path"; then
        echo "Error: Failed to replace file: $file_path" >&2
        return 1
      fi
      ;;

    update_database_url)
      # Transform DATABASE_URL to include worktree name
      # Example: postgresql://.../ example_dev → postgresql://.../ example_dev_feat_branch_name
      if [[ -z "$worktree_name" ]]; then
        echo "Error: worktree_name required for update_database_url transform" >&2
        return 1
      fi

      # Transform worktree name: feat-add-databases → feat_add_databases (replace - with _)
      local db_suffix
      db_suffix=$(echo "$worktree_name" | sed 's/-/_/g')

      # Use sed to transform DATABASE_URL
      # Pattern: postgresql://...@host:port/database_name?schema=...
      # Replace database_name with database_name_worktree_suffix
      if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed (BSD version)
        if ! sed -i '' -E "s|(^[[:space:]]*DATABASE_URL=postgresql://[^/]+/)([^?]+)|\1\2_${db_suffix}|" "$file_path" 2>&1; then
          echo "Error: Failed to update DATABASE_URL in $file_path" >&2
          return 1
        fi
      else
        # Linux sed (GNU version)
        if ! sed -i -E "s|(^[[:space:]]*DATABASE_URL=postgresql://[^/]+/)([^?]+)|\1\2_${db_suffix}|" "$file_path" 2>&1; then
          echo "Error: Failed to update DATABASE_URL in $file_path" >&2
          return 1
        fi
      fi
      ;;

    *)
      echo "Warning: Unknown transform type: $transform_type" >&2
      ;;
  esac
}

# Copy files for an app according to manifest
copy_app_files() {
  local app_name="$1"
  local source_root="$2"
  local dest_root="$3"
  local ports_json="$4"
  local worktree_name="${5:-}"

  local manifest_path
  manifest_path=$(get_manifest_path)

  if [[ ! -f "$manifest_path" ]]; then
    echo "Error: Manifest not found at $manifest_path" >&2
    return 1
  fi

  # Get files for this app from manifest
  local files_json
  files_json=$(jq -c ".apps.\"${app_name}\".files[]" "$manifest_path" 2>/dev/null)

  if [[ -z "$files_json" ]]; then
    echo "No files configured for app: $app_name" >&2
    return 0
  fi

  local copied_count=0
  local skipped_count=0

  # Process each file
  while IFS= read -r file_config; do
    local source
    source=$(echo "$file_config" | jq -r '.source')
    local destination
    destination=$(echo "$file_config" | jq -r '.destination')
    local required
    required=$(echo "$file_config" | jq -r '.required')
    local transform
    transform=$(echo "$file_config" | jq -r '.transform // "none"')
    local description
    description=$(echo "$file_config" | jq -r '.description')

    local source_path="${source_root}/${source}"
    local dest_path="${dest_root}/${destination}"

    # Check if source exists
    if [[ ! -f "$source_path" ]]; then
      if [[ "$required" == "true" ]]; then
        echo "Error: Required file not found: $source_path" >&2
        return 1
      else
        echo "  Skipping optional file: $source (not found)"
        skipped_count=$((skipped_count + 1))
        continue
      fi
    fi

    # Create destination directory if needed
    local dest_dir
    dest_dir=$(dirname "$dest_path")
    mkdir -p "$dest_dir"

    # Copy file
    cp "$source_path" "$dest_path"
    echo "  Copied: $source"

    # Apply transformation if specified
    if [[ "$transform" != "none" && "$transform" != "null" ]]; then
      apply_transform "$transform" "$dest_path" "$ports_json" "$worktree_name"
      echo "    Applied transform: $transform"
    fi

    copied_count=$((copied_count + 1))
  done <<< "$files_json"

  echo "Files processed: $copied_count copied, $skipped_count skipped"
  return 0
}
