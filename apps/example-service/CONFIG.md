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

### OpenTelemetry Config (`otel` namespace)

| Variable                            | Type    | Default                                       | Description                               |
| ----------------------------------- | ------- | --------------------------------------------- | ----------------------------------------- |
| `OTEL_SERVICE_NAME`                 | string  | `example-service`                             | Service name for traces and metrics       |
| `OTEL_SERVICE_VERSION`              | string  | `1.0.0`                                       | Service version                           |
| `OTEL_ENABLED`                      | boolean | `true`                                        | Enable/disable OpenTelemetry              |
| `OTEL_TRACING_ENABLED`              | boolean | `true`                                        | Enable/disable distributed tracing        |
| `OTEL_TRACE_EXPORTER`               | enum    | `otlp-http`                                   | Exporter type: `otlp-http`, `console`     |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`| url     | `http://localhost:4318/v1/traces`             | OTLP trace receiver endpoint              |
| `OTEL_TRACE_SAMPLE_RATE`            | number  | `1.0`                                         | Sampling rate (0.0-1.0)                   |
| `OTEL_METRICS_ENABLED`              | boolean | `true`                                        | Enable/disable metrics collection         |
| `OTEL_METRICS_PORT`                 | integer | `9464`                                        | Prometheus metrics port (1-65535)         |
| `OTEL_RESOURCE_ATTRIBUTES`          | string  | -                                             | Custom attributes (comma-separated)       |

See [OBSERVABILITY.md](../../OBSERVABILITY.md) for complete OpenTelemetry documentation.

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
    // Application config
    const port = this.config.app.PORT; // number
    const env = this.config.app.NODE_ENV; // Environment enum

    // Authentication config
    const secret = this.config.auth.JWT_SECRET; // string

    // OpenTelemetry config
    const serviceName = this.config.otel.OTEL_SERVICE_NAME; // string
    const tracingEnabled = this.config.otel.OTEL_TRACING_ENABLED; // boolean
    const metricsPort = this.config.otel.OTEL_METRICS_PORT; // number
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
import { TraceExporterType } from "~/shared/config/schemas/otel.config.schema";

const mockConfig: AppConfigService = {
  app: {
    PORT: 8000,
    NODE_ENV: Environment.Test,
    LOG_LEVEL: LogLevel.Error,
  },
  auth: {
    JWT_SECRET: "test-secret-at-least-32-characters-long",
  },
  otel: {
    OTEL_SERVICE_NAME: "test-service",
    OTEL_SERVICE_VERSION: "1.0.0",
    OTEL_ENABLED: false,
    OTEL_TRACING_ENABLED: false,
    OTEL_TRACE_EXPORTER: TraceExporterType.Console,
    OTEL_TRACE_SAMPLE_RATE: 1.0,
    OTEL_METRICS_ENABLED: false,
    OTEL_METRICS_PORT: 9464,
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
