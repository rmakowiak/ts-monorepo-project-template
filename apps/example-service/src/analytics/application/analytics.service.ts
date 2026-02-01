import { Inject, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { randomUUID } from "crypto";
import { getTraceId } from "@monorepo/otel";
import type { AnalyticsRepository } from "../outbound/ports/analytics-repository.port";
import type { AnalyticsEvent } from "../domain/analytics-event.entity";
import type { EventType } from "../domain/event-type.enum";
import type { TrackEventOptions } from "./dto/track-event.dto";

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject("AnalyticsRepository")
    private readonly repository: AnalyticsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsService.name);
  }

  async track(
    eventType: EventType,
    options: TrackEventOptions = {},
  ): Promise<AnalyticsEvent> {
    const traceId = getTraceId();

    this.logger.info(
      { eventType, userId: options.userId, traceId },
      "Tracking analytics event",
    );

    const event: AnalyticsEvent = {
      id: randomUUID(),
      eventType,
      userId: options.userId ?? null,
      timestamp: options.timestamp ?? new Date(),
      metadata: options.metadata ?? null,
      traceId: traceId ?? null,
    };

    try {
      const saved = await this.repository.save(event);
      this.logger.info(
        { eventId: saved.id, eventType: saved.eventType },
        "Analytics event tracked successfully",
      );
      return saved;
    } catch (error) {
      this.logger.error(
        { error, eventType, userId: options.userId },
        "Failed to track analytics event",
      );
      throw error;
    }
  }

  async findById(id: string): Promise<AnalyticsEvent | null> {
    this.logger.debug({ eventId: id }, "Finding analytics event by ID");
    return this.repository.findById(id);
  }

  async findByEventType(
    eventType: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ events: AnalyticsEvent[]; total: number }> {
    this.logger.debug({ eventType, ...options }, "Finding events by type");
    return this.repository.findByEventType(eventType, options);
  }

  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ events: AnalyticsEvent[]; total: number }> {
    this.logger.debug({ userId, ...options }, "Finding events by user ID");
    return this.repository.findByUserId(userId, options);
  }

  async findByTraceId(traceId: string): Promise<AnalyticsEvent[]> {
    this.logger.debug({ traceId }, "Finding events by trace ID");
    return this.repository.findByTraceId(traceId);
  }
}
