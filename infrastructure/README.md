# Local Observability Infrastructure

This directory contains Docker Compose setup for local development observability stack.

## Services

### Jaeger - Distributed Tracing

- **UI**: http://localhost:16686
- **OTLP HTTP Endpoint**: http://localhost:4318
- View distributed traces from your services
- Search traces by service, operation, tags, duration

### Prometheus - Metrics Collection

- **UI**: http://localhost:9090
- Scrapes metrics from example-service on port 9464
- 15s scrape interval
- Stores time-series metrics data

### Grafana - Visualization & Dashboards

- **UI**: http://localhost:3000
- **Default credentials**: admin/admin
- Pre-configured datasources:
  - Prometheus (default)
  - Jaeger
- Create custom dashboards for your services

## Quick Start

### Start all services:

```bash
cd infrastructure
docker-compose up -d
```

### View logs:

```bash
docker-compose logs -f
```

### Stop all services:

```bash
docker-compose down
```

### Stop and remove volumes (clean slate):

```bash
docker-compose down -v
```

## Accessing the Stack

1. **Start infrastructure**: `docker-compose up -d`
2. **Start your app**: `cd apps/example-service && pnpm dev`
3. **Generate some traffic**: Make API requests to http://localhost:8000
4. **View traces**: Open http://localhost:16686 (Jaeger)
5. **View metrics**: Open http://localhost:9090 (Prometheus)
6. **View dashboard**: Open http://localhost:3000 (Grafana - pre-configured dashboard included!)

### Pre-configured Grafana Dashboard

The stack includes a ready-to-use dashboard that shows:

- **Service Overview**: Request rate, duration percentiles (p50/p95/p99), error rate
- **HTTP Metrics**: Status code distribution, requests by endpoint
- **System Metrics**: CPU usage, memory usage, event loop lag
- **Trace Integration**: Direct links to Jaeger for exploring individual traces

The dashboard automatically loads when Grafana starts. Just open http://localhost:3000 and look for "Example Service - Observability Dashboard".

## Troubleshooting

### Prometheus can't reach example-service

**Symptom**: Prometheus shows `example-service` target as "down"

**Solution for Mac/Windows**: Should work out of the box with `host.docker.internal`

**Solution for Linux**:

1. Find your host IP: `ip addr show docker0`
2. Update `prometheus.yml`:
   ```yaml
   - targets: ["172.17.0.1:9464"] # Replace with your docker0 IP
   ```
3. Restart: `docker-compose restart prometheus`

### Can't see traces in Jaeger

**Check**:

1. Is OTLP endpoint configured? `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces`
2. Is tracing enabled? `OTEL_TRACING_ENABLED=true`
3. Check app logs for OTel initialization errors
4. Verify Jaeger is running: `docker-compose ps`

## Network Architecture

```
┌─────────────────────┐
│  Example Service    │
│  (host machine)     │
│  :8000 (HTTP API)   │
│  :9464 (Metrics)    │
└──────────┬──────────┘
           │
           │ Traces (OTLP HTTP)
           ├──────────────────────┐
           │                      │
           │ Metrics (HTTP scrape)│
           │                      │
    ┌──────▼──────┐        ┌─────▼──────┐
    │   Jaeger    │        │ Prometheus │
    │  :16686 UI  │        │  :9090 UI  │
    │  :4318 OTLP │        │            │
    └─────────────┘        └──────┬─────┘
                                  │
                                  │ Metrics Query
                           ┌──────▼──────┐
                           │   Grafana   │
                           │  :3000 UI   │
                           └─────────────┘
```

## Port Reference

| Service         | Port  | Purpose            |
| --------------- | ----- | ------------------ |
| example-service | 8000  | HTTP API           |
| example-service | 9464  | Prometheus metrics |
| Jaeger          | 16686 | Web UI             |
| Jaeger          | 4318  | OTLP HTTP receiver |
| Prometheus      | 9090  | Web UI & API       |
| Grafana         | 3000  | Web UI             |

## Next Steps

1. Create custom Grafana dashboards for your services
2. Set up alerting rules in Prometheus
3. Configure trace sampling for production
4. Add more services to the observability stack
