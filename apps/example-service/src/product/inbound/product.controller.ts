import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseFilters,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { ProductService } from "../application/product.service";
import { CreateProductDto } from "../application/dto/create-product.dto";
import { UpdateProductDto } from "../application/dto/update-product.dto";
import { ProductResponseDto } from "../application/dto/product-response.dto";
import { ProductListResponseDto } from "../application/dto/product-list-response.dto";
import { ProductExceptionFilter } from "./product-exception.filter";
import { JwtAuthGuard } from "~/auth/guards/jwt-auth.guard";
import { RolesGuard } from "~/auth/guards/roles.guard";
import { Roles } from "~/auth/decorators/roles.decorator";
import { CurrentUser } from "~/auth/decorators/current-user.decorator";
import type { User } from "~/auth/domain/user.entity";
import type { Product } from "../domain/product.entity";

@ApiTags("products")
@ApiBearerAuth()
@Controller("products")
@UseFilters(ProductExceptionFilter)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new product" })
  @ApiResponse({
    status: 201,
    description: "Product created successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 409, description: "Product with SKU already exists" })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: User,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.createProduct(dto, user.id);
    return this.toDto(product);
  }

  @Get()
  @ApiOperation({ summary: "Get all products" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: "List of products retrieved successfully",
    type: ProductListResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<ProductListResponseDto> {
    const { products, total } = await this.productService.getAllProducts(
      limit,
      offset,
    );

    return {
      products: products.map((p) => this.toDto(p)),
      total,
      limit,
      offset,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a product by ID" })
  @ApiParam({ name: "id", description: "Product ID", example: "1" })
  @ApiResponse({
    status: 200,
    description: "Product retrieved successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.getProductById(id, user.id);
    return this.toDto(product);
  }

  @Patch(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Update a product" })
  @ApiParam({ name: "id", description: "Product ID", example: "1" })
  @ApiResponse({
    status: 200,
    description: "Product updated successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: User,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.updateProduct(id, dto, user.id);
    return this.toDto(product);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a product" })
  @ApiParam({ name: "id", description: "Product ID", example: "1" })
  @ApiResponse({ status: 204, description: "Product deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.productService.deleteProduct(id, user.id);
  }

  private toDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
