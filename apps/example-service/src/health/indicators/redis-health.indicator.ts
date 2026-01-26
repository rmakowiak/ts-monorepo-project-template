import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { PinoLogger } from "nestjs-pino";
import Redis from "ioredis";
import { AppConfigService } from "~/shared/config/app-config.service";

/**
 * Redis health indicator for cache connectivity
 *
 * @remarks
 * - Creates a Redis client on demand for health checks
 * - Returns connection latency in metadata
 * - Gracefully handles Redis being optional
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    private readonly logger: PinoLogger,
    private readonly config: AppConfigService,
  ) {
    super();
    this.logger.setContext(RedisHealthIndicator.name);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let redis: Redis | null = null;

    try {
      const startTime = Date.now();

      // Create Redis client
      redis = new Redis(
        this.config.database.REDIS_URL || "redis://localhost:6379",
        {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // Don't retry on health check
          lazyConnect: true,
        },
      );

      // Test connection with PING command
      await redis.connect();
      const response = await redis.ping();

      const latency = Date.now() - startTime;

      if (response === "PONG") {
        this.logger.debug({ latency }, "Redis health check passed");

        return this.getStatus(key, true, {
          message: "Redis is responsive",
          latency: `${latency}ms`,
        });
      }

      throw new Error("Redis PING did not return PONG");
    } catch (error) {
      this.logger.error({ error }, "Redis health check failed");

      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    } finally {
      // Always disconnect to avoid connection leaks
      if (redis) {
        await redis.quit().catch(() => {
          // Ignore disconnect errors
        });
      }
    }
  }
}
