---
name: worktree
version: 2.0.0
description: Manage git worktrees with automatic environment setup
author: Claude Code
commands:
  - name: create
    description: Create a new worktree with port allocation and env setup
    usage: /worktree create <branch-name> [worktree-name]
    script: scripts/create-worktree.sh
  - name: close
    description: Remove a worktree (closes current if not specified)
    usage: /worktree close [worktree-name] [--force]
    script: scripts/close-worktree.sh
---

# Worktree Management Skill

This skill provides intelligent git worktree management for the monorepo, including automatic port allocation, environment setup, and file copying.

## Overview

Git worktrees allow you to work on multiple branches simultaneously without switching contexts. This skill automates the tedious setup process:

- **Automatic port allocation** - Each worktree gets unique ports by scanning existing worktrees
- **Environment file copying** - Copies `.env.local`, JWT tokens, and other configs
- **Intelligent file transformation** - Updates ports and URLs automatically
- **Dependency management** - Runs `pnpm install` for clean dependencies
- **No registry needed** - Uses `git worktree list` and reads actual `.env.local` files

## Commands

### `/worktree create <branch-name> [worktree-name]`

Creates a new worktree from the specified branch with automatic environment setup.

**Arguments:**

- `branch-name` (required) - Git branch to checkout in the worktree
- `worktree-name` (optional) - Custom name for the worktree directory. Defaults to sanitized branch name (e.g., `feat/api` → `feat-api`)

**What it does:**

1. Creates git worktree as sibling directory (e.g., `../monorepo-project-template.worktree.feat-new-api`)
2. Allocates unique PORT by scanning existing worktrees (OTEL_METRICS_PORT shared at 9464)
3. Copies environment files per manifest (`.env.local`, `http-client.env.json`)
4. Transforms files (updates ports, base URLs)
5. Runs `pnpm install` (does NOT copy node_modules)
6. Runs `pnpm run build` to build the project

**Examples:**

```bash
# Create worktree from branch with auto-generated name
/worktree create feat/new-api
# Creates: ../monorepo-project-template.worktree.feat-new-api/

# Create worktree with custom name
/worktree create feat/new-api my-feature
# Creates: ../monorepo-project-template.worktree.my-feature/

# Create worktree from remote branch
/worktree create origin/bugfix/auth-issue
# Creates: ../monorepo-project-template.worktree.bugfix-auth-issue/
```

**Port allocation:**

- Main repo: PORT=8000, OTEL_METRICS_PORT=9464
- First worktree: PORT=8001, OTEL_METRICS_PORT=9464 (shared)
- Second worktree: PORT=8002, OTEL_METRICS_PORT=9464 (shared)
- Continues incrementing...

### `/worktree close [worktree-name] [--force]`

Removes a worktree. If no worktree specified, closes the current one.

**Arguments:**

- `worktree-name` (optional) - Name of the worktree to close. If not provided, closes the current worktree (when run from within a worktree).
- `--force` (optional) - Skip uncommitted changes check

**What it does:**

1. Detects current worktree (if no name provided)
2. Checks for uncommitted changes (unless `--force`)
3. Removes worktree with `git worktree remove`
4. Runs `git worktree prune`

**Examples:**

```bash
# Close a specific worktree by name
/worktree close feat-new-api

# Close the current worktree (run from within a worktree)
cd ../monorepo-project-template.worktree.feat-new-api
/worktree close

# Force close even with uncommitted changes
/worktree close feat-new-api --force
```

**Safety features:**

- Warns if uncommitted changes exist
- Prevents closing if untracked files present (unless `--force`)
- Automatically falls back to force removal if standard removal fails

### Listing Worktrees

Use git's built-in command to list all worktrees:

```bash
git worktree list
```

**Example output:**

```
/Users/username/workspace/monorepo-project-template         6879c51 [main]
/Users/username/workspace/monorepo-project-template.worktree.feat-new-api  1234abc [feat/new-api]
/Users/username/workspace/monorepo-project-template.worktree.bugfix-auth   5678def [bugfix/auth]
```

## How It Works

### Port Allocation Strategy

The skill uses a dynamic port allocation system by scanning existing worktrees:

1. **Base ports** (reserved for main repo):
   - PORT: 8000
   - OTEL_METRICS_PORT: 9464 (shared across all worktrees)

2. **Worktree ports** (start at base + 1):
   - First worktree: 8001
   - Second worktree: 8002
   - Increments for each new worktree

3. **Collision avoidance**:
   - Scans all worktrees using `git worktree list`
   - Reads PORT from each worktree's `.env.local`
   - Validates with `lsof` to detect non-worktree processes
   - Automatically skips to next available port

4. **No registry needed**:
   - All state is derived from actual files
   - Cannot get out of sync
   - Works even if worktrees are manually deleted

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

## Common Workflows

### Working on a new feature

```bash
# Create worktree for feature branch
/worktree create feat/my-feature

# Switch to worktree
cd ../monorepo-project-template.worktree.feat-my-feature

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
cd ../monorepo-project-template.worktree.main-stable/apps/example-service
pnpm dev

# Terminal 2: Run experimental version on port 8002
cd ../monorepo-project-template.worktree.feat-experiment/apps/example-service
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
cd ../monorepo-project-template.worktree.test-env/apps/example-service
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
    "example-service": {
      "files": []
    },
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

To track additional port types, edit `.claude/skills/worktree/scripts/port-allocator.sh` and update the port allocation logic. Currently, only PORT is dynamically allocated (OTEL_METRICS_PORT is shared at 9464).

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

**Problem:** A worktree directory with that name already exists.

**Solutions:**

- List existing: `git worktree list`
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

### Stale worktree references

**Problem:** Git shows worktree but directory doesn't exist.

**Solutions:**

```bash
# Prune stale worktrees
git worktree prune
```

### File transformations not applied

**Problem:** Ports or URLs not updated in copied files.

**Solutions:**

- Check manifest transform is correct
- Verify file format matches transform expectations
- Check script permissions: `ls -la .claude/skills/worktree/scripts/`
- Test transform manually on a file

## Limitations

- **Shared infrastructure**: Observability services (Jaeger, Prometheus, Grafana) share the same OTEL_METRICS_PORT (9464) across all worktrees. Metrics from all worktrees go to the same Prometheus instance.

- **Disk space**: Each worktree includes full dependencies (`node_modules`). Monitor disk usage when creating many worktrees.

- **Platform-specific**: Uses macOS `sed` syntax (`sed -i ''`). On Linux, use `sed -i` instead (edit `file-copier.sh`).

## Best Practices

1. **Close unused worktrees** - Free up disk space and ports
2. **Use descriptive names** - Makes management easier
3. **Commit before closing** - Avoid losing work
4. **Update manifest** - When adding new important files
5. **Check active worktrees** - Use `git worktree list` to see all worktrees
6. **Test in worktree first** - Before merging risky changes
7. **Close from within** - Run `/worktree close` from within a worktree to close it

## See Also

- Git worktrees documentation: `git help worktree`
- List worktrees: `git worktree list`
- Port allocation: `.claude/skills/worktree/scripts/port-allocator.sh`
- File manifest: `.claude/skills/worktree/config/file-manifest.json`
- App development guide: `apps/example-service/CLAUDE.md`
