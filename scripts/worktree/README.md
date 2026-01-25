# Worktree Management Scripts

Standalone bash scripts for managing git worktrees with automatic environment setup and port allocation.

## Quick Start

```bash
# Create a worktree
./create-worktree.sh feat/my-feature

# Close a worktree by name
./close-worktree.sh feat-my-feature

# Close current worktree (run from within a worktree)
./close-worktree.sh

# List all worktrees
git worktree list
```

## Scripts

### create-worktree.sh

Creates a new git worktree with automatic port allocation and environment setup.

**Usage:** `./create-worktree.sh <branch-name> [worktree-name]`

**What it does:**

1. Validates or creates branch (if branch doesn't exist, creates it from latest origin/main)
2. Creates git worktree as sibling directory
3. Allocates unique PORT by scanning existing worktrees
4. Copies environment files per manifest
5. Transforms files (updates ports, base URLs)
6. Runs `pnpm install` and `pnpm build`

**Branch handling:**

- If branch exists locally or remotely, uses it
- If branch doesn't exist, automatically creates it from latest `origin/main`
- No need to create branches manually first

### close-worktree.sh

Removes a worktree. If no worktree specified, closes the current one.

**Usage:** `./close-worktree.sh [worktree-name] [--force]`

**What it does:**

1. Detects current worktree (if no name provided)
2. Checks for uncommitted changes (unless `--force`)
3. Removes worktree with `git worktree remove`
4. Runs `git worktree prune`

## Configuration

### config/file-manifest.json

Defines which files to copy to new worktrees and how to transform them.

**Structure:**

```json
{
  "version": "1.0.0",
  "apps": {
    "example-service": {
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

**Transform types:**

- `update_ports` - Updates PORT and OTEL_METRICS_PORT in .env files
- `update_base_url` - Updates JSON `$.dev.baseUrl` to match new PORT

## Port Allocation

Ports are allocated dynamically by:

1. Scanning all worktrees using `git worktree list`
2. Reading PORT from each worktree's `.env.local`
3. Finding next available port starting at 8001

**Port ranges:**

- Main repo: PORT=8000
- Worktrees: PORT=8001, 8002, 8003...
- OTEL_METRICS_PORT=9464 (shared across all worktrees)

## Adding New Apps

When adding a new app to the monorepo:

1. Update `config/file-manifest.json`
2. Add app with files to copy
3. Use existing transform types or add new ones in `file-copier.sh`

## See Also

- Main documentation: `/CLAUDE.md`
- App-specific docs: `/apps/*/CLAUDE.md`
