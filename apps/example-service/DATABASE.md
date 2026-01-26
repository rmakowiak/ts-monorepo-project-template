# Database Guide

This document covers database setup, management, and best practices for the example service.

## Overview

The service uses:

- **PostgreSQL 16** - Primary relational database
- **Redis 7** - Caching and session storage
- **Prisma ORM** - Type-safe database access with migrations

## Quick Start

```bash
# 1. Start databases
cd ../../infrastructure && docker-compose up -d postgres redis

# 2. Run migrations
cd apps/example-service
pnpm prisma:migrate

# 3. Seed database with sample data
pnpm prisma:seed

# 4. Start the service
pnpm dev

# 5. Verify health
curl http://localhost:8000/health
```

## Database Configuration

### Environment Variables

All database configuration is managed through validated environment variables:

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/example_dev?schema=public

# Redis Connection
REDIS_URL=redis://localhost:6379

# Database Logging (query logging for development)
DATABASE_LOGGING=false
```

### Configuration Schema

Database configuration is validated using `DatabaseConfigSchema`:

```typescript
export class DatabaseConfigSchema {
  @IsString()
  @Matches(/^postgresql:\/\//)
  readonly DATABASE_URL!: string;

  @IsString()
  @Matches(/^redis:\/\//)
  @IsOptional()
  readonly REDIS_URL?: string;

  @IsBoolean()
  @Transform(({ value }) => value === "true")
  readonly DATABASE_LOGGING!: boolean;
}
```

## Database Schema

### Models

**Product**

- Primary entity for product catalog
- UUID primary key
- Soft deletes via `isActive` flag
- Decimal precision for prices
- Indexed fields: SKU, category, active status

**Category**

- Product categorization
- UUID primary key
- Unique slug for URL-friendly lookups
- One-to-many relationship with Products

### Schema Definition

See `prisma/schema.prisma` for the complete schema:

```prisma
model Product {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(200)
  description String   @db.Text
  sku         String   @unique @db.VarChar(50)
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  categoryId  String?  @map("category_id")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([sku])
  @@index([categoryId])
  @@index([isActive])
  @@map("products")
}
```

## Prisma Commands

### Migrations

```bash
# Create and apply a new migration
pnpm prisma:migrate

# Apply migrations in production (no prompts)
pnpm prisma:migrate:deploy

# Reset database (WARNING: deletes all data)
pnpm db:reset
```

### Prisma Client

```bash
# Generate Prisma Client after schema changes
pnpm prisma:generate

# Open Prisma Studio (database GUI)
pnpm prisma:studio
```

### Database Seeding

```bash
# Run seed script
pnpm prisma:seed
```

The seed script (`prisma/seed.ts`) creates:

- 5 categories (Electronics, Accessories, Gaming, Office, Audio)
- 17 products with realistic data across all categories

## Database Access Patterns

### Using PrismaService

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "~/database/prisma.service";

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
    });
  }
}
```

### Implementing Repository Pattern

Follow the hexagonal architecture pattern:

1. **Define Port (Interface)**:

```typescript
// src/product/outbound/ports/product-repository.port.ts
export type ProductRepository = {
  save(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<Product | null>;
  findAll(): Promise<Product[]>;
};
```

2. **Implement Adapter**:

```typescript
// src/product/outbound/adapters/prisma-product.repository.ts
@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(product: Product): Promise<Product> {
    const saved = await this.prisma.product.upsert({
      where: { id: product.id },
      create: { ...product },
      update: { ...product },
    });
    return this.toDomain(saved);
  }
}
```

3. **Register in Module**:

```typescript
@Module({
  providers: [
    {
      provide: "ProductRepository",
      useClass: PrismaProductRepository,
    },
  ],
})
export class ProductModule {}
```

## Worktree Database Isolation

Each git worktree automatically gets an isolated database to prevent conflicts.

### How It Works

When creating a worktree:

```bash
./scripts/worktree/create-worktree.sh feat/add-caching
```

**The worktree script automatically:**

1. ✅ Transforms DATABASE_URL in `.env` files:

```
Main repo:  postgresql://postgres:postgres@localhost:5432/example_dev?schema=public
Worktree:   postgresql://postgres:postgres@localhost:5432/example_dev_feat_add_caching?schema=public
```

2. ✅ Creates the database: `example_dev_feat_add_caching`
3. ✅ Runs Prisma migrations (`prisma migrate deploy`)
4. ✅ Seeds the database with sample data

**Naming Pattern**: `{original_db_name}_{worktree_name_with_underscores}`

**No manual setup needed!** Everything is configured automatically.

### Manual Database Operations

If you need to manually manage databases:

**Create database:**

```bash
docker exec postgres psql -U postgres -c "CREATE DATABASE example_dev_feat_branch_name;"
```

**Run migrations:**

```bash
cd apps/example-service
pnpm prisma migrate deploy
pnpm prisma:seed
```

**Drop database:**

```bash
docker exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS example_dev_feat_branch_name;"
```

### Cleanup Worktree Databases

When closing a worktree with `./scripts/worktree/close-worktree.sh`, you'll be prompted to drop the associated database:

```bash
./scripts/worktree/close-worktree.sh feat-add-caching

Found database: example_dev_feat_add_caching
Drop this database? [y/N] y
  ✓ Database dropped
```

If you choose not to drop it, the command to drop it manually will be displayed.

## Health Checks

The service includes database health indicators for both PostgreSQL and Redis:

### PostgreSQL Health Check

- Executes `SELECT 1` query to verify connectivity
- Returns connection latency
- Fails if database is unreachable

### Redis Health Check

- Executes `PING` command
- Returns connection latency
- Fails if Redis is unreachable

### Testing Health

```bash
curl http://localhost:8000/health | jq

# Expected output includes:
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up",
      "message": "PostgreSQL is responsive",
      "latency": "3ms"
    },
    "redis": {
      "status": "up",
      "message": "Redis is responsive",
      "latency": "1ms"
    }
  }
}
```

## Development Workflow

### Making Schema Changes

1. **Edit Prisma Schema**:

```prisma
// Add new field to Product model
model Product {
  // ... existing fields
  tags String[] @default([])  // New field
}
```

2. **Create Migration**:

```bash
pnpm prisma:migrate
# Prisma will prompt for migration name
```

3. **Update Domain Entity**:

```typescript
export type Product = Readonly<{
  // ... existing fields
  tags: string[]; // Add to domain model
}>;
```

4. **Update Repository Mapping**:

```typescript
private toDomain(prismaProduct: any): Product {
  return {
    // ... existing mappings
    tags: prismaProduct.tags,
  };
}
```

### Database Logging

Enable query logging during development:

```bash
# .env
DATABASE_LOGGING=true
```

Logs will include:

- Query text
- Parameters
- Execution time
- Warnings and errors

## Production Considerations

### Connection Pooling

PrismaClient automatically manages connection pooling. Default limits:

- PostgreSQL: 10 connections per instance
- Adjust via connection string: `?connection_limit=20`

### Migrations in Production

Use `prisma:migrate:deploy` for production migrations:

```bash
pnpm prisma:migrate:deploy
```

This command:

- Applies pending migrations
- Does not prompt for input
- Fails fast on errors
- Safe for CI/CD pipelines

### Environment Variables

In production:

```bash
DATABASE_URL=postgresql://user:password@prod-host:5432/prod_db?schema=public&connection_limit=20
REDIS_URL=redis://prod-redis:6379
DATABASE_LOGGING=false  # Disable query logging in production
```

### Backup Strategy

PostgreSQL backups (recommended approach):

```bash
# Daily backup
docker exec postgres pg_dump -U postgres example_prod > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i postgres psql -U postgres example_prod < backup_20260126.sql
```

## Testing

### Unit Tests

Unit tests use in-memory repositories:

```typescript
describe("ProductService", () => {
  let mockRepository: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    };
  });
});
```

### Component Tests

Component tests use in-memory repositories (not real database):

```typescript
describe("Product API (Component)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(); // Uses in-memory repositories
  });
});
```

### E2E Tests (CI Only)

E2E tests use a separate test database:

```bash
# Test database runs on port 5433
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/example_test?schema=public

# Tests clean up after themselves
```

## Troubleshooting

### Connection Refused

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start if not running
cd infrastructure && docker-compose up -d postgres
```

### Migration Conflicts

**Problem**: `Migration already applied` or `Migration failed`

**Solution**:

```bash
# Check migration status
pnpm prisma migrate status

# Reset database (development only!)
pnpm db:reset
```

### Prisma Client Not Generated

**Problem**: `@prisma/client did not initialize`

**Solution**:

```bash
# Generate Prisma Client
pnpm prisma:generate
```

### Port Already in Use

**Problem**: `port 5432 already in use`

**Solution**:

```bash
# Find process using port
lsof -i :5432

# Stop conflicting service
brew services stop postgresql  # If using Homebrew PostgreSQL
```

## Best Practices

### 1. Always Use Migrations

Never modify the database schema manually. Always use Prisma migrations:

```bash
# ✅ Good
pnpm prisma:migrate

# ❌ Bad
docker exec postgres psql -U postgres -c "ALTER TABLE products ADD COLUMN tags text[];"
```

### 2. Soft Deletes

Use `isActive` flag for deletions to maintain data history:

```typescript
// ✅ Good - Soft delete
await this.prisma.product.update({
  where: { id },
  data: { isActive: false },
});

// ❌ Avoid - Hard delete (data loss)
await this.prisma.product.delete({ where: { id } });
```

### 3. Type Safety

Always map Prisma models to domain entities:

```typescript
// ✅ Good - Domain-driven
return this.toDomain(prismaProduct);

// ❌ Bad - Leaking Prisma types
return prismaProduct; // Exposes Decimal, Date implementation details
```

### 4. Query Optimization

Use indexes for frequently queried fields:

```prisma
model Product {
  sku String @unique @db.VarChar(50)

  @@index([sku])      // Fast lookups by SKU
  @@index([isActive]) // Fast filtering by active status
}
```

### 5. Transaction Management

Use Prisma transactions for multi-step operations:

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.product.create({ data: product });
  await tx.inventory.update({
    where: { productId: product.id },
    data: { stock: 100 },
  });
});
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Hexagonal Architecture](../CLAUDE.md#architecture-overview)
