# Example Service - Clean Architecture Guide

This service is built with **clean architecture** (hexagonal architecture) using the **ports and adapters pattern**. It provides a production-ready starting point for building scalable, testable, and maintainable NestJS applications.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Module Structure](#module-structure)
- [Dependency Flow](#dependency-flow)
- [Logging Strategy](#logging-strategy)
- [Development Workflow - Git Worktrees](#development-workflow---git-worktrees)
- [How to Extend](#how-to-extend)
- [Best Practices](#best-practices)
- [Testing](#testing)

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

## Core Concepts

### 1. Ports and Adapters

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

### 2. Domain Layer

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

### 3. Application Layer

**Services**: Orchestrate business logic and coordinate between ports.

```typescript
@Injectable()
export class ProductService {
  constructor(
    @Inject("ProductRepository")
    private readonly repository: ProductRepository,
    private readonly logger: PinoLogger,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    this.logger.info({ sku: dto.sku }, "Creating product");

    // Business logic
    const product: Product = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.repository.save(product);
  }
}
```

### 4. Inbound Layer

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
    return this.toDto(product);
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

---

## Module Structure

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

---

## Dependency Flow

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

---

## Logging Strategy

This service uses **Pino** via `nestjs-pino` for structured, high-performance logging.

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

    try {
      const product = await this.repository.save(product);
      this.logger.info(
        { productId: product.id },
        "Product created successfully",
      );
      return product;
    } catch (error) {
      this.logger.error({ error, sku: dto.sku }, "Failed to create product");
      throw error;
    }
  }
}
```

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

### Local Development

Logs are pretty-printed in development:

```
[10:30:15] INFO (ProductService): Creating product
    sku: "MOUSE-001"
    name: "Wireless Mouse"
[10:30:15] INFO (ProductService): Product created successfully
    productId: "550e8400-e29b-41d4-a716-446655440000"
```

### Production

Logs are JSON in production for log aggregation:

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

## Development Workflow - Git Worktrees

This monorepo supports **git worktrees** for working on multiple branches simultaneously. The `/worktree` skill automates worktree creation with intelligent port allocation and environment setup.

### Why Use Worktrees?

**Problem**: Switching branches disrupts your development flow:

- Loses running dev server state
- Requires reinstalling dependencies if package.json changed
- Can't compare behavior between branches easily

**Solution**: Worktrees let you have multiple checkouts of the same repo:

- Keep `main` running on port 8000 while developing on port 8001
- Compare API behavior between branches side-by-side
- Run tests on one branch while coding on another

### Quick Start

```bash
# Create worktree for a feature branch
/worktree create feat/new-api

# Switch to the new worktree
cd ../monorepo-project-template-feat-new-api

# Start development server (automatically uses port 8001)
cd apps/example-service
pnpm dev

# Work on your feature...

# When done, return to main repo and close worktree
cd /path/to/monorepo-project-template
/worktree close feat-new-api
```

### Port Allocation Strategy

Each worktree gets unique ports to avoid conflicts:

| Worktree     | PORT | OTEL_METRICS_PORT | OTEL_EXPORTER_OTLP_ENDPOINT |
| ------------ | ---- | ----------------- | --------------------------- |
| Main repo    | 8000 | 9464              | http://localhost:4318       |
| 1st worktree | 8001 | 9465              | http://localhost:4318       |
| 2nd worktree | 8002 | 9466              | http://localhost:4318       |
| 3rd worktree | 8003 | 9467              | http://localhost:4318       |

**Note**: Infrastructure services (Jaeger, Prometheus, Grafana) run on shared ports and are **shared across all worktrees**.

### Automatic Environment Setup

When creating a worktree, the skill automatically:

1. **Creates git worktree** as sibling directory
2. **Allocates unique ports** from the registry
3. **Copies important files** per manifest:
   - `.env.local` (ports updated automatically)
   - `requests/http-client.env.json` (baseUrl updated to new port)
   - Any other tracked credential/config files
4. **Transforms files** to use new ports
5. **Installs dependencies** with `pnpm install`
6. **Updates registry** to track worktree and prevent port collisions

**Files NOT copied:**

- `node_modules/` (always reinstalled)
- Build output (`dist/`, `.next/`)
- Git-tracked files (automatically present)

### File Manifest

The worktree skill uses a declarative manifest to know which files to copy. See `.claude/skills/worktree/config/file-manifest.json`:

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
          "description": "Local environment configuration with ports"
        },
        {
          "source": "requests/http-client.env.json",
          "destination": "requests/http-client.env.json",
          "required": false,
          "transform": "update_base_url",
          "description": "HTTP client JWT tokens and baseUrl"
        }
      ]
    }
  }
}
```

### CRITICAL: Maintaining the File Manifest

**IMPORTANT RULE**: When you add new untracked important files that should be copied to worktrees, you **MUST** update the file manifest.

**Files to include:**

- ✅ Environment configs (`.env.local`, `.env.test.local`)
- ✅ Authentication tokens (`requests/http-client.env.json`)
- ✅ Local credentials (`cookie.txt`, API keys, certificates)
- ✅ Local test data or fixtures that aren't in git

**Files to exclude:**

- ❌ `node_modules/` (always excluded, reinstalled instead)
- ❌ Build output (`dist/`, `.turbo/`, `.next/`)
- ❌ IDE configs (`.vscode/`, `.idea/`)
- ❌ Git-tracked files (automatically present in worktree)

**Example**: Adding a new credential file

```bash
# You add a new local file
echo "my-secret-key" > apps/example-service/.api-key

# You MUST update the manifest
vim .claude/skills/worktree/config/file-manifest.json
```

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
          "description": "Local environment configuration with ports"
        },
        {
          "source": "requests/http-client.env.json",
          "destination": "requests/http-client.env.json",
          "required": false,
          "transform": "update_base_url",
          "description": "HTTP client JWT tokens and baseUrl"
        },
        {
          "source": ".api-key",
          "destination": ".api-key",
          "required": false,
          "transform": "none",
          "description": "API key for external service"
        }
      ]
    }
  }
}
```

### Available Commands

See `.claude/skills/worktree/SKILL.md` for comprehensive documentation. Quick reference:

```bash
# Create worktree
/worktree create <branch-name> [custom-name]

