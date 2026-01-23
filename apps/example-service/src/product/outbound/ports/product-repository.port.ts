import { Product, ProductId } from "../../domain/product.entity";

export type QueryOptions = {
  limit?: number;
  offset?: number;
};

export type ProductRepository = {
  /**
   * Save a product (create or update)
   */
  save(product: Product): Promise<Product>;

  /**
   * Find a product by ID
   */
  findById(id: ProductId): Promise<Product | null>;

  /**
   * Find a product by SKU
   */
  findBySku(sku: string): Promise<Product | null>;

  /**
   * Find all products with optional pagination
   */
  findAll(
    options?: QueryOptions,
  ): Promise<{ products: Product[]; total: number }>;

  /**
   * Delete a product by ID
   */
  delete(id: ProductId): Promise<void>;
};
