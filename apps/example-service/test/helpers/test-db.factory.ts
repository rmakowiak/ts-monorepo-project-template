import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Starts a PostgreSQL testcontainer for integration tests
 *
 * @returns Started PostgreSQL container
 */
export async function startPostgreSqlContainer(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .withExposedPorts(5432)
    .start();

  return container;
}

/**
 * Runs Prisma migrations against a database
 *
 * @param databaseUrl - PostgreSQL connection string
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  try {
    const { stderr } = await execAsync("npx prisma migrate deploy", {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      cwd: process.cwd(),
    });

    if (
      stderr &&
      !stderr.includes("All migrations have been successfully applied")
    ) {
      console.error("Migration stderr:", stderr);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Cleans all data from database tables (for test isolation)
 *
 * @param databaseUrl - PostgreSQL connection string
 */
export async function cleanDatabase(databaseUrl: string): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    // Delete in correct order (respecting foreign keys)
    await prisma.analyticsEvent.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seeds database with multiple products for testing bulk operations
 * Uses direct database access for better performance
 *
 * @param databaseUrl - PostgreSQL connection string
 * @param count - Number of products to create
 * @param options - Optional overrides for product properties
 * @returns Array of created product IDs
 */
export async function seedProducts(
  databaseUrl: string,
  count: number,
  options?: {
    skuPrefix?: string;
    namePrefix?: string;
    basePrice?: number;
    baseStock?: number;
  },
): Promise<string[]> {
  const {
    skuPrefix = "BULK-SKU",
    namePrefix = "Bulk Product",
    basePrice = 10,
    baseStock = 100,
  } = options ?? {};

  const { PrismaClient } = await import("@prisma/client");
  const { randomUUID } = await import("crypto");

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const products = Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      sku: `${skuPrefix}-${i.toString().padStart(3, "0")}`,
      name: `${namePrefix} ${i}`,
      description: `Description for ${namePrefix.toLowerCase()} ${i}`,
      price: basePrice + i,
      stock: baseStock + i,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await prisma.product.createMany({ data: products });
    return products.map((p) => p.id);
  } finally {
    await prisma.$disconnect();
  }
}
