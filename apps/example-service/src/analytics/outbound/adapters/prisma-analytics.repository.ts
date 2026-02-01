import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { Prisma } from "@prisma/client";
import { PrismaService } from "~/database/prisma.service";
import type {
  AnalyticsRepository,
  QueryOptions,
  FindByEventTypeResult,
} from "../ports/analytics-repository.port";
import type { AnalyticsEvent } from "../../domain/analytics-event.entity";

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PrismaAnalyticsRepository.name);
  }

  async save(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    this.logger.debug(
      { eventId: event.id, eventType: event.eventType },
      "Saving analytics event",
    );

    const saved = await this.prisma.analyticsEvent.create({
      data: {
        id: event.id,
        eventType: event.eventType,
        userId: event.userId,
        timestamp: event.timestamp,
        metadata: (event.metadata as Prisma.InputJsonValue) ?? undefined,
        traceId: event.traceId,
      },
    });

    this.logger.info(
      { eventId: saved.id, eventType: saved.eventType },
      "Analytics event saved successfully",
    );

    return this.toDomain(saved);
  }

  async findById(id: string): Promise<AnalyticsEvent | null> {
    this.logger.debug({ eventId: id }, "Finding analytics event by ID");

    const event = await this.prisma.analyticsEvent.findUnique({
      where: { id },
    });

    if (!event) {
      this.logger.debug({ eventId: id }, "Analytics event not found");
      return null;
    }

    this.logger.debug({ eventId: id }, "Analytics event found");
    return this.toDomain(event);
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

    const [events, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { eventType },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.analyticsEvent.count({ where: { eventType } }),
    ]);

    this.logger.info(
      { eventType, count: events.length, total },
      "Analytics events found by event type",
    );

    return {
      events: events.map((e) => this.toDomain(e)),
      total,
    };
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

    const [events, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.analyticsEvent.count({ where: { userId } }),
    ]);

    this.logger.info(
      { userId, count: events.length, total },
      "Analytics events found by user ID",
    );

    return {
      events: events.map((e) => this.toDomain(e)),
      total,
    };
  }

  async findByTraceId(traceId: string): Promise<AnalyticsEvent[]> {
    this.logger.debug({ traceId }, "Finding analytics events by trace ID");

    const events = await this.prisma.analyticsEvent.findMany({
      where: { traceId },
      orderBy: { timestamp: "asc" },
    });

    this.logger.info(
      { traceId, count: events.length },
      "Analytics events found by trace ID",
    );

    return events.map((e) => this.toDomain(e));
  }

  private toDomain(prismaEvent: {
    id: string;
    eventType: string;
    userId: string | null;
    timestamp: Date;
    metadata: unknown;
    traceId: string | null;
  }): AnalyticsEvent {
    return {
      id: prismaEvent.id,
      eventType: prismaEvent.eventType,
      userId: prismaEvent.userId,
      timestamp: prismaEvent.timestamp,
      metadata: prismaEvent.metadata as Record<string, unknown> | null,
      traceId: prismaEvent.traceId,
    };
  }
}
