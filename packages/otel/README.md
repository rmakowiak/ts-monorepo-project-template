# @monorepo/otel

OpenTelemetry instrumentation package for monorepo services.

## Features

- ✅ **Auto-instrumentation** for HTTP, Express, NestJS, databases
- ✅ **OTLP trace export** to Jaeger, Tempo, or any OTLP-compatible backend
- ✅ **Prometheus metrics** endpoint
- ✅ **Pino logger integration** with automatic trace ID injection
- ✅ **Helper functions** for custom span attributes and events
- ✅ **Type-safe configuration** from environment variables
- ✅ **Zero code changes** required in services (except initialization)

## Installation

This package is already part of the monorepo workspace. Services can add it as a dependency:

```json
{
  "dependencies": {
    "@monorepo/otel": "workspace:*"
  }
}
```

Then run `pnpm install` at the monorepo root.

## Quick Start

### 1. Configure Environment Variables

Add to your service's `.env` file:

```bash
# Required
OTEL_SERVICE_NAME=example-service

# Optional (with defaults)
OTEL_SERVICE_VERSION=1.0.0
OTEL_ENABLED=true
OTEL_TRACING_ENABLED=true
OTEL_TRACE_EXPORTER=otlp-http
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_TRACE_SAMPLE_RATE=1.0
OTEL_METRICS_ENABLED=true
OTEL_METRICS_PORT=9464
OTEL_RESOURCE_ATTRIBUTES=team=platform,region=us-east
```

### 2. Initialize in main.ts

**IMPORTANT**: Initialize **BEFORE** `NestFactory.create()` to ensure all modules are instrumented.

```typescript
import { NestFactory } from '@nestjs/core'
import { OtelSDKManager, loadOtelConfig } from '@monorepo/otel'
import { AppModule } from './app.module'

async function bootstrap() {
  // Initialize OpenTelemetry FIRST
  const otel = new OtelSDKManager(loadOtelConfig())
  otel.initialize()

  // Then create NestJS app
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  // ... rest of your bootstrap code

  await app.listen(3000)
}

bootstrap()
```

### 3. Integrate with Pino Logger

Add the trace mixin to your Pino configuration:

```typescript
import { LoggerModule } from 'nestjs-pino'
import { createPinoOtelMixin } from '@monorepo/otel'

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        mixin: createPinoOtelMixin(), // ← Add this line
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
          },
        },
      },
    }),
  ],
})
export class SharedModule {}
```

### 4. Start Observability Stack

```bash
cd infrastructure
docker-compose up -d
```

### 5. Run Your Service

```bash
cd apps/example-service
pnpm dev
```

### 6. View Traces and Metrics

- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000

## What Gets Instrumented Automatically

Without any code changes, the following are automatically traced:

- ✅ HTTP/HTTPS requests (inbound and outbound)
- ✅ Express middleware and route handlers
- ✅ NestJS controllers, guards, interceptors
- ✅ Database queries (PostgreSQL, MySQL, MongoDB, etc.)
- ✅ Redis operations
- ✅ DNS lookups
- ✅ Net sockets

## Log Correlation

After integration, all Pino logs automatically include trace context:

**Before:**
```json
{
  "level": "info",
  "msg": "Creating product",
  "sku": "MOUSE-001"
}
```

**After:**
```json
{
  "level": "info",
  "msg": "Creating product",
  "sku": "MOUSE-001",
  "trace_id": "a1b2c3d4e5f6789012345678",
  "span_id": "0123456789abcdef",
  "trace_flags": 1
}
```

Now you can search logs by `trace_id` to see all logs for a specific request!

## Custom Instrumentation (Optional)

### Add Attributes to Auto-Instrumented Spans

```typescript
import { addSpanAttributes } from '@monorepo/otel'

@Injectable()
export class ProductService {
  async createProduct(dto: CreateProductDto): Promise<Product> {
    // Add business context to the auto-instrumented span
    addSpanAttributes({
      'product.sku': dto.sku,
      'product.category': dto.category,
      'product.price': dto.price,
    })

    return this.repository.save(dto)
  }
}
```

### Add Events to Spans

```typescript
import { addSpanEvent } from '@monorepo/otel'

async getProduct(sku: string): Promise<Product> {
  const cached = await this.cache.get(sku)

  if (cached) {
    addSpanEvent('cache.hit', { sku })
    return cached
  }

  addSpanEvent('cache.miss', { sku })
  return this.repository.findBySku(sku)
}
```

