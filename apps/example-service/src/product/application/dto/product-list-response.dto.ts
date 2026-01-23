import { ApiProperty } from "@nestjs/swagger";
import { ProductResponseDto } from "./product-response.dto";

export class ProductListResponseDto {
  @ApiProperty({
    description: "List of products",
    type: [ProductResponseDto],
  })
  products!: ProductResponseDto[];

  @ApiProperty({
    description: "Total number of products",
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: "Number of products requested",
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: "Offset for pagination",
    example: 0,
  })
  offset!: number;
}
