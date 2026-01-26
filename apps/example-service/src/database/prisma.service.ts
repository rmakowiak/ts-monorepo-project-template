import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { AppConfigService } from "~/shared/config/app-config.service";

/**
 * PrismaService extends PrismaClient with NestJS lifecycle hooks
 *
 * Provides:
 * - Automatic connection on module init
 * - Graceful disconnect on module destroy
 * - Database logging control via config
 * - Global provider for dependency injection
 *
 * @example
 * ```typescript
 * // In a repository
 * constructor(private readonly prisma: PrismaService) {}
 *
 * async findAll() {
 *   return this.prisma.product.findMany();
 * }
 * ```
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, "query" | "error" | "warn">
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    config: AppConfigService,
    private readonly logger: PinoLogger,
  ) {
    super({
      datasources: {
        db: {
          url: config.database.DATABASE_URL,
        },
      },
      log: config.database.DATABASE_LOGGING
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [],
    });

    logger.setContext(PrismaService.name);

    // Subscribe to Prisma events for logging
    if (config.database.DATABASE_LOGGING) {
      this.$on("query", (e: Prisma.QueryEvent) => {
        logger.debug(
          {
            query: e.query,
            params: e.params,
            duration: e.duration,
          },
          "Database query executed",
        );
      });

      this.$on("error", (e: Prisma.LogEvent) => {
        logger.error(
          {
            target: e.target,
            message: e.message,
          },
          "Database error",
        );
      });

      this.$on("warn", (e: Prisma.LogEvent) => {
        logger.warn({ message: e.message }, "Database warning");
      });
    }
  }

  async onModuleInit() {
    this.logger.info("Connecting to database...");
    try {
      await this.$connect();
      this.logger.info("Database connection established");
    } catch (error) {
      this.logger.error({ error }, "Failed to connect to database");
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.info("Disconnecting from database...");
    await this.$disconnect();
    this.logger.info("Database connection closed");
  }
}
