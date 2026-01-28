import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import { AppModule } from "~/app.module";
import { AppConfigService } from "~/shared/config/app-config.service";
import { createSecurityMiddleware } from "~/shared/security/security.middleware";
import { InMemoryProductRepository } from "~/product/outbound/adapters/in-memory-product.repository";
import { PrismaService } from "~/database/prisma.service";
import { MockPrismaService } from "./mock-prisma.service";

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

  let moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Override database connection with mock for component tests
  moduleBuilder = moduleBuilder
    .overrideProvider(PrismaService)
    .useClass(MockPrismaService);

  // Override repositories with in-memory implementations for component tests
  if (useInMemoryRepositories) {
    moduleBuilder = moduleBuilder
      .overrideProvider("ProductRepository")
      .useClass(InMemoryProductRepository);
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication();

  // Get configuration
  const config = app.get(AppConfigService);

  // Apply Helmet security headers (same as main.ts)
  const securityMiddleware = createSecurityMiddleware({
    helmet: {
      enabled: config.security.SECURITY_HELMET_ENABLED,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    },
  });
  securityMiddleware.forEach((middleware) => app.use(middleware));

  // Configure CORS (same as main.ts)
  const corsOrigins = config.security.SECURITY_CORS_ORIGINS;
  app.enableCors({
    origin:
      corsOrigins === "*" ? true : corsOrigins.split(",").map((o) => o.trim()),
    credentials: true,
  });

  // Request body size limits (same as main.ts)
  app.use(json({ limit: config.security.SECURITY_MAX_BODY_SIZE }));
  app.use(
    urlencoded({
      extended: true,
      limit: config.security.SECURITY_MAX_BODY_SIZE,
    }),
  );

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
