import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { HealthController } from "./inbound/health.controller";
import { DatabaseHealthIndicator } from "./indicators/database-health.indicator";
import { RedisHealthIndicator } from "./indicators/redis-health.indicator";

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
