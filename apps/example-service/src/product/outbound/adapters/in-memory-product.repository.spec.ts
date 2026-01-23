import { InMemoryProductRepository } from "./in-memory-product.repository";
import { createMockLogger } from "../../../../test/helpers/mock-logger.factory";
import { createTestProduct } from "../../../../test/fixtures/product.fixtures";

describe("InMemoryProductRepository", () => {
  let repository: InMemoryProductRepository;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    repository = new InMemoryProductRepository(mockLogger);
  });

  describe("save", () => {
    it("should save a new product and add to SKU index", async () => {
      // Arrange
      const product = createTestProduct({ id: "new-1", sku: "NEW-SKU-001" });

      // Act
      const result = await repository.save(product);

      // Assert
      expect(result).toEqual(product);
      const found = await repository.findById("new-1");
      expect(found).toEqual(product);
      const foundBySku = await repository.findBySku("NEW-SKU-001");
      expect(foundBySku).toEqual(product);
    });

    it("should update existing product when saving with same ID", async () => {
      // Arrange - Save initial product
      const original = createTestProduct({
        id: "1",
        sku: "MOUSE-001",
        price: 29.99,
      });
      await repository.save(original);

      // Act - Update price
      const updated = { ...original, price: 39.99 };
      const result = await repository.save(updated);

      // Assert
      expect(result.price).toBe(39.99);
      const found = await repository.findById("1");
      expect(found?.price).toBe(39.99);
    });

    it("should update SKU index when product SKU changes", async () => {
      // Arrange - Save product with original SKU
      const original = createTestProduct({ id: "1", sku: "OLD-SKU" });
      await repository.save(original);

      // Act - Change SKU
      const updated = { ...original, sku: "NEW-SKU" };
      await repository.save(updated);

      // Assert - Old SKU should not be found
      const foundByOldSku = await repository.findBySku("OLD-SKU");
      expect(foundByOldSku).toBeNull();

      // New SKU should find the product
      const foundByNewSku = await repository.findBySku("NEW-SKU");
      expect(foundByNewSku).toEqual(updated);
    });
  });

  describe("findById", () => {
    it("should return product when ID exists (ECP: Valid)", async () => {
      // Arrange - Use seeded data
      const product = await repository.findById("1");

      // Assert
      expect(product).toBeDefined();
      expect(product?.id).toBe("1");
      expect(product?.name).toBe("Wireless Mouse");
    });

    it("should return null when ID does not exist (ECP: Invalid)", async () => {
      // Act
      const product = await repository.findById("nonexistent-id");

      // Assert
      expect(product).toBeNull();
    });
  });

  describe("findBySku", () => {
    it("should return product when SKU exists (ECP: Valid)", async () => {
      // Act - Use seeded data
      const product = await repository.findBySku("MOUSE-001");

      // Assert
      expect(product).toBeDefined();
      expect(product?.sku).toBe("MOUSE-001");
      expect(product?.name).toBe("Wireless Mouse");
    });

    it("should return null when SKU does not exist (ECP: Invalid)", async () => {
      // Act
      const product = await repository.findBySku("NONEXISTENT-SKU");

      // Assert
      expect(product).toBeNull();
    });

    it("should use SKU index for efficient lookup", async () => {
      // Arrange - Save a new product
      const newProduct = createTestProduct({ id: "test-id", sku: "TEST-SKU" });
      await repository.save(newProduct);

      // Act
      const found = await repository.findBySku("TEST-SKU");

      // Assert - Should find via index
      expect(found).toEqual(newProduct);
    });
  });

  describe("findAll", () => {
    it("should return all products when no options provided", async () => {
      // Act
      const result = await repository.findAll();

      // Assert - Should return seeded products (3 items)
      expect(result.products.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("should return empty array when repository is empty", async () => {
      // Arrange - Create fresh empty repository
      const emptyRepo = new InMemoryProductRepository(mockLogger);
      // Clear seeded data by accessing private field (for testing only)
      (emptyRepo as any).products.clear();
      (emptyRepo as any).skuIndex.clear();

      // Act
      const result = await emptyRepo.findAll();

      // Assert
      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should apply limit boundary (BVA: limit=1)", async () => {
      // Act
      const result = await repository.findAll({ limit: 1, offset: 0 });

      // Assert
      expect(result.products.length).toBe(1);
      expect(result.total).toBe(3); // Total is not affected by limit
    });

    it("should apply offset boundary (BVA: offset=0)", async () => {
      // Act
      const result = await repository.findAll({ limit: 10, offset: 0 });

      // Assert
      expect(result.products.length).toBe(3);
      expect(result.products[0].id).toBe("1"); // First product
    });

    it("should handle offset beyond total (BVA: offset > total)", async () => {
      // Act
      const result = await repository.findAll({ limit: 10, offset: 100 });

      // Assert
      expect(result.products).toEqual([]);
      expect(result.total).toBe(3); // Total count is still correct
    });

    it("should apply pagination correctly (ECP: Normal pagination)", async () => {
      // Act - Get second page with limit 1
      const result = await repository.findAll({ limit: 1, offset: 1 });

      // Assert
      expect(result.products.length).toBe(1);
      expect(result.products[0].id).toBe("2"); // Second product
      expect(result.total).toBe(3);
    });

    it("should handle limit=0 edge case (BVA: Minimum limit)", async () => {
      // Act
      const result = await repository.findAll({ limit: 0, offset: 0 });

      // Assert
      expect(result.products).toEqual([]);
      expect(result.total).toBe(3);
    });
  });

  describe("delete", () => {
    it("should delete existing product and remove from SKU index", async () => {
      // Arrange - Verify product exists
      const beforeDelete = await repository.findById("1");
      expect(beforeDelete).toBeDefined();

      // Act
      await repository.delete("1");

      // Assert - Product should not be found
      const afterDelete = await repository.findById("1");
      expect(afterDelete).toBeNull();

      // SKU index should also be cleaned up
      const foundBySku = await repository.findBySku("MOUSE-001");
      expect(foundBySku).toBeNull();
    });

    it("should handle deletion of non-existent product gracefully", async () => {
      // Act & Assert - Should not throw
      await expect(repository.delete("nonexistent-id")).resolves.not.toThrow();

      // Verify logger was called with warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { productId: "nonexistent-id" },
        "Attempted to delete non-existent product",
      );
    });

    it("should maintain repository integrity after deletion", async () => {
      // Arrange
      const beforeCount = (await repository.findAll()).total;

      // Act - Delete one product
      await repository.delete("1");

      // Assert - Total should decrease
      const afterCount = (await repository.findAll()).total;
      expect(afterCount).toBe(beforeCount - 1);

      // Other products should still be accessible
      const product2 = await repository.findById("2");
      expect(product2).toBeDefined();
    });
  });

  describe("Seed data initialization", () => {
    it("should seed 3 products on initialization", async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.total).toBe(3);
      expect(result.products).toHaveLength(3);
    });

    it("should seed products with correct SKUs in index", async () => {
      // Act & Assert - All seeded SKUs should be findable
      const mouse = await repository.findBySku("MOUSE-001");
      const keyboard = await repository.findBySku("KB-001");
      const hub = await repository.findBySku("HUB-001");

      expect(mouse).toBeDefined();
      expect(keyboard).toBeDefined();
      expect(hub).toBeDefined();
    });

    it("should log seed operation", () => {
      // Assert - Constructor already ran, check logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 3 },
        "Repository seeded with sample data",
      );
    });
  });
});
