export type ProductId = string;

export type Product = Readonly<{
  id: ProductId;
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}>;
