#!/usr/bin/env bash
# Manage .idea/dataSources.xml for worktree databases
# This script is sourced, not executed directly

set -euo pipefail

# Add a datasource entry to .idea/dataSources.xml
# Arguments:
#   $1 - Path to dataSources.xml file
#   $2 - Worktree name (e.g., "fix-worktree-db")
#   $3 - Database name (e.g., "example_dev_fix_worktree_db")
add_datasource_entry() {
  local datasources_file="$1"
  local worktree_name="$2"
  local db_name="$3"

  # Generate a UUID for the datasource (simple version)
  local uuid
  uuid=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$(( RANDOM % 10000 ))-${worktree_name}")

  # Check if datasources file exists
  if [[ ! -f "$datasources_file" ]]; then
    echo "Warning: dataSources.xml not found at $datasources_file" >&2
    return 0
  fi

  # Check if this datasource already exists
  if grep -q "jdbc:postgresql://localhost:5432/${db_name}" "$datasources_file"; then
    echo "  Datasource for $db_name already exists in dataSources.xml"
    return 0
  fi

  # Create a temporary file
  local temp_file="${datasources_file}.tmp"

  # Read the file line by line and insert the new datasource entry before </component>
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *"</component>"* ]]; then
      # Insert the new datasource entry before the closing tag
      echo "    <!-- Worktree Database (${worktree_name}) -->" >> "$temp_file"
      echo "    <data-source source=\"LOCAL\" name=\"example-dev-${worktree_name}\" uuid=\"${uuid}\">" >> "$temp_file"
      echo "      <driver-ref>postgresql</driver-ref>" >> "$temp_file"
      echo "      <synchronize>true</synchronize>" >> "$temp_file"
      echo "      <jdbc-driver>org.postgresql.Driver</jdbc-driver>" >> "$temp_file"
      echo "      <jdbc-url>jdbc:postgresql://localhost:5432/${db_name}</jdbc-url>" >> "$temp_file"
      echo "      <working-dir>\$ProjectFileDir\$</working-dir>" >> "$temp_file"
      echo "      <user-name>postgres</user-name>" >> "$temp_file"
      echo "      <password>postgres</password>" >> "$temp_file"
      echo "    </data-source>" >> "$temp_file"
      echo "" >> "$temp_file"
    fi
    echo "$line" >> "$temp_file"
  done < "$datasources_file"

  # Replace the original file
  mv "$temp_file" "$datasources_file"

  echo "  ✓ Added datasource entry for $db_name to dataSources.xml"
}

# Copy and update dataSources.xml for worktree
# Arguments:
#   $1 - Source repo root
#   $2 - Destination worktree root
#   $3 - Worktree name
#   $4 - Database name
copy_and_update_datasources() {
  local source_root="$1"
  local dest_root="$2"
  local worktree_name="$3"
  local db_name="$4"

  local source_file="${source_root}/.idea/dataSources.xml"
  local dest_file="${dest_root}/.idea/dataSources.xml"

  # Check if source exists
  if [[ ! -f "$source_file" ]]; then
    echo "  Skipping dataSources.xml (not found in source)"
    return 0
  fi

  # Create .idea directory if needed
  mkdir -p "${dest_root}/.idea"

  # Copy the file
  cp "$source_file" "$dest_file"
  echo "  Copied: .idea/dataSources.xml"

  # Add the worktree datasource entry
  add_datasource_entry "$dest_file" "$worktree_name" "$db_name"
}

# Remove a datasource entry from .idea/dataSources.xml
# Arguments:
#   $1 - Path to dataSources.xml file
#   $2 - Database name (e.g., "example_dev_fix_worktree_db")
remove_datasource_entry() {
  local datasources_file="$1"
  local db_name="$2"

  # Check if datasources file exists
  if [[ ! -f "$datasources_file" ]]; then
    echo "  Note: dataSources.xml not found, skipping cleanup"
    return 0
  fi

  # Check if this datasource exists in the file
  if ! grep -q "jdbc:postgresql://localhost:5432/${db_name}" "$datasources_file"; then
    echo "  Note: Datasource for $db_name not found in dataSources.xml"
    return 0
  fi

  # Create a temporary file
  local temp_file="${datasources_file}.tmp"

  # Use Python to remove the datasource block (more reliable than sed/awk for XML)
  python3 << EOF > "$temp_file"
import re
import sys

with open("$datasources_file", 'r') as f:
    content = f.read()

# Pattern to match the entire data-source block containing our database
# This matches from the comment before <data-source> to </data-source>
pattern = r'    <!-- Worktree Database \([^)]+\) -->\n    <data-source[^>]*>.*?jdbc:postgresql://localhost:5432/${db_name}.*?</data-source>\n\n'

# Remove the block
content = re.sub(pattern, '', content, flags=re.DOTALL)

# Also handle case without the blank line at the end
pattern = r'    <!-- Worktree Database \([^)]+\) -->\n    <data-source[^>]*>.*?jdbc:postgresql://localhost:5432/${db_name}.*?</data-source>\n'
content = re.sub(pattern, '', content, flags=re.DOTALL)

print(content, end='')
EOF

  # If the temp file is not empty and different from original, replace it
  if [[ -s "$temp_file" ]]; then
    # Check if the file actually changed
    if ! diff -q "$datasources_file" "$temp_file" > /dev/null 2>&1; then
      mv "$temp_file" "$datasources_file"
      echo "  ✓ Removed datasource entry for $db_name from dataSources.xml"
    else
      rm -f "$temp_file"
      echo "  Note: No changes needed to dataSources.xml"
    fi
  else
    echo "  Warning: Failed to remove datasource entry (temp file empty)" >&2
    rm -f "$temp_file"
    return 1
  fi
}

# Cleanup dataSources.xml entry for a closed worktree
# Arguments:
#   $1 - Main repo root
#   $2 - Worktree name
cleanup_datasources() {
  local main_repo_root="$1"
  local worktree_name="$2"

  local datasources_file="${main_repo_root}/.idea/dataSources.xml"

  # Check if source exists
  if [[ ! -f "$datasources_file" ]]; then
    echo "  Note: dataSources.xml not found in main repo"
    return 0
  fi

  # Transform to database name
  local db_suffix
  db_suffix=$(echo "$worktree_name" | sed 's/-/_/g')
  local db_name="example_dev_${db_suffix}"

  # Remove the datasource entry
  remove_datasource_entry "$datasources_file" "$db_name"
}
