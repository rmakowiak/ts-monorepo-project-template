import { trace, context } from '@opentelemetry/api'

/**
 * Pino mixin that injects OpenTelemetry trace context into log entries
 *
 * This mixin automatically adds trace_id, span_id, and trace_flags to every log
 * when the log is made within an active trace span. This enables correlation
 * between logs and traces in observability platforms like Jaeger, Grafana, etc.
 *
 * @example
 * ```typescript
 * import { createPinoOtelMixin } from '@monorepo/otel'
 *
 * LoggerModule.forRoot({
 *   pinoHttp: {
 *     mixin: createPinoOtelMixin(),
 *     // ... other config
 *   }
 * })
 * ```
 */
export function createPinoOtelMixin() {
  return function otelMixin(): Record<string, string | number> {
    // Get the active span from the current context
    const span = trace.getSpan(context.active())

    if (!span) {
      // No active span, return empty object
      return {}
    }

    // Extract span context
    const spanContext = span.spanContext()

    // Return trace context fields to be merged into log entry
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      trace_flags: spanContext.traceFlags,
    }
  }
}
