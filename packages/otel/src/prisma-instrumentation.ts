/**
 * Prisma instrumentation setup for OpenTelemetry
 *
 * Prisma 6.1.0+ has stable tracing support (no preview feature needed)
 *
 * CRITICAL: This must be imported and called BEFORE any Prisma Client imports
 */

import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PrismaInstrumentation } from "@prisma/instrumentation";

/**
 * Register Prisma instrumentation with OpenTelemetry
 *
 * Must be called before PrismaClient is instantiated to ensure
 * the global tracing helper is available
 */
export function registerPrismaInstrumentation(): void {
  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation()],
  });

  console.log("[OTel] Prisma instrumentation registered");
}
