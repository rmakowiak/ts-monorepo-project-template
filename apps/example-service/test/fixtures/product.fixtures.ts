import type { Product } from '~/product/domain/product.entity'
import { CreateProductDto } from '~/product/application/dto/create-product.dto'
import { UpdateProductDto } from '~/product/application/dto/update-product.dto'

/**
 * Create a test Product entity with default or overridden values
 * Useful for unit tests that need Product domain objects
 *
 * @param overrides - Partial Product to override defaults
 * @returns Complete Product entity
 */
export function createTestProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'test-product-id',
    name: 'Test Product',
    description: 'Test product description',
    sku: 'TEST-SKU-001',
    price: 99.99,
    stock: 100,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

/**
 * Create a test CreateProductDto with default or overridden values
 * Useful for testing service methods and API endpoints
 *
 * @param overrides - Partial DTO to override defaults
 * @returns Complete CreateProductDto
 */
export function createTestProductDto(overrides?: Partial<CreateProductDto>): CreateProductDto {
  const dto = new CreateProductDto()
  dto.name = overrides?.name ?? 'New Test Product'
  dto.description = overrides?.description ?? 'New test product description'
  dto.sku = overrides?.sku ?? `TEST-${Date.now()}`
  dto.price = overrides?.price ?? 49.99
  dto.stock = overrides?.stock ?? 50

  return dto
}

/**
 * Create a test UpdateProductDto with specific fields to update
 *
 * @param overrides - Partial DTO fields to include
 * @returns Partial UpdateProductDto
 */
export function createTestUpdateDto(overrides?: Partial<UpdateProductDto>): UpdateProductDto {
  const dto = new UpdateProductDto()

  if (overrides?.name !== undefined) dto.name = overrides.name
  if (overrides?.description !== undefined) dto.description = overrides.description
  if (overrides?.price !== undefined) dto.price = overrides.price
  if (overrides?.stock !== undefined) dto.stock = overrides.stock

  return dto
}

/**
 * Sample products for testing list operations
 */
export const SAMPLE_PRODUCTS: Product[] = [
  createTestProduct({
    id: '1',
    name: 'Wireless Mouse',
    sku: 'MOUSE-001',
    price: 29.99,
    stock: 150,
  }),
  createTestProduct({
    id: '2',
    name: 'Mechanical Keyboard',
    sku: 'KB-001',
    price: 89.99,
    stock: 75,
  }),
  createTestProduct({
    id: '3',
    name: 'USB-C Hub',
    sku: 'HUB-001',
    price: 45.99,
    stock: 200,
  }),
]

/**
 * Boundary value test data for ECP/BVA testing
 */
export const BOUNDARY_VALUES = {
  price: {
    valid: {
      minimum: 0.01, // Minimum valid price
      normal: 99.99, // Normal price
      maximum: 9999999.99, // Maximum practical price
    },
    invalid: {
      zero: 0, // Must be positive
      negative: -1, // Cannot be negative
      tooManyDecimals: 10.999, // Max 2 decimal places
    },
  },
  stock: {
    valid: {
      zero: 0, // Out of stock is valid
      one: 1, // Minimum in-stock quantity
      normal: 100, // Normal stock level
    },
    invalid: {
      negative: -1, // Cannot be negative
    },
  },
  strings: {
    name: {
      maxLength: 100,
      valid: 'A'.repeat(100), // Exactly at boundary
      invalid: 'A'.repeat(101), // Over boundary
    },
    description: {
      maxLength: 500,
      valid: 'A'.repeat(500),
      invalid: 'A'.repeat(501),
    },
    sku: {
      maxLength: 50,
      valid: 'A'.repeat(50),
      invalid: 'A'.repeat(51),
    },
  },
}
