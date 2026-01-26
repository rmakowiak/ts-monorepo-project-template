import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppConfigService } from "../config/app-config.service";
import { RateLimitingGuard } from "./rate-limiting.guard";

/**
 * Security Module
 * Provides rate limiting and security middleware configuration
 *
 * Features:
 * - Global rate limiting via ThrottlerGuard
 * - Configurable via environment variables
 * - Can be disabled for testing or specific environments
 *
 * @remarks
 * This module is imported by SharedModule and made global
 * Rate limiting is applied to all routes except those decorated with @SkipThrottle()
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const security = config.security;

        // Skip rate limiting if disabled
        if (!security.SECURITY_RATE_LIMIT_ENABLED) {
          return { throttlers: [] };
        }

        return {
          throttlers: [
            {
              ttl: security.SECURITY_RATE_LIMIT_TTL,
              limit: security.SECURITY_RATE_LIMIT_MAX_REQUESTS,
            },
          ],
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitingGuard,
    },
  ],
})
export class SecurityModule {}
