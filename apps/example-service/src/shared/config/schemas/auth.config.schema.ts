import { IsString, MinLength } from "class-validator";

/**
 * Authentication configuration schema
 * Validates JWT and auth-related settings
 */
export class AuthConfigSchema {
  /**
   * JWT signing secret
   * Must be at least 32 characters for security
   * @default 'dev-secret-change-in-production' (development only)
   */
  @IsString()
  @MinLength(32, {
    message:
      "JWT_SECRET must be at least 32 characters for security. Generate with: openssl rand -base64 32",
  })
  JWT_SECRET!: string;
}
