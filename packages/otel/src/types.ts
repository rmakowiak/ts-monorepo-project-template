/**
 * OpenTelemetry configuration types
 */

/**
 * Environment variables for OpenTelemetry configuration
 *
 * @remarks
 * These types are provided for reference. Use OtelConfigSchema
 * from './config-schema' for actual validation.
 */
export interface OtelEnvironmentVariables {
  OTEL_SERVICE_NAME: string;
  OTEL_SERVICE_VERSION?: string;
  NODE_ENV?: string;
  OTEL_ENABLED?: string;
  OTEL_TRACING_ENABLED?: string;
  OTEL_TRACE_EXPORTER?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_TRACE_SAMPLE_RATE?: string;
  OTEL_METRICS_ENABLED?: string;
  OTEL_METRICS_PORT?: string;
  OTEL_RESOURCE_ATTRIBUTES?: string;
}
