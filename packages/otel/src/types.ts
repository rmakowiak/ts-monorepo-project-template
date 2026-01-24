/**
 * OpenTelemetry configuration types
 */

export interface OtelConfig {
  serviceName: string
  serviceVersion: string
  environment: string
  enabled: boolean
  tracing: TracingConfig
  metrics: MetricsConfig
  resource: ResourceConfig
}

export interface TracingConfig {
  enabled: boolean
  exporter: TraceExporterType
  endpoint?: string
  sampleRate: number
}

export interface MetricsConfig {
  enabled: boolean
  port: number
  endpoint?: string
}

export interface ResourceConfig {
  attributes: Record<string, string | number | boolean>
}

export type TraceExporterType = 'otlp-http' | 'console'

/**
 * Environment variables for OpenTelemetry configuration
 */
export interface OtelEnvironmentVariables {
  OTEL_SERVICE_NAME: string
  OTEL_SERVICE_VERSION?: string
  NODE_ENV?: string
  OTEL_ENABLED?: string
  OTEL_TRACING_ENABLED?: string
  OTEL_TRACE_EXPORTER?: TraceExporterType
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string
  OTEL_TRACE_SAMPLE_RATE?: string
  OTEL_METRICS_ENABLED?: string
  OTEL_METRICS_PORT?: string
  OTEL_RESOURCE_ATTRIBUTES?: string
}
