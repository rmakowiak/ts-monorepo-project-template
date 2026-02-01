import { PrismaAnalyticsRepository } from "./prisma-analytics.repository";
import { EventType } from "../../domain/event-type.enum";
import { createMockLogger } from "../../../../test/helpers/mock-logger.factory";
import type { AnalyticsEvent } from "../../domain/analytics-event.entity";

describe("PrismaAnalyticsRepository", () => {
  let repository: PrismaAnalyticsRepository;
  let mockPrisma: any;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      analyticsEvent: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    mockLogger = createMockLogger();
    repository = new PrismaAnalyticsRepository(mockPrisma, mockLogger);
  });

  const createTestEvent = (
    overrides?: Partial<AnalyticsEvent>,
  ): AnalyticsEvent => ({
    id: "event-123",
    eventType: EventType.PRODUCT_CREATED,
    userId: "user-123",
    timestamp: new Date("2024-01-15T10:00:00Z"),
    metadata: { productId: "prod-1", sku: "TEST-001" },
    traceId: "trace-abc123",
    ...overrides,
  });

  const createPrismaEvent = (overrides?: any) => ({
    id: "event-123",
    eventType: EventType.PRODUCT_CREATED,
    userId: "user-123",
    timestamp: new Date("2024-01-15T10:00:00Z"),
    metadata: { productId: "prod-1", sku: "TEST-001" },
    traceId: "trace-abc123",
    ...overrides,
  });

  describe("save", () => {
    it("should save event and return domain entity", async () => {
      // Arrange
      const event = createTestEvent();
      const prismaEvent = createPrismaEvent();

      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.save(event);

      // Assert
      expect(result).toEqual(event);
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          id: "event-123",
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-123",
          timestamp: new Date("2024-01-15T10:00:00Z"),
          metadata: { productId: "prod-1", sku: "TEST-001" },
          traceId: "trace-abc123",
        },
      });
    });

    it("should handle null metadata", async () => {
      // Arrange
      const event = createTestEvent({ metadata: null });
      const prismaEvent = createPrismaEvent({ metadata: null });

      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      await repository.save(event);

      // Assert
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: undefined, // null converts to undefined for Prisma
        }),
      });
    });

    it("should handle null userId", async () => {
      // Arrange
      const event = createTestEvent({ userId: null });
      const prismaEvent = createPrismaEvent({ userId: null });

      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.save(event);

      // Assert
      expect(result.userId).toBeNull();
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
        }),
      });
    });

    it("should handle null traceId", async () => {
      // Arrange
      const event = createTestEvent({ traceId: null });
      const prismaEvent = createPrismaEvent({ traceId: null });

      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.save(event);

      // Assert
      expect(result.traceId).toBeNull();
    });

    it("should log debug and info messages", async () => {
      // Arrange
      const event = createTestEvent();
      const prismaEvent = createPrismaEvent();

      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      await repository.save(event);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "event-123", eventType: EventType.PRODUCT_CREATED },
        "Saving analytics event",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { eventId: "event-123", eventType: EventType.PRODUCT_CREATED },
        "Analytics event saved successfully",
      );
    });
  });

  describe("findById", () => {
    it("should find event by ID", async () => {
      // Arrange
      const prismaEvent = createPrismaEvent();
      mockPrisma.analyticsEvent.findUnique.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.findById("event-123");

      // Assert
      expect(result).toEqual(createTestEvent());
      expect(mockPrisma.analyticsEvent.findUnique).toHaveBeenCalledWith({
        where: { id: "event-123" },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "event-123" },
        "Analytics event found",
      );
    });

    it("should return null when event not found", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findUnique.mockResolvedValue(null);

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
    it("should find events by type with default pagination", async () => {
      // Arrange
      const prismaEvents = [
        createPrismaEvent({ id: "event-1" }),
        createPrismaEvent({ id: "event-2" }),
      ];

      mockPrisma.analyticsEvent.findMany.mockResolvedValue(prismaEvents);
      mockPrisma.analyticsEvent.count.mockResolvedValue(2);

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith({
        where: { eventType: EventType.PRODUCT_CREATED },
        orderBy: { timestamp: "desc" },
        take: 50,
        skip: 0,
      });
      expect(mockPrisma.analyticsEvent.count).toHaveBeenCalledWith({
        where: { eventType: EventType.PRODUCT_CREATED },
      });
    });

    it("should support custom limit and offset", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(100);

      // Act
      await repository.findByEventType(EventType.PRODUCT_VIEWED, {
        limit: 10,
        offset: 20,
      });

      // Assert
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith({
        where: { eventType: EventType.PRODUCT_VIEWED },
        orderBy: { timestamp: "desc" },
        take: 10,
        skip: 20,
      });
    });

    it("should convert Prisma events to domain entities", async () => {
      // Arrange
      const prismaEvent = createPrismaEvent({
        id: "event-1",
        metadata: { custom: "data" },
      });

      mockPrisma.analyticsEvent.findMany.mockResolvedValue([prismaEvent]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(1);

      // Act
      const result = await repository.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events[0]).toEqual(
        expect.objectContaining({
          id: "event-1",
          metadata: { custom: "data" },
        }),
      );
    });

    it("should log query results", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([
        createPrismaEvent(),
      ]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(1);

      // Act
      await repository.findByEventType(EventType.PRODUCT_CREATED);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          eventType: EventType.PRODUCT_CREATED,
          count: 1,
          total: 1,
        },
        "Analytics events found by event type",
      );
    });
  });

  describe("findByUserId", () => {
    it("should find events by user ID", async () => {
      // Arrange
      const prismaEvents = [createPrismaEvent({ userId: "user-123" })];

      mockPrisma.analyticsEvent.findMany.mockResolvedValue(prismaEvents);
      mockPrisma.analyticsEvent.count.mockResolvedValue(1);

      // Act
      const result = await repository.findByUserId("user-123");

      // Assert
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { timestamp: "desc" },
        take: 50,
        skip: 0,
      });
    });

    it("should support pagination", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(25);

      // Act
      await repository.findByUserId("user-123", { limit: 5, offset: 10 });

      // Assert
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { timestamp: "desc" },
        take: 5,
        skip: 10,
      });
    });

    it("should log query results", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(0);

      // Act
      await repository.findByUserId("user-123");

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: "user-123", count: 0, total: 0 },
        "Analytics events found by user ID",
      );
    });
  });

  describe("findByTraceId", () => {
    it("should find events by trace ID", async () => {
      // Arrange
      const prismaEvents = [
        createPrismaEvent({ id: "event-1", traceId: "trace-abc" }),
        createPrismaEvent({ id: "event-2", traceId: "trace-abc" }),
      ];

      mockPrisma.analyticsEvent.findMany.mockResolvedValue(prismaEvents);

      // Act
      const result = await repository.findByTraceId("trace-abc");

      // Assert
      expect(result).toHaveLength(2);
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith({
        where: { traceId: "trace-abc" },
        orderBy: { timestamp: "asc" },
      });
    });

    it("should sort by timestamp ascending", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);

      // Act
      await repository.findByTraceId("trace-abc");

      // Assert
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: "asc" },
        }),
      );
    });

    it("should log query results", async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([
        createPrismaEvent(),
      ]);

      // Act
      await repository.findByTraceId("trace-abc");

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { traceId: "trace-abc", count: 1 },
        "Analytics events found by trace ID",
      );
    });
  });

  describe("toDomain", () => {
    it("should convert Prisma event to domain entity", async () => {
      // Arrange
      const prismaEvent = createPrismaEvent();
      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.save(createTestEvent());

      // Assert
      expect(result).toEqual(createTestEvent());
    });

    it("should handle metadata as JSONB correctly", async () => {
      // Arrange
      const complexMetadata = {
        productId: "prod-1",
        nested: { key: "value" },
        array: [1, 2, 3],
      };

      const prismaEvent = createPrismaEvent({ metadata: complexMetadata });
      mockPrisma.analyticsEvent.create.mockResolvedValue(prismaEvent);

      // Act
      const result = await repository.save(
        createTestEvent({ metadata: complexMetadata }),
      );

      // Assert
      expect(result.metadata).toEqual(complexMetadata);
    });
  });
});
