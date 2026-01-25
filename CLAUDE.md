# Monorepo Project Template - Developer Guide

This document provides guidance for working with this TypeScript monorepo template.

## Project Structure

```
monorepo-project-template/
├── apps/
│   └── example-service/          # Example NestJS service
├── packages/                      # Shared packages
├── scripts/
│   └── worktree/                 # Git worktree management scripts
├── observability/                # Docker Compose for monitoring stack
└── pnpm-workspace.yaml           # Monorepo workspace configuration
```

## Worktree Management

This project includes scripts for managing git worktrees with automatic environment setup. Worktrees allow you to work on multiple branches simultaneously without context switching.

### Location

All worktree scripts are in `scripts/worktree/`:

- `create-worktree.sh` - Create new worktree with environment setup
- `close-worktree.sh` - Remove worktree and cleanup
- `port-allocator.sh` - Dynamic port allocation logic
- `file-copier.sh` - Copy and transform environment files
- `config/file-manifest.json` - Configuration for which files to copy

### Usage

```bash
# Create a worktree (creates branch from origin/main if it doesn't exist)
./scripts/worktree/create-worktree.sh feat/my-feature

# Create worktree from existing branch
./scripts/worktree/create-worktree.sh existing-branch

# Close a specific worktree by name
./scripts/worktree/close-worktree.sh feat-my-feature

# Close current worktree (run from within a worktree)
cd ../monorepo-project-template.worktree.feat-my-feature
./scripts/worktree/close-worktree.sh

# List all worktrees
git worktree list
```

**Branch handling:**

- If you specify a branch that doesn't exist, it will automatically be created from the latest `origin/main`
- No need to create branches manually before creating worktrees

### When to Update Worktree Configuration

#### Update `scripts/worktree/config/file-manifest.json` when:

1. **Adding a new app** to the monorepo:

   ```json
   {
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

2. **Adding new untracked files** that should be copied to worktrees:
   - Environment configs (`.env.local`, `.env.test.local`)
   - Authentication tokens (`requests/http-client.env.json`)
   - Local credentials (`cookie.txt`, API keys)
   - Test data files

3. **Files to exclude** (never add these):
   - `node_modules/` (always excluded, `pnpm install` runs instead)
   - Build output (`dist/`, `.next/`)
   - IDE configs (`.vscode/`, `.idea/`)
   - Git-tracked files (copied automatically by git)

#### Update `scripts/worktree/port-allocator.sh` when:

1. **Adding new port environment variables** that need unique allocation:

   ```bash
   # Current: Only PORT is dynamically allocated
   # OTEL_METRICS_PORT is shared at 9464

   # If you need to allocate additional unique ports:
   # - Update BASE_PORT constants
   # - Modify find_next_port() logic
   # - Update get_used_ports() to read new port vars from .env files
   ```

2. **Changing base port ranges**:

   ```bash
   # Example: Change starting port from 8000 to 3000
   BASE_PORT=3000  # Change this constant
   ```

3. **Adding support for reading ports from different files**:
   ```bash
   # Currently reads from: apps/example-service/.env.local
   # Update get_used_ports() to scan additional locations
   ```

### Port Allocation Strategy

- **Main repo**: PORT=8000, OTEL_METRICS_PORT=9464
- **Worktrees**: PORT=8001+, OTEL_METRICS_PORT=9464 (shared)
- Ports are allocated dynamically by scanning existing worktrees
- No registry needed - all state derived from actual `.env.local` files

## Adding New Services

When adding a new service to the monorepo:

1. Create service in `apps/` or `packages/`
2. Add to `pnpm-workspace.yaml` if needed
3. **Update worktree manifest** (`scripts/worktree/config/file-manifest.json`)
4. Add any environment files that should be copied to worktrees
5. Document service-specific setup in its own `CLAUDE.md`

## Environment Variables

Standard environment variables across services:

- `PORT` - HTTP server port (unique per worktree)
- `OTEL_METRICS_PORT` - OpenTelemetry metrics port (9464, shared)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP endpoint (http://localhost:4318)

## Observability Stack

The project includes a Docker Compose stack with:

- Jaeger (tracing)
- Prometheus (metrics)
- Grafana (dashboards)

All worktrees share the same observability infrastructure on standard ports.

## Development Workflow

1. Create worktree for feature branch
2. Environment files automatically copied with updated ports
3. Dependencies installed via `pnpm install`
4. Work on feature independently
5. Close worktree when done

See individual service `CLAUDE.md` files for service-specific guidance.
