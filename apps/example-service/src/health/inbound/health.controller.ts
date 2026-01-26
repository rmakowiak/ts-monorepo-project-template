import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { Public } from "~/auth/decorators/public.decorator";
import { DatabaseHealthIndicator } from "../indicators/database-health.indicator";
import { RedisHealthIndicator } from "../indicators/redis-health.indicator";
import { AppConfigService } from "~/shared/config/app-config.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private database: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
    private config: AppConfigService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: "Check service health" })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        info: { type: "object" },
        error: { type: "object" },
        details: { type: "object" },
      },
    },
  })
  @ApiResponse({ status: 503, description: "Service is unhealthy" })
  check() {
    return this.health.check([
      () =>
        this.http.pingCheck("http", `http://localhost:${this.config.app.PORT}`),
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS("memory_rss", 300 * 1024 * 1024), // 300MB
      () =>
        this.disk.checkStorage("storage", { path: "/", thresholdPercent: 0.9 }),
      () => this.database.isHealthy("database"),
      () => this.redis.isHealthy("redis"),
    ]);
  }
}
