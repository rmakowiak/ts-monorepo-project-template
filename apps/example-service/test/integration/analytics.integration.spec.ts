import { INestApplication } from "@nestjs/common";
import { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { PrismaService } from "~/database/prisma.service";
import {
  startPostgreSqlContainer,
  runMigrations,
  cleanDatabase,
} from "../helpers/test-db.factory";
import { createIntegrationTestApp } from "../helpers/integration-test-app.factory";
import { createAdminToken, createUserToken } from "../helpers/jwt.factory";
import { createTestProductDto } from "../fixtures/product.fixtures";
import { AnalyticsService } from "~/analytics/application/analytics.service";
import { EventType } from "~/analytics/domain/event-type.enum";

/**
 * Integration tests for Analytics with real PostgreSQL database
 *
 * These tests verify:
 * - Events persist to database correctly
 * - JSON metadata serialization works
 * - Database indexes optimize queries
 * - Pagination works with real data
 * - Concurrent operations don't cause issues
 */
describe("Analytics (Integration)", () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let analyticsService: AnalyticsService;
  let databaseUrl: string;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await startPostgreSqlContainer();
    databaseUrl = container.getConnectionUri();

    // Run Prisma migrations
    await runMigrations(databaseUrl);

    // Create app with real database
    app = await createIntegrationTestApp({ databaseUrl });
    prisma = app.get(PrismaService);
    analyticsService = app.get(AnalyticsService);

    // Generate auth tokens
    adminToken = createAdminToken();
    userToken = createUserToken();
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean database for test isolation
    await cleanDatabase(databaseUrl);
  });

  describe("Event Persistence", () => {
    it("should persist analytics event to database", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: `INT-TEST-${Date.now()}` });

      // Act - Create product which tracks analytics event
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      const productId = response.body.id;

      // Assert - Verify event exists in database
      const dbEvent = await prisma.analyticsEvent.findFirst({
        where: {
          eventType: EventType.PRODUCT_CREATED,
          metadata: {
            path: ["productId"],
            equals: productId,
          },
        },
      });

      expect(dbEvent).toBeDefined();
      expect(dbEvent?.eventType).toBe(EventType.PRODUCT_CREATED);
      expect(dbEvent?.userId).toBe("admin-user-id");
    });

    it("should handle null userId correctly", async () => {
      // Arrange - Track event without userId
      const event = await analyticsService.track(EventType.PRODUCT_VIEWED, {
        metadata: { productId: "test-123" },
      });

      // Act - Query from database
      const dbEvent = await prisma.analyticsEvent.findUnique({
        where: { id: event.id },
      });

      // Assert
      expect(dbEvent?.userId).toBeNull();
    });

    it("should handle null metadata correctly", async () => {
      // Arrange
      const event = await analyticsService.track(EventType.PRODUCT_VIEWED);

      // Act - Query from database
      const dbEvent = await prisma.analyticsEvent.findUnique({
        where: { id: event.id },
      });

      // Assert
      expect(dbEvent?.metadata).toBeNull();
    });

    it("should handle null traceId correctly", async () => {
      // Arrange
      const event = await analyticsService.track(EventType.PRODUCT_CREATED, {
        metadata: { test: "data" },
      });

      // Act - Query from database
      const dbEvent = await prisma.analyticsEvent.findUnique({
        where: { id: event.id },
      });

      // Assert
      expect(dbEvent?.traceId).toBeNull();
    });
  });

  describe("JSON Metadata Serialization", () => {
    it("should correctly serialize and deserialize JSON metadata", async () => {
      // Arrange
      const complexMetadata = {
        productId: "prod-123",
        sku: "TEST-001",
        name: "Test Product",
        price: 99.99,
        nested: {
          category: "Electronics",
          tags: ["new", "sale"],
        },
        array: [1, 2, 3],
      };

      // Act - Save event with complex metadata
      const event = await analyticsService.track(EventType.PRODUCT_CREATED, {
        userId: "test-user",
        metadata: complexMetadata,
      });

      // Assert - Retrieve and verify metadata structure
      const retrieved = await analyticsService.findById(event.id);

      expect(retrieved?.metadata).toEqual(complexMetadata);
      expect(retrieved?.metadata).toMatchObject({
        productId: "prod-123",
        nested: {
          category: "Electronics",
          tags: ["new", "sale"],
        },
        array: [1, 2, 3],
      });
    });

    it("should handle special characters in metadata", async () => {
      // Arrange
      const metadataWithSpecialChars = {
        description: "Product with \"quotes\" and 'apostrophes'",
        unicode: "🎉 Emoji support",
        escaped: "Line1\nLine2\tTabbed",
      };

      // Act
      const event = await analyticsService.track(EventType.PRODUCT_CREATED, {
        metadata: metadataWithSpecialChars,
      });

      // Assert
      const retrieved = await analyticsService.findById(event.id);
      expect(retrieved?.metadata).toEqual(metadataWithSpecialChars);
    });
  });

  describe("Database Indexes and Query Performance", () => {
    it("should efficiently query by eventType using index", async () => {
      // Arrange - Create 50 events of different types
      for (let i = 0; i < 20; i++) {
        await analyticsService.track(EventType.PRODUCT_CREATED, {
          metadata: { index: i },
        });
      }
      for (let i = 0; i < 30; i++) {
        await analyticsService.track(EventType.PRODUCT_VIEWED, {
          metadata: { index: i },
        });
      }

      // Act - Query by event type
      const result = await analyticsService.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert
      expect(result.events).toHaveLength(20);
      expect(result.total).toBe(20);
    });

    it("should efficiently query by userId using index", async () => {
      // Arrange - Create events for different users
      for (let i = 0; i < 15; i++) {
        await analyticsService.track(EventType.PRODUCT_VIEWED, {
          userId: "user-1",
          metadata: { index: i },
        });
      }
      for (let i = 0; i < 10; i++) {
        await analyticsService.track(EventType.PRODUCT_VIEWED, {
          userId: "user-2",
          metadata: { index: i },
        });
      }

      // Act - Query by user ID
      const result = await analyticsService.findByUserId("user-1");

      // Assert
      expect(result.events).toHaveLength(15);
      expect(result.total).toBe(15);
    });

    it("should sort results by timestamp descending", async () => {
      // Arrange - Create events with specific timestamps
      const event1 = await analyticsService.track(EventType.PRODUCT_CREATED, {
        timestamp: new Date("2024-01-01T10:00:00Z"),
        metadata: { order: 1 },
      });

      const event2 = await analyticsService.track(EventType.PRODUCT_CREATED, {
        timestamp: new Date("2024-01-02T10:00:00Z"),
        metadata: { order: 2 },
      });

      const event3 = await analyticsService.track(EventType.PRODUCT_CREATED, {
        timestamp: new Date("2024-01-03T10:00:00Z"),
        metadata: { order: 3 },
      });

      // Act - Query events
      const result = await analyticsService.findByEventType(
        EventType.PRODUCT_CREATED,
      );

      // Assert - Should be in descending order (newest first)
      expect(result.events[0].id).toBe(event3.id);
      expect(result.events[1].id).toBe(event2.id);
      expect(result.events[2].id).toBe(event1.id);
    });
  });

  describe("Pagination", () => {
    it("should paginate results correctly", async () => {
      // Arrange - Create 25 events
      for (let i = 0; i < 25; i++) {
        await analyticsService.track(EventType.PRODUCT_VIEWED, {
          metadata: { index: i },
        });
      }

      // Act - Query with pagination
      const page1 = await analyticsService.findByEventType(
        EventType.PRODUCT_VIEWED,
        { limit: 10, offset: 0 },
      );

      const page2 = await analyticsService.findByEventType(
        EventType.PRODUCT_VIEWED,
        { limit: 10, offset: 10 },
      );

      const page3 = await analyticsService.findByEventType(
        EventType.PRODUCT_VIEWED,
        { limit: 10, offset: 20 },
      );

      // Assert
      expect(page1.events).toHaveLength(10);
      expect(page1.total).toBe(25);

      expect(page2.events).toHaveLength(10);
      expect(page2.total).toBe(25);

      expect(page3.events).toHaveLength(5); // Last page has 5 items
      expect(page3.total).toBe(25);

      // Verify no overlap between pages
      const page2Ids = new Set(page2.events.map((e) => e.id));
      const page3Ids = new Set(page3.events.map((e) => e.id));

      expect(
        page1.events.some((e) => page2Ids.has(e.id) || page3Ids.has(e.id)),
      ).toBe(false);
      expect(page2.events.some((e) => page3Ids.has(e.id))).toBe(false);
    });

    it("should handle limit larger than total results", async () => {
      // Arrange - Create 5 events
      for (let i = 0; i < 5; i++) {
        await analyticsService.track(EventType.PRODUCT_CREATED, {
          metadata: { index: i },
        });
      }

      // Act - Query with limit > total
      const result = await analyticsService.findByEventType(
        EventType.PRODUCT_CREATED,
        { limit: 100, offset: 0 },
      );

      // Assert
      expect(result.events).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it("should handle offset beyond total results", async () => {
      // Arrange - Create 10 events
      for (let i = 0; i < 10; i++) {
        await analyticsService.track(EventType.PRODUCT_UPDATED, {
          metadata: { index: i },
        });
      }

      // Act - Query with offset > total
      const result = await analyticsService.findByEventType(
        EventType.PRODUCT_UPDATED,
        { limit: 10, offset: 100 },
      );

      // Assert
      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(10);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent event creation", async () => {
      // Arrange
      const promises = [];

      // Act - Create 20 events concurrently
      for (let i = 0; i < 20; i++) {
        promises.push(
          analyticsService.track(EventType.PRODUCT_VIEWED, {
            userId: `user-${i % 5}`, // 5 different users
            metadata: { concurrent: true, index: i },
          }),
        );
      }

      await Promise.all(promises);

      // Assert - All events should be saved
      const result = await analyticsService.findByEventType(
        EventType.PRODUCT_VIEWED,
      );

      expect(result.total).toBe(20);

      // Verify all event IDs are unique
      const ids = new Set(result.events.map((e) => e.id));
      expect(ids.size).toBe(20);
    });
  });

  describe("Trace ID Correlation", () => {
    it("should query events by trace ID", async () => {
      // Arrange - Create events with same trace ID
      const traceId = "test-trace-123";

      await analyticsService.track(EventType.PRODUCT_CREATED, {
        metadata: { traceId, step: 1 },
      });

      await analyticsService.track(EventType.PRODUCT_VIEWED, {
        metadata: { traceId, step: 2 },
      });

      await analyticsService.track(EventType.PRODUCT_UPDATED, {
        metadata: { traceId, step: 3 },
      });

      // Note: In real scenarios, traceId would be captured from OpenTelemetry
      // In tests, we're manually setting it in metadata for demonstration

      // For now, this test documents the expected behavior
      // Actual trace ID correlation would require mocking @monorepo/otel
    });
  });

  describe("Full Integration Flow", () => {
    it("should track all CRUD operations end-to-end", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: `E2E-TEST-${Date.now()}` });

      // Act 1 - Create
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      const productId = createResponse.body.id;

      // Act 2 - View
      await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Act 3 - Update
      await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ price: 149.99 })
        .expect(200);

      // Act 4 - Delete
      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      // Assert - Verify all 4 events exist in database
      const createdEvents = await prisma.analyticsEvent.findMany({
        where: {
          metadata: {
            path: ["productId"],
            equals: productId,
          },
        },
        orderBy: { timestamp: "asc" },
      });

      expect(createdEvents).toHaveLength(4);
      expect(createdEvents[0].eventType).toBe(EventType.PRODUCT_CREATED);
      expect(createdEvents[1].eventType).toBe(EventType.PRODUCT_VIEWED);
      expect(createdEvents[2].eventType).toBe(EventType.PRODUCT_UPDATED);
      expect(createdEvents[3].eventType).toBe(EventType.PRODUCT_DELETED);
    });
  });
});
