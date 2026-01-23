# Monorepo Project Template

A production-ready monorepo starter template using Turborepo, pnpm workspaces, and shared configurations.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev

# Build all packages
pnpm build

# Lint and format
pnpm lint
pnpm style:format

# Run tests
pnpm test
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access the service
curl http://localhost:8001/health
```

## Structure

```
.
├── apps/
│   └── example-service/     # Express service example
└── packages/
    ├── eslint-config/       # Shared ESLint configuration
    ├── prettier-config/     # Shared Prettier configuration
    └── release-it-config/   # Shared release-it configuration
```

## Features

- **Turborepo** - Intelligent task orchestration with caching
- **pnpm workspaces** - Fast, efficient package management
- **Shared configs** - Centralized ESLint, Prettier, and release-it configurations
- **Docker** - Multi-stage builds with pnpm deploy optimization
- **TypeScript** - Full type safety across the monorepo
- **Conventional commits** - Commitlint validation for consistent commit messages

## Adding New Apps

1. Create a new directory in `apps/`
2. Add `package.json` with name `@monorepo/your-app-name`
3. Reference shared configs from `packages/`
4. Update `Dockerfile` to add your app as a new stage if needed

## Commands

- `pnpm build` - Build all packages
- `pnpm dev` - Run all services in development mode
- `pnpm lint` - Lint all packages
- `pnpm style:format` - Format code with Prettier
- `pnpm style:lint` - Check code formatting
- `pnpm test` - Run tests across all packages
- `pnpm release` - Create a new release
