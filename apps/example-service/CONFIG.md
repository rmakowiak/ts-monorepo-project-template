# Configuration Guide

This service uses `@nestjs/config` with `class-validator` for type-safe, validated configuration management organized into logical namespaces.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration Namespaces](#configuration-namespaces)
- [Environment Variables](#environment-variables)
- [Environment File Priority](#environment-file-priority)
- [Validation](#validation)
- [Usage in Code](#usage-in-code)
- [Adding New Configuration](#adding-new-configuration)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Development Setup

1. **Copy the example environment file**:

   ```bash
   cp .env.example .env
   ```

2. **Start the development server**:
   ```bash
   pnpm dev
   ```

### Production Setup

1. **Create production environment file** (git-ignored):

   ```bash
   cp .env.example .env.production
   ```

2. **Edit `.env.production`** with production values:

   ```bash
   # IMPORTANT: Generate a secure JWT secret
   JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Deploy and start**:
   ```bash
   pnpm build
   pnpm start
   ```

### Local Overrides

Create `.env.local` (git-ignored) for personal development overrides:

```bash
# Example: Use different port locally
echo "PORT=9000" > .env.local
echo "LOG_LEVEL=debug" >> .env.local
```

---

## Architecture

The configuration system is organized into **namespaces** for scalability and maintainability.

```
Environment Variables (.env files)
          ↓
    config.loader.ts (validates with class-validator)
          ↓
    ConfigService (stores validated config)
          ↓
    AppConfigService (type-safe wrapper with namespaces)
          ↓
    Your Services/Controllers
```

### Configuration Namespaces

| Namespace | Purpose                    | Variables                 |
| --------- | -------------------------- | ------------------------- |
| `app`     | Application-level settings | PORT, NODE_ENV, LOG_LEVEL |
| `auth`    | Authentication settings    | JWT_SECRET                |

**Future namespaces** can be added for: database, redis, email, monitoring, etc.

---

## Configuration Namespaces

### `app` Namespace

Application-level configuration for core service settings.

**Access**: `config.app.*`

**Schema**: `src/shared/config/schemas/app.config.schema.ts`

**Properties**:

- `PORT` - HTTP server port
- `NODE_ENV` - Application environment
- `LOG_LEVEL` - Logging verbosity

### `auth` Namespace

Authentication and security configuration.

**Access**: `config.auth.*`

**Schema**: `src/shared/config/schemas/auth.config.schema.ts`

**Properties**:

- `JWT_SECRET` - JWT signing secret

---

## Environment Variables

### Application Configuration (`app` namespace)

#### `PORT`

- **Description**: HTTP server port
- **Type**: Integer (1-65535)
- **Default**: `8000`
- **Validation**: Must be between 1 and 65535
- **Example**: `PORT=8000`

#### `NODE_ENV`

- **Description**: Application environment
- **Type**: Enum
- **Valid Values**: `development`, `production`, `test`
- **Default**: `development`
- **Validation**: Must be one of the allowed values
- **Examples**:
  - Development: `NODE_ENV=development`
  - Production: `NODE_ENV=production`
  - Testing: `NODE_ENV=test`

#### `LOG_LEVEL`

- **Description**: Logging verbosity level
- **Type**: Enum
- **Valid Values**: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- **Default**: `info`
- **Validation**: Must be one of the allowed values
- **Recommendations**:
  - Development: `debug` or `trace` for detailed logs
  - Production: `info` or `warn` for performance
  - Testing: `error` to reduce noise
- **Example**: `LOG_LEVEL=info`

### Authentication Configuration (`auth` namespace)

#### `JWT_SECRET`

- **Description**: Secret key for JWT token signing
- **Type**: String
- **Minimum Length**: 32 characters (production requirement)
- **Default**: `dev-secret-change-in-production` (development only)
- **Validation**:
  - Must be at least 32 characters for security
  - Validation enforced in all environments
- **Security**: Use a cryptographically secure random string
- **Generation**:

  ```bash
  # Option 1: OpenSSL (recommended)
  openssl rand -base64 32

  # Option 2: Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

- **Example**: `JWT_SECRET=your-super-secure-secret-key-at-least-32-characters-long`

---

## Environment File Priority

Environment files are loaded in this priority order (highest to lowest):

```
1. .env.local          (highest priority - local development overrides)
   ↓
2. .env.production     (production-specific values)
   ↓
3. .env                (committed defaults)
   ↓
4. Schema defaults     (lowest priority - hardcoded fallbacks)
```

### File Usage Guidelines

| File              | Purpose                             | Git Tracked | When to Use                       |
| ----------------- | ----------------------------------- | ----------- | --------------------------------- |
| `.env`            | Default values for all environments | ✅ Yes      | Commit safe defaults, no secrets  |
| `.env.production` | Production secrets and overrides    | ❌ No       | Deploy to production servers only |
| `.env.local`      | Local development overrides         | ❌ No       | Personal settings, never commit   |
| `.env.example`    | Documentation of all variables      | ✅ Yes      | Reference for required variables  |

### Example Priority Resolution

Given these files:

```bash
# .env (committed)
PORT=8000
JWT_SECRET=dev-secret-change-in-production
LOG_LEVEL=info

# .env.production (git-ignored)
JWT_SECRET=prod-super-secure-secret-32-chars-minimum
LOG_LEVEL=warn

# .env.local (git-ignored)
PORT=9000
LOG_LEVEL=debug
```

**Result**:

- `PORT=9000` (from .env.local)
- `JWT_SECRET=prod-super-secure-secret-32-chars-minimum` (from .env.production)
- `LOG_LEVEL=debug` (from .env.local)

---

## Validation

All configuration is validated at **application startup** using `class-validator` decorators.

### Validation Behavior

- **Fail-fast**: Invalid configuration prevents application startup
- **Detailed errors**: Shows exactly what's wrong and how to fix it
- **All errors shown**: Displays all validation failures, not just the first

### Validation Rules

#### Application Config

| Variable    | Validation Rules                                         |
| ----------- | -------------------------------------------------------- |
| `PORT`      | • Must be an integer<br>• Must be between 1 and 65535    |
| `NODE_ENV`  | • Must be one of: development, production, test          |
| `LOG_LEVEL` | • Must be one of: fatal, error, warn, info, debug, trace |

#### Authentication Config

| Variable     | Validation Rules                                       |
| ------------ | ------------------------------------------------------ |
| `JWT_SECRET` | • Must be a string<br>• Must be at least 32 characters |

### Example Validation Error

If you start the application with invalid configuration:

```bash
PORT=99999 NODE_ENV=invalid pnpm dev
```

You'll see:

```
❌ Configuration validation failed for AppConfig:
  - PORT: PORT must not be greater than 65535
  - NODE_ENV: NODE_ENV must be a valid enum value

Please check your .env file or environment variables.
```

---

## Usage in Code

### Injecting Configuration

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfigService } from "~/shared/config/app-config.service";

@Injectable()
export class MyService {
  constructor(private readonly config: AppConfigService) {}

  doSomething() {
    // Access application config via namespace
    const port = this.config.app.PORT; // Type: number
    const env = this.config.app.NODE_ENV; // Type: Environment enum
    const logLevel = this.config.app.LOG_LEVEL; // Type: LogLevel enum

    // Access authentication config
    const jwtSecret = this.config.auth.JWT_SECRET; // Type: string

    // All values are validated at startup, so they're guaranteed to be valid
    console.log(`Running on port ${port} in ${env} mode`);
  }
}
```

### Accessing in Module Factories

```typescript
import { Module } from "@nestjs/common";
import { AppConfigService } from "~/shared/config/app-config.service";

@Module({
  imports: [
    SomeModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.auth.JWT_SECRET,
        port: config.app.PORT,
      }),
    }),
  ],
})
export class MyModule {}
```

### Accessing in Bootstrap (main.ts)

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/config/app-config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(AppConfigService);

  await app.listen(config.app.PORT);
  console.log(`Running on port ${config.app.PORT}`);
}
```

### Type Safety & IDE Support

The configuration service provides full TypeScript type safety:

```typescript
// ✅ Correct - TypeScript knows the types
const port: number = this.config.app.PORT;
const env: Environment = this.config.app.NODE_ENV;

// ❌ Type error - PORT is a number, not a string
const port: string = this.config.app.PORT;

// ✅ IDE autocomplete works
this.config.app.   // Shows: PORT, NODE_ENV, LOG_LEVEL
this.config.auth.  // Shows: JWT_SECRET
```

---

## Adding New Configuration

To add a new configuration variable or namespace:

### Adding to Existing Namespace

**Example**: Add a new application config variable

1. **Update the schema** (`src/shared/config/schemas/app.config.schema.ts`):

```typescript
export class AppConfigSchema {
  // ... existing properties ...

  @IsUrl({ require_tld: false })
  API_BASE_URL!: string;
}
```

2. **Update the loader** (`src/shared/config/config.loader.ts`):

```typescript
const appConfig = plainToInstance(AppConfigSchema, {
  PORT: process.env.PORT || "8000",
  NODE_ENV: process.env.NODE_ENV || Environment.Development,
  LOG_LEVEL: process.env.LOG_LEVEL || LogLevel.Info,
  API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8000", // Add here
});
```

3. **Update `.env.example`**:

```bash
# API Configuration
API_BASE_URL=http://localhost:8000
```

4. **Update this documentation** with the new variable details.

### Adding a New Namespace

**Example**: Add database configuration namespace

1. **Create new schema** (`src/shared/config/schemas/database.config.schema.ts`):

```typescript
import { IsUrl, IsInt, Min, Max } from "class-validator";

export class DatabaseConfigSchema {
  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  DATABASE_POOL_SIZE!: number;
}
```

2. **Update `ValidatedConfig` interface** (`src/shared/config/config.loader.ts`):

```typescript
export interface ValidatedConfig {
  app: AppConfigSchema;
  auth: AuthConfigSchema;
  database: DatabaseConfigSchema; // Add here
}
```

3. **Update `loadConfig()` function** (`src/shared/config/config.loader.ts`):

```typescript
export function loadConfig(): ValidatedConfig {
  // ... existing app and auth config ...

  // Load database config
  const databaseConfig = plainToInstance(
    DatabaseConfigSchema,
    {
      DATABASE_URL:
        process.env.DATABASE_URL || "postgresql://localhost:5432/mydb",
      DATABASE_POOL_SIZE: process.env.DATABASE_POOL_SIZE || "10",
    },
    { enableImplicitConversion: true },
  );
  validateConfig(databaseConfig, "DatabaseConfig");

  return {
    app: appConfig,
    auth: authConfig,
    database: databaseConfig, // Add here
  };
}
```

4. **Add accessor to `AppConfigService`** (`src/shared/config/app-config.service.ts`):

```typescript
export class AppConfigService {
  // ... existing getters ...

  /**
   * Database configuration namespace
   * Contains: DATABASE_URL, DATABASE_POOL_SIZE
   */
  get database(): DatabaseConfigSchema {
    return this.configService.get("database", { infer: true });
  }
}
```

5. **Update `.env.example`**:

```bash
# Database Configuration
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_POOL_SIZE=10
```

6. **Update this documentation** with the new namespace section.

7. **Use the new config**:

```typescript
constructor(private readonly config: AppConfigService) {}

connectToDatabase() {
  const url = this.config.database.DATABASE_URL;
  const poolSize = this.config.database.DATABASE_POOL_SIZE;
}
```

---

## Testing

### Unit Tests

Mock the `AppConfigService` in your tests:

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { AppConfigService } from "~/shared/config/app-config.service";
import {
  Environment,
  LogLevel,
} from "~/shared/config/schemas/app.config.schema";

describe("MyService", () => {
  let service: MyService;

  const mockConfig: AppConfigService = {
    app: {
      PORT: 8000,
      NODE_ENV: Environment.Test,
      LOG_LEVEL: LogLevel.Error,
    },
    auth: {
      JWT_SECRET: "test-secret-at-least-32-characters-long-for-validation",
    },
    all: {} as any,
  } as AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: AppConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it("should use config values", () => {
    expect(service.getPort()).toBe(8000);
  });
});
```

### Integration Tests

Set environment variables before creating the test app:

```typescript
// test/helpers/test-app.factory.ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "~/app.module";

export async function createTestApp(): Promise<INestApplication> {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.PORT = "8000";
  process.env.JWT_SECRET =
    "test-secret-at-least-32-characters-long-for-validation";
  process.env.LOG_LEVEL = "error";

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  // ... apply pipes, guards, etc.

  await app.init();
  return app;
}
```

### Testing Validation

You can test that invalid configuration prevents startup:

```typescript
describe("Configuration Validation", () => {
  it("should reject invalid PORT", () => {
    process.env.PORT = "99999";
    expect(() => loadConfig()).toThrow("PORT must not be greater than 65535");
  });

  it("should reject short JWT_SECRET", () => {
    process.env.JWT_SECRET = "short";
    expect(() => loadConfig()).toThrow(
      "JWT_SECRET must be at least 32 characters",
    );
  });
});
```

---

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] `.env.production` is git-ignored (verify with `git status`)
- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `JWT_SECRET` is cryptographically secure (use `openssl rand -base64 32`)
- [ ] `NODE_ENV=production` is set
- [ ] `LOG_LEVEL` is set to `info` or `warn` (not `debug` or `trace`)
- [ ] Environment files have restricted permissions: `chmod 600 .env.production`
- [ ] Secrets are never logged or exposed in error messages

### Deployment Steps

1. **Create production environment file on server**:

```bash
# On production server
cd /path/to/app
cp .env.example .env.production
```

2. **Generate secure secrets**:

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=${JWT_SECRET}" >> .env.production
```

3. **Set production values**:

```bash
# Edit .env.production
nano .env.production

# Set:
NODE_ENV=production
LOG_LEVEL=info
PORT=8000
```

4. **Secure the file**:

```bash
chmod 600 .env.production
```

5. **Build and start**:

```bash
pnpm build
pnpm start
```

### Environment Variable Injection

Alternatively, use environment variables directly (no `.env.production` file):

```bash
export NODE_ENV=production
export PORT=8000
export LOG_LEVEL=info
export JWT_SECRET="your-secure-secret-32-chars-minimum"

pnpm start
```

### Docker Deployment

Use `.env.production` or environment variables in Docker:

```dockerfile
# Option 1: Copy .env.production into container
COPY .env.production /app/.env.production

# Option 2: Use build args and ENV
ARG JWT_SECRET
ENV JWT_SECRET=$JWT_SECRET
```

---

## Troubleshooting

### Application Won't Start

**Symptom**: Application fails to start with configuration validation error.

**Common Causes**:

1. Missing required environment variables
2. Invalid environment variable values
3. JWT_SECRET too short

**Solution**:

1. Read the error message carefully - it tells you exactly what's wrong
2. Check your `.env` file exists and has correct values
3. Verify environment file priority (`.env.local` overrides `.env.production`)
4. Ensure JWT_SECRET is at least 32 characters

**Example Error**:

```
❌ Configuration validation failed for AuthConfig:
  - JWT_SECRET: JWT_SECRET must be at least 32 characters for security
```

**Fix**:

```bash
# Generate a secure secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=${JWT_SECRET}" > .env.local
```

### Configuration Changes Not Taking Effect

**Symptom**: Updated environment variables don't reflect in running application.

**Causes**:

1. Application wasn't restarted (hot reload doesn't reload env files)
2. Wrong environment file is being used (check priority)
3. Environment variable set in wrong file

