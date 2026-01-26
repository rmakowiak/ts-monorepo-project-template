import {
  IsString,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateProductDto {
  @ApiProperty({
    description: "Product name",
    example: "Wireless Mouse",
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @ApiProperty({
    description: "Product description",
    example: "Ergonomic wireless mouse with 6 buttons",
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  description!: string;

  @ApiProperty({
    description: "Stock Keeping Unit - must be unique",
    example: "MOUSE-001",
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
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
