/**
 * Default JWT secret for development and testing
 * Must be at least 32 characters to pass validation
 *
 * IMPORTANT: Never use this in production!
 * Generate a secure secret with: openssl rand -base64 32
 */
export const DEFAULT_JWT_SECRET =
  "dev-secret-change-in-production-at-least-32-chars";