# List all worktrees with their ports
/worktree list

# Close and cleanup worktree
/worktree close <worktree-name> [--force]
```

### Common Workflows

**Comparing branches:**

```bash
# Terminal 1: Run stable version
cd apps/example-service
pnpm dev  # Port 8000

# Terminal 2: Create and run experimental version
/worktree create feat/experiment
cd ../monorepo-project-template-feat-experiment/apps/example-service
pnpm dev  # Port 8001

# Compare behavior
curl localhost:8000/health  # Stable
curl localhost:8001/health  # Experimental
```

**Working on multiple features:**

```bash
# Create worktrees for different features
/worktree create feat/api-v2 api-v2
/worktree create feat/auth-refactor auth-work

# Switch between them as needed
cd ../monorepo-project-template-api-v2
cd ../monorepo-project-template-auth-work

# List to see all active worktrees
/worktree list
```

### Observability with Worktrees

All worktrees share the same observability infrastructure:

- **Jaeger** (http://localhost:16686) - View traces from all worktrees
- **Prometheus** (http://localhost:9090) - Metrics aggregated from all ports
- **Grafana** (http://localhost:3001) - Dashboards show all services

**Tip**: Use service instance labels to differentiate:

- Main repo traces tagged with `service.instance.id` including port 8000
- Worktree traces tagged with port 8001, 8002, etc.

### Troubleshooting

**Port already in use:**

- The skill automatically finds the next available port
- Check which ports are allocated: `/worktree list`

**File not copied to worktree:**

- Check if it's in the manifest: `.claude/skills/worktree/config/file-manifest.json`
- Add it if needed (see "Maintaining the File Manifest" above)

**Worktree out of sync:**

```bash
# Force cleanup
/worktree close worktree-name --force

# Or manually prune
git worktree prune
```

For more details, see `.claude/skills/worktree/SKILL.md`.

---

## How to Extend

### Adding a New Module

**Example**: Adding a "Category" module

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

5. **Create adapter** (`outbound/adapters/in-memory-category.repository.ts`):

```typescript
@Injectable()
export class InMemoryCategoryRepository implements CategoryRepository {
  private categories = new Map<CategoryId, Category>();

