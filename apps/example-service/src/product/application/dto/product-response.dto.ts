import { ApiProperty } from "@nestjs/swagger";

export class ProductResponseDto {
  @ApiProperty({
    description: "Product unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "Product name",
    example: "Wireless Mouse",
  })
  name!: string;

  @ApiProperty({
    description: "Product description",
    example: "Ergonomic wireless mouse with 6 buttons",
  })
  description!: string;

  @ApiProperty({
    description: "Stock Keeping Unit",
    example: "MOUSE-001",
  })
  sku!: string;

  @ApiProperty({
    description: "Product price in USD",
    example: 29.99,
  })
  price!: number;

  @ApiProperty({
    description: "Available stock quantity",
    example: 150,
  })
  stock!: number;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt!: string;
}
