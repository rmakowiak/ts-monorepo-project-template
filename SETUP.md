# Setup Guide

## What's Included

This template extracts the battle-tested scaffold from your production monorepo:

- **Turbo 2.5.8** - Task orchestration with intelligent caching
- **pnpm 9.15.9** - Efficient package management
- **Node 22** - Latest LTS
- **Shared configs** - ESLint, Prettier, release-it
- **Example Express service** - Minimal working example
- **Docker** - Multi-stage builds with pnpm deploy
- **Conventional commits** - Commitlint validation

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all commands to verify setup
pnpm build        # ✅ Builds TypeScript
pnpm lint         # ✅ Lints code
pnpm style:lint   # ✅ Checks formatting
pnpm dev          # Runs development server

# Format code
pnpm style:format
```

## Docker

```bash
# Build
docker build --target example-service -t my-service .

# Run with docker-compose
docker-compose up --build
```

## Adding New Services

1. Copy `apps/example-service` as a template
2. Update package name in `package.json` to `@monorepo/your-service`
3. Add to `Dockerfile` as a new build stage
4. Update `docker-compose.yml` if needed

## What's Different from Your Production Setup

- **Generic commitlint** - Uses standard conventional commits instead of Jira pattern
- **Standard Docker images** - Uses `node:22-slim` instead of parloa-specific images
- **Minimal example** - Single Express service instead of full microservices architecture
- **No company-specific** - Removed artifactory, compliance scanning, parloa-specific configs

## Verified Commands

All these commands have been tested and work:

```bash
✅ pnpm install
✅ pnpm build
✅ pnpm lint
✅ pnpm style:lint
✅ pnpm style:format
```

## Next Steps

1. Rename the root package in `package.json`
2. Update workspace package names from `@monorepo/*` to your preferred scope
3. Add your services to `apps/`
4. Customize shared configs in `packages/` as needed
5. Set up git and run `pnpm prepare` to install husky hooks
