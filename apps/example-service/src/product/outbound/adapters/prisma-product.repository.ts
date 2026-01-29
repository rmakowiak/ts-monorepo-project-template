import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { Product as PrismaProduct, Prisma } from "@prisma/client";
import { PrismaService } from "~/database/prisma.service";
import { Product, ProductId } from "../../domain/product.entity";
import {
  ProductRepository,
  QueryOptions,
} from "../ports/product-repository.port";
import { ProductAlreadyExistsError } from "../../domain/product.error";

/**
 * Prisma implementation of ProductRepository
 *
 * @remarks
 * - Uses soft deletes via isActive flag
 * - Maps between Prisma model and domain entity
 * - Logs all database operations
 * - Converts Prisma Decimal to number for price
 *
 * @example
 * ```typescript
 * // Register in ProductModule
 * {
 *   provide: 'ProductRepository',
 *   useClass: PrismaProductRepository,
 * }
 * ```
 */
@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PrismaProductRepository.name);
  }

  async save(product: Product): Promise<Product> {
    this.logger.debug(
      { productId: product.id, sku: product.sku },
      "Saving product",
    );

    try {
      const saved = await this.prisma.product.upsert({
        where: { id: product.id },
        create: {
          id: product.id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          isActive: true,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
        update: {
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          updatedAt: product.updatedAt,
        },
      });

      this.logger.info({ productId: saved.id }, "Product saved successfully");
      return this.toDomain(saved);
    } catch (error) {
      // Handle Prisma unique constraint violations
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes("sku")) {
          this.logger.warn(
            { sku: product.sku },
            "SKU unique constraint violation",
          );
          throw new ProductAlreadyExistsError(product.sku);
        }
      }
      // Re-throw other errors
      throw error;
    }
  }

  async findById(id: ProductId): Promise<Product | null> {
    this.logger.debug({ productId: id }, "Finding product by ID");

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true,
      },
    });

    if (!product) {
      this.logger.debug({ productId: id }, "Product not found");
      return null;
    }

    this.logger.debug({ productId: id }, "Product found");
    return this.toDomain(product);
  }

  async findBySku(sku: string): Promise<Product | null> {
    this.logger.debug({ sku }, "Finding product by SKU");

    const product = await this.prisma.product.findFirst({
      where: {
        sku,
        isActive: true,
      },
    });

    if (!product) {
      this.logger.debug({ sku }, "Product not found");
      return null;
    }

    this.logger.debug({ sku, productId: product.id }, "Product found");
    return this.toDomain(product);
  }

  async findAll(
    options?: QueryOptions,
  ): Promise<{ products: Product[]; total: number }> {
    const limit = options?.limit;
    const offset = options?.offset ?? 0;

    this.logger.debug({ limit, offset }, "Finding all products");

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        orderBy: [
          { createdAt: "desc" },
          { id: "asc" }, // Secondary sort for stable ordering
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count({
        where: { isActive: true },
      }),
    ]);

    this.logger.info(
      { count: products.length, total, limit, offset },
      "Products retrieved",
    );

    return {
      products: products.map((p) => this.toDomain(p)),
      total,
    };
  }

  async delete(id: ProductId): Promise<void> {
    this.logger.debug({ productId: id }, "Soft deleting product");

    const result = await this.prisma.product.updateMany({
      where: {
        id,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      this.logger.debug(
        { productId: id },
        "Product not found or already deleted",
      );
      return;
    }

    this.logger.info({ productId: id }, "Product soft deleted");
  }

  /**
   * Maps Prisma Product model to domain Product entity
   */
  private toDomain(prismaProduct: PrismaProduct): Product {
    return {
      id: prismaProduct.id,
      name: prismaProduct.name,
      description: prismaProduct.description,
      sku: prismaProduct.sku,
      price: Number(prismaProduct.price), // Convert Decimal to number
      stock: prismaProduct.stock,
      createdAt: prismaProduct.createdAt,
      updatedAt: prismaProduct.updatedAt,
    };
  }
}
