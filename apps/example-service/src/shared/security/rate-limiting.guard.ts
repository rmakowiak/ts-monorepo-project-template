import { Injectable, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from "@nestjs/throttler";
import { PinoLogger } from "nestjs-pino";

/**
 * Rate limiting guard with logging
 * Extends NestJS ThrottlerGuard to add structured logging
 *
 * Automatically enforces rate limits configured via ThrottlerModule
 * Logs warnings when rate limits are exceeded for monitoring and alerting
 */
@Injectable()
export class RateLimitingGuard extends ThrottlerGuard {
  private readonly logger: PinoLogger;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    logger: PinoLogger,
  ) {
    super(options, storageService, reflector);
    this.logger = logger;
    this.logger.setContext(RateLimitingGuard.name);
  }

  /**
   * Override to add logging when rate limit is exceeded
   * Called internally by ThrottlerGuard when limit is hit
   *
   * @remarks
   * Logs are structured and include:
   * - ip: Client IP address (for identifying abuse patterns)
   * - path: Endpoint being rate limited
   * - method: HTTP method
   *
   * In production, these logs can be:
   * - Sent to SIEM for security monitoring
   * - Aggregated to create rate limit abuse alerts
   * - Used to identify and block malicious actors
   *
   * @throws ThrottlerException - Returns 429 Too Many Requests to client
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
  ): Promise<void> {
    let request;
    try {
      request = _context.switchToHttp().getRequest();
    } catch (error) {
      // CRITICAL: Cannot extract HTTP request context
      this.logger.error(
        {
          error,
          contextType: _context.getType(),
        },
        "Failed to extract HTTP request from execution context during rate limit enforcement",
      );
      throw new ThrottlerException();
    }

    const ip = request.ip || request.socket?.remoteAddress;
    const path = request.path;
    const method = request.method;

    // CRITICAL: Missing IP identification in rate limit violation
    if (!ip) {
      this.logger.error(
        {
          path,
          method,
          headers: {
            xForwardedFor: request.headers["x-forwarded-for"],
            xRealIp: request.headers["x-real-ip"],
          },
          socketInfo: {
            hasSocket: !!request.socket,
            hasRemoteAddress: !!request.socket?.remoteAddress,
          },
        },
        "SECURITY: Rate limit exceeded but cannot determine client IP - check reverse proxy configuration",
      );
    } else {
      this.logger.warn({ ip, path, method }, "Rate limit exceeded");
    }

    throw new ThrottlerException();
  }
}
