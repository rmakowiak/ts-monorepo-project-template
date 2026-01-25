# Observability Stack

Complete OpenTelemetry setup with distributed tracing, metrics, and log correlation.

## Stack Components

- **OpenTelemetry** (`@monorepo/otel`) - Auto-instrumentation, trace/metric collection
- **Jaeger** - Distributed tracing UI and storage
- **Prometheus** - Metrics collection and time-series database
- **Grafana** - Dashboards and visualization
- **Pino** - Structured logging with automatic trace correlation

## Quick Start

### 1. Start Observability Infrastructure

```bash
cd infrastructure
docker-compose up -d
```

This starts:

- **Jaeger** at http://localhost:16686 (traces)
- **Prometheus** at http://localhost:9090 (metrics)
- **Grafana** at http://localhost:3000 (dashboards)

### 2. Configure Service

Services are already configured with default values. For custom configuration, copy `.env.example` to `.env`:

```bash
cd apps/example-service
cp .env.example .env
```

Edit `.env` to customize OpenTelemetry settings (see Configuration section below).

### 3. Run Service

```bash
cd apps/example-service
pnpm dev
```

### 4. Generate Traces

Make some API requests:

```bash
# Get products
curl http://localhost:8000/products

# Create a product (requires JWT token)
curl -X POST http://localhost:8000/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mouse","sku":"MOUSE-001","price":29.99,"stock":100,"description":"Wireless mouse"}'
```

### 5. View Results

**Traces in Jaeger**:

1. Open http://localhost:16686
2. Select `example-service` from the service dropdown
3. Click "Find Traces"
4. Click on a trace to see the full request flow

**Metrics in Prometheus**:

1. Open http://localhost:9090
2. Try queries:
   - `http_server_requests_total` - Total HTTP requests
   - `http_server_duration_milliseconds` - Request duration histogram
   - `process_cpu_seconds_total` - CPU usage

**Dashboards in Grafana**:

1. Open http://localhost:3000
2. Login: admin/admin (or browse anonymously)
3. Look for **"Example Service - Observability Dashboard"** - automatically loaded!
4. Dashboard includes:
   - 📊 Request rate, duration percentiles (p50/p95/p99), error rate
   - 🌐 HTTP status codes distribution, requests by endpoint
   - 💻 CPU usage, memory usage, event loop lag
   - 🔗 Direct links to Jaeger for trace exploration
5. Datasources are pre-configured (Prometheus + Jaeger)
6. Create additional custom dashboards as needed

**Logs with Trace Correlation**:

Check your service logs - they now include trace IDs:

```json
{
  "level": "info",
  "msg": "Creating product",
  "trace_id": "a1b2c3d4e5f6789012345678",
  "span_id": "0123456789abcdef",
  "sku": "MOUSE-001"
}
```

Copy the `trace_id` and search for it in Jaeger to see the full request flow!

---

## Configuration

### Environment Variables

Configure OpenTelemetry in your service's `.env` file:

```bash
# Required
OTEL_SERVICE_NAME=example-service

# Optional (with defaults shown)
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

**Key Settings**:

- `OTEL_SERVICE_NAME` (required) - Service identifier in traces/metrics
- `OTEL_TRACE_SAMPLE_RATE` - Set to `0.1` (10%) in high-traffic production
- `OTEL_METRICS_PORT` - Prometheus scrapes `http://localhost:PORT/metrics`
- `OTEL_RESOURCE_ATTRIBUTES` - Add custom tags (comma-separated `key=value` pairs)

---

## What Gets Instrumented Automatically

OpenTelemetry auto-instrumentation captures:

✅ **HTTP/HTTPS** - All inbound and outbound requests
✅ **Express** - Middleware and route handlers
✅ **NestJS** - Controllers, guards, interceptors
✅ **Databases** - PostgreSQL, MySQL, MongoDB, Redis queries
✅ **DNS** - DNS lookups
✅ **Net** - Socket operations

**No code changes required!** Just initialize OpenTelemetry in `main.ts`.

---

## Adding Custom Instrumentation

### Add Attributes to Current Span

```typescript
import { addSpanAttributes } from "@monorepo/otel";

@Injectable()
export class ProductService {
  async createProduct(dto: CreateProductDto): Promise<Product> {
    // Add business context to the auto-instrumented HTTP span
    addSpanAttributes({
      "product.sku": dto.sku,
      "product.category": dto.category,
      "product.price": dto.price,
    });

    return this.repository.save(dto);
  }
}
```

### Add Events to Span

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

  // Store trace ID for later correlation
  await this.repository.update(orderId, { traceId })
}
```

---

## Architecture

### Package Structure

```
packages/otel/
├── src/
│   ├── config.ts                    # OtelSDKManager, loadOtelConfig()
│   ├── pino-instrumentation.ts      # Trace ID mixin for Pino
│   ├── helpers.ts                   # addSpanAttributes(), addSpanEvent(), etc.
│   ├── types.ts                     # TypeScript definitions
│   └── index.ts                     # Public exports
└── README.md
```

### Integration Points

**1. main.ts** (BEFORE NestFactory.create)

```typescript
import { OtelSDKManager, loadOtelConfig } from "@monorepo/otel";

async function bootstrap() {
  // Initialize OpenTelemetry FIRST
  const otel = new OtelSDKManager(loadOtelConfig());
  otel.initialize();

  // Then create NestJS app
  const app = await NestFactory.create(AppModule);
  // ...
}
```

**2. shared.module.ts** (Pino configuration)

```typescript
import { createPinoOtelMixin } from "@monorepo/otel";

