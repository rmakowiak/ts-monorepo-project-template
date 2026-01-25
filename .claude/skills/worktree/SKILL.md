---
name: worktree
version: 1.0.0
description: Manage git worktrees with automatic environment setup
author: Claude Code
commands:
  - name: create
    description: Create a new worktree with port allocation and env setup
    usage: /worktree create <branch-name> [worktree-name]
    script: scripts/create-worktree.sh
  - name: close
    description: Remove a worktree and cleanup registry
    usage: /worktree close <worktree-name> [--force]
    script: scripts/close-worktree.sh
  - name: list
    description: List all active worktrees with their ports
    usage: /worktree list
    script: scripts/list-worktrees.sh
---

# Worktree Management Skill

This skill provides intelligent git worktree management for the monorepo, including automatic port allocation, environment setup, and file copying.

## Overview

Git worktrees allow you to work on multiple branches simultaneously without switching contexts. This skill automates the tedious setup process:

- **Automatic port allocation** - Each worktree gets unique ports to avoid conflicts
- **Environment file copying** - Copies `.env.local`, JWT tokens, and other configs
- **Intelligent file transformation** - Updates ports and URLs automatically
- **Dependency management** - Runs `pnpm install` for clean dependencies
- **Registry tracking** - Keeps track of all worktrees and their ports

## Commands

### `/worktree create <branch-name> [worktree-name]`

Creates a new worktree from the specified branch with automatic environment setup.

**Arguments:**

- `branch-name` (required) - Git branch to checkout in the worktree
- `worktree-name` (optional) - Custom name for the worktree directory. Defaults to sanitized branch name (e.g., `feat/api` → `feat-api`)

**What it does:**

1. Creates git worktree as sibling directory (e.g., `../monorepo-project-template-feat-api`)
2. Allocates unique ports for each service (PORT, OTEL_METRICS_PORT)
3. Copies environment files per manifest (`.env.local`, `http-client.env.json`)
4. Transforms files (updates ports, base URLs)
5. Runs `pnpm install` (does NOT copy node_modules)
6. Updates registry with worktree info

**Examples:**

```bash
# Create worktree from branch with auto-generated name
/worktree create feat/new-api
# Creates: ../monorepo-project-template-feat-new-api/

# Create worktree with custom name
/worktree create feat/new-api my-feature
# Creates: ../monorepo-project-template-my-feature/

# Create worktree from remote branch
/worktree create origin/bugfix/auth-issue
```

**Port allocation:**

- First worktree: PORT=8001, OTEL_METRICS_PORT=9465
- Second worktree: PORT=8002, OTEL_METRICS_PORT=9466
- Continues incrementing...

### `/worktree close <worktree-name> [--force]`

Removes a worktree and cleans up the registry.

**Arguments:**

- `worktree-name` (required) - Name of the worktree to close
- `--force` (optional) - Skip uncommitted changes check

**What it does:**

1. Validates worktree exists in registry
2. Checks for uncommitted changes (unless `--force`)
3. Removes worktree with `git worktree remove`
4. Updates registry (removes entry, frees ports)
5. Runs `git worktree prune`

**Examples:**

```bash
# Close worktree (checks for uncommitted changes)
/worktree close feat-new-api

# Force close even with uncommitted changes
/worktree close feat-new-api --force
```

**Safety features:**

- Warns if uncommitted changes exist
- Prevents closing if untracked files present (unless `--force`)
- Automatically falls back to force removal if standard removal fails

### `/worktree list`

Lists all active worktrees with their configuration.

**What it shows:**

- Worktree name and branch
- Full filesystem path
- Creation timestamp
- Apps and their allocated ports

**Example output:**

```
Active worktrees: 2

[feat-new-api]
  Branch: feat/new-api
  Path: /Users/username/workspace/monorepo-project-template-feat-new-api
  Created: 2026-01-25T15:30:00Z
  Apps:
    example-service:
      PORT=8001
      OTEL_METRICS_PORT=9465

[bugfix-auth]
  Branch: bugfix/auth-issue
  Path: /Users/username/workspace/monorepo-project-template-bugfix-auth
  Created: 2026-01-25T16:45:00Z
  Apps:
    example-service:
      PORT=8002
      OTEL_METRICS_PORT=9466
```

