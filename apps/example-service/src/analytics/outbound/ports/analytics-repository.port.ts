import { AnalyticsEvent } from "../../domain/analytics-event.entity";

export type QueryOptions = {
  limit?: number;
  offset?: number;
};

export type FindByEventTypeResult = {
  events: AnalyticsEvent[];
  total: number;
};

export type AnalyticsRepository = {
  save(event: AnalyticsEvent): Promise<AnalyticsEvent>;
  findById(id: string): Promise<AnalyticsEvent | null>;
  findByEventType(
    eventType: string,
    options?: QueryOptions,
  ): Promise<FindByEventTypeResult>;
  findByUserId(
    userId: string,
    options?: QueryOptions,
  ): Promise<FindByEventTypeResult>;
  findByTraceId(traceId: string): Promise<AnalyticsEvent[]>;
};
