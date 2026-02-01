# Monorepo Project Template - Developer Guide

This document provides guidance for working with this TypeScript monorepo template, including architectural patterns, testing strategies, and best practices that apply across all services.

## Table of Contents

- [Project Structure](#project-structure)
- [Service Architecture Patterns](#service-architecture-patterns)
- [Testing Implementation Patterns](#testing-implementation-patterns)
- [Best Practices](#best-practices)
- [Configuration Pattern](#configuration-pattern)
- [Logging Strategy](#logging-strategy)
- [Worktree Management](#worktree-management)
- [Adding New Services](#adding-new-services)
- [Environment Variables](#environment-variables)
- [Observability Stack](#observability-stack)
- [Development Workflow](#development-workflow)

---

## Project Structure

```
monorepo-project-template/
├── apps/
│   └── example-service/          # Example NestJS service
├── packages/                      # Shared packages
├── docs/
│   └── templates/
│       └── service-template/     # Templates for new services
│           ├── SERVICE_CLAUDE_TEMPLATE.md
│           ├── MODULE_TEMPLATE.md
│           └── TESTING_CHECKLIST.md
├── scripts/
│   └── worktree/                 # Git worktree management scripts
├── observability/                # Docker Compose for monitoring stack
└── pnpm-workspace.yaml           # Monorepo workspace configuration
```

---

## Service Architecture Patterns

All services in this monorepo follow **hexagonal architecture** (clean architecture) using the **ports and adapters pattern**. This provides testability, flexibility, and maintainability.

### Architecture Overview

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

### Ports and Adapters Pattern

**Port**: An interface that defines what the application needs from the outside world.

```typescript
// Port (interface)
export type ProductRepository = {
  save(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<Product | null>;
  findAll(
    options?: QueryOptions,
  ): Promise<{ products: Product[]; total: number }>;
  delete(id: ProductId): Promise<void>;
};
```

**Adapter**: A concrete implementation of a port.

```typescript
// Adapter (implementation)
@Injectable()
export class InMemoryProductRepository implements ProductRepository {
  private products = new Map<ProductId, Product>();

  async save(product: Product): Promise<Product> {
    this.products.set(product.id, product);
    return product;
  }
  // ... other methods
}
```

**Module Registration**: Bind ports to adapters via dependency injection.

```typescript
@Module({
  providers: [
    ProductService,
    {
      provide: "ProductRepository",
      useClass: InMemoryProductRepository,
    },
  ],
})
export class ProductModule {}
```

**Service Usage**: Services depend on ports, not adapters.

```typescript
@Injectable()
export class ProductService {
  constructor(
    @Inject("ProductRepository")
    private readonly repository: ProductRepository, // Port, not adapter
  ) {}
}
```

### Standard Module Structure

Every feature module follows this structure:

```
feature-name/
├── feature-name.module.ts           # Module definition
├── guards/                          # At module root (if needed)
│   └── feature-specific.guard.ts
├── decorators/                      # At module root (if needed)
│   └── feature-specific.decorator.ts
├── inbound/                         # Controllers, filters (entry points)
│   ├── feature.controller.ts
│   └── feature-exception.filter.ts
├── application/                     # Services, DTOs (business logic)
│   ├── feature.service.ts
│   └── dto/
│       ├── create-feature.dto.ts
│       └── feature-response.dto.ts
├── domain/                          # Entities, errors (pure domain)
│   ├── feature.entity.ts
│   └── feature.error.ts
└── outbound/                        # Ports and adapters
    ├── ports/
    │   └── feature-repository.port.ts
    └── adapters/
        └── concrete-feature.repository.ts
```

**Important**: Guards, decorators, and filters go at the **module root**, NOT in `inbound/`. Only controllers and resolvers go in `inbound/`.

### Dependency Flow

Dependencies flow **inward**:

```
Controller → Service → Repository Port
                           ↓
                       Repository Adapter
```

- Controllers depend on Services
- Services depend on Ports (interfaces)
- Adapters implement Ports
- Adapters are injected via DI

**Never**:

- Domain shouldn't know about Services
- Services shouldn't know about Controllers
- Ports shouldn't know about Adapters

### Domain Layer Patterns

**Entities**: Immutable, type-safe domain models.

```typescript
export type Product = Readonly<{
  id: ProductId;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}>;
```

**Domain Errors**: Custom errors for business rule violations.

```typescript
export class ProductNotFoundError extends Error {
  constructor(id: ProductId) {
    super(`Product not found: ${id}`);
    this.name = "ProductNotFoundError";
  }
}
```

### Application Layer Patterns

**Services**: Orchestrate business logic and coordinate between ports.

```typescript
@Injectable()
export class ProductService {
  constructor(
    @Inject("ProductRepository")
    private readonly repository: ProductRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProductService.name);
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    this.logger.info({ sku: dto.sku }, "Creating product");

    // Map DTO to domain entity (explicit mapping for clarity)
    const product: Product = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      sku: dto.sku,
      price: dto.price,
      stock: dto.stock,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.repository.save(product);
  }
}
```

### Inbound Layer Patterns

**Controllers**: Handle HTTP requests, validate input, call services.

```typescript
@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new product" })
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productService.createProduct(dto);
    return ProductResponseDto.fromDomain(product);
  }
}
```

**Exception Filters**: Map domain errors to HTTP responses.

```typescript
@Catch(ProductNotFoundError)
export class ProductExceptionFilter implements ExceptionFilter {
  catch(exception: ProductNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.NOT_FOUND).json({
      statusCode: HttpStatus.NOT_FOUND,
      message: exception.message,
    });
  }
}
```

**For detailed module creation guide**, see [docs/templates/service-template/MODULE_TEMPLATE.md](docs/templates/service-template/MODULE_TEMPLATE.md).

---

## Testing Implementation Patterns

This monorepo uses a **three-tier testing approach** to achieve comprehensive coverage strategically.

### Testing Philosophy

```
┌─────────────────────────────────────┐
│       Integration Tests              │  ← HTTP → Service → Real DB
├─────────────────────────────────────┤
│       Component Tests                │  ← HTTP → Service → Mocked DB
├─────────────────────────────────────┤
│          Unit Tests                  │  ← Individual functions/classes
└─────────────────────────────────────┘
```

**Key Principles:**

- ✅ **Meaningful over exhaustive**: Focus on valuable tests, not test count
- ✅ **ECP & BVA**: Use Equivalence Class Partitioning and Boundary Value Analysis
- ✅ **Separation of concerns**: Unit tests for logic, component tests for HTTP flow, integration tests for database
- ✅ **High coverage with focus**: 100% unit coverage on business logic, 90%+ component coverage on API layer
- ✅ **Minimal integration tests**: Decision table approach for critical database scenarios only

### Test Structure Organization

**Unit tests**: Co-located next to source files (`*.spec.ts`)

```
src/
└── feature/
    ├── application/
    │   ├── feature.service.ts
    │   └── feature.service.spec.ts      # Unit test
    └── outbound/
        ├── adapters/
        │   ├── repository.adapter.ts
        │   └── repository.adapter.spec.ts # Unit test
```

**Component and Integration tests**: Separate test directory

```
test/
├── fixtures/                          # Test data and boundary values
│   └── entity.fixtures.ts
├── helpers/                           # Reusable test utilities
│   ├── mock-logger.factory.ts
│   ├── jwt.factory.ts
│   ├── test-app.factory.ts
│   └── integration-test-app.factory.ts
├── component/                         # HTTP component tests (mocked DB)
│   └── feature.component.spec.ts
└── integration/                       # Integration tests (real DB)
    └── feature.integration.spec.ts
```

### Coverage Strategy

**Three Separate Test Suites:**

1. **Unit Test Coverage: 100%**
   - Business logic (Services)
   - Data access (Repositories)
   - Authorization (Guards)
   - Pure logic without HTTP concerns

2. **Component Test Coverage: 90%+**
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

### Test Helper Patterns

**Mock Logger Factory**:

```typescript
import type { PinoLogger } from "nestjs-pino";

export function createMockLogger(): jest.Mocked<PinoLogger> {
  return {
    setContext: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    log: jest.fn(),
    assign: jest.fn(),
  } as unknown as jest.Mocked<PinoLogger>;
}
```

**JWT Token Factory**:

```typescript
import * as jwt from "jsonwebtoken";

export function createAdminToken(): string {
  return jwt.sign(
    {
      sub: "admin-user-id",
      email: "admin@example.com",
      name: "Admin User",
      roles: ["admin", "user"],
    },
    process.env.JWT_SECRET || "dev-secret-change-in-production",
    { expiresIn: "1h" },
  );
}
```

**Test App Factory (Mocked Database)**:

```typescript
import { Test } from "@nestjs/testing";
import { AppModule } from "~/app.module";

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider("ProductRepository")
    .useValue(mockRepository) // Mock the database adapter
    .compile();

  const app = moduleRef.createNestApplication();
  // Apply global pipes, filters, etc.
  await app.init();
  return app;
}
```

**Integration Test App Factory (Real Database)**:

```typescript
import { startPostgreSqlContainer } from "./test-db.factory";

export async function createIntegrationTestApp(options: {
  databaseUrl: string;
}) {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider("DATABASE_URL")
    .useValue(options.databaseUrl) // Use real testcontainer database
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
```

### ECP & BVA Methodology

**Equivalence Class Partitioning (ECP):**

Group inputs into classes that should behave the same way:

- **Valid Classes**: Admin with token, User with token, Valid data format
- **Invalid Classes**: No token, Invalid token, Wrong role, Malformed data, Duplicates

**Boundary Value Analysis (BVA):**

Test at boundaries where behavior changes:

- **Price**: 0 (invalid), 0.01 (minimum valid), negative (invalid)
- **Stock**: -1 (invalid), 0 (valid boundary), 1 (normal)
- **Pagination**: limit=0, limit=1, offset at total count
- **String Length**: maxLength-1, maxLength, maxLength+1

### Decision Table Methodology

Use decision tables to identify which scenarios truly need integration tests. Ask: "Can this be tested with unit/component tests?"

**Example Decision Table Pattern**:

| Scenario           | What It Validates                   | Why Integration Test?                    | Alternative?                               |
| ------------------ | ----------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Unique constraint  | Database enforces uniqueness        | In-memory mock can't test DB constraints | No - need real DB                          |
| Concurrent updates | Database locking/transactions       | Need real DB concurrency behavior        | No - need real DB                          |
| Soft delete        | Queries exclude deleted records     | Need real DB indexes and WHERE clauses   | Maybe - could use DB-backed component test |
| Decimal precision  | Type conversion (Decimal ↔ number) | Need real ORM/driver behavior            | No - need real stack                       |

**Key Questions for Decision Table**:

1. Does this test database constraints? → Integration test
2. Does this test ORM/query behavior? → Integration test
3. Does this test API validation? → Component test
4. Does this test business logic? → Unit test

This approach keeps integration tests minimal (5-10 tests) while maintaining confidence in critical integrations.

### Integration Test Infrastructure

Integration tests use **testcontainers** to manage ephemeral databases:

```typescript
import { PostgreSqlContainer } from "@testcontainers/postgresql";

export async function startPostgreSqlContainer() {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  return container;
}

export async function runMigrations(databaseUrl: string) {
  // Run Prisma migrations or SQL scripts
}

export async function cleanDatabase(databaseUrl: string) {
  // Truncate tables for test isolation
}
```

**Setup Pattern**:

```typescript
describe("Feature API (Integration)", () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;

  beforeAll(async () => {
    container = await startPostgreSqlContainer();
    databaseUrl = container.getConnectionString();
    await runMigrations(databaseUrl);
    app = await createIntegrationTestApp({ databaseUrl });
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(databaseUrl);
  });

  // Integration tests here...
});
```

**For comprehensive testing guide**, see [docs/templates/service-template/TESTING_CHECKLIST.md](docs/templates/service-template/TESTING_CHECKLIST.md).

---

## Best Practices

### 1. Dependency Injection

**✅ Good**: Inject ports, not adapters

```typescript
constructor(
  @Inject('ProductRepository')
  private readonly repository: ProductRepository,  // Port interface
) {}
```

**❌ Bad**: Don't inject concrete adapters

```typescript
constructor(
  private readonly repository: InMemoryProductRepository,  // Concrete class
) {}
```

### 2. Domain Errors

**✅ Good**: Throw domain-specific errors

```typescript
if (!product) {
  throw new ProductNotFoundError(id);
}
```

**❌ Bad**: Don't throw generic errors

```typescript
if (!product) {
  throw new Error("Product not found"); // Too generic
}
```

### 3. DTOs

**✅ Good**: Use DTOs for API boundaries

```typescript
// Request DTO
export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;
}

// Response DTO
export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    return dto;
  }
}
```

**❌ Bad**: Don't expose domain entities directly

```typescript
@Post()
async create(@Body() product: Product): Promise<Product> {  // Bad
  return this.service.create(product);
}
```

### 4. Immutable Entities

**✅ Good**: Use Readonly types

```typescript
export type Product = Readonly<{
  id: ProductId;
  name: string;
}>;
```

**❌ Bad**: Mutable entities

```typescript
export interface Product {
  id: string;
  name: string;
}
```

### 5. Module Exports

Only export what other modules need:

```typescript
@Module({
  providers: [ProductService, ProductRepository],
  exports: [ProductService], // Only export service
})
export class ProductModule {}
```

### 6. Environment Variable Validation

**✅ Good**: Always add new environment variables to config schemas

```typescript
// src/shared/config/schemas/app.config.schema.ts
export class AppConfigSchema {
  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;
}

// Then use via config service
const dbUrl = this.config.app.DATABASE_URL; // Type-safe, validated
```

**❌ Bad**: Don't read environment variables directly

```typescript
// Bad - no validation, not type-safe
const dbUrl = process.env.DATABASE_URL;

// Bad - bypasses config validation
const port = parseInt(process.env.PORT || "8000", 10);
```

**Why?**

- Type safety and IntelliSense
- Validation on startup (fails fast)
- Centralized configuration management
- Immutability (config can't be changed at runtime)
- Documentation in one place

---

## Configuration Pattern

All services use namespace-based configuration with class-validator for type-safe validation.

### Configuration Structure

**Namespace-based schemas**: Organize configuration into logical groups

```typescript
// src/shared/config/schemas/app.config.schema.ts
export class AppConfigSchema {
  @IsNumber()
  @Min(1000)
  @Max(65535)
  PORT!: number;

  @IsEnum(["development", "production", "test"])
  NODE_ENV!: Environment;

  @IsEnum(["fatal", "error", "warn", "info", "debug", "trace"])
  LOG_LEVEL!: LogLevel;
}

// src/shared/config/schemas/auth.config.schema.ts
export class AuthConfigSchema {
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;
}
```

### Loading Configuration

```typescript
// src/shared/config/config.loader.ts
export function loadConfig() {
  return {
    app: plainToInstance(AppConfigSchema, {
      PORT: parseInt(process.env.PORT || "8000", 10),
      NODE_ENV: process.env.NODE_ENV || "development",
      LOG_LEVEL: process.env.LOG_LEVEL || "info",
    }),
    auth: plainToInstance(AuthConfigSchema, {
      JWT_SECRET: process.env.JWT_SECRET,
    }),
  };
}
```

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
  }
}
```

### Steps to Add New Config

1. Add property to schema in `src/shared/config/schemas/[namespace].config.schema.ts`
2. Add validation decorators (`@IsString()`, `@IsNumber()`, `@IsUrl()`, etc.)
3. Add to `loadConfig()` in `config.loader.ts`
4. Update `.env.example`
5. Update service-specific `CONFIG.md`

**Example**: Adding a database URL

```typescript
// src/shared/config/schemas/app.config.schema.ts
export class AppConfigSchema {
  // ... existing properties ...

  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;
}

// Then update loadConfig()
export function loadConfig() {
  return {
    app: plainToInstance(AppConfigSchema, {
      // ... existing properties ...
      DATABASE_URL: process.env.DATABASE_URL,
    }),
  };
}
```

**For service-specific configuration**, see each service's `CONFIG.md` file.

---

## Logging Strategy

All services use **Pino** via `nestjs-pino` for structured, high-performance logging.

### Global Logger Configuration

```typescript
// main.ts
app.useLogger(app.get(Logger));
```

### Service-Level Logging

```typescript
@Injectable()
export class ProductService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ProductService.name);
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    this.logger.info({ sku: dto.sku, name: dto.name }, "Creating product");

    // Domain errors are thrown directly (no try-catch needed)
    const product = await this.repository.save(product);

    this.logger.info({ productId: product.id }, "Product created successfully");
    return product;
  }
}
```

**Note on error handling**: Use try-catch only for infrastructure errors (database connection failures, network timeouts) that need logging before re-throwing. Domain errors (business rule violations) are thrown directly and caught by exception filters.

### Logging Best Practices

1. **Set context**: Always call `logger.setContext(ClassName.name)` in constructor
2. **Structured data**: Use objects for context: `logger.info({ userId, action }, 'message')`
3. **Log levels**:
   - `fatal`: Application crash
   - `error`: Error that needs attention
   - `warn`: Something unexpected but recoverable
   - `info`: Important business events
   - `debug`: Detailed information for debugging
   - `trace`: Very verbose debugging
4. **Repository logging**: Log all database operations
5. **Service logging**: Log business decisions and orchestration
6. **Controller logging**: Usually not needed (HTTP logging is automatic)

### Development vs Production

**Development**: Pretty-printed logs

```
[10:30:15] INFO (ProductService): Creating product
    sku: "MOUSE-001"
    name: "Wireless Mouse"
```

**Production**: JSON logs for aggregation

```json
{
  "level": "info",
  "time": 1642242615,
  "context": "ProductService",
  "sku": "MOUSE-001",
  "msg": "Creating product"
}
```

---

## Worktree Management

This project includes scripts for managing git worktrees with automatic environment setup. Worktrees allow you to work on multiple branches simultaneously without context switching.

### Quick Usage

```bash
# Create a worktree (creates branch from origin/main if it doesn't exist)
./scripts/worktree/create-worktree.sh feat/my-feature

# Switch to the worktree
cd ../monorepo-project-template.worktree.feat-my-feature

# Close and cleanup worktree
./scripts/worktree/close-worktree.sh feat-my-feature

# List all worktrees
git worktree list
```

**Branch handling:**

- If you specify a branch that doesn't exist, it will automatically be created from the latest `origin/main`
- No need to create branches manually before creating worktrees

### Port Allocation Strategy

Each worktree gets unique ports to avoid conflicts:

| Worktree     | PORT | OTEL_METRICS_PORT |
| ------------ | ---- | ----------------- |
| Main repo    | 8000 | 9464              |
| 1st worktree | 8001 | 9464 (shared)     |
| 2nd worktree | 8002 | 9464 (shared)     |
| 3rd worktree | 8003 | 9464 (shared)     |

Ports are allocated dynamically by scanning existing worktrees. No registry needed - all state derived from actual `.env.local` files.

### When to Update Worktree Configuration

**Update `scripts/worktree/config/file-manifest.json` when:**

1. **Adding a new app** to the monorepo
2. **Adding new untracked files** that should be copied to worktrees:
   - Environment configs (`.env.local`, `.env.test.local`)
   - Authentication tokens (`requests/http-client.env.json`)
   - Local credentials (`cookie.txt`, API keys)

**Files to exclude** (never add these):

- `node_modules/` (always excluded, `pnpm install` runs instead)
- Build output (`dist/`, `.next/`)
- IDE configs (`.vscode/`, `.idea/`)
- Git-tracked files (copied automatically by git)

**For comprehensive worktree documentation**, see [scripts/worktree/README.md](scripts/worktree/README.md).

---

## Adding New Services

When adding a new service to the monorepo:

1. **Create service** in `apps/` or `packages/`
2. **Add to `pnpm-workspace.yaml`** if needed
3. **Update worktree manifest** (`scripts/worktree/config/file-manifest.json`)
4. **Create service CLAUDE.md** using [docs/templates/service-template/SERVICE_CLAUDE_TEMPLATE.md](docs/templates/service-template/SERVICE_CLAUDE_TEMPLATE.md)
5. **Document service-specific setup** in service's CLAUDE.md

**Templates Available:**

- [SERVICE_CLAUDE_TEMPLATE.md](docs/templates/service-template/SERVICE_CLAUDE_TEMPLATE.md) - Template for service documentation
- [MODULE_TEMPLATE.md](docs/templates/service-template/MODULE_TEMPLATE.md) - Step-by-step module creation guide
- [TESTING_CHECKLIST.md](docs/templates/service-template/TESTING_CHECKLIST.md) - Testing setup checklist

---

## Environment Variables

Standard environment variables across services:

- `PORT` - HTTP server port (unique per worktree)
- `NODE_ENV` - Environment (development, production, test)
- `LOG_LEVEL` - Logging level (fatal, error, warn, info, debug, trace)
- `JWT_SECRET` - JWT secret for authentication
- `OTEL_SERVICE_NAME` - Service name for OpenTelemetry
- `OTEL_METRICS_PORT` - OpenTelemetry metrics port (9464, shared)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP endpoint (http://localhost:4318)

**Service-specific variables**: See each service's `CONFIG.md` file.

---

## Observability Stack

The project includes a Docker Compose stack with:

- **Jaeger** (http://localhost:16686) - Distributed tracing
- **Prometheus** (http://localhost:9090) - Metrics collection
- **Grafana** (http://localhost:3001) - Dashboards and visualization

All worktrees share the same observability infrastructure on standard ports.

**Start the stack**:

```bash
cd observability
docker-compose up -d
```

---

## Development Workflow

1. **Create worktree** for feature branch
2. **Environment files automatically copied** with updated ports
3. **Dependencies installed** via `pnpm install`
4. **Work on feature** independently
5. **Close worktree** when done

See individual service `CLAUDE.md` files for service-specific guidance.

---

## Related Documentation

- [Service Template](docs/templates/service-template/SERVICE_CLAUDE_TEMPLATE.md) - Template for new services
- [Module Creation Guide](docs/templates/service-template/MODULE_TEMPLATE.md) - Step-by-step module creation
- [Testing Checklist](docs/templates/service-template/TESTING_CHECKLIST.md) - Testing setup guide
- [Worktree Scripts](scripts/worktree/README.md) - Detailed worktree documentation
- [Example Service](apps/example-service/CLAUDE.md) - Reference implementation

---

**Summary**: This monorepo provides a production-ready foundation for building TypeScript services with clean architecture, comprehensive testing, and excellent developer experience through worktree management.
