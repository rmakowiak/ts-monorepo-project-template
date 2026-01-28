import { Injectable } from "@nestjs/common";

/**
 * Mock PrismaService for component tests
 * Prevents actual database connections during testing
 */
@Injectable()
export class MockPrismaService {
  // Mock methods that might be called
  async $connect() {
    // No-op: don't actually connect
  }

  async $disconnect() {
    // No-op: don't actually disconnect
  }

  async $transaction(fn: any) {
    // If called, just execute the function
    return fn(this);
  }

  async $queryRaw() {
    // Mock successful query for health checks
    return [{ result: 1 }];
  }

  async $queryRawUnsafe() {
    // Mock successful query for health checks
    return [{ result: 1 }];
  }

  // Add any other Prisma methods that might be called
  // For component tests, we use in-memory repositories, so Prisma shouldn't be called
  // But if it is, these will prevent errors
}
