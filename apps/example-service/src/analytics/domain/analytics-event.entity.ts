export type AnalyticsEventId = string;

export type AnalyticsEvent = Readonly<{
  id: AnalyticsEventId;
  eventType: string;
  userId: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
  traceId: string | null;
}>;
