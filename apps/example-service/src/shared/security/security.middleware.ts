import helmet from "helmet";
import type { RequestHandler } from "express";

/**
 * Security middleware configuration
 * Defines helmet options and CORS settings
 */
export interface SecurityMiddlewareConfig {
  helmet: {
    enabled: boolean;
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
  };
}

/**
 * Creates Helmet security middleware with API-friendly defaults
 * Disables CSP and COEP to support Swagger UI and modern browsers
 *
 * @param config - Security configuration from environment
 * @returns Array of Express middleware functions
 *
 * @remarks
 * Uses console.warn/info for logging because this runs during bootstrap
 * before the DI container and PinoLogger are available
 */
export function createSecurityMiddleware(
  config: SecurityMiddlewareConfig,
): RequestHandler[] {
  if (!config.helmet.enabled) {
    // SECURITY WARNING: Running without security headers
    console.warn(
      "[SECURITY WARNING] Helmet security headers are DISABLED - application is vulnerable to XSS, clickjacking, and other attacks. " +
        "Set SECURITY_HELMET_ENABLED=true to enable protection.",
    );
    return [];
  }

  // Log Helmet configuration for security audit trail
  console.info(
    `[SECURITY] Applying Helmet security headers: ` +
      `CSP=${config.helmet.contentSecurityPolicy}, ` +
      `COEP=${config.helmet.crossOriginEmbedderPolicy}, ` +
      `HSTS=31536000s (1 year)`,
  );

  try {
    return [
      helmet({
        contentSecurityPolicy: config.helmet.contentSecurityPolicy,
        crossOriginEmbedderPolicy: config.helmet.crossOriginEmbedderPolicy,
        // Explicit security header configuration (stricter than Helmet defaults)
        // These protect against common web attacks:
        hsts: {
          maxAge: 31536000, // 1 year - enforce HTTPS for returning visitors
          includeSubDomains: true, // Apply HSTS to all subdomains
          preload: true, // Allow inclusion in browser HSTS preload lists
        },
        frameguard: { action: "deny" }, // X-Frame-Options: DENY - prevents clickjacking
        noSniff: true, // X-Content-Type-Options: nosniff - prevents MIME sniffing attacks
        xssFilter: true, // X-XSS-Protection: 1; mode=block - legacy XSS protection
      }),
    ];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[SECURITY ERROR] Failed to create Helmet security middleware:",
      errorMessage,
    );
    throw error;
  }
}
