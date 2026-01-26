import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfigSchema } from "./schemas/app.config.schema";
import type { AuthConfigSchema } from "./schemas/auth.config.schema";
import type { DatabaseConfigSchema } from "./schemas/database.config.schema";
import type { ValidatedConfig } from "./config.loader";

/**
 * Type-safe configuration service wrapper
 * Provides strongly-typed access to all configuration namespaces
 *
 * All configuration objects are **immutable** (frozen) to prevent runtime modifications.
 * Attempting to mutate config values will throw in strict mode or fail silently otherwise.
 *
 * @example
 * ```typescript
 * constructor(private config: AppConfigService) {}
 *
 * someMethod() {
 *   const port = this.config.app.PORT;              // Type: number
 *   const env = this.config.app.NODE_ENV;           // Type: Environment
 *   const secret = this.config.auth.JWT_SECRET;     // Type: string
 * }
 * ```
 *
 * Adding new namespaces:
 *   1. Create new schema in schemas/[name].config.schema.ts
 *   2. Add to ValidatedConfig interface in config.loader.ts
 *   3. Add validation in loadConfig() function
 *   4. Add getter method below
 */
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService<ValidatedConfig, true>) {}

  /**
   * Application configuration namespace
   * Contains: PORT, NODE_ENV, LOG_LEVEL
   */
  get app(): AppConfigSchema {
    return this.configService.get("app", { infer: true });
  }

  /**
   * Authentication configuration namespace
   * Contains: JWT_SECRET
   */
  get auth(): AuthConfigSchema {
    return this.configService.get("auth", { infer: true });
  }

  /**
   * Database configuration namespace
   * Contains: DATABASE_URL, REDIS_URL, DATABASE_LOGGING
   */
  get database(): DatabaseConfigSchema {
    return this.configService.get("database", { infer: true });
  }

  /**
   * Get entire configuration object (for debugging)
   */
  get all(): ValidatedConfig {
    return {
      app: this.app,
      auth: this.auth,
      database: this.database,
    };
  }
}
