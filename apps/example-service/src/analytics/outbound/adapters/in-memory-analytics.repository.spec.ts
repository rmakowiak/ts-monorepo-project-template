import { InMemoryAnalyticsRepository } from "./in-memory-analytics.repository";
import { EventType } from "../../domain/event-type.enum";
import { createMockLogger } from "../../../../test/helpers/mock-logger.factory";
import type { AnalyticsEvent } from "../../domain/analytics-event.entity";

describe("InMemoryAnalyticsRepository", () => {
  let repository: InMemoryAnalyticsRepository;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    repository = new InMemoryAnalyticsRepository(mockLogger);
  });

  const createTestEvent = (
    overrides?: Partial<AnalyticsEvent>,
  ): AnalyticsEvent => ({
    id: `event-${Date.now()}`,
    eventType: EventType.PRODUCT_CREATED,
    userId: "user-123",
    timestamp: new Date(),
    metadata: { productId: "prod-1", sku: "TEST-001" },
    traceId: "trace-123",
    ...overrides,
  });

  describe("save", () => {
    it("should save event and return it", async () => {
      // Arrange
      const event = createTestEvent({ id: "event-1" });

      // Act
      const result = await repository.save(event);

      // Assert
      expect(result).toEqual(event);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { eventId: "event-1", eventType: EventType.PRODUCT_CREATED },
        "Analytics event saved successfully",
      );
    });

    it("should log debug message when saving", async () => {
      // Arrange
      const event = createTestEvent({ id: "event-1" });

      // Act
      await repository.save(event);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "event-1", eventType: EventType.PRODUCT_CREATED },
        "Saving analytics event",
      );
    });

    it("should overwrite existing event with same ID", async () => {
      // Arrange
      const event1 = createTestEvent({
        id: "event-1",
        metadata: { version: 1 },
      });
      const event2 = createTestEvent({
        id: "event-1",
        metadata: { version: 2 },
      });

      // Act
      await repository.save(event1);
      await repository.save(event2);
      const result = await repository.findById("event-1");

      // Assert
      expect(result?.metadata).toEqual({ version: 2 });
    });
  });

  describe("findById", () => {
    it("should find event by ID", async () => {
      // Arrange
      const event = createTestEvent({ id: "event-1" });
      await repository.save(event);

      // Act
      const result = await repository.findById("event-1");

      // Assert
      expect(result).toEqual(event);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "event-1" },
        "Analytics event found",
      );
    });

    it("should return null when event not found", async () => {
      // Act
      const result = await repository.findById("non-existent");

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "non-existent" },
        "Analytics event not found",
      );
    });
  });

  describe("findByEventType", () => {
    it("should find events by type", async () => {
      // Arrange
      const event1 = createTestEvent({
        id: "event-1",
        eventType: EventType.PRODUCT_CREATED,
      });
      const event2 = createTestEvent({
        id: "event-2",
        eventType: EventType.PRODUCT_CREATED,
      });
      const event3 = createTestEvent({
        id: "event-3",
        eventType: EventType.PRODUCT_VIEWED,
      });

      await repository.save(event1);
      await repository.save(event2);
      await repository.save(event3);

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.events.map((e) => e.id)).toEqual(
        expect.arrayContaining(["event-1", "event-2"]),
      );
    });

    it("should return events sorted by timestamp descending", async () => {
      // Arrange
      const oldEvent = createTestEvent({
        id: "event-1",
        timestamp: new Date("2024-01-01"),
      });
      const newEvent = createTestEvent({
        id: "event-2",
        timestamp: new Date("2024-01-02"),
      });

      await repository.save(oldEvent);
      await repository.save(newEvent);

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events[0].id).toBe("event-2"); // Newer first
      expect(result.events[1].id).toBe("event-1"); // Older second
    });

    it("should support pagination with limit", async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        await repository.save(
          createTestEvent({
            id: `event-${i}`,
            timestamp: new Date(2024, 0, i + 1),
          }),
        );
      }

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
        { limit: 5 },
      );

      // Assert
      expect(result.events).toHaveLength(5);
      expect(result.total).toBe(10);
    });

    it("should support pagination with offset", async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        await repository.save(
          createTestEvent({
            id: `event-${i}`,
            timestamp: new Date(2024, 0, i + 1),
          }),
        );
      }

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
        { limit: 3, offset: 5 },
      );

      // Assert
      expect(result.events).toHaveLength(3);
      expect(result.total).toBe(10);
    });

    it("should return empty array when no events match type", async () => {
      // Arrange
      await repository.save(
        createTestEvent({ eventType: EventType.PRODUCT_CREATED }),
      );

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_DELETED,
      );

      // Assert
      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should use default limit of 50", async () => {
      // Arrange
      for (let i = 0; i < 60; i++) {
        await repository.save(createTestEvent({ id: `event-${i}` }));
      }

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events).toHaveLength(50);
      expect(result.total).toBe(60);
    });
  });

  describe("findByUserId", () => {
    it("should find events by user ID", async () => {
      // Arrange
      const event1 = createTestEvent({ id: "event-1", userId: "user-1" });
      const event2 = createTestEvent({ id: "event-2", userId: "user-1" });
      const event3 = createTestEvent({ id: "event-3", userId: "user-2" });

      await repository.save(event1);
      await repository.save(event2);
      await repository.save(event3);

      // Act
      const result = await repository.findByUserId("user-1");

      // Assert
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.events.map((e) => e.id)).toEqual(
        expect.arrayContaining(["event-1", "event-2"]),
      );
    });

    it("should return events sorted by timestamp descending", async () => {
      // Arrange
      const oldEvent = createTestEvent({
        id: "event-1",
        userId: "user-1",
        timestamp: new Date("2024-01-01"),
      });
      const newEvent = createTestEvent({
        id: "event-2",
        userId: "user-1",
        timestamp: new Date("2024-01-02"),
      });

      await repository.save(oldEvent);
      await repository.save(newEvent);

      // Act
      const result = await repository.findByUserId("user-1");

      // Assert
      expect(result.events[0].id).toBe("event-2");
      expect(result.events[1].id).toBe("event-1");
    });

    it("should support pagination", async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        await repository.save(
          createTestEvent({
            id: `event-${i}`,
            userId: "user-1",
            timestamp: new Date(2024, 0, i + 1),
          }),
        );
      }

      // Act
      const result = await repository.findByUserId("user-1", {
        limit: 5,
        offset: 2,
      });

      // Assert
      expect(result.events).toHaveLength(5);
      expect(result.total).toBe(10);
    });

    it("should return empty array when no events match user ID", async () => {
      // Arrange
      await repository.save(createTestEvent({ userId: "user-1" }));

      // Act
      const result = await repository.findByUserId("user-2");

      // Assert
      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("findByTraceId", () => {
    it("should find events by trace ID", async () => {
      // Arrange
      const event1 = createTestEvent({ id: "event-1", traceId: "trace-abc" });
      const event2 = createTestEvent({ id: "event-2", traceId: "trace-abc" });
      const event3 = createTestEvent({ id: "event-3", traceId: "trace-xyz" });

      await repository.save(event1);
      await repository.save(event2);
      await repository.save(event3);

      // Act
      const result = await repository.findByTraceId("trace-abc");

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(
        expect.arrayContaining(["event-1", "event-2"]),
      );
    });

    it("should return events sorted by timestamp ascending", async () => {
      // Arrange
      const oldEvent = createTestEvent({
        id: "event-1",
        traceId: "trace-abc",
        timestamp: new Date("2024-01-01"),
      });
      const newEvent = createTestEvent({
        id: "event-2",
        traceId: "trace-abc",
        timestamp: new Date("2024-01-02"),
      });

      await repository.save(newEvent);
      await repository.save(oldEvent);

      // Act
      const result = await repository.findByTraceId("trace-abc");

      // Assert
      expect(result[0].id).toBe("event-1"); // Older first (ascending)
      expect(result[1].id).toBe("event-2"); // Newer second
    });

    it("should return empty array when no events match trace ID", async () => {
      // Arrange
      await repository.save(createTestEvent({ traceId: "trace-abc" }));

      // Act
      const result = await repository.findByTraceId("trace-xyz");

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle null trace ID correctly", async () => {
      // Arrange
      const event1 = createTestEvent({ id: "event-1", traceId: null });
      const event2 = createTestEvent({ id: "event-2", traceId: "trace-abc" });

      await repository.save(event1);
      await repository.save(event2);

      // Act
      const result = await repository.findByTraceId("trace-abc");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("event-2");
    });
  });
});
