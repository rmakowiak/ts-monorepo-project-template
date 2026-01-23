import { ProductService } from "./product.service";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import {
  createTestProduct,
  createTestProductDto,
  createTestUpdateDto,
  BOUNDARY_VALUES,
} from "../../../test/fixtures/product.fixtures";
import {
  ProductNotFoundError,
  ProductAlreadyExistsError,
} from "../domain/product.error";
import type { ProductRepository } from "../outbound/ports/product-repository.port";

describe("ProductService", () => {
  let service: ProductService;
  let mockRepository: jest.Mocked<ProductRepository>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    };
    mockLogger = createMockLogger();
    service = new ProductService(mockRepository, mockLogger);
  });

  describe("createProduct", () => {
    it("should create product with valid data (ECP: Valid class)", async () => {
      // Arrange
      const dto = createTestProductDto();

      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.createProduct(dto);

      // Assert
      expect(mockRepository.findBySku).toHaveBeenCalledWith(dto.sku);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
      expect(result.sku).toBe(dto.sku);
      expect(result.price).toBe(dto.price);
      expect(result.stock).toBe(dto.stock);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("should throw ProductAlreadyExistsError when SKU exists (ECP: Invalid class)", async () => {
      // Arrange
      const dto = createTestProductDto({ sku: "EXISTING-SKU" });
      const existingProduct = createTestProduct({ sku: "EXISTING-SKU" });

      mockRepository.findBySku.mockResolvedValue(existingProduct);

      // Act & Assert
      await expect(service.createProduct(dto)).rejects.toThrow(
        ProductAlreadyExistsError,
      );
      await expect(service.createProduct(dto)).rejects.toThrow(
        "Product with SKU EXISTING-SKU already exists",
      );

      // Repository save should not be called
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should handle boundary values for price (BVA: Minimum valid)", async () => {
      // Arrange
      const dto = createTestProductDto({
        price: BOUNDARY_VALUES.price.valid.minimum,
      });

      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.createProduct(dto);

      // Assert
      expect(result.price).toBe(BOUNDARY_VALUES.price.valid.minimum);
    });

    it("should handle boundary values for stock (BVA: Zero stock)", async () => {
      // Arrange - Zero stock is valid (out of stock)
      const dto = createTestProductDto({
        stock: BOUNDARY_VALUES.stock.valid.zero,
      });

      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.createProduct(dto);

      // Assert
      expect(result.stock).toBe(0);
    });

    it("should set timestamps on creation", async () => {
      // Arrange
      const dto = createTestProductDto();
      const beforeCreate = new Date();

      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.createProduct(dto);
      const afterCreate = new Date();

      // Assert
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
      expect(result.updatedAt).toEqual(result.createdAt);
    });

    it("should log product creation", async () => {
      // Arrange
      const dto = createTestProductDto();

      mockRepository.findBySku.mockResolvedValue(null);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      await service.createProduct(dto);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { sku: dto.sku, name: dto.name },
        "Creating new product",
      );
    });
  });

  describe("getProductById", () => {
    it("should return product when found (ECP: Valid)", async () => {
      // Arrange
      const product = createTestProduct();
      mockRepository.findById.mockResolvedValue(product);

      // Act
      const result = await service.getProductById(product.id);

      // Assert
      expect(result).toEqual(product);
      expect(mockRepository.findById).toHaveBeenCalledWith(product.id);
    });

    it("should throw ProductNotFoundError when not found (ECP: Invalid)", async () => {
      // Arrange
      const productId = "nonexistent-id";
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProductById(productId)).rejects.toThrow(
        ProductNotFoundError,
      );
      await expect(service.getProductById(productId)).rejects.toThrow(
        `Product not found: ${productId}`,
      );
    });

    it("should log warning when product not found", async () => {
      // Arrange
      const productId = "missing-id";
      mockRepository.findById.mockResolvedValue(null);

      // Act
      try {
        await service.getProductById(productId);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { productId },
        "Product not found",
      );
    });
  });

  describe("getAllProducts", () => {
    it("should return products with default pagination (ECP: Normal)", async () => {
      // Arrange
      const products = [createTestProduct(), createTestProduct({ id: "2" })];
      mockRepository.findAll.mockResolvedValue({ products, total: 2 });

      // Act
      const result = await service.getAllProducts();

      // Assert
      expect(result.products).toEqual(products);
      expect(result.total).toBe(2);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
      });
    });

    it("should apply custom pagination parameters", async () => {
      // Arrange
      const products = [createTestProduct()];
      mockRepository.findAll.mockResolvedValue({ products, total: 10 });

      // Act
      const result = await service.getAllProducts(10, 5);

      // Assert
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
      });
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it("should handle limit boundary (BVA: limit=0)", async () => {
      // Arrange
      mockRepository.findAll.mockResolvedValue({ products: [], total: 10 });

      // Act
      const result = await service.getAllProducts(0, 0);

      // Assert
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 0,
        offset: 0,
      });
      expect(result.products).toHaveLength(0);
    });

    it("should handle offset boundary (BVA: offset=0)", async () => {
      // Arrange
      const products = [createTestProduct()];
      mockRepository.findAll.mockResolvedValue({ products, total: 1 });

      // Act
      await service.getAllProducts(10, 0);

      // Assert
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
      });
    });

    it("should return empty list when no products exist (ECP: Empty)", async () => {
      // Arrange
      mockRepository.findAll.mockResolvedValue({ products: [], total: 0 });

      // Act
      const result = await service.getAllProducts();

      // Assert
      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should log products retrieval", async () => {
      // Arrange
      mockRepository.findAll.mockResolvedValue({ products: [], total: 0 });

      // Act
      await service.getAllProducts(20, 10);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { limit: 20, offset: 10 },
        "Fetching all products",
      );
    });
  });

  describe("updateProduct", () => {
    it("should update product when exists (ECP: Valid)", async () => {
      // Arrange
      const existing = createTestProduct();
      const updateDto = createTestUpdateDto({
        name: existing.name,
        description: existing.description,
        price: 199.99,
        stock: 50,
      });
      const beforeUpdate = new Date();

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.updateProduct(existing.id, updateDto);
      const afterUpdate = new Date();

      // Assert
      expect(result.id).toBe(existing.id);
      expect(result.price).toBe(199.99);
      expect(result.stock).toBe(50);
      expect(result.name).toBe(existing.name); // Unchanged
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(result.updatedAt.getTime()).toBeLessThanOrEqual(
        afterUpdate.getTime(),
      );
    });

    it("should throw ProductNotFoundError when product does not exist (ECP: Invalid)", async () => {
      // Arrange
      const productId = "nonexistent-id";
      const updateDto = createTestUpdateDto({ price: 100 });

      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateProduct(productId, updateDto)).rejects.toThrow(
        ProductNotFoundError,
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("should handle partial updates (ECP: Partial fields)", async () => {
      // Arrange
      const existing = createTestProduct({ price: 50, stock: 100 });
      // Create plain object with only the field we want to update
      const updateDto: any = { price: 75 }; // Only update price

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.updateProduct(existing.id, updateDto);

      // Assert
      expect(result.price).toBe(75);
      expect(result.stock).toBe(100); // Unchanged
      expect(result.name).toBe(existing.name); // Unchanged
    });

    it("should update timestamp but not creation time", async () => {
      // Arrange
      const existing = createTestProduct({
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      });
      const updateDto = createTestUpdateDto({ price: 100 });

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.updateProduct(existing.id, updateDto);

      // Assert
      expect(result.createdAt).toEqual(existing.createdAt); // Unchanged
      expect(result.updatedAt).not.toEqual(existing.updatedAt); // Changed
      expect(result.updatedAt.getTime()).toBeGreaterThan(
        existing.updatedAt.getTime(),
      );
    });

    it("should handle empty update dto", async () => {
      // Arrange
      const existing = createTestProduct();
      // Empty object with no properties
      const emptyUpdate: any = {};

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (product) => product);

      // Act
      const result = await service.updateProduct(existing.id, emptyUpdate);

      // Assert - All fields stay the same except updatedAt
      expect(result.name).toBe(existing.name);
      expect(result.price).toBe(existing.price);
      expect(result.stock).toBe(existing.stock);
      expect(result.updatedAt).not.toEqual(existing.updatedAt);
    });
  });

  describe("deleteProduct", () => {
    it("should delete product when exists (ECP: Valid)", async () => {
      // Arrange
      const product = createTestProduct();
      mockRepository.findById.mockResolvedValue(product);
      mockRepository.delete.mockResolvedValue(undefined);

      // Act
      await service.deleteProduct(product.id);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(product.id);
      expect(mockRepository.delete).toHaveBeenCalledWith(product.id);
    });

    it("should throw ProductNotFoundError when product does not exist (ECP: Invalid)", async () => {
      // Arrange
      const productId = "nonexistent-id";
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteProduct(productId)).rejects.toThrow(
        ProductNotFoundError,
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it("should log deletion", async () => {
      // Arrange
      const product = createTestProduct();
      mockRepository.findById.mockResolvedValue(product);
      mockRepository.delete.mockResolvedValue(undefined);

      // Act
      await service.deleteProduct(product.id);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { productId: product.id },
        "Deleting product",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { productId: product.id, sku: product.sku },
        "Product deleted successfully",
      );
    });

    it("should log warning when product not found for deletion", async () => {
      // Arrange
      const productId = "missing-id";
      mockRepository.findById.mockResolvedValue(null);

      // Act
      try {
        await service.deleteProduct(productId);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { productId },
        "Product not found for deletion",
      );
    });
  });
});
