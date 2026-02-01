# Example Service - Clean Architecture Guide

This service is built with **clean architecture** (hexagonal architecture) using the **ports and adapters pattern**. It provides a production-ready starting point for building scalable, testable, and maintainable NestJS applications.

**For comprehensive architectural patterns, testing strategies, best practices, and configuration patterns**, see the [root CLAUDE.md](../../CLAUDE.md).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [How to Extend](#how-to-extend)
- [Testing](#testing)
- [Authentication & Authorization](#authentication--authorization)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)

---

## Architecture Overview

This service follows **hexagonal architecture** principles:

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

**Key Benefits:**

- ✅ **Testable**: Mock adapters for easy testing
- ✅ **Flexible**: Swap implementations without touching business logic
- ✅ **Independent**: Domain logic doesn't depend on frameworks or databases
- ✅ **Maintainable**: Clear separation of concerns

**For detailed architectural patterns** (ports and adapters, module structure, dependency flow), see [root CLAUDE.md - Service Architecture Patterns](../../CLAUDE.md#service-architecture-patterns).

---

## Project Structure

```
src/
├── main.ts                          # Application bootstrap
├── app.module.ts                    # Root module
├── app.controller.ts                # Root endpoints
│
├── shared/                          # Cross-cutting concerns (Global)
│   ├── shared.module.ts            # @Global module
│   └── config/
│       └── app.config.ts           # Configuration loading with validation
│
├── auth/                            # Authentication module
│   ├── auth.module.ts
│   ├── guards/                     # NestJS guards (module root)
│   │   ├── jwt-auth.guard.ts      # JWT authentication
│   │   └── roles.guard.ts         # Role-based access control
│   ├── decorators/                 # Custom decorators (module root)
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── application/
│   │   └── auth.service.ts        # Auth orchestration
│   ├── domain/
│   │   └── user.entity.ts         # User domain model
│   └── outbound/
│       ├── ports/
│       │   └── auth-provider.port.ts    # Interface for auth
│       └── adapters/
│           └── simple-auth.adapter.ts   # Simple JWT implementation
│
├── health/                         # Health checks module
│   ├── health.module.ts
│   ├── inbound/
│   │   └── health.controller.ts
│   └── indicators/
│       └── database-health.indicator.ts
│
└── product/                        # Example domain module
    ├── product.module.ts
    ├── inbound/                    # Entry points
    │   ├── product.controller.ts  # REST API
    │   └── product-exception.filter.ts
    ├── application/               # Business logic
    │   ├── product.service.ts    # Service orchestration
    │   └── dto/                  # Data transfer objects
    │       ├── create-product.dto.ts
    │       ├── update-product.dto.ts
    │       ├── product-response.dto.ts
    │       └── product-list-response.dto.ts
    ├── domain/                    # Core business
    │   ├── product.entity.ts     # Domain model
    │   └── product.error.ts      # Domain errors
    └── outbound/                  # External dependencies
        ├── ports/
        │   └── product-repository.port.ts  # Interface
        └── adapters/
            └── in-memory-product.repository.ts  # Implementation
```

---

## How to Extend

### Adding a New Module

For comprehensive step-by-step guide on adding a new module (with complete code examples), see [docs/templates/service-template/MODULE_TEMPLATE.md](../../docs/templates/service-template/MODULE_TEMPLATE.md).

**Quick Example: Adding a "Category" module**

1. **Create folder structure**:

```bash
mkdir -p src/category/{inbound,application/dto,domain,outbound/{ports,adapters}}
```

2. **Define domain model** (`domain/category.entity.ts`):

```typescript
export type CategoryId = string;

export type Category = Readonly<{
  id: CategoryId;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}>;
```

3. **Create domain errors** (`domain/category.error.ts`):

```typescript
export class CategoryNotFoundError extends Error {
  constructor(id: CategoryId) {
    super(`Category not found: ${id}`);
    this.name = "CategoryNotFoundError";
  }
}
```

4. **Define repository port** (`outbound/ports/category-repository.port.ts`):

```typescript
export type CategoryRepository = {
  save(category: Category): Promise<Category>;
  findById(id: CategoryId): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  delete(id: CategoryId): Promise<void>;
};
```

5. **Create adapter**, **DTOs**, **service**, **controller**, **exception filter**, and **module**

See [MODULE_TEMPLATE.md](../../docs/templates/service-template/MODULE_TEMPLATE.md) for complete implementations of steps 5-11.

**For architectural patterns and best practices**, see:

- [Root CLAUDE.md - Service Architecture Patterns](../../CLAUDE.md#service-architecture-patterns)
- [Root CLAUDE.md - Best Practices](../../CLAUDE.md#best-practices)

---

## Testing

This service uses a **three-tier testing approach** with separate **unit tests**, **component tests**, and **integration tests**. See [root CLAUDE.md - Testing Implementation Patterns](../../CLAUDE.md#testing-implementation-patterns) for comprehensive testing patterns.

### Testing Philosophy

**Key Principles:**

- ✅ **Meaningful over exhaustive**: Focus on valuable tests, not test count
- ✅ **ECP & BVA**: Use Equivalence Class Partitioning and Boundary Value Analysis for strategic coverage
- ✅ **Separation of concerns**: Unit tests for logic, component tests for HTTP flow, integration tests for database
- ✅ **High coverage with focus**: 100% unit coverage on business logic, 93%+ component coverage on API layer
- ✅ **Minimal integration tests**: Decision table approach for critical database scenarios only

### Test Structure

```
test/
├── fixtures/                          # Test data and boundary values
│   └── product.fixtures.ts            # Product test data, BOUNDARY_VALUES
├── helpers/                           # Reusable test utilities
│   ├── mock-logger.factory.ts        # Mock PinoLogger
│   ├── jwt.factory.ts                # JWT token generation
│   ├── test-app.factory.ts           # NestJS app factory (mocked DB)
│   ├── integration-test-app.factory.ts # App factory with real DB
│   └── test-db.factory.ts            # Testcontainers setup
├── component/                         # HTTP component tests (mocked DB)
│   ├── product.component.spec.ts
│   └── health.component.spec.ts
├── integration/                       # Integration tests (real DB)
│   └── product.integration.spec.ts
├── jest-component.json                # Component test config
└── jest-integration.json              # Integration test config

src/
└── */                                 # Co-located unit tests
    ├── **/*.spec.ts                   # Unit tests next to source
    └── **/*.ts                        # Source files
```

### Coverage Strategy

**Three Separate Test Suites:**

1. **Unit Test Coverage: 100%**
   - Business logic (Services)
   - Data access (Repositories)
   - Authorization (Guards)
   - Pure logic without HTTP concerns

2. **Component Test Coverage: 93.91%**
   - Full HTTP request/response cycle
   - Controllers
   - Exception filters
   - Validation pipes
   - Authentication flow
   - End-to-end scenarios with mocked database

3. **Integration Test Coverage: Database-specific**
   - Real PostgreSQL database (testcontainers)
   - Database constraints (unique, foreign keys)
   - Concurrency and race conditions
   - Soft delete behavior
   - Decimal precision handling
   - Pagination performance

**Excluded from Unit Test Coverage:**

Files covered by component tests or infrastructure:

```json
{
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.dto.ts",
    "!**/*.entity.ts",
    "!**/*.port.ts",
    "!**/*.error.ts",
    "!**/main.ts",
    "!**/*.module.ts",
    "!**/*.controller.ts",
    "!**/*.filter.ts",
    "!**/*.decorator.ts",
    "!**/config/**",
    "!**/indicators/**",
    "!**/adapters/simple-*.ts",
    "!**/auth/application/auth.service.ts"
  ]
}
```

### Test Commands

```bash
# Unit Tests (72 tests - 100% coverage)
pnpm test:unit              # Run unit tests
pnpm test:cov:unit          # With coverage report

# Component Tests (31 tests - 93.91% coverage)
pnpm test:component         # Run component tests
pnpm test:component:cov     # With coverage report

# Integration Tests (8 tests - database integration)
pnpm test:integration       # Run integration tests (requires Docker)
pnpm test:integration:cov   # With coverage report

# All Tests (111 tests total)
pnpm test:all               # Run unit + component tests
pnpm test:ci                # Run all tests including integration

# Development
pnpm test:watch             # Watch mode
pnpm test:debug             # Debug mode
pnpm test                   # Run all unit tests (default)
```

### Service-Specific Test Examples

**Test Data Fixtures** (`test/fixtures/product.fixtures.ts`):

```typescript
export const BOUNDARY_VALUES = {
  price: {
    valid: {
      minimum: 0.01,
      normal: 99.99,
      maximum: 9999999.99,
    },
    invalid: {
      zero: 0,
      negative: -1,
      tooManyDecimals: 10.999,
    },
  },
  stock: {
    valid: {
      zero: 0,
      one: 1,
      normal: 100,
    },
    invalid: {
      negative: -1,
    },
  },
};

export function createTestProductDto(
  overrides?: Partial<CreateProductDto>,
): CreateProductDto {
  const dto = new CreateProductDto();
  dto.name = overrides?.name ?? "New Test Product";
  dto.description = overrides?.description ?? "New test product description";
  dto.sku = overrides?.sku ?? `TEST-${Date.now()}`;
  dto.price = overrides?.price ?? 49.99;
  dto.stock = overrides?.stock ?? 50;
  return dto;
}

export function createTestProduct(overrides?: Partial<Product>): Product {
  return {
    id: overrides?.id ?? randomUUID(),
    name: overrides?.name ?? "Test Product",
    description: overrides?.description ?? "Test product description",
    sku: overrides?.sku ?? `TEST-SKU-${Date.now()}`,
    price: overrides?.price ?? 99.99,
    stock: overrides?.stock ?? 10,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}
```

**Writing Unit Tests**:

```typescript
import { ProductService } from "./product.service";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import {
  createTestProductDto,
  createTestProduct,
  BOUNDARY_VALUES,
} from "../../../test/fixtures/product.fixtures";
import type { ProductRepository } from "../outbound/ports/product-repository.port";

describe("ProductService", () => {
  let service: ProductService;
  let mockRepository: jest.Mocked<ProductRepository>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    };

    mockLogger = createMockLogger();
    service = new ProductService(mockRepository, mockLogger);
  });

  describe("createProduct (ECP & BVA)", () => {
    it("should create product with valid data (ECP: Valid)", async () => {
      const dto = createTestProductDto({ sku: "TEST-001" });
      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (p) => p);

      const result = await service.createProduct(dto);

      expect(result.name).toBe(dto.name);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("should accept minimum valid price (BVA: Lower boundary)", async () => {
      const dto = createTestProductDto({
        sku: "MIN-PRICE",
        price: BOUNDARY_VALUES.price.valid.minimum, // 0.01
      });
      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (p) => p);

      const result = await service.createProduct(dto);

      expect(result.price).toBe(0.01);
    });
  });
});
```

**Writing Component Tests**:

```typescript
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.factory";
import { createAdminToken, createUserToken } from "../helpers/jwt.factory";
import {
  createTestProductDto,
  BOUNDARY_VALUES,
} from "../fixtures/product.fixtures";

describe("Product API (Component)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = createAdminToken();
    userToken = createUserToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /products (ECP + BVA)", () => {
    it("should create product as admin (ECP: Valid admin)", async () => {
      const dto = createTestProductDto({ sku: `TEST-CREATE-${Date.now()}` });

      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
      });
    });

    it("should return 403 when user role tries to create (ECP: Invalid - Wrong role)", async () => {
      const dto = createTestProductDto({ sku: `TEST-USER-${Date.now()}` });

      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${userToken}`)
        .send(dto)
        .expect(403);
    });

    it("should return 400 for negative price (BVA: Below minimum)", async () => {
      const dto = createTestProductDto({
        sku: `TEST-NEG-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.invalid.negative, // -1
      });

      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);

      expect(Array.isArray(response.body.message)).toBe(true);
    });
  });
});
```

**Writing Integration Tests**:

Integration tests verify the service integrates correctly with **real external systems** (PostgreSQL database). Uses **testcontainers**.

**Decision Table for Integration Tests**:

Use decision table methodology to identify which scenarios need integration tests:

| Scenario            | Validates                          | Why Integration Test Needed                 |
| ------------------- | ---------------------------------- | ------------------------------------------- |
| Duplicate SKU       | PostgreSQL unique constraint       | In-memory repo can't test actual constraint |
| Concurrent creation | Race condition handling            | Tests actual database locking               |
| Soft delete         | isActive filtering in queries      | Verifies database indexes work correctly    |
| Decimal precision   | Prisma Decimal → number conversion | Tests actual type conversion                |
| Pagination          | Query performance with real data   | Tests SQL OFFSET/LIMIT efficiency           |

This table shows why we have only 8 integration tests - each one validates something that **cannot be tested** with unit or component tests.

```typescript
import { INestApplication } from "@nestjs/common";
import { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { PrismaService } from "~/database/prisma.service";
import {
  startPostgreSqlContainer,
  runMigrations,
  cleanDatabase,
} from "../helpers/test-db.factory";
import { createIntegrationTestApp } from "../helpers/integration-test-app.factory";

describe("Product API (Integration)", () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let databaseUrl: string;

  beforeAll(async () => {
    container = await startPostgreSqlContainer();
    databaseUrl = container.getConnectionString();
    await runMigrations(databaseUrl);
    app = await createIntegrationTestApp({ databaseUrl });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(databaseUrl);
  });

  it("should enforce unique SKU constraint at database level", async () => {
    const dto = createTestProductDto({ sku: "UNIQUE-SKU-001" });

    // Create first product
    await request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(dto)
      .expect(201);

    // Try to create second product with same SKU
    await request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(dto)
      .expect(409); // Conflict due to database constraint
  });
});
```

**For comprehensive testing patterns**, see:

- [Root CLAUDE.md - Testing Implementation Patterns](../../CLAUDE.md#testing-implementation-patterns)
- [Testing Checklist](../../docs/templates/service-template/TESTING_CHECKLIST.md)

---

## Authentication & Authorization

### Protecting Routes

```typescript
@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard) // Global guard
export class ProductController {
  @Get()
  findAll() {} // Protected by JWT

  @Post()
  @Roles("admin") // Also requires admin role
  create() {}
}
```

### Public Routes

```typescript
@Get('public')
@Public()  // Skip authentication
getPublicData() {}
```

### Getting Current User

```typescript
@Get('my-products')
async getMyProducts(@CurrentUser() user: User) {
  return this.service.findByUserId(user.id)
}
```

### Testing with JWT

1. Generate a test token:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'user-123',email:'test@example.com',name:'Test User',roles:['admin']}, 'dev-secret-change-in-production', {expiresIn:'24h'}))"
```

2. Use in API requests:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/products
```

---

## API Documentation

Swagger is available at: `http://localhost:8000/api`

### Adding Swagger Documentation

```typescript
@Post()
@ApiOperation({ summary: 'Create a product' })
@ApiResponse({ status: 201, description: 'Created', type: ProductResponseDto })
@ApiResponse({ status: 400, description: 'Bad Request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 409, description: 'Product already exists' })
async create(@Body() dto: CreateProductDto) {
  return this.service.create(dto)
}
```

---

## Configuration

Configuration uses `@nestjs/config` with class-validator for type-safe validation organized into namespaces. See **[CONFIG.md](./CONFIG.md)** for comprehensive documentation.

**For configuration patterns and best practices**, see [root CLAUDE.md - Configuration Pattern](../../CLAUDE.md#configuration-pattern).

### Quick Reference

**Configuration Namespaces**:

- `app` - Application settings (PORT, NODE_ENV, LOG_LEVEL)
- `auth` - Authentication settings (JWT_SECRET)
- `otel` - OpenTelemetry settings (service name, tracing, metrics)

**Environment Files** (priority order):

- `.env.local` - Local overrides (git-ignored)
- `.env.production` - Production values (git-ignored)
- `.env` - Default values (committed)

### Using Config in Services

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfigService } from "~/shared/config/app-config.service";

@Injectable()
export class SomeService {
  constructor(private readonly config: AppConfigService) {}

  doSomething() {
    // Access via namespaces
    const port = this.config.app.PORT; // Type: number
    const env = this.config.app.NODE_ENV; // Type: Environment
    const secret = this.config.auth.JWT_SECRET; // Type: string
    const serviceName = this.config.otel.OTEL_SERVICE_NAME; // Type: string
  }
}
```

**Important**: Never read `process.env` directly. Always use the config service for validated, type-safe configuration.

For complete documentation including validation rules, environment file priority, production deployment, and troubleshooting, see **[CONFIG.md](./CONFIG.md)**.

---

## Running the Service

```bash
# Development with hot reload
pnpm dev

# Production build
pnpm build

# Start production
pnpm start

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm style:format
```

---

## Development Workflow

### Git Worktrees

This monorepo supports git worktrees for working on multiple branches simultaneously with automatic port allocation. See [root CLAUDE.md - Worktree Management](../../CLAUDE.md#worktree-management) for comprehensive documentation.

**Quick Reference**:

```bash
# Create worktree for feature branch
./scripts/worktree/create-worktree.sh feat/my-feature

# Switch to worktree (automatically uses port 8001+)
cd ../monorepo-project-template.worktree.feat-my-feature/apps/example-service
pnpm dev

# Close worktree when done
cd /path/to/monorepo-project-template
./scripts/worktree/close-worktree.sh feat-my-feature
```

This service uses ports 8000+ and requires `.env.local` and `requests/http-client.env.json` to be copied per the manifest. Port allocation is handled automatically.

### Logging

This service uses Pino for structured logging. See [root CLAUDE.md - Logging Strategy](../../CLAUDE.md#logging-strategy) for comprehensive patterns.

**Quick Example**:

```typescript
@Injectable()
export class ProductService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ProductService.name); // Always set context
  }

  async doSomething(id: string) {
    this.logger.info({ id }, "Doing something"); // Structured logging
  }
}
```

---

## Summary

This service provides:

✅ **Clean architecture** with ports and adapters
✅ **Full authentication** with JWT and role-based access
✅ **Comprehensive logging** with Pino
✅ **API documentation** with Swagger
✅ **Health checks** with Terminus
✅ **Type-safe** domain models and DTOs
✅ **Exception handling** with domain-specific filters
✅ **Production-ready** patterns and best practices
✅ **Comprehensive testing** (unit, component, integration)

**For architectural patterns, best practices, and monorepo-level documentation**, see:

- [Root CLAUDE.md](../../CLAUDE.md) - Comprehensive architectural patterns and testing strategies
- [Module Creation Guide](../../docs/templates/service-template/MODULE_TEMPLATE.md) - Step-by-step module creation
- [Testing Checklist](../../docs/templates/service-template/TESTING_CHECKLIST.md) - Testing setup guide

Follow this guide and the linked documentation to maintain consistency and code quality across all modules.
