# [Service Name] - Developer Guide

> **Template Instructions**: Replace [Service Name] with your service name throughout this document. Remove all sections marked with "Template Instructions" after completing setup.

This service follows clean architecture principles with the ports and adapters pattern. For comprehensive architectural patterns, testing strategies, and best practices, see the [root CLAUDE.md](../../../CLAUDE.md) and [MODULE_TEMPLATE.md](../../../docs/templates/service-template/MODULE_TEMPLATE.md).

## Table of Contents

- [Service Overview](#service-overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Running the Service](#running-the-service)

---

## Service Overview

> **Template Instructions**: Describe what this service does, its primary responsibilities, and key business domains it handles.

**Purpose**: [Brief description of what this service does]

**Key Features**:

- [Feature 1]
- [Feature 2]
- [Feature 3]

**Technology Stack**:

- NestJS (framework)
- TypeScript (language)
- [Database] (persistence)
- Pino (logging)
- OpenTelemetry (observability)
- Jest (testing)

---

## Architecture

This service follows **hexagonal architecture** (ports and adapters pattern). See [root CLAUDE.md - Service Architecture Patterns](../../../CLAUDE.md#service-architecture-patterns) for detailed architectural patterns and principles.

### Architecture Diagram

> **Template Instructions**: Update this diagram to reflect your service's specific module structure.

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                       │
│  Controllers, Guards, Decorators, Exception Filters          │
│  (HTTP/REST interface - Framework dependent)                 │
└────────────────┬───────────────────────────────────────┬─────┘
                 │                                       │
┌────────────────▼───────────────────────────────────────▼─────┐
│                      APPLICATION LAYER                        │
│  Services (Business Logic Orchestration), DTOs                │
│  (Framework independent business rules)                       │
└────────────────┬───────────────────────────────────────┬─────┘
                 │                                       │
     ┌───────────▼───────────┐                 ┌────────▼────────┐
     │    DOMAIN LAYER       │                 │  OUTBOUND PORTS │
     │  Entities, Errors     │                 │  (Interfaces)   │
     │  (Pure business logic) │                 └─────────┬───────┘
     └───────────────────────┘                           │
                                              ┌──────────▼────────┐
                                              │  ADAPTERS         │
                                              │  (Implementations) │
                                              └───────────────────┘
```

**Key Principles**:

- Dependencies flow inward (controllers → services → ports)
- Domain layer has no external dependencies
- Adapters implement ports and are swappable
- Business logic is framework-agnostic

See [root CLAUDE.md - Service Architecture Patterns](../../../CLAUDE.md#service-architecture-patterns) for detailed explanations and code examples.

---

## Project Structure

> **Template Instructions**: Update this structure to match your service's actual directory layout. Keep this focused on high-level organization.

```
src/
├── main.ts                          # Application bootstrap
├── app.module.ts                    # Root module
├── app.controller.ts                # Root endpoints
│
├── shared/                          # Cross-cutting concerns (Global)
│   ├── shared.module.ts            # @Global module
│   └── config/
│       └── app.config.ts           # Configuration loading
│
├── auth/                            # Authentication module
│   ├── auth.module.ts
│   ├── guards/
│   ├── decorators/
│   ├── application/
│   ├── domain/
│   └── outbound/
│
├── [domain-module-1]/               # Example: user/, product/, order/
│   ├── [module].module.ts
│   ├── inbound/                     # Controllers, filters
│   ├── application/                 # Services, DTOs
│   ├── domain/                      # Entities, errors
│   └── outbound/                    # Ports, adapters
│
└── [domain-module-2]/
    └── ...
```

**Module Organization**:

- Each feature module follows the same layered structure
- See [MODULE_TEMPLATE.md](../../../docs/templates/service-template/MODULE_TEMPLATE.md) for step-by-step module creation guide

---

## Development Setup

### Prerequisites

- Node.js 20+ and pnpm
- Docker (for integration tests and infrastructure)
- [Any other service-specific requirements]

### Local Development

> **Template Instructions**: Update port numbers and environment variables specific to your service.

**Quick Start**:

```bash
# Install dependencies (from monorepo root)
pnpm install

# Navigate to service directory
cd apps/[service-name]

# Copy environment file
cp .env .env.local

# Start development server
pnpm dev

# Service runs on http://localhost:[PORT]
```

**Environment Variables**:

Create `.env.local` (git-ignored) with:

```bash
# Application
PORT=8000
NODE_ENV=development
LOG_LEVEL=debug

# Authentication
JWT_SECRET=dev-secret-change-in-production

# Database (if applicable)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# OpenTelemetry
OTEL_SERVICE_NAME=[service-name]
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

See [Configuration](#configuration) section and [CONFIG.md](./CONFIG.md) for complete configuration documentation.

### Git Worktrees

This monorepo supports git worktrees for working on multiple branches simultaneously with automatic port allocation. See [root CLAUDE.md - Worktree Management](../../../CLAUDE.md#worktree-management) for comprehensive documentation.

**Quick Reference**:

```bash
# Create worktree for feature branch
./scripts/worktree/create-worktree.sh feat/my-feature

# Switch to worktree
cd ../monorepo-project-template.worktree.feat-my-feature/apps/[service-name]

# Start with automatically allocated port (e.g., 8001)
pnpm dev

# Close worktree when done
cd /path/to/monorepo-project-template
./scripts/worktree/close-worktree.sh feat-my-feature
```

**Port Allocation**: Worktrees automatically get unique ports (8001, 8002, etc.) to avoid conflicts with the main repo running on port 8000.

---

## Testing

This service uses a **three-tier testing approach**: unit tests, component tests, and integration tests. See [root CLAUDE.md - Testing Implementation Patterns](../../../CLAUDE.md#testing-implementation-patterns) for comprehensive testing patterns and [TESTING_CHECKLIST.md](../../../docs/templates/service-template/TESTING_CHECKLIST.md) for setup guide.

### Testing Strategy

```
┌─────────────────────────────────────┐
│       Integration Tests              │  ← HTTP → Service → Real DB
├─────────────────────────────────────┤
│       Component Tests                │  ← HTTP → Service → Mocked DB
├─────────────────────────────────────┤
│          Unit Tests                  │  ← Individual functions/classes
└─────────────────────────────────────┘
```

**Coverage Goals**:

- Unit tests: 100% of business logic (services, repositories, guards)
- Component tests: 90%+ of HTTP layer (controllers, filters, full API flow)
- Integration tests: Decision table approach for critical database scenarios

### Test Commands

> **Template Instructions**: Verify these commands match your package.json scripts.

```bash
# Unit Tests (co-located *.spec.ts files)
pnpm test:unit              # Run unit tests
pnpm test:cov:unit          # With coverage report

# Component Tests (test/component/)
pnpm test:component         # Run component tests
pnpm test:component:cov     # With coverage report

# Integration Tests (test/integration/) - Requires Docker
pnpm test:integration       # Run integration tests
pnpm test:integration:cov   # With coverage report

# All Tests
pnpm test:all               # Unit + component
pnpm test:ci                # All tests including integration

# Development
pnpm test:watch             # Watch mode
pnpm test:debug             # Debug mode
```

### Test Structure

```
test/
├── fixtures/                          # Test data and boundary values
│   └── [entity].fixtures.ts
├── helpers/                           # Reusable test utilities
│   ├── mock-logger.factory.ts
│   ├── jwt.factory.ts
│   ├── test-app.factory.ts
│   └── integration-test-app.factory.ts
├── component/                         # HTTP component tests (mocked DB)
│   └── [feature].component.spec.ts
└── integration/                       # Integration tests (real DB)
    └── [feature].integration.spec.ts

src/
└── */                                 # Co-located unit tests
    ├── **/*.spec.ts                   # Unit tests next to source
    └── **/*.ts                        # Source files
```

### Writing Tests

See [root CLAUDE.md - Testing Implementation Patterns](../../../CLAUDE.md#testing-implementation-patterns) for detailed examples of:

- Unit test patterns (services, repositories, guards)
- Component test patterns (HTTP endpoints, ECP & BVA)
- Integration test patterns (database constraints, concurrency)
- Test helpers and fixtures
- ECP & BVA methodology

### Service-Specific Test Examples

> **Template Instructions**: Add examples of service-specific tests, fixtures, and boundary values relevant to your domain.

**Example Boundary Values** (`test/fixtures/[entity].fixtures.ts`):

```typescript
export const BOUNDARY_VALUES = {
  // Add domain-specific boundary values
  price: {
    valid: { minimum: 0.01, normal: 99.99, maximum: 9999999.99 },
    invalid: { zero: 0, negative: -1, tooManyDecimals: 10.999 },
  },
};

export function createTest[Entity]Dto(overrides?: Partial<Create[Entity]Dto>) {
  // Factory function for creating test DTOs
  const dto = new Create[Entity]Dto();
  dto.field1 = overrides?.field1 ?? 'default value';
  dto.field2 = overrides?.field2 ?? 42;
  return dto;
}
```

---

## Configuration

Configuration uses namespace-based schemas with validation. See [root CLAUDE.md - Configuration Pattern](../../../CLAUDE.md#configuration-pattern) for the configuration architecture and [CONFIG.md](./CONFIG.md) for service-specific variables.

### Quick Reference

**Configuration Namespaces**:

> **Template Instructions**: Update these namespaces to match your service's config structure.

- `app` - Application settings (PORT, NODE_ENV, LOG_LEVEL)
- `auth` - Authentication settings (JWT_SECRET)
- `database` - Database connection settings (if applicable)
- `otel` - OpenTelemetry settings

**Using Config in Services**:

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfigService } from "~/shared/config/app-config.service";

@Injectable()
export class SomeService {
  constructor(private readonly config: AppConfigService) {}

  doSomething() {
    const port = this.config.app.PORT; // Type: number
    const env = this.config.app.NODE_ENV; // Type: Environment
    const secret = this.config.auth.JWT_SECRET; // Type: string
  }
}
```

**Important**: Never read `process.env` directly. Always use the config service for validated, type-safe configuration.

See [CONFIG.md](./CONFIG.md) for:

- Complete list of environment variables
- Validation rules
- Environment file priority
- Adding new configuration

---

## API Documentation

### Swagger/OpenAPI

Interactive API documentation is available at:

```
http://localhost:[PORT]/api
```

### Authentication

Most endpoints require JWT authentication:

```bash
# Generate test token
node -e "console.log(require('jsonwebtoken').sign(
  {sub:'user-123', email:'test@example.com', name:'Test User', roles:['admin']},
  'dev-secret-change-in-production',
  {expiresIn:'24h'}
))"

# Use in requests
curl -H "Authorization: Bearer <token>" http://localhost:[PORT]/endpoint
```

### HTTP Client

> **Template Instructions**: Update if your service uses different HTTP client files.

JetBrains HTTP Client files are in `requests/`:

- `[service-name].http` - API request examples
- `http-client.env.json` - Environment variables and JWT tokens (git-ignored)

---

## Running the Service

### Development

```bash
# Start with hot reload
pnpm dev

# Start with debug mode
pnpm dev:debug
```

### Production

```bash
# Build
pnpm build

# Start production server
pnpm start
```

### Other Commands

```bash
# Linting
pnpm lint

# Formatting
pnpm style:format

# Type checking
pnpm type-check
```

---

## Logging Strategy

This service uses Pino for structured logging. See [root CLAUDE.md - Logging Strategy](../../../CLAUDE.md#logging-strategy) for comprehensive logging patterns.

**Quick Reference**:

```typescript
@Injectable()
export class SomeService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SomeService.name); // Always set context
  }

  async doSomething(id: string) {
    this.logger.info({ id }, "Doing something"); // Structured logging

    try {
      // Business logic
      this.logger.debug({ result }, "Operation successful");
    } catch (error) {
      this.logger.error({ error, id }, "Operation failed");
      throw error;
    }
  }
}
```

**Log Levels**: `fatal`, `error`, `warn`, `info`, `debug`, `trace`

---

## Best Practices

See [root CLAUDE.md - Best Practices](../../../CLAUDE.md#best-practices) for comprehensive patterns. Key principles:

- ✅ Inject ports (interfaces), not adapters (implementations)
- ✅ Throw domain-specific errors from services
- ✅ Use DTOs for API boundaries (never expose entities)
- ✅ Use `Readonly<>` for immutable domain entities
- ✅ Set logger context in constructors
- ✅ Validate all environment variables through config schemas

---

## Adding New Modules

To add a new feature module to this service, follow the [MODULE_TEMPLATE.md](../../../docs/templates/service-template/MODULE_TEMPLATE.md) guide, which provides:

- Step-by-step instructions for creating all layers
- Code examples for entities, services, controllers
- Best practices for domain modeling
- Testing checklist

---

## Observability

### Metrics

Prometheus metrics available at:

```
http://localhost:[OTEL_METRICS_PORT]/metrics
```

### Tracing

OpenTelemetry traces exported to:

```
http://localhost:16686 (Jaeger UI)
```

### Monitoring Stack

The monorepo includes a complete observability stack. From the monorepo root:

```bash
# Start monitoring infrastructure
cd observability
docker-compose up -d

# Access dashboards
open http://localhost:16686  # Jaeger (tracing)
open http://localhost:9090   # Prometheus (metrics)
open http://localhost:3001   # Grafana (dashboards)
```

---

## Related Documentation

- [Root CLAUDE.md](../../../CLAUDE.md) - Monorepo patterns and architecture
- [MODULE_TEMPLATE.md](../../../docs/templates/service-template/MODULE_TEMPLATE.md) - Module creation guide
- [TESTING_CHECKLIST.md](../../../docs/templates/service-template/TESTING_CHECKLIST.md) - Testing setup
- [CONFIG.md](./CONFIG.md) - Configuration reference
- [Worktree README](../../../scripts/worktree/README.md) - Git worktree management

---

## Summary

This service provides:

> **Template Instructions**: Update this list with your service's actual features.

✅ Clean architecture with ports and adapters
✅ Full authentication with JWT and RBAC
✅ Structured logging with Pino
✅ API documentation with Swagger
✅ Type-safe configuration with validation
✅ Comprehensive testing (unit, component, integration)
✅ OpenTelemetry observability

Follow the patterns in this guide and the linked documentation to maintain consistency and code quality.
