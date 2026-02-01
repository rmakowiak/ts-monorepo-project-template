import { Global, Module } from "@nestjs/common";
import { AnalyticsService } from "./application/analytics.service";
import { PrismaAnalyticsRepository } from "./outbound/adapters/prisma-analytics.repository";

@Global()
@Module({
  providers: [
    AnalyticsService,
    {
      provide: "AnalyticsRepository",
      useClass: PrismaAnalyticsRepository,
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
