import { trace, context, Span } from '@opentelemetry/api'

/**
 * Add custom attributes to the currently active span
 *
 * This is useful for adding business context to auto-instrumented spans
 * (e.g., HTTP request spans, database query spans, etc.)
 *
 * @param attributes - Key-value pairs to add as span attributes
 *
 * @example
 * ```typescript
 * import { addSpanAttributes } from '@monorepo/otel'
 *
 * async createProduct(dto: CreateProductDto): Promise<Product> {
 *   addSpanAttributes({
 *     'product.sku': dto.sku,
 *     'product.category': dto.category,
 *     'product.price': dto.price,
 *   })
 *
 *   return this.repository.save(dto)
 * }
 * ```
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const span = trace.getSpan(context.active())

  if (!span) {
    // No active span - silently skip
    return
  }

  Object.entries(attributes).forEach(([key, value]) => {
    span.setAttribute(key, value)
  })
}

/**
 * Add an event to the currently active span
 *
 * Events are timestamped annotations that can represent interesting points
 * in the span's lifecycle (e.g., cache hit, validation error, retry attempt)
 *
 * @param name - Event name (e.g., "cache.hit", "validation.failed")
 * @param attributes - Optional key-value pairs for the event
 *
 * @example
 * ```typescript
 * import { addSpanEvent } from '@monorepo/otel'
 *
 * async getProduct(sku: string): Promise<Product> {
 *   const cached = await this.cache.get(sku)
 *   if (cached) {
 *     addSpanEvent('cache.hit', { sku })
 *     return cached
 *   }
 *
 *   addSpanEvent('cache.miss', { sku })
 *   return this.repository.findBySku(sku)
 * }
 * ```
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = trace.getSpan(context.active())

  if (!span) {
    // No active span - silently skip
    return
  }

  span.addEvent(name, attributes)
}

/**
 * Get the currently active span
 *
 * This is useful for advanced use cases where you need direct access
 * to the span object (e.g., to check span context, update status, etc.)
 *
 * @returns The active span, or undefined if no span is active
 *
 * @example
 * ```typescript
 * import { getActiveSpan } from '@monorepo/otel'
 *
 * async processOrder(orderId: string): Promise<void> {
 *   const span = getActiveSpan()
 *   if (span) {
 *     const spanContext = span.spanContext()
 *     console.log(`Processing order in trace: ${spanContext.traceId}`)
 *   }
 * }
 * ```
 */
export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active())
}

/**
 * Get the current trace ID
 *
 * @returns The trace ID of the active span, or undefined if no span is active
 *
 * @example
 * ```typescript
 * import { getTraceId } from '@monorepo/otel'
 *
 * async createOrder(dto: CreateOrderDto): Promise<Order> {
 *   const traceId = getTraceId()
 *   console.log(`Creating order with trace ID: ${traceId}`)
 *
 *   const order = await this.repository.save(dto)
 *   order.traceId = traceId  // Store for later correlation
 *   return order
 * }
 * ```
 */
export function getTraceId(): string | undefined {
  const span = trace.getSpan(context.active())
  return span?.spanContext().traceId
}

/**
 * Get the current span ID
 *
 * @returns The span ID of the active span, or undefined if no span is active
 */
export function getSpanId(): string | undefined {
  const span = trace.getSpan(context.active())
  return span?.spanContext().spanId
}
