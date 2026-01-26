import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "~/database/prisma.service";

/**
 * Database health indicator for PostgreSQL connectivity
 *
 * @remarks
 * - Performs a simple query to verify database connection
 * - Returns connection latency in metadata
 * - Logs failures for monitoring
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {
    super();
    this.logger.setContext(DatabaseHealthIndicator.name);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();

      // Execute a simple query to check PostgreSQL connectivity
      await this.prisma.$queryRaw`SELECT 1 as result`;

      const latency = Date.now() - startTime;

      this.logger.debug({ latency }, "Database health check passed");

      return this.getStatus(key, true, {
        message: "PostgreSQL is responsive",
        latency: `${latency}ms`,
      });
    } catch (error) {
      this.logger.error({ error }, "Database health check failed");

      throw new HealthCheckError(
        "Database check failed",
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }
}
