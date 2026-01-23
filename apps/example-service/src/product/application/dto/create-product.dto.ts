import {
  IsString,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateProductDto {
  @ApiProperty({
    description: "Product name",
    example: "Wireless Mouse",
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: "Product description",
    example: "Ergonomic wireless mouse with 6 buttons",
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({
    description: "Stock Keeping Unit - must be unique",
    example: "MOUSE-001",
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  sku!: string;

  @ApiProperty({
    description: "Product price in USD",
    example: 29.99,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @ApiProperty({
    description: "Available stock quantity",
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  stock!: number;
}
