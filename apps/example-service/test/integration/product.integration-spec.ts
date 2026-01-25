import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.factory";
import { createAdminToken, createUserToken } from "../helpers/jwt.factory";
import {
  createTestProductDto,
  BOUNDARY_VALUES,
} from "../fixtures/product.fixtures";
import { DEFAULT_JWT_SECRET } from "~/shared/config/config.constants";

describe("Product API (Integration)", () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Set JWT_SECRET to match test tokens
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;

    app = await createTestApp();
    adminToken = createAdminToken();
    userToken = createUserToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /products (ECP + BVA)", () => {
    it("should create product as admin (ECP: Valid admin)", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: `TEST-CREATE-${Date.now()}` });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
        stock: dto.stock,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it("should return 401 when no auth token provided (ECP: Invalid - No auth)", async () => {
      // Arrange
      const dto = createTestProductDto();

      // Act & Assert
      await request(app.getHttpServer())
        .post("/products")
        .send(dto)
        .expect(401);
    });

    it("should return 403 when user role tries to create (ECP: Invalid - Wrong role)", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: `TEST-USER-${Date.now()}` });

      // Act & Assert
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${userToken}`)
        .send(dto)
        .expect(403);
    });

    it("should return 400 for invalid data - missing name (ECP: Invalid)", async () => {
      // Arrange - Missing required field
      const invalidDto = {
        description: "Test",
        sku: "TEST-INVALID",
        price: 10,
        stock: 5,
        // name is missing
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it("should return 400 for negative price (BVA: Below minimum)", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: `TEST-NEG-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.invalid.negative,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);

      // Validation errors come as an array
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(
        response.body.message.some((msg: string) => msg.includes("positive")),
      ).toBe(true);
    });

    it("should return 400 for zero price (BVA: Invalid boundary)", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: `TEST-ZERO-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.invalid.zero,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);
    });

    it("should accept minimum valid price (BVA: Lower boundary)", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: `TEST-MIN-PRICE-${Date.now()}`,
        price: BOUNDARY_VALUES.price.valid.minimum,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      expect(response.body.price).toBe(BOUNDARY_VALUES.price.valid.minimum);
    });

    it("should accept zero stock (BVA: Valid boundary)", async () => {
      // Arrange - Zero stock is valid
      const dto = createTestProductDto({
        sku: `TEST-ZERO-STOCK-${Date.now()}`,
        stock: BOUNDARY_VALUES.stock.valid.zero,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      expect(response.body.stock).toBe(0);
    });

    it("should return 400 for negative stock (BVA: Invalid boundary)", async () => {
      // Arrange
      const dto = createTestProductDto({
        sku: `TEST-NEG-STOCK-${Date.now()}`,
        stock: BOUNDARY_VALUES.stock.invalid.negative,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);
    });

    it("should return 409 when SKU already exists (ECP: Duplicate)", async () => {
      // Arrange - Create first product
      const dto = createTestProductDto({ sku: `TEST-DUPLICATE-${Date.now()}` });
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      // Act & Assert - Try to create again with same SKU
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(409);
    });
  });

  describe("GET /products (ECP + BVA)", () => {
    it("should return product list as authenticated user (ECP: Valid)", async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get("/products")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("products");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("limit");
      expect(response.body).toHaveProperty("offset");
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it("should return 401 when no auth token provided (ECP: Invalid)", async () => {
      // Act & Assert
      await request(app.getHttpServer()).get("/products").expect(401);
    });

    it("should support pagination with limit (BVA: Custom limit)", async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get("/products?limit=2")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert
      expect(response.body.limit).toBe(2);
      expect(response.body.products.length).toBeLessThanOrEqual(2);
    });

    it("should support pagination with offset (BVA: Custom offset)", async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get("/products?limit=10&offset=1")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert
      expect(response.body.offset).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should apply default pagination when no params provided", async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get("/products")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert - Default limit is 50, offset is 0
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });
  });

  describe("GET /products/:id (ECP)", () => {
    it("should return product by ID as authenticated user (ECP: Valid)", async () => {
      // Arrange - Use seeded product
      const productId = "1";

      // Act
      const response = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(productId);
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("sku");
      expect(response.body).toHaveProperty("price");
      expect(response.body).toHaveProperty("stock");
    });

    it("should return 404 when product not found (ECP: Invalid)", async () => {
      // Arrange
      const nonExistentId = "nonexistent-product-id";

      // Act & Assert
      await request(app.getHttpServer())
        .get(`/products/${nonExistentId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("should return 401 when no auth token provided (ECP: Invalid auth)", async () => {
      // Act & Assert
      await request(app.getHttpServer()).get("/products/1").expect(401);
    });
  });

  describe("PATCH /products/:id (ECP + BVA)", () => {
    it("should update product as admin (ECP: Valid)", async () => {
      // Arrange - Create product first
      const createDto = createTestProductDto({
        sku: `TEST-UPDATE-${Date.now()}`,
      });
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      const productId = createResponse.body.id;

      const updateDto = {
        price: 199.99,
        stock: 75,
      };

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(productId);
      expect(response.body.price).toBe(199.99);
      expect(response.body.stock).toBe(75);
      expect(response.body.name).toBe(createDto.name); // Unchanged
    });

    it("should return 403 when user role tries to update (ECP: Invalid role)", async () => {
      // Arrange
      const updateDto = { price: 100 };

      // Act & Assert
      await request(app.getHttpServer())
        .patch("/products/1")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateDto)
        .expect(403);
    });

    it("should return 404 when product not found (ECP: Invalid ID)", async () => {
      // Arrange
      const updateDto = { price: 100 };

      // Act & Assert
      await request(app.getHttpServer())
        .patch("/products/nonexistent-id")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(404);
    });

    it("should return 400 for invalid update data (BVA: Negative price)", async () => {
      // Arrange
      const updateDto = { price: BOUNDARY_VALUES.price.invalid.negative };

      // Act & Assert
      await request(app.getHttpServer())
        .patch("/products/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(400);
    });

    it("should return 401 when no auth token provided (ECP: No auth)", async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .patch("/products/1")
        .send({ price: 100 })
        .expect(401);
    });

    it("should handle partial updates correctly", async () => {
      // Arrange - Create product
      const createDto = createTestProductDto({
        sku: `TEST-PARTIAL-${Date.now()}`,
      });
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      const productId = createResponse.body.id;

      // Act - Update only price
      const updateDto = { price: 150 };
      const response = await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      // Assert - Only price changed
      expect(response.body.price).toBe(150);
      expect(response.body.stock).toBe(createDto.stock); // Unchanged
      expect(response.body.name).toBe(createDto.name); // Unchanged
    });
  });

  describe("DELETE /products/:id (ECP)", () => {
    it("should delete product as admin (ECP: Valid)", async () => {
      // Arrange - Create product
      const dto = createTestProductDto({ sku: `TEST-DELETE-${Date.now()}` });
      const createResponse = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      const productId = createResponse.body.id;

      // Act - Delete
      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      // Assert - Verify deletion
      await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("should return 403 when user role tries to delete (ECP: Invalid role)", async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .delete("/products/1")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });

    it("should return 404 when product not found (ECP: Invalid ID)", async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .delete("/products/nonexistent-id")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });

    it("should return 401 when no auth token provided (ECP: No auth)", async () => {
      // Act & Assert
      await request(app.getHttpServer()).delete("/products/1").expect(401);
    });
  });
});
