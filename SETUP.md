# Setup Guide

## Quick Start

```bash
# Install and verify
pnpm install
pnpm build
pnpm lint
pnpm dev
```

## What's Included

- **Turbo 2.5.8** - Task orchestration with intelligent caching
- **pnpm 9.15.9** - Efficient package management
- **Node 22** - Latest LTS
- **Shared configs** - ESLint, Prettier, release-it
- **NestJS service** - Production-ready example
- **Docker** - Multi-stage builds with pnpm deploy
- **Conventional commits** - Commitlint validation

## Docker

```bash
# Build and run
docker build --target example-service -t my-service .
docker-compose up --build

# Test
curl http://localhost:8001/health
```

## Adding New Services

1. Copy `apps/example-service` as template
2. Update `package.json` name to `@monorepo/your-service`
3. Add to `Dockerfile` as new build stage
4. Update `docker-compose.yml` if needed

## Next Steps

1. Rename root package in `package.json`
2. Update workspace names from `@monorepo/*` to your scope
3. Add your services to `apps/`
4. Customize shared configs in `packages/`
5. Set up git: `git init && pnpm prepare` (installs husky hooks)

## Commands

```bash
pnpm install       # Install dependencies
pnpm build         # Build all packages
pnpm dev           # Run development servers
pnpm lint          # Lint all packages
pnpm style:format  # Format code
pnpm style:lint    # Check formatting
pnpm test          # Run tests
```
