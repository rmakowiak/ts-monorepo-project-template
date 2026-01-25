import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { validateOtelConfig } from "./validate-config";
import type { OtelConfigSchema } from "./config-schema";

/**
 * Initialize OpenTelemetry SDK with automatic validation
 *
 * This function:
 * 1. Reads OpenTelemetry config from process.env
 * 2. Validates config using OtelConfigSchema
 * 3. Initializes OpenTelemetry SDK
 *
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * // In main.ts (before NestFactory.create)
 * import { initializeOtel } from '@monorepo/otel'
 *
 * initializeOtel()
 * const app = await NestFactory.create(AppModule)
 * ```
 */
export function initializeOtel(): void {
  // Validate config from environment variables
  const config = validateOtelConfig({
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
    OTEL_ENABLED: process.env.OTEL_ENABLED,
    OTEL_TRACING_ENABLED: process.env.OTEL_TRACING_ENABLED,
    OTEL_TRACE_EXPORTER: process.env.OTEL_TRACE_EXPORTER,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    OTEL_TRACE_SAMPLE_RATE: process.env.OTEL_TRACE_SAMPLE_RATE,
    OTEL_METRICS_ENABLED: process.env.OTEL_METRICS_ENABLED,
    OTEL_METRICS_PORT: process.env.OTEL_METRICS_PORT,
    OTEL_RESOURCE_ATTRIBUTES: process.env.OTEL_RESOURCE_ATTRIBUTES,
  });

  // Initialize SDK with validated config
  const manager = new OtelSDKManager(config);
  manager.initialize();
}

/**
 * OpenTelemetry SDK Manager
 * Handles initialization and lifecycle of the OpenTelemetry SDK
 *
 * @internal This class is used internally by initializeOtel()
 */
class OtelSDKManager {
  private sdk?: NodeSDK;

  constructor(private readonly config: OtelConfigSchema) {}

  /**
   * Initialize and start the OpenTelemetry SDK
   * @throws Error if SDK initialization fails (app should not start without telemetry)
   */
  initialize(): void {
    if (!this.config.OTEL_ENABLED) {
      console.log("[OTel] OpenTelemetry is disabled");
      return;
    }

    // Create resource with service metadata
    const resource = this.createResource();

    // Create trace exporter
    const traceExporter = this.createTraceExporter();

    // Create metric reader (Prometheus)
    const metricReader = this.createMetricReader();

    // Create instrumentations
    const instrumentations = getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": {
        enabled: false, // File system instrumentation is too noisy
      },
      "@opentelemetry/instrumentation-http": {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health checks and metrics endpoints
          const url = req.url || "";
          return (
            url.includes("/health") ||
            url.includes("/metrics") ||
            url.includes("/favicon.ico")
          );
        },
      },
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-nestjs-core": {
        enabled: true,
      },
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations,
    });

    this.sdk.start();

    const environment = process.env.NODE_ENV || "development";

    console.log("[OTel] OpenTelemetry SDK initialized successfully");
    console.log(`[OTel]   Service: ${this.config.OTEL_SERVICE_NAME}`);
    console.log(`[OTel]   Version: ${this.config.OTEL_SERVICE_VERSION}`);
    console.log(`[OTel]   Environment: ${environment}`);
    console.log(
      `[OTel]   Tracing: ${this.config.OTEL_TRACING_ENABLED ? "enabled" : "disabled"} (${this.config.OTEL_TRACE_EXPORTER})`,
    );
    console.log(
      `[OTel]   Metrics: ${this.config.OTEL_METRICS_ENABLED ? "enabled" : "disabled"} (port ${this.config.OTEL_METRICS_PORT})`,
    );
  }

  /**
   * Gracefully shutdown the SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log("[OTel] OpenTelemetry SDK shut down");
    }
  }

  /**
   * Parse resource attributes from comma-separated key=value pairs
   * @example "team=platform,region=us-east" → { team: "platform", region: "us-east" }
   */
  private parseResourceAttributes(
    attrString?: string,
  ): Record<string, string | number | boolean> {
    if (!attrString) return {};

    const attributes: Record<string, string | number | boolean> = {};
    attrString.split(",").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        // Try to parse as number or boolean
        if (value === "true") attributes[key.trim()] = true;
        else if (value === "false") attributes[key.trim()] = false;
        else if (!isNaN(Number(value))) attributes[key.trim()] = Number(value);
        else attributes[key.trim()] = value.trim();
      }
    });
    return attributes;
  }

  /**
   * Create resource with service metadata and custom attributes
   */
  private createResource(): Resource {
    const environment = process.env.NODE_ENV || "development";
    const customAttributes = this.parseResourceAttributes(
      this.config.OTEL_RESOURCE_ATTRIBUTES,
    );

    return new Resource({
      [SEMRESATTRS_SERVICE_NAME]: this.config.OTEL_SERVICE_NAME,
      [SEMRESATTRS_SERVICE_VERSION]: this.config.OTEL_SERVICE_VERSION,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      ...customAttributes,
    });
  }

  /**
   * Create trace exporter based on configuration
   */
  private createTraceExporter() {
    if (!this.config.OTEL_TRACING_ENABLED) {
      return new ConsoleSpanExporter(); // No-op effectively
    }

    switch (this.config.OTEL_TRACE_EXPORTER) {
      case "otlp-http":
        return new OTLPTraceExporter({
          url:
            this.config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
            "http://localhost:4318/v1/traces",
        });
      case "console":
        return new ConsoleSpanExporter();
      default:
        console.warn(
          `[OTel] Unknown trace exporter: ${this.config.OTEL_TRACE_EXPORTER}, falling back to console`,
        );
        return new ConsoleSpanExporter();
    }
  }

  /**
   * Create Prometheus metric reader
   */
  private createMetricReader() {
    if (!this.config.OTEL_METRICS_ENABLED) {
      return undefined;
    }

    return new PrometheusExporter({
      port: this.config.OTEL_METRICS_PORT,
      endpoint: "/metrics",
    });
  }
}