## How It Works

### Port Allocation Strategy

The skill uses a registry-based port allocation system:

1. **Base ports** (reserved for main repo):
   - PORT: 8000
   - OTEL_METRICS_PORT: 9464

2. **Worktree ports** (start at base + 1):
   - First worktree: 8001, 9465
   - Second worktree: 8002, 9466
   - Increments for each new worktree

3. **Collision avoidance**:
   - Checks registry for used ports
   - Validates with `lsof` to detect non-worktree processes
   - Automatically skips to next available port

### File Copying and Transformation

Files are copied based on the manifest at `.claude/skills/worktree/config/file-manifest.json`:

**Currently tracked files:**

- `.env.local` - Local environment variables (ports updated)
- `requests/http-client.env.json` - HTTP client config with JWT tokens (baseUrl updated)

**Transform types:**

- `update_ports` - Replaces PORT and OTEL_METRICS_PORT in .env files
- `update_base_url` - Updates JSON `$.dev.baseUrl` to match new PORT

**Not copied:**

- `node_modules/` - Always skipped, `pnpm install` runs instead
- Build output, cache directories
- IDE configs, git-tracked files

### Registry Structure

The registry (`.claude/skills/worktree/.worktree-registry.json`) tracks all worktrees:

```json
{
  "version": "1.0.0",
  "worktrees": [
    {
      "name": "feat-new-api",
      "branch": "feat/new-api",
      "path": "/Users/username/workspace/monorepo-project-template-feat-new-api",
      "created": "2026-01-25T15:30:00Z",
      "apps": {
        "example-service": {
          "ports": {
            "PORT": 8001,
            "OTEL_METRICS_PORT": 9465
          }
        }
      }
    }
  ]
}
```

**Important:** The registry is git-ignored (local machine state only).

## Common Workflows

### Working on a new feature

```bash
# Create worktree for feature branch
/worktree create feat/my-feature

# Switch to worktree
cd ../monorepo-project-template-feat-my-feature

# Start development server (runs on PORT=8001)
cd apps/example-service
pnpm dev

# Work on feature...

# When done, commit and push
git add .
git commit -m "feat: implement new feature"
git push origin feat/my-feature

# Return to main repo and close worktree
cd /Users/username/workspace/monorepo-project-template
/worktree close feat-my-feature
```

### Running multiple services simultaneously

```bash
# Create two worktrees
/worktree create main main-stable
/worktree create feat/experiment

# Terminal 1: Run stable version on port 8001
cd ../monorepo-project-template-main-stable/apps/example-service
pnpm dev

# Terminal 2: Run experimental version on port 8002
cd ../monorepo-project-template-feat-experiment/apps/example-service
pnpm dev

# Compare behavior:
curl localhost:8001/health  # Stable version
curl localhost:8002/health  # Experimental version
```

### Testing against production-like setup

```bash
# Create worktree for testing
/worktree create feat/new-endpoint test-env

# Configure with production-like data
cd ../monorepo-project-template-test-env/apps/example-service
# Edit .env.local with production-like settings

# Run tests
pnpm test

# When done
cd /Users/username/workspace/monorepo-project-template
/worktree close test-env
```

## Configuration

### Adding New Apps

To track files for a new app, update `.claude/skills/worktree/config/file-manifest.json`:

```json
{
  "version": "1.0.0",
  "apps": {
    "example-service": { ... },
    "new-service": {
      "files": [
        {
          "source": ".env.local",
          "destination": ".env.local",
          "required": false,
          "transform": "update_ports",
          "description": "Local environment configuration"
        }
      ]
    }
  }
}
```

### Adding New Files to Track

When you add important untracked files that should be copied to worktrees:

1. Update the manifest: `.claude/skills/worktree/config/file-manifest.json`
2. Add file entry with appropriate transform
3. Test with a new worktree

**Files to include:**

