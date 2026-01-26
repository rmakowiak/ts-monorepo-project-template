import { IsBoolean, IsInt, IsString, Min } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Security configuration schema
 * Validates security-related environment variables
 *
 * @remarks
 * All security features are configurable via environment variables
 * Default values prioritize security while supporting development workflows
 *
 * @example
 * ```bash
 * SECURITY_HELMET_ENABLED=true
 * SECURITY_CORS_ORIGINS=https://app.example.com,https://admin.example.com
 * SECURITY_RATE_LIMIT_ENABLED=true
 * SECURITY_RATE_LIMIT_TTL=60000
 * SECURITY_RATE_LIMIT_MAX_REQUESTS=100
 * ```
 */
export class SecurityConfigSchema {
  /**
   * Enable Helmet security headers
   * @default true
   */
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  readonly SECURITY_HELMET_ENABLED!: boolean;

  /**
   * CORS allowed origins (comma-separated)
   * Use specific domains in production, "*" only for development
   *
   * @default "*"
   * @example "https://app.example.com,https://admin.example.com"
   */
  @IsString()
  readonly SECURITY_CORS_ORIGINS!: string;

  /**
   * Enable rate limiting (throttling)
   * @default true
   */
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  readonly SECURITY_RATE_LIMIT_ENABLED!: boolean;

  /**
   * Rate limit time window in milliseconds
   * @default 60000 (1 minute)
   * @minimum 1000 (1 second) - values below this will fail validation
   * @validation IsInt, Min(1000)
   */
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1000)
  readonly SECURITY_RATE_LIMIT_TTL!: number;

  /**
   * Maximum requests allowed per time window
   * @default 100
   * @minimum 1 - at least 1 request must be allowed
   * @validation IsInt, Min(1)
   */
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  readonly SECURITY_RATE_LIMIT_MAX_REQUESTS!: number;

  /**
   * Max request body size in bytes
   * @default 1048576 (1MB)
   * @minimum 1024 (1KB) - must allow at least 1KB requests
   * @validation IsInt, Min(1024)
   */
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1024)
  readonly SECURITY_MAX_BODY_SIZE!: number;
}
