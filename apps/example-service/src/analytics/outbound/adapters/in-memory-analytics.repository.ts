import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type {
  AnalyticsRepository,
  QueryOptions,
  FindByEventTypeResult,
} from "../ports/analytics-repository.port";
import type { AnalyticsEvent } from "../../domain/analytics-event.entity";

@Injectable()
export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private events = new Map<string, AnalyticsEvent>();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(InMemoryAnalyticsRepository.name);
  }

  async save(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    this.logger.debug(
      { eventId: event.id, eventType: event.eventType },
      "Saving analytics event",
    );

    this.events.set(event.id, event);

    this.logger.info(
      { eventId: event.id, eventType: event.eventType },
      "Analytics event saved successfully",
    );

    return event;
  }

  async findById(id: string): Promise<AnalyticsEvent | null> {
    this.logger.debug({ eventId: id }, "Finding analytics event by ID");

    const event = this.events.get(id) || null;

    if (!event) {
      this.logger.debug({ eventId: id }, "Analytics event not found");
      return null;
    }

    this.logger.debug({ eventId: id }, "Analytics event found");
    return event;
  }

  async findByEventType(
    eventType: string,
    options: QueryOptions = {},
  ): Promise<FindByEventTypeResult> {
    const { limit = 50, offset = 0 } = options;

    this.logger.debug(
      { eventType, limit, offset },
      "Finding analytics events by event type",
    );

    const allEvents = Array.from(this.events.values())
      .filter((e) => e.eventType === eventType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = allEvents.length;
    const events = allEvents.slice(offset, offset + limit);

    this.logger.info(
      { eventType, count: events.length, total },
      "Analytics events found by event type",
    );

    return { events, total };
  }

  async findByUserId(
    userId: string,
    options: QueryOptions = {},
  ): Promise<FindByEventTypeResult> {
    const { limit = 50, offset = 0 } = options;

    this.logger.debug(
      { userId, limit, offset },
      "Finding analytics events by user ID",
    );

    const allEvents = Array.from(this.events.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = allEvents.length;
    const events = allEvents.slice(offset, offset + limit);

    this.logger.info(
      { userId, count: events.length, total },
      "Analytics events found by user ID",
    );

    return { events, total };
  }

  async findByTraceId(traceId: string): Promise<AnalyticsEvent[]> {
    this.logger.debug({ traceId }, "Finding analytics events by trace ID");

    const events = Array.from(this.events.values())
      .filter((e) => e.traceId === traceId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    this.logger.info(
      { traceId, count: events.length },
      "Analytics events found by trace ID",
    );

    return events;
  }
}
