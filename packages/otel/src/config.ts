import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { Resource } from '@opentelemetry/resources'
import {
  SemanticResourceAttributes,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import type { OtelConfig, TraceExporterType } from './types'

/**
 * Load OpenTelemetry configuration from environment variables
 */
export function loadOtelConfig(): OtelConfig {
  const serviceName = process.env.OTEL_SERVICE_NAME
  if (!serviceName) {
    throw new Error(
      'OTEL_SERVICE_NAME environment variable is required for OpenTelemetry'
    )
  }

  // Parse resource attributes from comma-separated key=value pairs
  const parseResourceAttributes = (
    attrString?: string
  ): Record<string, string | number | boolean> => {
    if (!attrString) return {}

    const attributes: Record<string, string | number | boolean> = {}
    attrString.split(',').forEach((pair) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        // Try to parse as number or boolean
        if (value === 'true') attributes[key.trim()] = true
        else if (value === 'false') attributes[key.trim()] = false
        else if (!isNaN(Number(value))) attributes[key.trim()] = Number(value)
        else attributes[key.trim()] = value.trim()
      }
    })
    return attributes
  }

  return {
    serviceName,
    serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    enabled: process.env.OTEL_ENABLED !== 'false',
    tracing: {
      enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
      exporter:
        (process.env.OTEL_TRACE_EXPORTER as TraceExporterType) || 'otlp-http',
      endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      sampleRate: parseFloat(process.env.OTEL_TRACE_SAMPLE_RATE || '1.0'),
    },
    metrics: {
      enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
      port: parseInt(process.env.OTEL_METRICS_PORT || '9464', 10),
    },
    resource: {
      attributes: parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES),
    },
  }
}

/**
 * OpenTelemetry SDK Manager
 * Handles initialization and lifecycle of the OpenTelemetry SDK
 */
export class OtelSDKManager {
  private sdk?: NodeSDK

  constructor(private readonly config: OtelConfig) {}

  /**
   * Initialize and start the OpenTelemetry SDK
   */
  initialize(): void {
    if (!this.config.enabled) {
      console.log('[OTel] OpenTelemetry is disabled')
      return
    }

    try {
      // Create resource with service metadata
      const resource = this.createResource()

      // Create trace exporter
      const traceExporter = this.createTraceExporter()

      // Create metric reader (Prometheus)
      const metricReader = this.createMetricReader()

      // Create instrumentations
      const instrumentations = getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // File system instrumentation is too noisy
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            // Ignore health checks and metrics endpoints
            const url = req.url || ''
            return (
              url.includes('/health') ||
              url.includes('/metrics') ||
              url.includes('/favicon.ico')
            )
          },
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
      })

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations,
      })

      this.sdk.start()

      console.log('[OTel] OpenTelemetry SDK initialized successfully')
      console.log(`[OTel]   Service: ${this.config.serviceName}`)
      console.log(`[OTel]   Version: ${this.config.serviceVersion}`)
      console.log(`[OTel]   Environment: ${this.config.environment}`)
      console.log(
        `[OTel]   Tracing: ${this.config.tracing.enabled ? 'enabled' : 'disabled'} (${this.config.tracing.exporter})`
      )
      console.log(
        `[OTel]   Metrics: ${this.config.metrics.enabled ? 'enabled' : 'disabled'} (port ${this.config.metrics.port})`
      )
    } catch (error) {
      console.error('[OTel] Failed to initialize OpenTelemetry SDK:', error)
      // Don't throw - allow app to start without telemetry
    }
  }

  /**
   * Gracefully shutdown the SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown()
      console.log('[OTel] OpenTelemetry SDK shut down')
    }
  }

  /**
   * Create resource with service metadata and custom attributes
   */
  private createResource(): Resource {
    return new Resource({
      [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      ...this.config.resource.attributes,
    })
  }

  /**
   * Create trace exporter based on configuration
   */
  private createTraceExporter() {
    if (!this.config.tracing.enabled) {
      return new ConsoleSpanExporter() // No-op effectively
    }

    switch (this.config.tracing.exporter) {
      case 'otlp-http':
        return new OTLPTraceExporter({
          url:
            this.config.tracing.endpoint ||
            'http://localhost:4318/v1/traces',
        })
      case 'console':
        return new ConsoleSpanExporter()
      default:
        console.warn(
          `[OTel] Unknown trace exporter: ${this.config.tracing.exporter}, falling back to console`
        )
        return new ConsoleSpanExporter()
    }
  }

  /**
   * Create Prometheus metric reader
   */
  private createMetricReader() {
    if (!this.config.metrics.enabled) {
      return undefined
    }

    return new PrometheusExporter({
      port: this.config.metrics.port,
      endpoint: '/metrics',
    })
  }
}
