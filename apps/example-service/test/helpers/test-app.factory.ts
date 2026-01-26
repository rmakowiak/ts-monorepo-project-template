import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "~/app.module";
import { InMemoryProductRepository } from "~/product/outbound/adapters/in-memory-product.repository";

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
  const { useValidation = true, useInMemoryRepositories = true } = options;

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Override repositories with in-memory implementations for component tests
  if (useInMemoryRepositories) {
    moduleBuilder
      .overrideProvider("ProductRepository")
      .useClass(InMemoryProductRepository);
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication();

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
