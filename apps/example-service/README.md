can # Example Service

Production-ready NestJS service demonstrating clean architecture with JWT authentication and CRUD operations.

## Quick Start

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start development server
cd apps/example-service
pnpm dev

# Access the service
curl http://localhost:8000/health
```

## What It Does

Provides a REST API for product management with JWT authentication and role-based access control. Built using hexagonal architecture (ports and adapters) for testability and maintainability. Includes comprehensive logging, health checks, and API documentation.

## Key Endpoints

| Endpoint        | Method | Auth  | Description           |
| --------------- | ------ | ----- | --------------------- |
| `/health`       | GET    | None  | Health check          |
| `/api`          | GET    | None  | Swagger documentation |
| `/products`     | GET    | JWT   | List all products     |
| `/products/:id` | GET    | JWT   | Get product by ID     |
| `/products`     | POST   | Admin | Create product        |
| `/products/:id` | PATCH  | Admin | Update product        |
| `/products/:id` | DELETE | Admin | Delete product        |

Default port: `8000`

## Authentication

Generate a test JWT token:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'test-user',email:'test@example.com',name:'Test User',roles:['admin']}, 'dev-secret-change-in-production', {expiresIn:'24h'}))"
```

Use in requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/products
```

## Configuration

Environment variables: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`

See [CONFIG.md](./CONFIG.md) for complete configuration reference.

## Architecture

Built with clean architecture using:

- **Hexagonal architecture** (ports and adapters pattern)
- **Domain-driven design** principles
- **Type-safe** domain models and DTOs
- **Comprehensive testing** (unit + component)

See [CLAUDE.md](./CLAUDE.md) for detailed architectural documentation.

## Commands

```bash
# Development
pnpm dev              # Start with hot reload
pnpm dev:debug        # Start with debugger

# Build
pnpm build            # Build for production
pnpm start            # Run production build

# Testing
pnpm test:unit      # Run unit tests (100% coverage)
pnpm test:component # Run component tests (93%+ coverage)
pntml test:all         # Run all tests

# Code Quality
pnpm lint             # Run ESLint
pnpm style:format     # Format with Prettier
```

## API Documentation

Interactive Swagger docs available at: http://localhost:8000/api

## Project Structure

```
src/
├── auth/           # JWT authentication
├── health/         # Health checks
├── product/        # Product CRUD (example feature)
│   ├── inbound/    # Controllers, filters
│   ├── application/# Services, DTOs
│   ├── domain/     # Entities, errors
│   └── outbound/   # Repository ports/adapters
└── shared/         # Global config, logging
```

For detailed structure and patterns, see [CLAUDE.md](./CLAUDE.md).
