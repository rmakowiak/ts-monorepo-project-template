# Module Creation Guide

This guide provides step-by-step instructions for adding a new module to your NestJS service following clean architecture principles.

## Prerequisites

- Understanding of hexagonal architecture (ports and adapters pattern)
- Familiarity with NestJS dependency injection
- Knowledge of TypeScript and domain-driven design concepts

## Module Structure

Every feature module should follow this structure:

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

## Step-by-Step Guide

### Example: Adding a "Category" Module

#### Step 1: Create Folder Structure

```bash
mkdir -p src/category/{inbound,application/dto,domain,outbound/{ports,adapters}}
```

#### Step 2: Define Domain Model

Create `domain/category.entity.ts`:

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

**Key Points:**

- Use `Readonly<>` for immutability
- Use type aliases for IDs
- Include audit timestamps

#### Step 3: Create Domain Errors

Create `domain/category.error.ts`:

```typescript
export class CategoryNotFoundError extends Error {
  constructor(id: CategoryId) {
    super(`Category not found: ${id}`);
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Category already exists: ${name}`);
    this.name = "CategoryAlreadyExistsError";
  }
}
```

**Key Points:**

- Extend `Error` class
- Set meaningful error names
- Include relevant context in error messages

#### Step 4: Define Repository Port

Create `outbound/ports/category-repository.port.ts`:

```typescript
import type { Category, CategoryId } from "../../domain/category.entity";

export type CategoryRepository = {
  save(category: Category): Promise<Category>;
  findById(id: CategoryId): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  delete(id: CategoryId): Promise<void>;
};
```

**Key Points:**

- Use type alias, not interface
- Return `null` for not found (don't throw)
- Keep methods focused and single-purpose

#### Step 5: Create Repository Adapter

Create `outbound/adapters/in-memory-category.repository.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { Category, CategoryId } from "../../domain/category.entity";
import type { CategoryRepository } from "../ports/category-repository.port";

@Injectable()
export class InMemoryCategoryRepository implements CategoryRepository {
  private categories = new Map<CategoryId, Category>();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(InMemoryCategoryRepository.name);
  }

  async save(category: Category): Promise<Category> {
    this.logger.debug({ categoryId: category.id }, "Saving category");
    this.categories.set(category.id, category);
    return category;
  }

  async findById(id: CategoryId): Promise<Category | null> {
    this.logger.debug({ categoryId: id }, "Finding category by ID");
    return this.categories.get(id) ?? null;
  }

  async findByName(name: string): Promise<Category | null> {
    this.logger.debug({ name }, "Finding category by name");
    const category = Array.from(this.categories.values()).find(
      (c) => c.name === name,
    );
    return category ?? null;
  }

  async findAll(): Promise<Category[]> {
    this.logger.debug("Finding all categories");
    return Array.from(this.categories.values());
  }

  async delete(id: CategoryId): Promise<void> {
    this.logger.debug({ categoryId: id }, "Deleting category");
    this.categories.delete(id);
  }
}
```

**Key Points:**

- Implement the port interface
- Log all operations
- Use `@Injectable()` decorator

#### Step 6: Create DTOs

Create `application/dto/create-category.dto.ts`:

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ description: "Category name", example: "Electronics" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: "Category description",
    example: "Electronic devices",
  })
  @IsString()
  @MaxLength(500)
  description!: string;
}
```

