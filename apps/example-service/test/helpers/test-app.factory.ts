import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  LoggerService,
} from "@nestjs/common";
import { Module, Global } from "@nestjs/common";
import { AppModule } from "~/app.module";
import { InMemoryProductRepository } from "~/product/outbound/adapters/in-memory-product.repository";
import { PrismaService } from "~/database/prisma.service";
import { DatabaseModule } from "~/database/database.module";

export interface TestAppOptions {
  /**
   * Whether to apply global validation pipe
   * @default true
   */
  useValidation?: boolean;

  /**
   * Whether to use in-memory repositories (for component tests)
   * @default true
   */
  useInMemoryRepositories?: boolean;

  /**
   * Whether to suppress logger output during tests
   * @default true
   */
  suppressLogs?: boolean;
}

/**
 * Silent logger that suppresses all output during tests
 */
class SilentLogger implements LoggerService {
  log() {}
  error() {}
  warn() {}
  debug() {}
  verbose() {}
  fatal() {}
}

/**
 * Creates a NestJS application instance configured for component testing
 * Applies the same configuration as main.ts (validation pipe, etc.)
 *
 * @param options - Configuration options for the test app
 * @returns Initialized INestApplication instance
 *
 * @example
 * ```typescript
 * let app: INestApplication
 *
 * beforeAll(async () => {
 *   app = await createTestApp()
 * })
 *
 * afterAll(async () => {
 *   await app.close()
 * })
 * ```
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  const {
    useValidation = true,
    useInMemoryRepositories = true,
    suppressLogs = true,
  } = options;

  // Suppress logger output during component tests
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = "fatal";
  }

  // Create a mock DatabaseModule for component tests
  // Must be @Global() to match real DatabaseModule behavior
  @Global()
  @Module({
    providers: [
      {
        provide: PrismaService,
        useFactory: () => ({
          $connect: jest.fn().mockResolvedValue(undefined),
          $disconnect: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
          $on: jest.fn(),
        }),
      },
    ],
    exports: [PrismaService],
  })
  class MockDatabaseModule {}

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Override repositories with in-memory implementations for component tests
  if (useInMemoryRepositories) {
    // Replace DatabaseModule with MockDatabaseModule to prevent real DB connections
    moduleBuilder.overrideModule(DatabaseModule).useModule(MockDatabaseModule);

    moduleBuilder
      .overrideProvider("ProductRepository")
      .useClass(InMemoryProductRepository);
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication();

  // Suppress all logger output during tests
  if (suppressLogs) {
    app.useLogger(new SilentLogger());
  }

  // Apply same configuration as main.ts
  if (useValidation) {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
  }

  await app.init();

  return app;
}
