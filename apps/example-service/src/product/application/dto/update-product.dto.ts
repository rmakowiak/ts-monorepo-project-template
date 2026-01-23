import {
  IsString,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
  IsOptional,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: "Product name",
    example: "Wireless Mouse Pro",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Product description",
    example: "Enhanced ergonomic wireless mouse with 8 buttons",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Product price in USD",
    example: 34.99,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({
    description: "Available stock quantity",
    example: 200,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}