Create `application/dto/update-category.dto.ts`:

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCategoryDto {
  @ApiProperty({
    description: "Category name",
    example: "Electronics",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: "Category description",
    example: "Electronic devices",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

Create `application/dto/category-response.dto.ts`:

```typescript
import { ApiProperty } from "@nestjs/swagger";
import type { Category } from "../../domain/category.entity";

export class CategoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromDomain(category: Category): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.description = category.description;
    dto.createdAt = category.createdAt.toISOString();
    dto.updatedAt = category.updatedAt.toISOString();
    return dto;
  }
}
```

**Key Points:**

- Use validation decorators (`@IsString()`, `@MaxLength()`, etc.)
- Add Swagger documentation with `@ApiProperty()`
- Create static mapper methods for response DTOs

#### Step 7: Create Service

Create `application/category.service.ts`:

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PinoLogger } from "nestjs-pino";
import type { Category, CategoryId } from "../domain/category.entity";
import {
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
} from "../domain/category.error";
import type { CategoryRepository } from "../outbound/ports/category-repository.port";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

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

    // Check for duplicates
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new CategoryAlreadyExistsError(dto.name);
    }

    const category: Category = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.repository.save(category);
  }

  async getCategoryById(id: CategoryId): Promise<Category> {
    this.logger.debug({ categoryId: id }, "Getting category by ID");

    const category = await this.repository.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id);
    }

    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    this.logger.debug("Getting all categories");
    return this.repository.findAll();
  }

  async updateCategory(
    id: CategoryId,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    this.logger.info({ categoryId: id }, "Updating category");

    const category = await this.getCategoryById(id); // Throws if not found

    // Check for name conflicts if name is being changed
    if (dto.name && dto.name !== category.name) {
      const existing = await this.repository.findByName(dto.name);
      if (existing) {
        throw new CategoryAlreadyExistsError(dto.name);
      }
    }

    const updated: Category = {
      ...category,
      ...(dto.name && { name: dto.name }),
      ...(dto.description && { description: dto.description }),
      updatedAt: new Date(),
    };

    return this.repository.save(updated);
  }

  async deleteCategory(id: CategoryId): Promise<void> {
    this.logger.info({ categoryId: id }, "Deleting category");

    // Verify exists before deleting
    await this.getCategoryById(id);

    await this.repository.delete(id);
  }
}
```

**Key Points:**

- Inject port (interface), not adapter (concrete class)
- Set logger context in constructor
- Log important business operations
- Throw domain errors for business rule violations
- Verify entity exists before operations

#### Step 8: Create Controller

Create `inbound/category.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "~/auth/guards/jwt-auth.guard";
import { Roles } from "~/auth/decorators/roles.decorator";
import { RolesGuard } from "~/auth/guards/roles.guard";
import { CategoryService } from "../application/category.service";
import { CreateCategoryDto } from "../application/dto/create-category.dto";
import { UpdateCategoryDto } from "../application/dto/update-category.dto";
import { CategoryResponseDto } from "../application/dto/category-response.dto";
import { CategoryExceptionFilter } from "./category-exception.filter";

