import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { OtelConfigSchema } from "./config-schema";

/**
 * Validates OpenTelemetry configuration from raw environment variables
 *
 * This function performs synchronous validation using class-validator,
 * enabling fail-fast validation before OTel SDK initialization.
 *
 * @param envVars - Raw environment variables (typically from process.env)
 * @returns Validated OtelConfigSchema instance
 * @throws Error with detailed validation messages if validation fails
 *
 * @example
 * ```typescript
 * // In main.ts bootstrap
 * const otelConfig = validateOtelConfig({
 *   OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
 *   OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
 *   // ... other env vars
 * })
 *
 * const otel = new OtelSDKManager(otelConfig)
 * otel.initialize()
 * ```
 */
export function validateOtelConfig(
  envVars: Record<string, any>,
): OtelConfigSchema {
  // Transform plain object to class instance with decorators
  // exposeUnsetFields: false allows @Transform decorators to run even for undefined values
  const config = plainToInstance(OtelConfigSchema, envVars, {
    enableImplicitConversion: true,
    exposeUnsetFields: false,
  });

  // Perform synchronous validation
  const errors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    // Format validation errors with helpful details
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(", ")
          : "Unknown validation error";
        const actualValue =
          error.value !== undefined
            ? ` (received: ${JSON.stringify(error.value)})`
            : "";
        return `  - ${error.property}: ${constraints}${actualValue}`;
      })
      .join("\n");

    throw new Error(
      `❌ OpenTelemetry configuration validation failed:\n${errorMessages}\n\n` +
        `Please check your .env file or environment variables.\n` +
        `Environment file priority: .env.local > .env.production > .env`,
    );
  }

  return config;
}
