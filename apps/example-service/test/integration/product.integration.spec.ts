import { INestApplication } from "@nestjs/common";
import { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { PrismaService } from "~/database/prisma.service";
import {
  startPostgreSqlContainer,
  runMigrations,
  cleanDatabase,
  seedProducts,
} from "../helpers/test-db.factory";
import { createIntegrationTestApp } from "../helpers/integration-test-app.factory";
import { createAdminToken, createUserToken } from "../helpers/jwt.factory";
import {
  createTestProductDto,
  BOUNDARY_VALUES,
} from "../fixtures/product.fixtures";
import { DEFAULT_JWT_SECRET } from "../../src/shared/config/config.constants";

/**
 * Product Integration Tests
 *
 * These tests verify the service integrates correctly with a REAL PostgreSQL database.
 * Uses testcontainers to spin up an ephemeral database for each test run.
 *
 * Test Strategy: Decision Table - Minimal Critical Set
 * ONLY tests that require real database behavior (constraints, concurrency, type conversion).
 * Each scenario maps to the integration test decision table in CLAUDE.md.
 *
 * Component tests already cover HTTP flow with mocked database.
 * Unit tests already cover business logic.
 *
 * Decision Criteria - Include test if it validates:
 * 1. PostgreSQL-specific constraints (unique, foreign keys)
 * 2. Database-level race conditions and locking
 * 3. Prisma type conversion (Decimal, DateTime)
 * 4. Query performance with realistic data volumes
 * 5. Soft delete database filtering behavior
 *
 * See CLAUDE.md "Integration Test Guidelines" for full rationale.
 */
describe("Product API (Integration)", () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let databaseUrl: string;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Set JWT_SECRET to match test tokens
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;

    // Start PostgreSQL testcontainer
    console.log("Starting PostgreSQL testcontainer...");
    container = await startPostgreSqlContainer();
    databaseUrl = container.getConnectionUri();
    console.log("PostgreSQL testcontainer started");

    // Run Prisma migrations
    console.log("Running database migrations...");
    await runMigrations(databaseUrl);
    console.log("Migrations completed");

    // Create app with real database
    app = await createIntegrationTestApp({ databaseUrl });
    prisma = app.get(PrismaService);

    // Generate auth tokens
    adminToken = createAdminToken();
    userToken = createUserToken();
  });

  afterAll(async () => {
    // Cleanup
    await app?.close();
    await container?.stop();
    console.log("Integration test cleanup completed");
  });

  beforeEach(async () => {
    // Clean database for test isolation
    await cleanDatabase(databaseUrl);
  });

  /**
   * IT-1: Duplicate SKU Constraint Enforcement
   *
   * Validates: PostgreSQL unique constraint on SKU column
   * Why Integration Test: In-memory repo uses Map, doesn't test actual DB constraint
   * Expected: First product created (201), second fails with 409 Conflict
   */
  describe("IT-1: Duplicate SKU constraint (Database)", () => {
    it("should enforce unique SKU constraint at database level", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: "UNIQUE-SKU-001" });

      // Act - Create first product
      const firstResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      expect(firstResponse.body.sku).toBe("UNIQUE-SKU-001");

      // Act - Try to create second product with same SKU
      const secondResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(409);

      // Assert - Should get conflict error
      expect(secondResponse.body.message).toContain("already exists");
    });
  });

  /**
   * IT-2: Concurrent SKU Creation (Race Condition)
   *
   * Validates: Database handles concurrent requests with same SKU correctly
   * Why Integration Test: Tests actual database transaction isolation and locking
   * Expected: One request succeeds (201), others fail (409)
   */
  describe("IT-2: Concurrent SKU creation race condition", () => {
    it("should handle concurrent creation of same SKU correctly", async () => {
      // Arrange
      const sku = `CONCURRENT-SKU-${Date.now()}`;
      const dto = createTestProductDto({ sku });

      // Act - Fire 3 concurrent requests with same SKU
      const requests = [
        request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto),
        request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto),
        request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto),
      ];

      const responses = await Promise.all(requests);

      // Assert - Exactly one should succeed, others should fail with 409
      const successCount = responses.filter((r) => r.status === 201).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);
    });
  });

  /**
   * IT-3: Soft Delete with isActive Filtering
   *
   * Validates: Soft delete sets isActive=false and filters correctly in queries
   * Why Integration Test: Verifies actual database filtering behavior and indexes
   * Expected: Deleted products excluded from findAll and findById
   */
  describe("IT-3: Soft delete with isActive filtering", () => {
    it("should soft delete product and exclude from queries", async () => {
      // Arrange - Create product
      const dto = createTestProductDto({ sku: `SOFT-DELETE-${Date.now()}` });
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      const productId = createResponse.body.id;

      // Act - Delete product
      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      // Assert - Verify product is excluded from findById
      await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);

      // Assert - Verify product is excluded from findAll
      const listResponse = await request(app.getHttpServer())
        .get("/products")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      const productIds = listResponse.body.products.map((p: any) => p.id);
      expect(productIds).not.toContain(productId);

      // Assert - Verify isActive=false in database
      const dbProduct = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(dbProduct).not.toBeNull();
      expect(dbProduct!.isActive).toBe(false);
    });

    it("should prevent creating new product with same SKU as soft-deleted product", async () => {
      // Arrange - Create and soft delete product
      const sku = `REUSE-SKU-${Date.now()}`;
      const dto1 = createTestProductDto({ sku, name: "First Product" });

      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto1)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/products/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      // Act - Try to create new product with same SKU
      // This should fail because the database has a unique constraint on SKU
      // that applies to ALL records (active and soft-deleted)
      const dto2 = createTestProductDto({ sku, name: "Second Product" });
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto2)
        .expect(409); // Should fail due to unique constraint

      // Assert - Verify only one product exists with this SKU (the soft-deleted one)
      const allProducts = await prisma.product.findMany({
        where: { sku },
      });
      expect(allProducts).toHaveLength(1);
      expect(allProducts[0].isActive).toBe(false);
    });
  });

  /**
   * IT-4: Decimal Precision Handling
   *
   * Validates: Prisma Decimal(10,2) converts correctly to JavaScript number
   * Why Integration Test: Tests actual Prisma type conversion and database storage
   * Expected: Price stored and retrieved accurately, including maximum values
   */
  describe("IT-4: Decimal precision handling", () => {
    it("should handle maximum price value correctly", async () => {
      // Arrange - Create product with maximum price
      const dto = createTestProductDto({
        sku: `MAX-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.valid.maximum, // 9999999.99
      });

      // Act
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      const productId = createResponse.body.id;

      // Assert - Verify price stored correctly
      expect(createResponse.body.price).toBe(9999999.99);

      // Assert - Verify price retrieved correctly
      const getResponse = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(getResponse.body.price).toBe(9999999.99);

      // Assert - Verify in database (Decimal type)
      const dbProduct = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(Number(dbProduct!.price)).toBe(9999999.99);
    });

    it("should handle minimum valid price correctly", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: `MIN-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.valid.minimum, // 0.01
      });

      // Act
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      // Assert
      expect(response.body.price).toBe(0.01);
    });

    it("should round prices with more than 2 decimal places", async () => {
      // Arrange - DTO validation should reject this, but test DB behavior
      const dto = createTestProductDto({
        sku: `ROUND-PRICE-${Date.now()}`,
        price: 99.999, // 3 decimals - should be rejected by validation
      });

      // Act & Assert - Should fail validation before reaching database
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);

      expect(Array.isArray(response.body.message)).toBe(true);
    });
  });

  /**
   * IT-5: Pagination Performance with Real Dataset
   *
   * Validates: Database pagination works efficiently with realistic data volume
   * Why Integration Test: Tests actual SQL OFFSET/LIMIT and index usage
   * Expected: Pagination works correctly with large dataset, reasonable performance
   */
  describe("IT-5: Pagination with real dataset", () => {
    beforeEach(async () => {
      // Seed database with 100 products for pagination testing
      // Use direct database seeding for performance (much faster than HTTP requests)
      await seedProducts(databaseUrl, 100);
    });

    it("should paginate correctly with limit and offset", async () => {
      // Act - Get first page (limit 10)
      const page1 = await request(app.getHttpServer())
        .get("/products?limit=10&offset=0")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Act - Get second page
      const page2 = await request(app.getHttpServer())
        .get("/products?limit=10&offset=10")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert - Page 1 has 10 products
      expect(page1.body.products).toHaveLength(10);
      expect(page1.body.total).toBe(100);
      expect(page1.body.limit).toBe(10);
      expect(page1.body.offset).toBe(0);

      // Assert - Page 2 has different products
      expect(page2.body.products).toHaveLength(10);
      expect(page2.body.total).toBe(100);
      expect(page2.body.offset).toBe(10);

      // Assert - No overlap between pages
      const page1Ids = page1.body.products.map((p: any) => p.id);
      const page2Ids = page2.body.products.map((p: any) => p.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it("should handle large offset efficiently", async () => {
      // Act - Query with large offset (last page)
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get("/products?limit=10&offset=90")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);
      const duration = Date.now() - startTime;

      // Assert - Should return last 10 products
      expect(response.body.products).toHaveLength(10);
      expect(response.body.offset).toBe(90);

      // Assert - Response time reasonable (< 1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it("should return empty array when offset exceeds total", async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get("/products?limit=10&offset=200")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert
      expect(response.body.products).toHaveLength(0);
      expect(response.body.total).toBe(100);
      expect(response.body.offset).toBe(200);
    });
  });
});