### Get Current Trace ID

```typescript
import { getTraceId } from '@monorepo/otel'

async processOrder(orderId: string): Promise<void> {
  const traceId = getTraceId()
  console.log(`Processing order ${orderId} in trace ${traceId}`)

  // Store trace ID in order record for later correlation
  await this.repository.update(orderId, { traceId })
}
```

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | ✅ Yes | - | Service name (e.g., "example-service") |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `NODE_ENV` | No | `development` | Environment (development, staging, production) |
| `OTEL_ENABLED` | No | `true` | Enable/disable OpenTelemetry |
| `OTEL_TRACING_ENABLED` | No | `true` | Enable/disable tracing |
| `OTEL_TRACE_EXPORTER` | No | `otlp-http` | Trace exporter type (otlp-http, console) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | No | `http://localhost:4318/v1/traces` | OTLP endpoint |
| `OTEL_TRACE_SAMPLE_RATE` | No | `1.0` | Sample rate (0.0 to 1.0) |
| `OTEL_METRICS_ENABLED` | No | `true` | Enable/disable metrics |
| `OTEL_METRICS_PORT` | No | `9464` | Prometheus metrics port |
| `OTEL_RESOURCE_ATTRIBUTES` | No | - | Custom resource attributes (comma-separated key=value pairs) |

### Resource Attributes Format

```bash
OTEL_RESOURCE_ATTRIBUTES=team=platform,region=us-east,version=2.0
```

Supported value types:
- **String**: `key=value`
- **Number**: `key=123`
- **Boolean**: `key=true` or `key=false`

## Troubleshooting

### No traces in Jaeger

**Check:**
1. Is Jaeger running? `docker ps | grep jaeger`
2. Is OTLP endpoint correct? Should be `http://localhost:4318/v1/traces`
3. Is tracing enabled? `OTEL_TRACING_ENABLED=true`
4. Check app logs for OTel initialization errors

### Prometheus can't scrape metrics

**Check:**
1. Is metrics port correct? Default is `9464`
2. Is metrics endpoint accessible? `curl http://localhost:9464/metrics`
3. Is Prometheus configured correctly? Check `infrastructure/prometheus.yml`
4. For Docker on Linux, update target to `172.17.0.1:9464`

### Logs don't have trace_id

**Check:**
1. Is Pino mixin configured? `mixin: createPinoOtelMixin()`
2. Is OTel initialized before NestFactory.create()?
3. Is there an active span? (Only logs within HTTP requests have trace context)

### High overhead / performance issues

**Solution:**
1. Reduce sample rate: `OTEL_TRACE_SAMPLE_RATE=0.1` (10% sampling)
2. Disable expensive instrumentations in `config.ts`
3. Use batch span processor (already configured)

## API Reference

### Functions

#### `loadOtelConfig(): OtelConfig`
Loads OpenTelemetry configuration from environment variables.

#### `OtelSDKManager`
Class that manages the OpenTelemetry SDK lifecycle.

**Methods:**
- `constructor(config: OtelConfig)`
- `initialize(): void` - Initialize and start the SDK
- `shutdown(): Promise<void>` - Gracefully shutdown the SDK

#### `createPinoOtelMixin(): MixinFn`
Creates a Pino mixin that injects trace context into logs.

#### `addSpanAttributes(attributes: Record<string, string | number | boolean>): void`
Adds custom attributes to the currently active span.

#### `addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void`
Adds an event to the currently active span.

#### `getTraceId(): string | undefined`
Returns the current trace ID, or undefined if no active span.

#### `getSpanId(): string | undefined`
Returns the current span ID, or undefined if no active span.

#### `getActiveSpan(): Span | undefined`
Returns the currently active span for advanced use cases.

## Best Practices

1. **Initialize Early**: Always call `otel.initialize()` BEFORE `NestFactory.create()`
2. **Use Auto-Instrumentation**: Let auto-instrumentation handle most cases
3. **Add Business Context**: Use `addSpanAttributes()` for important business data
4. **Sample in Production**: Use `OTEL_TRACE_SAMPLE_RATE=0.1` for high-traffic services
5. **Ignore Health Checks**: Already configured to skip `/health` and `/metrics` endpoints
6. **Correlate Logs**: Always enable Pino mixin for log-trace correlation
7. **Monitor Overhead**: Track metrics endpoint performance and adjust sampling if needed

## License

MIT