- Environment configs (`.env.local`, `.env.test.local`)
- Authentication tokens (`requests/http-client.env.json`)
- Credentials (`cookie.txt`, API keys)
- Local test data

**Files to exclude:**

- `node_modules/` (always excluded)
- Build output (`dist/`, `.next/`, etc.)
- IDE configs (`.vscode/`, `.idea/`)
- Git-tracked files (copied automatically)

### Adding New Port Variables

To track additional port types:

1. Edit `.claude/skills/worktree/scripts/port-allocator.sh`
2. Add to `BASE_PORTS` associative array:
   ```bash
   declare -A BASE_PORTS=(
     ["PORT"]=8000
     ["OTEL_METRICS_PORT"]=9464
     ["NEW_PORT"]=9000
   )
   ```
3. Update manifest transforms as needed

### Adding New Transform Types

To add custom file transformations:

1. Edit `.claude/skills/worktree/scripts/file-copier.sh`
2. Add case to `apply_transform()` function:
   ```bash
   case "$transform_type" in
     update_ports) ... ;;
     update_base_url) ... ;;
     my_custom_transform)
       # Your transformation logic
       ;;
   esac
   ```

## Troubleshooting

### "Branch does not exist"

**Problem:** The specified branch isn't found.

**Solutions:**

- Check branch name: `git branch -a`
- Fetch latest: `git fetch`
- Use full name for remote branches: `origin/branch-name`

### "Worktree name already exists"

**Problem:** A worktree with that name is already registered.

**Solutions:**

- List existing: `/worktree list`
- Choose different name: `/worktree create branch custom-name`
- Close old worktree: `/worktree close existing-name`

### "Port already in use"

**Problem:** Allocated port is occupied by another process.

**Solutions:**

- The skill automatically skips to the next port
- If persistent, check: `lsof -Pi :8001 -sTCP:LISTEN`
- Kill blocking process or restart

### "Worktree has uncommitted changes"

**Problem:** Trying to close worktree with uncommitted work.

**Solutions:**

- Commit changes: `cd worktree && git commit -am "Save work"`
- Stash changes: `git stash`
- Force close: `/worktree close name --force` (loses changes!)

### "Required file not found"

**Problem:** A required file in the manifest doesn't exist.

**Solutions:**

- Create the file in main repo first
- Mark as optional in manifest: `"required": false`
- Remove from manifest if not needed

### Worktree out of sync with registry

**Problem:** Registry shows worktree but directory doesn't exist.

**Solutions:**

```bash
# Force close to cleanup registry
/worktree close worktree-name --force

# Or manually prune
git worktree prune

# Edit registry if needed
vim .claude/skills/worktree/.worktree-registry.json
```

### File transformations not applied

**Problem:** Ports or URLs not updated in copied files.

**Solutions:**

- Check manifest transform is correct
- Verify file format matches transform expectations
- Check script permissions: `ls -la .claude/skills/worktree/scripts/`
- Test transform manually on a file

## Limitations

- **Shared infrastructure**: Observability services (Jaeger, Prometheus, Grafana) are shared across all worktrees. Consider using separate Docker Compose instances if full isolation is needed.

- **Disk space**: Each worktree includes full dependencies (`node_modules`). Monitor disk usage when creating many worktrees.

- **Registry sync**: Registry is local to your machine. If you manually delete worktree directories, run `/worktree close name --force` to clean up the registry.

- **Platform-specific**: Uses macOS `sed` syntax (`sed -i ''`). On Linux, use `sed -i` instead (edit `file-copier.sh`).

## Best Practices

1. **Close unused worktrees** - Free up disk space and ports
2. **Use descriptive names** - Makes management easier
3. **Commit before closing** - Avoid losing work
4. **Update manifest** - When adding new important files
5. **List regularly** - Keep track of active worktrees
6. **Test in worktree first** - Before merging risky changes

## See Also

- Git worktrees documentation: `git help worktree`
- Port allocation: `.claude/skills/worktree/scripts/port-allocator.sh`
- File manifest: `.claude/skills/worktree/config/file-manifest.json`
- App development guide: `apps/example-service/CLAUDE.md`