  async save(category: Category): Promise<Category> {
    this.logger.debug({ categoryId: category.id }, "Saving category");
    this.categories.set(category.id, category);
    return category;
  }
  // ... implement other methods
}
```

6. **Create DTOs** (`application/dto/`):

```typescript
export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description!: string;
}
```

7. **Create service** (`application/category.service.ts`):

```typescript
@Injectable()
export class CategoryService {
  constructor(
    @Inject("CategoryRepository")
    private readonly repository: CategoryRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CategoryService.name);
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    this.logger.info({ name: dto.name }, "Creating category");
    const category: Category = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.repository.save(category);
  }
}
```

8. **Create controller** (`inbound/category.controller.ts`):

```typescript
@ApiTags("categories")
@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: "Create category" })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.createCategory(dto);
  }
}
```

9. **Create exception filter** (`inbound/category-exception.filter.ts`):

```typescript
@Catch(CategoryNotFoundError)
export class CategoryExceptionFilter implements ExceptionFilter {
  catch(exception: CategoryNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.NOT_FOUND).json({
      statusCode: HttpStatus.NOT_FOUND,
      message: exception.message,
    });
  }
}
```

10. **Create module** (`category.module.ts`):

```typescript
@Module({
  imports: [SharedModule, AuthModule],
  controllers: [CategoryController],
  providers: [
    CategoryService,
    {
      provide: "CategoryRepository",
      useClass: InMemoryCategoryRepository,
    },
  ],
  exports: [CategoryService],
})
export class CategoryModule {}
```

11. **Register in AppModule** (`app.module.ts`):

```typescript
@Module({
  imports: [
    SharedModule,
    AuthModule,
    HealthModule,
    ProductModule,
    CategoryModule, // Add here
  ],
})
export class AppModule {}
```

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
}
```

**❌ Bad**: Don't expose domain entities directly

```typescript
@Post()
async create(@Body() product: Product): Promise<Product> {  // Bad
  return this.service.create(product)
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

**Steps to add new environment variables:**

1. Add to appropriate schema in `src/shared/config/schemas/[namespace].config.schema.ts`
2. Add validation decorators (`@IsString()`, `@IsNumber()`, `@IsUrl()`, etc.)
3. Add to `loadConfig()` in `config.loader.ts`
4. Update `.env.example`
5. Update `CONFIG.md`

See [Configuration](#configuration) section and `CONFIG.md` for details.

---

## Testing

This service uses a **comprehensive, strategic testing approach** with separate **unit tests** and **integration tests** to achieve high coverage without excessive tests.

### Testing Philosophy

**Key Principles:**

- ✅ **Meaningful over exhaustive**: Focus on valuable tests, not test count
- ✅ **ECP & BVA**: Use Equivalence Class Partitioning and Boundary Value Analysis for strategic coverage
- ✅ **Separation of concerns**: Unit tests for logic, integration tests for HTTP flow
- ✅ **High coverage with focus**: 100% unit coverage on business logic, 93%+ integration coverage on API layer

### Test Structure

```
test/
├── fixtures/                    # Test data and boundary values
│   └── product.fixtures.ts      # Product test data, BOUNDARY_VALUES
├── helpers/                     # Reusable test utilities
│   ├── mock-logger.factory.ts  # Mock PinoLogger
│   ├── jwt.factory.ts          # JWT token generation
│   └── test-app.factory.ts     # NestJS app factory
├── integration/                 # HTTP integration tests
│   ├── product.integration-spec.ts
│   └── health.integration-spec.ts
└── jest-integration.json        # Integration test config

src/
└── */                           # Co-located unit tests
    ├── **/*.spec.ts             # Unit tests next to source
    └── **/*.ts                  # Source files
```

### Coverage Strategy

**Two Separate Coverage Reports:**

1. **Unit Test Coverage: 100%**
   - Business logic (Services)
   - Data access (Repositories)
   - Authorization (Guards)
   - Pure logic without HTTP concerns

2. **Integration Test Coverage: 93.91%**
   - Full HTTP request/response cycle
   - Controllers
   - Exception filters
   - Validation pipes
   - Authentication flow
   - End-to-end scenarios

**Excluded from Unit Test Coverage:**

Files covered by integration tests or infrastructure:

```json
{
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.spec.ts", // Test files
    "!**/*.dto.ts", // DTOs (validated in integration)
    "!**/*.entity.ts", // Domain types
    "!**/*.port.ts", // Interfaces
    "!**/*.error.ts", // Domain errors
    "!**/main.ts", // Bootstrap
    "!**/*.module.ts", // Module definitions
    "!**/*.controller.ts", // Covered by integration tests
    "!**/*.filter.ts", // Covered by integration tests
    "!**/*.decorator.ts", // Covered by integration tests
    "!**/config/**", // Configuration
    "!**/indicators/**", // Health indicators (integration)
    "!**/adapters/simple-*.ts", // Simple adapters
    "!**/auth/application/auth.service.ts" // Simple wrapper
  ]
}
```

### Test Commands

```bash
# Unit Tests (72 tests - 100% coverage)
pnpm test:unit              # Run unit tests
pnpm test:cov:unit          # With coverage report

