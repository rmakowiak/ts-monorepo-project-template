import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfigSchema } from "./schemas/app.config.schema";
import type { AuthConfigSchema } from "./schemas/auth.config.schema";
import type { ValidatedConfig } from "./config.loader";

/**
 * Type-safe configuration service wrapper
 * Provides strongly-typed access to all configuration namespaces
 *
 * Usage:
 *   constructor(private config: AppConfigService) {}
 *   const port = this.config.app.PORT;
 *   const secret = this.config.auth.JWT_SECRET;
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
   * Get entire configuration object (for debugging)
   */
  get all(): ValidatedConfig {
    return {
      app: this.app,
      auth: this.auth,
    };
  }
}
