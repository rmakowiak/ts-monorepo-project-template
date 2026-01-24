# Configuration Guide

Type-safe configuration using `@nestjs/config` with namespace-based validation.

## Quick Start

```bash
# Development
cp .env.example .env
pnpm dev

# Production
cp .env.example .env.production
# Edit .env.production with secure values
JWT_SECRET=$(openssl rand -base64 32)
pnpm build && pnpm start
```

## Environment Variables

### Application Config (`app` namespace)

| Variable    | Type    | Default       | Description                                                   |
| ----------- | ------- | ------------- | ------------------------------------------------------------- |
| `PORT`      | integer | `8000`        | HTTP server port (1-65535)                                    |
| `NODE_ENV`  | enum    | `development` | Environment: `development`, `production`, `test`              |
| `LOG_LEVEL` | enum    | `info`        | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

### Authentication Config (`auth` namespace)

| Variable     | Type   | Default                                             | Description                       |
| ------------ | ------ | --------------------------------------------------- | --------------------------------- |
| `JWT_SECRET` | string | `dev-secret-change-in-production-at-least-32-chars` | JWT signing secret (min 32 chars) |

## Environment File Priority

Files loaded in order (later overrides earlier):

```
.env                  (default values)
.env.production       (production overrides)
.env.local            (local overrides - highest priority)
```

| File              | Git Tracked | Use Case                   |
| ----------------- | ----------- | -------------------------- |
| `.env`            | ❌ No       | Default development values |
| `.env.production` | ❌ No       | Production secrets         |
| `.env.local`      | ❌ No       | Personal local overrides   |
| `.env.example`    | ✅ Yes      | Documentation template     |

## Validation

All config validated at startup with `class-validator`. Invalid config prevents app from starting.

**Common errors**:

- `PORT must not be greater than 65535`
- `JWT_SECRET must be at least 32 characters`
- `NODE_ENV must be a valid enum value`

## Usage in Code

```typescript
import { AppConfigService } from "~/shared/config/app-config.service";

@Injectable()
export class MyService {
  constructor(private readonly config: AppConfigService) {}

  doSomething() {
    const port = this.config.app.PORT; // number
    const env = this.config.app.NODE_ENV; // Environment enum
    const secret = this.config.auth.JWT_SECRET; // string
  }
}
```

## Adding New Config

### Add to Existing Namespace

1. Update schema in `src/shared/config/schemas/[namespace].config.schema.ts`
2. Add to `loadConfig()` in `config.loader.ts`
3. Update `.env.example`

**Example** - Add API URL to app namespace:

```typescript
// schemas/app.config.schema.ts
export class AppConfigSchema {
  @IsUrl({ require_tld: false })
  API_BASE_URL!: string;
}

// config.loader.ts
const appConfig = loadAndValidateSchema(
  AppConfigSchema,
  {
    PORT: process.env.PORT || "8000",
    API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8000",
  },
  "AppConfig",
);
```

### Add New Namespace

1. Create schema: `src/shared/config/schemas/database.config.schema.ts`
2. Add to `ValidatedConfig` interface in `config.loader.ts`
3. Update `loadConfig()` function
4. Add getter to `AppConfigService`
5. Update `.env.example`

See [CLAUDE.md](./CLAUDE.md) for detailed examples.

## Production Deployment

```bash
# On production server
cp .env.example .env.production

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=${JWT_SECRET}" >> .env.production

# Set production values
echo "NODE_ENV=production" >> .env.production
echo "LOG_LEVEL=info" >> .env.production

# Secure file
chmod 600 .env.production

# Deploy
pnpm build && pnpm start
```

**Security checklist**:

- [ ] JWT_SECRET is cryptographically secure (32+ chars)
- [ ] `.env.production` is git-ignored
- [ ] Environment files have restricted permissions (chmod 600)
- [ ] NODE_ENV=production
- [ ] LOG_LEVEL set to info/warn (not debug/trace)

## Testing

**Mock config in tests**:

```typescript
const mockConfig: AppConfigService = {
  app: {
    PORT: 8000,
    NODE_ENV: Environment.Test,
    LOG_LEVEL: LogLevel.Error,
  },
  auth: {
    JWT_SECRET: "test-secret-at-least-32-characters-long",
  },
} as AppConfigService;
```

## Troubleshooting

### App won't start - validation error

Check error message for specific issue:

- Verify `.env` file exists
- Ensure JWT_SECRET is 32+ characters
- Check environment file priority

### Config changes not taking effect

Restart the app (hot reload doesn't reload env files).

### Type errors accessing config

Use namespace accessors:

```typescript
// ✅ Correct
const port = this.config.app.PORT;

// ❌ Wrong
const port = this.config.PORT;
```

## Architecture

Configuration system uses namespace-based schemas for scalability:

```
.env files → config.loader.ts (validates) → ConfigService → AppConfigService → Your code
```

For comprehensive architectural details, see [CLAUDE.md](./CLAUDE.md).