@ApiTags("categories")
@Controller("categories")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(CategoryExceptionFilter)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new category" })
  @ApiResponse({
    status: 201,
    description: "Created",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 409, description: "Category already exists" })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoryService.createCategory(dto);
    return CategoryResponseDto.fromDomain(category);
  }

  @Get()
  @ApiOperation({ summary: "Get all categories" })
  @ApiResponse({
    status: 200,
    description: "Success",
    type: [CategoryResponseDto],
  })
  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryService.getAllCategories();
    return categories.map(CategoryResponseDto.fromDomain);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category by ID" })
  @ApiResponse({
    status: 200,
    description: "Success",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findOne(@Param("id") id: string): Promise<CategoryResponseDto> {
    const category = await this.categoryService.getCategoryById(id);
    return CategoryResponseDto.fromDomain(category);
  }

  @Put(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Update category" })
  @ApiResponse({
    status: 200,
    description: "Updated",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({ status: 409, description: "Category name already exists" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryService.updateCategory(id, dto);
    return CategoryResponseDto.fromDomain(category);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete category" })
  @ApiResponse({ status: 204, description: "Deleted" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async remove(@Param("id") id: string): Promise<void> {
    await this.categoryService.deleteCategory(id);
  }
}
```

**Key Points:**

- Use guards for authentication/authorization
- Add Swagger documentation
- Convert domain entities to response DTOs
- Use proper HTTP status codes

#### Step 9: Create Exception Filter

Create `inbound/category-exception.filter.ts`:

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import {
  CategoryNotFoundError,
  CategoryAlreadyExistsError,
} from "../domain/category.error";

@Catch(CategoryNotFoundError)
export class CategoryNotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: CategoryNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.NOT_FOUND).json({
      statusCode: HttpStatus.NOT_FOUND,
      message: exception.message,
      error: "Not Found",
    });
  }
}

@Catch(CategoryAlreadyExistsError)
export class CategoryAlreadyExistsExceptionFilter implements ExceptionFilter {
  catch(exception: CategoryAlreadyExistsError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.CONFLICT).json({
      statusCode: HttpStatus.CONFLICT,
      message: exception.message,
      error: "Conflict",
    });
  }
}

// Combined filter for convenience
@Catch(CategoryNotFoundError, CategoryAlreadyExistsError)
export class CategoryExceptionFilter implements ExceptionFilter {
  catch(
    exception: CategoryNotFoundError | CategoryAlreadyExistsError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof CategoryNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: exception.message,
        error: "Not Found",
      });
    } else if (exception instanceof CategoryAlreadyExistsError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: exception.message,
        error: "Conflict",
      });
    }
  }
}
```

**Key Points:**

- Map domain errors to HTTP status codes
- Use `@Catch()` decorator with specific error types
- Provide consistent error response format

#### Step 10: Create Module

Create `category.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { SharedModule } from "~/shared/shared.module";
import { AuthModule } from "~/auth/auth.module";
import { CategoryController } from "./inbound/category.controller";
import { CategoryService } from "./application/category.service";
import { InMemoryCategoryRepository } from "./outbound/adapters/in-memory-category.repository";

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

**Key Points:**

- Import `SharedModule` for config and logging
- Import `AuthModule` for guards
- Bind port to adapter using string token
- Export service if other modules need it

#### Step 11: Register in AppModule

Update `app.module.ts`:

```typescript
@Module({
  imports: [
    SharedModule,
    AuthModule,
    HealthModule,
    ProductModule,
    CategoryModule, // Add your new module here
  ],
})
export class AppModule {}
```

## Testing Your Module

After creating your module, add comprehensive tests following the three-tier testing approach. See the root CLAUDE.md "Testing Implementation Patterns" section and service-specific testing documentation for details.

### Quick Testing Checklist

- [ ] Unit tests for service (100% coverage)
- [ ] Unit tests for repository
- [ ] Component tests for API endpoints (HTTP flow)
- [ ] Integration tests if using real database
- [ ] Test boundary values and edge cases
- [ ] Test error scenarios

## Common Patterns

### Pattern: Checking for Existence Before Operations

```typescript
async updateEntity(id: string, dto: UpdateDto): Promise<Entity> {
  const entity = await this.getEntityById(id); // Throws if not found

  const updated: Entity = {
    ...entity,
    ...dto,
    updatedAt: new Date(),
  };

  return this.repository.save(updated);
}
```

### Pattern: Preventing Duplicates

```typescript
async createEntity(dto: CreateDto): Promise<Entity> {
  const existing = await this.repository.findByUniqueField(dto.uniqueField);
  if (existing) {
    throw new EntityAlreadyExistsError(dto.uniqueField);
  }

  // Create new entity...
}
```

### Pattern: Pagination Support

```typescript
// In port definition
export type EntityRepository = {
  findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ entities: Entity[]; total: number }>;
};

// In service
async getAllEntities(limit = 20, offset = 0) {
  return this.repository.findAll({ limit, offset });
}
```

## Best Practices Checklist

- [ ] Use `Readonly<>` for domain entities
- [ ] Create domain-specific errors
- [ ] Define ports as type aliases, not interfaces
- [ ] Inject ports, not adapters
- [ ] Set logger context in constructors
- [ ] Log important business operations
- [ ] Use DTOs for API boundaries
- [ ] Add Swagger documentation
- [ ] Create exception filters for domain errors
- [ ] Export service if needed by other modules
- [ ] Add validation decorators to DTOs
- [ ] Write comprehensive tests

## Next Steps

1. Review the service's specific CLAUDE.md for service-specific patterns
2. Check existing modules for examples (e.g., `product/`, `auth/`)
3. See root CLAUDE.md for architectural patterns and best practices
4. Add tests following the testing strategy documentation

For more information on architecture patterns, testing strategies, and configuration, see the root CLAUDE.md file.