# Integration Tests (31 tests - 93.91% coverage)
pnpm test:integration       # Run integration tests
pnpm test:integration:cov   # With coverage report

# All Tests (103 tests total)
pnpm test:all               # Run both unit + integration

# Development
pnpm test:watch             # Watch mode
pnpm test:debug             # Debug mode
pnpm test                   # Run all unit tests (default)
```

### Writing Unit Tests

Unit tests focus on **isolated business logic** with mocked dependencies.

**Location**: Co-located next to source files (`*.spec.ts`)

**Example: Testing a Service**

```typescript
import { ProductService } from "./product.service";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import {
  createTestProductDto,
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
      // Arrange
      const dto = createTestProductDto({ sku: "TEST-001" });
      mockRepository.findBySku.mockResolvedValue(null); // No conflict
      mockRepository.save.mockImplementation(async (p) => p);

      // Act
      const result = await service.createProduct(dto);

      // Assert
      expect(result.name).toBe(dto.name);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          sku: dto.sku,
          price: dto.price,
        }),
      );
    });

    it("should throw when SKU exists (ECP: Invalid - Duplicate)", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: "EXISTING-SKU" });
      const existing = createTestProduct({ sku: "EXISTING-SKU" });
      mockRepository.findBySku.mockResolvedValue(existing);

      // Act & Assert
      await expect(service.createProduct(dto)).rejects.toThrow(
        ProductAlreadyExistsError,
      );
    });

    it("should accept minimum valid price (BVA: Lower boundary)", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: "MIN-PRICE",
        price: BOUNDARY_VALUES.price.valid.minimum, // 0.01
      });
      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (p) => p);

      // Act
      const result = await service.createProduct(dto);

      // Assert
      expect(result.price).toBe(0.01);
    });
  });
});
```

**Example: Testing a Repository**

```typescript
describe("InMemoryProductRepository", () => {
  let repository: InMemoryProductRepository;

  beforeEach(() => {
    repository = new InMemoryProductRepository(createMockLogger());
  });

  it("should save and retrieve product by ID", async () => {
    // Arrange
    const product = createTestProduct({ id: "test-123" });

    // Act
    await repository.save(product);
    const result = await repository.findById("test-123");

    // Assert
    expect(result).toEqual(product);
  });

  it("should support pagination with limit (BVA)", async () => {
    // Arrange - Create 10 products
    for (let i = 0; i < 10; i++) {
      await repository.save(createTestProduct({ id: `product-${i}` }));
    }

    // Act
    const result = await repository.findAll({ limit: 5, offset: 0 });

    // Assert
    expect(result.products).toHaveLength(5);
    expect(result.total).toBe(10);
  });
});
```

**Example: Testing Guards**

```typescript
describe("JwtAuthGuard", () => {
  it("should allow access with valid Bearer token (ECP: Valid)", async () => {
    // Arrange
    const mockUser: User = {
      id: "1",
      email: "test@test.com",
      name: "Test",
      roles: ["user"],
    };
    mockReflector.getAllAndOverride.mockReturnValue(false); // Not public
    mockAuthService.validateToken.mockResolvedValue(mockUser);

    const request = mockContext.switchToHttp().getRequest();
    request.headers.authorization = "Bearer valid-token-string";

    // Act
    const result = await guard.canActivate(mockContext);

    // Assert
    expect(result).toBe(true);
    expect(mockAuthService.validateToken).toHaveBeenCalledWith(
      "valid-token-string",
    );
    expect(request.user).toEqual(mockUser);
  });

  it("should throw when header missing (ECP: Invalid - Missing auth)", async () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue(false);
    // No authorization header

    // Act & Assert
    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

### Writing Integration Tests

Integration tests focus on **full HTTP request/response cycles** through the actual application.

**Location**: `test/integration/*.integration-spec.ts`

**Setup:**

```typescript
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.factory";
import { createAdminToken, createUserToken } from "../helpers/jwt.factory";
import {
  createTestProductDto,
  BOUNDARY_VALUES,
} from "../fixtures/product.fixtures";

describe("Product API (Integration)", () => {
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

  // Tests here...
});
```

**Example: Testing API Endpoints with ECP & BVA**

```typescript
describe("POST /products (ECP + BVA)", () => {
  it("should create product as admin (ECP: Valid admin)", async () => {
    // Arrange
    const dto = createTestProductDto({ sku: `TEST-CREATE-${Date.now()}` });

    // Act & Assert
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
    expect(response.body.id).toBeDefined();
  });

  it("should return 401 when no auth token provided (ECP: Invalid - No auth)", async () => {
    // Arrange
    const dto = createTestProductDto();

    // Act & Assert
    await request(app.getHttpServer()).post("/products").send(dto).expect(401);
  });

  it("should return 403 when user role tries to create (ECP: Invalid - Wrong role)", async () => {
    // Arrange
    const dto = createTestProductDto({ sku: `TEST-USER-${Date.now()}` });

    // Act & Assert
    await request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send(dto)
      .expect(403);
  });

  it("should return 400 for negative price (BVA: Below minimum)", async () => {
    // Arrange
    const dto = createTestProductDto({
      sku: `TEST-NEG-PRICE-${Date.now()}`,
      price: BOUNDARY_VALUES.price.invalid.negative, // -1
    });

    // Act & Assert
    const response = await request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(dto)
      .expect(400);

    // Validation errors come as an array
    expect(Array.isArray(response.body.message)).toBe(true);
    expect(
      response.body.message.some((msg: string) => msg.includes("positive")),
    ).toBe(true);
  });

  it("should accept minimum valid price (BVA: Lower boundary)", async () => {
    // Arrange
    const dto = createTestProductDto({
      sku: `TEST-MIN-PRICE-${Date.now()}`,
      price: BOUNDARY_VALUES.price.valid.minimum, // 0.01
    });

    // Act & Assert
    const response = await request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(dto)
      .expect(201);

    expect(response.body.price).toBe(0.01);
  });
});
```

### Test Helpers & Fixtures

**Mock Logger Factory** (`test/helpers/mock-logger.factory.ts`):

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

**JWT Token Factory** (`test/helpers/jwt.factory.ts`):

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

export function createUserToken(): string {
  return jwt.sign(
    {
      sub: "regular-user-id",
      email: "user@example.com",
      name: "Regular User",
      roles: ["user"],
    },
    process.env.JWT_SECRET || "dev-secret-change-in-production",
    { expiresIn: "1h" },
  );
}
```

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
```

### ECP & BVA in Practice

**Equivalence Class Partitioning (ECP):**

Group inputs into classes that should behave the same way:

- **Valid Classes**: Admin with token, User with token
- **Invalid Classes**: No token, Invalid token, Wrong role, Malformed data

**Boundary Value Analysis (BVA):**

Test at boundaries where behavior changes:

- **Price**: 0 (invalid), 0.01 (minimum valid), negative (invalid)
- **Stock**: -1 (invalid), 0 (valid boundary), 1 (normal)
- **Pagination**: limit=0, limit=1, offset at total count
- **String Length**: maxLength-1, maxLength, maxLength+1

### Coverage Reports

**View Coverage:**

```bash
# Unit test coverage (100%)
pnpm test:cov:unit
open coverage/index.html

# Integration test coverage (93.91%)
pnpm test:integration:cov
open coverage-integration/index.html
```

**Coverage Thresholds:**

Unit tests enforce minimum thresholds:

```json
{
  "coverageThreshold": {
    "global": {
      "lines": 80,
      "branches": 75,
      "functions": 80,
      "statements": 80
    }
  }
}
```

### Best Practices

**✅ DO:**

- Use ECP to identify test classes (valid/invalid scenarios)
- Use BVA to test boundary conditions
- Co-locate unit tests with source files
- Put integration tests in `test/integration/`
- Use test fixtures for reusable test data
- Test error paths and edge cases
- Mock external dependencies in unit tests
- Use real HTTP requests in integration tests
- Name tests clearly: `should [action] when [condition] (ECP/BVA: [category])`

**❌ DON'T:**

- Write redundant tests that cover the same equivalence class
- Test implementation details (private methods)
- Mix unit and integration test concerns
- Skip error case testing
- Hardcode test data (use fixtures)
- Test framework code (controllers in unit tests)
- Create tests just to increase coverage numbers

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

### Adding New Config

**IMPORTANT**: All environment variables MUST be validated through config schemas. Never read `process.env` directly in services.

**Steps**:

1. Add property to schema in `src/shared/config/schemas/[namespace].config.schema.ts`
2. Add validation decorators (`@IsString()`, `@IsNumber()`, etc.)
3. Add to `loadConfig()` in `config.loader.ts`
4. Update `.env.example`
5. Update `CONFIG.md`

**Example**: Adding a database URL to app namespace:

```typescript
// src/shared/config/schemas/app.config.schema.ts
export class AppConfigSchema {
  // ... existing properties ...

  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;
}

// Then use in services:
const dbUrl = this.config.app.DATABASE_URL; // ✅ Validated & type-safe
```

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

Follow this guide when extending the service to maintain consistency and code quality across all modules.
