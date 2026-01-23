import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(DatabaseHealthIndicator.name);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // In a real application, this would check repository/database connection
      // For now, we'll simulate a simple check
      const isHealthy = true;

      if (isHealthy) {
        this.logger.debug("Database health check passed");
        return this.getStatus(key, true, {
          message: "Database is responsive",
        });
      }

      this.logger.warn("Database health check failed");
      throw new HealthCheckError(
        "Database check failed",
        this.getStatus(key, false),
      );
    } catch (error) {
      this.logger.error({ error }, "Database health check error");
      throw new HealthCheckError(
        "Database check failed",
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }
}
