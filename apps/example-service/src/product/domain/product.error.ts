import { ProductId } from "./product.entity";

export class ProductNotFoundError extends Error {
  constructor(id: ProductId) {
    super(`Product not found: ${id}`);
    this.name = "ProductNotFoundError";
  }
}

export class ProductAlreadyExistsError extends Error {
  constructor(sku: string) {
    super(`Product with SKU ${sku} already exists`);
    this.name = "ProductAlreadyExistsError";
  }
}

export class InsufficientStockError extends Error {
  constructor(productId: ProductId, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}: requested ${requested}, available ${available}`,
    );
    this.name = "InsufficientStockError";
  }
}
