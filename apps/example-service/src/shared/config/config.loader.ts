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
 * Combined configuration object returned by the loader
 */
export interface ValidatedConfig {
  app: AppConfigSchema;
  auth: AuthConfigSchema;
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
        return `  - ${error.property}: ${constraints}`;
      })
      .join("\n");

    throw new Error(
      `❌ Configuration validation failed for ${schemaName}:\n${messages}\n\n` +
        `Please check your .env file or environment variables.`,
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
  const config = plainToInstance(schemaClass, envData, {
    enableImplicitConversion: true,
  });
  return validateConfig(config, schemaName);
}

/**
 * Load and validate all configuration from environment variables
 * This function is called by @nestjs/config during app initialization
 *
 * Environment file priority: .env.local > .env.production > .env
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

  return {
    app: appConfig,
    auth: authConfig,
  };
}
