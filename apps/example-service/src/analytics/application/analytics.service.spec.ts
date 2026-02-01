import { AnalyticsService } from "./analytics.service";
import { EventType } from "../domain/event-type.enum";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import type { AnalyticsRepository } from "../outbound/ports/analytics-repository.port";
import type { AnalyticsEvent } from "../domain/analytics-event.entity";

// Mock the @monorepo/otel package
jest.mock("@monorepo/otel", () => ({
  getTraceId: jest.fn(),
}));

import { getTraceId } from "@monorepo/otel";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let mockRepository: jest.Mocked<AnalyticsRepository>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEventType: jest.fn(),
      findByUserId: jest.fn(),
      findByTraceId: jest.fn(),
    };

    // Create mock logger
    mockLogger = createMockLogger();

    // Create service instance
    service = new AnalyticsService(mockRepository, mockLogger);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("track", () => {
    it("should track event with all fields provided", async () => {
      // Arrange
      const mockTraceId = "test-trace-id-123";
      (getTraceId as jest.Mock).mockReturnValue(mockTraceId);

      const mockEvent: AnalyticsEvent = {
        id: expect.any(String),
        eventType: EventType.PRODUCT_CREATED,
        userId: "user-123",
        timestamp: expect.any(Date),
        metadata: { productId: "prod-1", sku: "TEST-001" },
        traceId: mockTraceId,
      };

      mockRepository.save.mockResolvedValue(mockEvent);

      // Act
      const result = await service.track(EventType.PRODUCT_CREATED, {
        userId: "user-123",
        metadata: { productId: "prod-1", sku: "TEST-001" },
      });

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-123",
          metadata: { productId: "prod-1", sku: "TEST-001" },
          traceId: mockTraceId,
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-123",
          traceId: mockTraceId,
        }),
        "Tracking analytics event",
      );
    });

    it("should track event with minimal fields (userId and metadata optional)", async () => {
      // Arrange
      (getTraceId as jest.Mock).mockReturnValue(undefined);

      const mockEvent: AnalyticsEvent = {
        id: expect.any(String),
        eventType: EventType.PRODUCT_VIEWED,
        userId: null,
        timestamp: expect.any(Date),
        metadata: null,
        traceId: null,
      };

      mockRepository.save.mockResolvedValue(mockEvent);

      // Act
      const result = await service.track(EventType.PRODUCT_VIEWED);

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PRODUCT_VIEWED,
          userId: null,
          metadata: null,
          traceId: null,
        }),
      );
    });

    it("should track event with custom timestamp", async () => {
      // Arrange
      const customTimestamp = new Date("2024-01-15T10:00:00Z");
      (getTraceId as jest.Mock).mockReturnValue(null);

      const mockEvent: AnalyticsEvent = {
        id: expect.any(String),
        eventType: EventType.PRODUCT_UPDATED,
        userId: null,
        timestamp: customTimestamp,
        metadata: null,
        traceId: null,
      };

      mockRepository.save.mockResolvedValue(mockEvent);

      // Act
      const result = await service.track(EventType.PRODUCT_UPDATED, {
        timestamp: customTimestamp,
      });

      // Assert
      expect(result.timestamp).toEqual(customTimestamp);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: customTimestamp,
        }),
      );
    });

    it("should generate UUID for event ID", async () => {
      // Arrange
      (getTraceId as jest.Mock).mockReturnValue(null);
      mockRepository.save.mockImplementation(async (event) => event);

      // Act
      const result = await service.track(EventType.PRODUCT_CREATED);

      // Assert
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should capture trace ID from OpenTelemetry", async () => {
      // Arrange
      const mockTraceId = "abc123def456";
      (getTraceId as jest.Mock).mockReturnValue(mockTraceId);
      mockRepository.save.mockImplementation(async (event) => event);

      // Act
      const result = await service.track(EventType.PRODUCT_CREATED);

      // Assert
      expect(result.traceId).toBe(mockTraceId);
      expect(getTraceId).toHaveBeenCalled();
    });

    it("should handle null trace ID gracefully", async () => {
      // Arrange
      (getTraceId as jest.Mock).mockReturnValue(null);
      mockRepository.save.mockImplementation(async (event) => event);

      // Act
      const result = await service.track(EventType.PRODUCT_CREATED);

      // Assert
      expect(result.traceId).toBeNull();
    });

    it("should log successful tracking", async () => {
      // Arrange
      const mockEvent: AnalyticsEvent = {
        id: "event-123",
        eventType: EventType.PRODUCT_CREATED,
        userId: "user-123",
        timestamp: new Date(),
        metadata: null,
        traceId: null,
      };

      (getTraceId as jest.Mock).mockReturnValue(null);
      mockRepository.save.mockResolvedValue(mockEvent);

      // Act
      await service.track(EventType.PRODUCT_CREATED, { userId: "user-123" });

      // Assert
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        { eventId: "event-123", eventType: EventType.PRODUCT_CREATED },
        "Analytics event tracked successfully",
      );
    });

    it("should throw error if repository save fails", async () => {
      // Arrange
      const repositoryError = new Error("Database connection failed");
      (getTraceId as jest.Mock).mockReturnValue(null);
      mockRepository.save.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(
        service.track(EventType.PRODUCT_CREATED, { userId: "user-123" }),
      ).rejects.toThrow("Database connection failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: repositoryError,
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-123",
        }),
        "Failed to track analytics event",
      );
    });

    it("should track all event types correctly", async () => {
      // Arrange
      (getTraceId as jest.Mock).mockReturnValue(null);
      mockRepository.save.mockImplementation(async (event) => event);

      const eventTypes = [
        EventType.PRODUCT_CREATED,
        EventType.PRODUCT_UPDATED,
        EventType.PRODUCT_DELETED,
        EventType.PRODUCT_VIEWED,
      ];

      // Act & Assert
      for (const eventType of eventTypes) {
        const result = await service.track(eventType);
        expect(result.eventType).toBe(eventType);
      }

      expect(mockRepository.save).toHaveBeenCalledTimes(4);
    });
  });

  describe("findById", () => {
    it("should find event by ID", async () => {
      // Arrange
      const mockEvent: AnalyticsEvent = {
        id: "event-123",
        eventType: EventType.PRODUCT_CREATED,
        userId: "user-123",
        timestamp: new Date(),
        metadata: { productId: "prod-1" },
        traceId: "trace-123",
      };

      mockRepository.findById.mockResolvedValue(mockEvent);

      // Act
      const result = await service.findById("event-123");

      // Assert
      expect(result).toEqual(mockEvent);
      expect(mockRepository.findById).toHaveBeenCalledWith("event-123");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { eventId: "event-123" },
        "Finding analytics event by ID",
      );
    });

    it("should return null when event not found", async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.findById("non-existent");

      // Assert
      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("findByEventType", () => {
    it("should find events by type with default pagination", async () => {
      // Arrange
      const mockEvents: AnalyticsEvent[] = [
        {
          id: "event-1",
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-1",
          timestamp: new Date(),
          metadata: null,
          traceId: null,
        },
        {
          id: "event-2",
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-2",
          timestamp: new Date(),
          metadata: null,
          traceId: null,
        },
      ];

      mockRepository.findByEventType.mockResolvedValue({
        events: mockEvents,
        total: 2,
      });

      // Act
      const result = await service.findByEventType(EventType.PRODUCT_CREATED);

      // Assert
      expect(result).toEqual({ events: mockEvents, total: 2 });
      expect(mockRepository.findByEventType).toHaveBeenCalledWith(
        EventType.PRODUCT_CREATED,
        undefined,
      );
    });

    it("should find events by type with custom pagination", async () => {
      // Arrange
      mockRepository.findByEventType.mockResolvedValue({
        events: [],
        total: 100,
      });

      // Act
      await service.findByEventType(EventType.PRODUCT_VIEWED, {
        limit: 10,
        offset: 20,
      });

      // Assert
      expect(mockRepository.findByEventType).toHaveBeenCalledWith(
        EventType.PRODUCT_VIEWED,
        { limit: 10, offset: 20 },
      );
    });
  });

  describe("findByUserId", () => {
    it("should find events by user ID", async () => {
      // Arrange
      const mockEvents: AnalyticsEvent[] = [
        {
          id: "event-1",
          eventType: EventType.PRODUCT_VIEWED,
          userId: "user-123",
          timestamp: new Date(),
          metadata: null,
          traceId: null,
        },
      ];

      mockRepository.findByUserId.mockResolvedValue({
        events: mockEvents,
        total: 1,
      });

      // Act
      const result = await service.findByUserId("user-123");

      // Assert
      expect(result).toEqual({ events: mockEvents, total: 1 });
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(
        "user-123",
        undefined,
      );
    });

    it("should find events by user ID with pagination", async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue({
        events: [],
        total: 50,
      });

      // Act
      await service.findByUserId("user-123", { limit: 25, offset: 10 });

      // Assert
      expect(mockRepository.findByUserId).toHaveBeenCalledWith("user-123", {
        limit: 25,
        offset: 10,
      });
    });
  });

  describe("findByTraceId", () => {
    it("should find events by trace ID", async () => {
      // Arrange
      const mockEvents: AnalyticsEvent[] = [
        {
          id: "event-1",
          eventType: EventType.PRODUCT_CREATED,
          userId: "user-123",
          timestamp: new Date(),
          metadata: null,
          traceId: "trace-abc123",
        },
        {
          id: "event-2",
          eventType: EventType.PRODUCT_VIEWED,
          userId: "user-123",
          timestamp: new Date(),
          metadata: null,
          traceId: "trace-abc123",
        },
      ];

      mockRepository.findByTraceId.mockResolvedValue(mockEvents);

      // Act
      const result = await service.findByTraceId("trace-abc123");

      // Assert
      expect(result).toEqual(mockEvents);
      expect(mockRepository.findByTraceId).toHaveBeenCalledWith("trace-abc123");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { traceId: "trace-abc123" },
        "Finding events by trace ID",
      );
    });

    it("should return empty array when no events found for trace ID", async () => {
      // Arrange
      mockRepository.findByTraceId.mockResolvedValue([]);

      // Act
      const result = await service.findByTraceId("non-existent-trace");

      // Assert
      expect(result).toEqual([]);
    });
  });
});
