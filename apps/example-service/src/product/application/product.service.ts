import { Injectable, Inject } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { randomUUID } from "crypto";
import type { ProductRepository } from "../outbound/ports/product-repository.port";
import type { Product, ProductId } from "../domain/product.entity";
import {
  ProductNotFoundError,
  ProductAlreadyExistsError,
} from "../domain/product.error";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductService {
  constructor(
    @Inject("ProductRepository")
    private readonly repository: ProductRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProductService.name);
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    this.logger.info({ sku: dto.sku, name: dto.name }, "Creating new product");

    // Check if SKU already exists
    const existing = await this.repository.findBySku(dto.sku);
    if (existing) {
      this.logger.warn({ sku: dto.sku }, "Product with SKU already exists");
      throw new ProductAlreadyExistsError(dto.sku);
    }

    const now = new Date();
    const product: Product = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      sku: dto.sku,
      price: dto.price,
      stock: dto.stock,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repository.save(product);

    this.logger.info(
      { productId: saved.id, sku: saved.sku },
      "Product created successfully",
    );

    return saved;
  }

  async getProductById(id: ProductId): Promise<Product> {
    this.logger.debug({ productId: id }, "Fetching product by ID");

    const product = await this.repository.findById(id);

    if (!product) {
      this.logger.warn({ productId: id }, "Product not found");
      throw new ProductNotFoundError(id);
    }

    this.logger.debug(
      { productId: id, name: product.name },
      "Product retrieved",
    );

    return product;
  }

  async getAllProducts(
    limit = 50,
    offset = 0,
  ): Promise<{ products: Product[]; total: number }> {
    this.logger.info({ limit, offset }, "Fetching all products");

    const result = await this.repository.findAll({ limit, offset });

    this.logger.info(
      {
        total: result.total,
        returned: result.products.length,
        limit,
        offset,
      },
      "Products retrieved successfully",
    );

    return result;
  }

  async updateProduct(id: ProductId, dto: UpdateProductDto): Promise<Product> {
    this.logger.info(
      { productId: id, updates: Object.keys(dto) },
      "Updating product",
    );

    const existing = await this.repository.findById(id);

    if (!existing) {
      this.logger.warn({ productId: id }, "Product not found for update");
      throw new ProductNotFoundError(id);
    }

    // Filter out undefined properties to only update provided fields
    const updates = Object.fromEntries(
      Object.entries(dto).filter(([_, value]) => value !== undefined),
    );

    const updated: Product = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    const saved = await this.repository.save(updated);

    this.logger.info(
      { productId: id, name: saved.name },
      "Product updated successfully",
    );

    return saved;
  }

  async deleteProduct(id: ProductId): Promise<void> {
    this.logger.info({ productId: id }, "Deleting product");

    const existing = await this.repository.findById(id);

    if (!existing) {
      this.logger.warn({ productId: id }, "Product not found for deletion");
      throw new ProductNotFoundError(id);
    }

    await this.repository.delete(id);

    this.logger.info(
      { productId: id, sku: existing.sku },
      "Product deleted successfully",
    );
  }
}
