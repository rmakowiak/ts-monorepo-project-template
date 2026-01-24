/**
 * @monorepo/otel
 *
 * OpenTelemetry instrumentation package for monorepo services
 *
 * Provides:
 * - Auto-instrumentation for HTTP, Express, NestJS, databases
 * - OTLP trace export to Jaeger/Tempo
 * - Prometheus metrics endpoint
 * - Pino logger integration with trace ID injection
 * - Helper functions for custom span attributes and events
 *
 * @example
 * ```typescript
 * // In main.ts (before NestFactory.create)
 * import { OtelSDKManager, loadOtelConfig } from '@monorepo/otel'
 *
 * const otel = new OtelSDKManager(loadOtelConfig())
 * otel.initialize()
 * ```
 *
 * @packageDocumentation
 */

export { OtelSDKManager, loadOtelConfig } from './config'
export { createPinoOtelMixin } from './pino-instrumentation'
export {
  addSpanAttributes,
  addSpanEvent,
  getActiveSpan,
  getTraceId,
  getSpanId,
} from './helpers'
export type {
  OtelConfig,
  TracingConfig,
  MetricsConfig,
  ResourceConfig,
  TraceExporterType,
  OtelEnvironmentVariables,
} from './types'