**Solution**:

1. **Always restart the application** after changing `.env` files
2. Check file priority: `.env.local` > `.env.production` > `.env`
3. Verify which file is being loaded:
   ```typescript
   console.log("Config loaded:", config.all);
   ```

### Type Errors When Accessing Config

**Symptom**: TypeScript errors when accessing configuration.

**Error Example**:

```typescript
// Error: Property 'PORT' does not exist on type 'AppConfigService'
const port = this.config.PORT;
```

**Solution**: Use namespace accessors:

```typescript
// ✅ Correct
const port = this.config.app.PORT;
const secret = this.config.auth.JWT_SECRET;
```

### Cannot Find Module Error

**Symptom**: Import errors after migration.

**Error Example**:

```
Cannot find module '~/shared/config/app.config'
```

**Solution**: Update imports to use new paths:

```typescript
// ❌ Old
import type { AppConfig } from "~/shared/config/app.config";

// ✅ New
import { AppConfigService } from "~/shared/config/app-config.service";
```

### JWT_SECRET Validation Error in Development

**Symptom**: Validation fails with "JWT_SECRET must be at least 32 characters" in development.

**Cause**: Default development secret is too short.

**Solution**:

```bash
# Generate a development secret (or use any 32+ character string)
echo "JWT_SECRET=dev-secret-at-least-32-characters-long-ok" > .env
```

---

## Related Documentation

- [NestJS Configuration Documentation](https://docs.nestjs.com/techniques/configuration)
- [class-validator Documentation](https://github.com/typestack/class-validator)
- [The Twelve-Factor App: Config](https://12factor.net/config)
- [OWASP: Secure Configuration](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

---

## Migration Notes

This configuration system replaced the previous `AppConfig` type with a validated, namespaced architecture.

### Migration Changes

| Old Pattern            | New Pattern                          |
| ---------------------- | ------------------------------------ |
| `@Inject('AppConfig')` | `AppConfigService` (inject directly) |
| `config.port`          | `config.app.PORT`                    |
| `config.nodeEnv`       | `config.app.NODE_ENV`                |
| `config.jwtSecret`     | `config.auth.JWT_SECRET`             |
| `config.logLevel`      | `config.app.LOG_LEVEL`               |

### Benefits of New System

- ✅ Runtime validation with detailed error messages
- ✅ Type-safe access with IDE autocomplete
- ✅ Namespace organization for scalability
- ✅ Standard NestJS ConfigService pattern
- ✅ Environment file priority system
- ✅ Easy to extend with new namespaces

For implementation details, see the main [CLAUDE.md](./CLAUDE.md) documentation.
