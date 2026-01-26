/**
 * @monorepo/otel
 *
 * Self-contained OpenTelemetry instrumentation package for monorepo services
 *
 * Provides:
 * - Auto-instrumentation for HTTP, Express, NestJS, databases
 * - OTLP trace export to Jaeger/Tempo
 * - Prometheus metrics endpoint
 * - Pino logger component with trace ID injection
 * - Helper functions for custom span attributes and events
 * - Internal configuration validation (no app-side config needed)
 *
 * @example
 * ```typescript
 * // In main.ts (before NestFactory.create)
 * import { initializeOtel } from '@monorepo/otel'
 *
 * // That's it! Configuration is loaded and validated internally from environment variables
 * initializeOtel()
 * ```
 *
 * Configuration is managed via environment variables:
 * - OTEL_SERVICE_NAME (required) - Service identifier
 * - OTEL_SERVICE_VERSION - Service version (default: "1.0.0")
 * - OTEL_ENABLED - Enable/disable OTel (default: true)
 * - OTEL_TRACING_ENABLED - Enable tracing (default: true)
 * - OTEL_TRACE_EXPORTER - Exporter type: "otlp-http" | "console" (default: "otlp-http")
 * - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT - OTLP endpoint (optional)
 * - OTEL_TRACE_SAMPLE_RATE - Sample rate 0.0-1.0 (default: 1.0)
 * - OTEL_METRICS_ENABLED - Enable metrics (default: true)
 * - OTEL_METRICS_PORT - Prometheus port (default: 9464)
 * - OTEL_RESOURCE_ATTRIBUTES - Additional attributes (optional)
 *
 * @packageDocumentation
 */

export { initializeOtel } from "./config";
export { createPinoOtelMixin } from "./pino-instrumentation";
export {
  addSpanAttributes,
  addSpanEvent,
  getActiveSpan,
  getTraceId,
  getSpanId,
} from "./helpers";
export type { OtelEnvironmentVariables } from "./types";