LoggerModule.forRootAsync({
  useFactory: () => ({
    pinoHttp: {
      mixin: createPinoOtelMixin(), // ← Injects trace IDs into logs
      // ... other config
    },
  }),
});
```

### Data Flow

```
HTTP Request
    ↓
[Auto-instrumentation] Creates root span
    ↓
NestJS Controller → Service → Repository
    ↓
[Each layer] Automatically traced
    ↓
[PinoLogger] Reads active span via mixin
    ↓
[Log output] Includes trace_id, span_id
    ↓
[Span complete] Exported to Jaeger
[Metrics] Exported to Prometheus
```

---

## Production Deployment

### Sampling

Reduce overhead in high-traffic services:

```bash
OTEL_TRACE_SAMPLE_RATE=0.1  # 10% sampling
```

### OTLP Collector

Point to your production collector:

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://collector.prod.example.com:4318/v1/traces
```

### Resource Attributes

Add deployment metadata:

```bash
OTEL_RESOURCE_ATTRIBUTES=env=production,region=us-east-1,cluster=prod-01,version=2.0.0
```

### Security

- Use **HTTPS** for OTLP endpoints in production
- Add authentication headers if required by your collector
- Never log sensitive data in span attributes
- Use `ignoreIncomingRequestHook` to exclude sensitive endpoints

---

## Troubleshooting

### No traces in Jaeger

**Check**:

1. Is Jaeger running? `docker ps | grep jaeger`
2. Is OTLP endpoint correct? Default: `http://localhost:4318/v1/traces`
3. Is tracing enabled? `OTEL_TRACING_ENABLED=true`
4. Check app logs for OTel initialization errors

**Solution**: Look for `[OTel] OpenTelemetry SDK initialized successfully` in startup logs.

### Prometheus can't scrape metrics

**Check**:

1. Is metrics endpoint accessible? `curl http://localhost:9464/metrics`
2. Is Prometheus configured correctly? Check `infrastructure/prometheus.yml`
3. For **Linux**: Update Prometheus target to `172.17.0.1:9464` (Docker bridge IP)

**Solution for Linux**:

```yaml
# infrastructure/prometheus.yml
- targets: ["172.17.0.1:9464"] # Replace host.docker.internal
```

### Logs missing trace_id

**Check**:

1. Is Pino mixin configured? Look for `mixin: createPinoOtelMixin()` in shared.module.ts
2. Is OTel initialized BEFORE NestFactory.create()? Must be first!
3. Is there an active span? (Only logs within HTTP requests have trace context)

### High overhead

**Solution**:

1. Reduce sample rate: `OTEL_TRACE_SAMPLE_RATE=0.1`
2. Disable expensive instrumentations in `packages/otel/src/config.ts`
3. Increase batch size for span processor

---

## Adding Observability to New Services

1. **Add dependency** to `package.json`:

   ```json
   {
     "dependencies": {
       "@monorepo/otel": "workspace:*"
     }
   }
   ```

2. **Initialize in main.ts** (before NestFactory.create):

   ```typescript
   import { OtelSDKManager, loadOtelConfig } from "@monorepo/otel";

   const otel = new OtelSDKManager(loadOtelConfig());
   otel.initialize();
   ```

3. **Add Pino mixin** in logger config:

   ```typescript
   import { createPinoOtelMixin } from '@monorepo/otel'

   pinoHttp: {
     mixin: createPinoOtelMixin(),
   }
   ```

4. **Configure environment** in `.env`:

   ```bash
   OTEL_SERVICE_NAME=my-new-service
   OTEL_METRICS_PORT=9465  # Use unique port per service
   ```

5. **Update Prometheus** to scrape new service:
   ```yaml
   # infrastructure/prometheus.yml
   scrape_configs:
     - job_name: "my-new-service"
       static_configs:
         - targets: ["host.docker.internal:9465"]
   ```

---

## Monitoring Best Practices

1. **Tag spans with business context**:
   - User ID, tenant ID, feature flags
   - Business entity IDs (order ID, product SKU, etc.)

2. **Add events for important moments**:
   - Cache hits/misses
   - Retries and fallbacks
   - Circuit breaker state changes

3. **Create custom metrics**:
   - Business KPIs (orders processed, revenue)
   - Domain-specific counters (products created, users registered)

4. **Set up alerts** in Prometheus:
   - High error rates (>1%)
   - Slow requests (p95 > 500ms)
   - High CPU/memory usage

5. **Build Grafana dashboards**:
   - RED metrics (Rate, Errors, Duration)
   - Service dependencies
   - Business metrics

---

## Learn More

- **OpenTelemetry Docs**: https://opentelemetry.io/docs/
- **Jaeger Docs**: https://www.jaegertracing.io/docs/
- **Prometheus Docs**: https://prometheus.io/docs/
- **Grafana Docs**: https://grafana.com/docs/

**Package Documentation**:

- `packages/otel/README.md` - Full API reference
- `infrastructure/README.md` - Infrastructure setup guide

---

## Summary

You now have:

✅ **Distributed tracing** - See request flows across services
✅ **Metrics collection** - Monitor performance and resource usage
✅ **Log correlation** - Connect logs to traces with trace IDs
✅ **Auto-instrumentation** - Zero code changes for most use cases
✅ **Custom instrumentation** - Helper functions for business context
✅ **Production-ready** - Sampling, security, deployment patterns

Start the infrastructure (`docker-compose up -d`), run your service (`pnpm dev`), and explore the observability stack!
