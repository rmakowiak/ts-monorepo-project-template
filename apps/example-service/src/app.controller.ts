import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "~/auth/decorators/public.decorator";

@ApiTags("root")
@Controller()
@SkipThrottle()
export class AppController {
  @Get()
  @Public()
  @ApiOperation({ summary: "Root endpoint" })
  @ApiResponse({
    status: 200,
    description: "Service information",
    schema: {
      type: "object",
      properties: {
        service: { type: "string", example: "example-service" },
        version: { type: "string", example: "1.0.0" },
        status: { type: "string", example: "running" },
      },
    },
  })
  getInfo() {
    return {
      service: "example-service",
      version: "1.0.0",
      status: "running",
    };
  }
}
