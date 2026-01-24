import { plainToInstance } from "class-transformer";
import { validateSync, ValidationError } from "class-validator";
import {
  AppConfigSchema,
  Environment,
  LogLevel,
} from "./schemas/app.config.schema";
import { AuthConfigSchema } from "./schemas/auth.config.schema";
import { DEFAULT_JWT_SECRET } from "./config.constants";

/**
 * Combined configuration object with all validated namespaces
 *
 * @remarks
 * This type should only be created by `loadConfig()`, which ensures:
 * - All schemas are validated against environment variables
 * - The entire structure is deeply frozen (immutable)
 * - Secrets are properly masked in logs
 * - Validation errors include helpful context and file priority hints
 *
 * @example
 * ```typescript
 * // In a service
 * constructor(private readonly config: AppConfigService) {}
 *
 * someMethod() {
 *   const port = this.config.app.PORT;
 *   const secret = this.config.auth.JWT_SECRET;
 * }
 * ```
 *
 * @see loadConfig
 * @see AppConfigService
 */
export interface ValidatedConfig {
  readonly app: AppConfigSchema;
  readonly auth: AuthConfigSchema;
}

/**
 * Validates a configuration schema class instance
 * Throws detailed error on validation failure
 */
function validateConfig<T extends object>(config: T, schemaName: string): T {
  const errors: ValidationError[] = validateSync(config, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(", ")
          : "Unknown error";
        const actualValue =
          error.value !== undefined
            ? ` (received: ${JSON.stringify(error.value)})`
            : "";
        return `  - ${error.property}: ${constraints}${actualValue}`;
      })
      .join("\n");

    throw new Error(
      `❌ Configuration validation failed for ${schemaName}:\n${messages}\n\n` +
        `Please check your .env file or environment variables.\n` +
        `Environment file priority: .env.local > .env.production > .env`,
    );
  }

  return config;
}

/**
 * Loads and validates a configuration schema
 * Combines plainToInstance and validateConfig into a single DRY helper
 */
function loadAndValidateSchema<T extends object>(
  schemaClass: new () => T,
  envData: Record<string, any>,
  schemaName: string,
): T {
  let config: T;

  try {
    config = plainToInstance(schemaClass, envData, {
      enableImplicitConversion: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `❌ Failed to transform ${schemaName} configuration:\n` +
        `  ${errorMessage}\n\n` +
        `This is likely due to invalid @Transform decorators or malformed environment values.\n` +
        `Environment data provided: ${JSON.stringify(envData, null, 2)}`,
    );
  }

  return validateConfig(config, schemaName);
}

/**
 * Load and validate all configuration from environment variables
 * This function is called by @nestjs/config during app initialization
 *
 * See CONFIG.md for environment file priority details
 */
export function loadConfig(): ValidatedConfig {
  const appConfig = loadAndValidateSchema(
    AppConfigSchema,
    {
      PORT: process.env.PORT || "8000",
      NODE_ENV: process.env.NODE_ENV || Environment.Development,
      LOG_LEVEL: process.env.LOG_LEVEL || LogLevel.Info,
    },
    "AppConfig",
  );

  const authConfig = loadAndValidateSchema(
    AuthConfigSchema,
    {
      JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    },
    "AuthConfig",
  );

  // Log loaded configuration (masking secrets) in non-test environments
  // NOTE: Using console.log here instead of PinoLogger because this runs during
  // bootstrap before the logger is initialized. This is a bootstrap-phase log.
  // For application-level logging, use PinoLogger injected via DI.
  if (process.env.NODE_ENV !== "test") {
    const configSummary = {
      app: {
        PORT: appConfig.PORT,
        NODE_ENV: appConfig.NODE_ENV,
        LOG_LEVEL: appConfig.LOG_LEVEL,
      },
      auth: {
        JWT_SECRET:
          authConfig.JWT_SECRET === DEFAULT_JWT_SECRET
            ? "<using DEFAULT_JWT_SECRET>"
            : "<custom secret set>",
      },
    };
    console.log(
      "[Config] Loaded configuration:",
      JSON.stringify(configSummary, null, 2),
    );
  }

  // Warn if using default JWT secret in non-development environments
  // NOTE: Using console.warn for bootstrap warnings (before logger initialization)
  if (
    authConfig.JWT_SECRET === DEFAULT_JWT_SECRET &&
    appConfig.NODE_ENV !== Environment.Development &&
    appConfig.NODE_ENV !== Environment.Test
  ) {
    console.warn(
      "⚠️  WARNING: Using DEFAULT_JWT_SECRET in production! " +
        "Generate a secure secret with: openssl rand -base64 32",
    );
  }

  // Freeze config objects to prevent mutation
  return Object.freeze({
    app: Object.freeze(appConfig),
    auth: Object.freeze(authConfig),
  });
}
