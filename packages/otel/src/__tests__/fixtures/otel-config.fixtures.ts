import { TraceExporterType } from "../../config-schema";

/**
 * Boundary values for OpenTelemetry configuration testing
 * Used for Boundary Value Analysis (BVA) in tests
 */
export const BOUNDARY_VALUES = {
  sampleRate: {
    valid: {
      minimum: 0.0,
      normal: 0.5,
      maximum: 1.0,
    },
    invalid: {
      belowMinimum: -0.1,
      aboveMaximum: 1.1,
    },
  },
  metricsPort: {
    valid: {
      minimum: 1,
      normal: 9464,
      maximum: 65535,
    },
    invalid: {
      zero: 0,
      belowMinimum: -1,
      aboveMaximum: 65536,
    },
  },
};

/**
 * Valid configuration data for testing (raw env var format - all strings)
 */
export const VALID_CONFIG = {
  OTEL_SERVICE_NAME: "test-service",
  OTEL_SERVICE_VERSION: "1.0.0",
  OTEL_ENABLED: "true",
  OTEL_TRACING_ENABLED: "true",
  OTEL_TRACE_EXPORTER: "otlp-http",
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
  OTEL_TRACE_SAMPLE_RATE: "1.0",
  OTEL_METRICS_ENABLED: "true",
  OTEL_METRICS_PORT: "9464",
  OTEL_RESOURCE_ATTRIBUTES: "team=platform,region=us-east",
};

/**
 * Minimal valid configuration (required field + empty strings for defaults to trigger transforms)
 */
export const MINIMAL_CONFIG = {
  OTEL_SERVICE_NAME: "test-service",
  OTEL_SERVICE_VERSION: "",
  OTEL_ENABLED: "",
  OTEL_TRACING_ENABLED: "",
  OTEL_TRACE_EXPORTER: "",
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: undefined,
  OTEL_TRACE_SAMPLE_RATE: "",
  OTEL_METRICS_ENABLED: "",
  OTEL_METRICS_PORT: "",
  OTEL_RESOURCE_ATTRIBUTES: undefined,
};

/**
 * Helper to create test config with overrides
 */
export function createTestConfig(
  overrides?: Record<string, any>,
): Record<string, any> {
  return {
    ...VALID_CONFIG,
    ...overrides,
  };
}

/**
 * Helper to create minimal config with overrides
 */
export function createMinimalConfig(
  overrides?: Record<string, any>,
): Record<string, any> {
  return {
    ...MINIMAL_CONFIG,
    ...overrides,
  };
}

/**
 * Helper to create config for testing single field (includes SERVICE_NAME + field being tested)
 */
export function createSingleFieldConfig(
  field: string,
  value: any,
): Record<string, any> {
  return {
    OTEL_SERVICE_NAME: "test",
    [field]: value,
    // Add empty strings for other required transform fields
    ...(field !== "OTEL_SERVICE_VERSION" && { OTEL_SERVICE_VERSION: "" }),
    ...(field !== "OTEL_ENABLED" && { OTEL_ENABLED: "" }),
    ...(field !== "OTEL_TRACING_ENABLED" && { OTEL_TRACING_ENABLED: "" }),
    ...(field !== "OTEL_TRACE_EXPORTER" && { OTEL_TRACE_EXPORTER: "" }),
    ...(field !== "OTEL_TRACE_SAMPLE_RATE" && { OTEL_TRACE_SAMPLE_RATE: "" }),
    ...(field !== "OTEL_METRICS_ENABLED" && { OTEL_METRICS_ENABLED: "" }),
    ...(field !== "OTEL_METRICS_PORT" && { OTEL_METRICS_PORT: "" }),
  };
}
