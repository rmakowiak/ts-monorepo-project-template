import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type {
  ProductRepository,
  QueryOptions,
} from "../ports/product-repository.port";
import type { Product, ProductId } from "../../domain/product.entity";

@Injectable()
export class InMemoryProductRepository implements ProductRepository {
  private products = new Map<ProductId, Product>();
  private skuIndex = new Map<string, ProductId>();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(InMemoryProductRepository.name);
    this.seedData();
  }

  async save(product: Product): Promise<Product> {
    this.logger.debug(
      { productId: product.id, sku: product.sku },
      "Saving product",
    );

    const existing = this.products.get(product.id);

    if (existing && existing.sku !== product.sku) {
      // If SKU changed, update the index
      this.skuIndex.delete(existing.sku);
      this.skuIndex.set(product.sku, product.id);
    } else if (!existing) {
      // New product, add to index
      this.skuIndex.set(product.sku, product.id);
    }

    this.products.set(product.id, product);

    this.logger.info(
      { productId: product.id, name: product.name },
      "Product saved successfully",
    );

    return product;
  }

  async findById(id: ProductId): Promise<Product | null> {
    this.logger.debug({ productId: id }, "Finding product by ID");

    const product = this.products.get(id) || null;

    if (product) {
      this.logger.debug({ productId: id, found: true }, "Product found");
    } else {
      this.logger.debug({ productId: id, found: false }, "Product not found");
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product | null> {
    this.logger.debug({ sku }, "Finding product by SKU");

    const productId = this.skuIndex.get(sku);
    if (!productId) {
      this.logger.debug({ sku, found: false }, "Product not found by SKU");
      return null;
    }

    const product = this.products.get(productId);
    this.logger.debug(
      { sku, found: !!product },
      "Product lookup by SKU complete",
    );

    return product || null;
  }

  async findAll(
    options?: QueryOptions,
  ): Promise<{ products: Product[]; total: number }> {
    this.logger.debug({ options }, "Finding all products");

    const allProducts = Array.from(this.products.values());
    const total = allProducts.length;

    const { limit = 50, offset = 0 } = options || {};

    const products = allProducts.slice(offset, offset + limit);

    this.logger.info(
      { total, returned: products.length, limit, offset },
      "Products retrieved",
    );

    return { products, total };
  }

  async delete(id: ProductId): Promise<void> {
    this.logger.debug({ productId: id }, "Deleting product");

    const product = this.products.get(id);

    if (product) {
      this.products.delete(id);
      this.skuIndex.delete(product.sku);
      this.logger.info({ productId: id }, "Product deleted successfully");
    } else {
      this.logger.warn(
        { productId: id },
        "Attempted to delete non-existent product",
      );
    }
  }

  private seedData(): void {
    const sampleProducts: Product[] = [
      {
        id: "1",
        name: "Wireless Mouse",
        description: "Ergonomic wireless mouse with 6 buttons",
        sku: "MOUSE-001",
        price: 29.99,
        stock: 150,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      },
      {
        id: "2",
        name: "Mechanical Keyboard",
        description: "RGB mechanical keyboard with Cherry MX switches",
        sku: "KB-001",
        price: 89.99,
        stock: 75,
        createdAt: new Date("2024-01-20"),
        updatedAt: new Date("2024-01-20"),
      },
      {
        id: "3",
        name: "USB-C Hub",
        description: "7-in-1 USB-C hub with 4K HDMI output",
        sku: "HUB-001",
        price: 45.99,
        stock: 200,
        createdAt: new Date("2024-02-01"),
        updatedAt: new Date("2024-02-01"),
      },
    ];

    sampleProducts.forEach((product) => {
      this.products.set(product.id, product);
      this.skuIndex.set(product.sku, product.id);
    });

    this.logger.info(
      { count: sampleProducts.length },
      "Repository seeded with sample data",
    );
  }
}
