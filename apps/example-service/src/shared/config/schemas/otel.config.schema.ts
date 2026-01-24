import {
  IsString,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  MinLength,
  IsUrl,
} from "class-validator";
import { Transform } from "class-transformer";

/**
 * OpenTelemetry trace exporter types
 */
export enum TraceExporterType {
  OtlpHttp = "otlp-http",
  Console = "console",
}

/**
 * OpenTelemetry configuration schema
 * Validates observability settings for distributed tracing and metrics
 *
 * @see ../../../../packages/otel/README.md for detailed documentation
 */
export class OtelConfigSchema {
  /**
   * Service name for traces and metrics (required)
   * @example "example-service"
   */
  @IsString()
  @MinLength(1, {
    message:
      "OTEL_SERVICE_NAME is required. Set it to your service name (e.g., OTEL_SERVICE_NAME=example-service)",
  })
  readonly OTEL_SERVICE_NAME!: string;

  /**
   * Service version for observability
   * @default "1.0.0"
   */
  @IsString()
  readonly OTEL_SERVICE_VERSION!: string;

  /**
   * Enable/disable OpenTelemetry
   * @default true
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return true;
    const str = String(value).toLowerCase();
    return str !== "false" && str !== "0";
  })
  @IsBoolean()
  readonly OTEL_ENABLED!: boolean;

  /**
   * Enable/disable distributed tracing
   * @default true
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return true;
    const str = String(value).toLowerCase();
    return str !== "false" && str !== "0";
  })
  @IsBoolean()
  readonly OTEL_TRACING_ENABLED!: boolean;

  /**
   * Trace exporter type
   * @default "otlp-http"
   */
  @IsEnum(TraceExporterType)
  readonly OTEL_TRACE_EXPORTER!: TraceExporterType;

  /**
   * OTLP trace receiver endpoint (optional)
   * @default "http://localhost:4318/v1/traces"
   * @example "https://collector.example.com:4318/v1/traces"
   */
  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT must be a valid URL" },
  )
  readonly OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;

  /**
   * Trace sampling rate (0.0 to 1.0)
   * - 1.0 = 100% (all requests traced) - use in development
   * - 0.1 = 10% (10% of requests traced) - recommended for production
   * @default 1.0
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return 1.0;
    return parseFloat(String(value));
  })
  @IsNumber()
  @Min(0, { message: "OTEL_TRACE_SAMPLE_RATE must be between 0.0 and 1.0" })
  @Max(1, { message: "OTEL_TRACE_SAMPLE_RATE must be between 0.0 and 1.0" })
  readonly OTEL_TRACE_SAMPLE_RATE!: number;

  /**
   * Enable/disable metrics collection
   * @default true
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return true;
    const str = String(value).toLowerCase();
    return str !== "false" && str !== "0";
  })
  @IsBoolean()
  readonly OTEL_METRICS_ENABLED!: boolean;

  /**
   * Prometheus metrics endpoint port
   * Prometheus will scrape http://localhost:OTEL_METRICS_PORT/metrics
   * @default 9464
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return 9464;
    return parseInt(String(value), 10);
  })
  @IsNumber()
  @Min(1, { message: "OTEL_METRICS_PORT must be between 1 and 65535" })
  @Max(65535, { message: "OTEL_METRICS_PORT must be between 1 and 65535" })
  readonly OTEL_METRICS_PORT!: number;

  /**
   * Additional resource attributes (comma-separated key=value pairs)
   * @optional
   * @example "team=platform,region=us-east"
   */
  @IsOptional()
  @IsString()
  readonly OTEL_RESOURCE_ATTRIBUTES?: string;
}
