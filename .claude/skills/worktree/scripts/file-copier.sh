#!/usr/bin/env bash
# File copying and transformation library for worktree management
# This script is sourced, not executed directly

set -euo pipefail

# Get the manifest file path
get_manifest_path() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$script_dir/../config/file-manifest.json"
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

  case "$transform_type" in
    update_ports)
      # Replace PORT and OTEL_METRICS_PORT in the file
      local port
      port=$(get_port_value "$ports_json" "PORT")
      local otel_port
      otel_port=$(get_port_value "$ports_json" "OTEL_METRICS_PORT")

      # Use sed to replace port values (macOS compatible)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^PORT=.*/PORT=${port}/" "$file_path" 2>/dev/null || true
        sed -i '' "s/^OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path" 2>/dev/null || true
      else
        sed -i "s/^PORT=.*/PORT=${port}/" "$file_path" 2>/dev/null || true
        sed -i "s/^OTEL_METRICS_PORT=.*/OTEL_METRICS_PORT=${otel_port}/" "$file_path" 2>/dev/null || true
      fi
      ;;

    update_base_url)
      # Update baseUrl in JSON file
      local port
      port=$(get_port_value "$ports_json" "PORT")
      local base_url="http://localhost:${port}"

      # Use jq to update the baseUrl
      local tmp_file="${file_path}.tmp"
      jq ".dev.baseUrl = \"${base_url}\"" "$file_path" > "$tmp_file"
      mv "$tmp_file" "$file_path"
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
      apply_transform "$transform" "$dest_path" "$ports_json"
      echo "    Applied transform: $transform"
    fi

    copied_count=$((copied_count + 1))
  done <<< "$files_json"

  echo "Files processed: $copied_count copied, $skipped_count skipped"
  return 0
}
