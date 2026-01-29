import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import { AppModule } from "~/app.module";
import { AppConfigService } from "~/shared/config/app-config.service";
import { createSecurityMiddleware } from "~/shared/security/security.middleware";
import { PrismaProductRepository } from "~/product/outbound/adapters/prisma-product.repository";

export interface IntegrationTestAppOptions {
  /**
   * Database connection URL for the test container
   */
  databaseUrl: string;

  /**
   * Whether to apply global validation pipe
   * @default true
   */
  useValidation?: boolean;
}

/**
 * Creates a NestJS application instance configured for integration testing
 * Uses REAL database connection (via testcontainers) and real repositories
 *
 * @param options - Configuration options including database URL
 * @returns Initialized INestApplication instance
 *
 * @example
 * ```typescript
 * let app: INestApplication
 * let container: StartedPostgreSqlContainer
 *
 * beforeAll(async () => {
 *   container = await startPostgreSqlContainer()
 *   app = await createIntegrationTestApp({
 *     databaseUrl: container.getConnectionString()
 *   })
 * })
 *
 * afterAll(async () => {
 *   await app.close()
 *   await container.stop()
 * })
 * ```
 */
export async function createIntegrationTestApp(
  options: IntegrationTestAppOptions,
): Promise<INestApplication> {
  const { databaseUrl, useValidation = true } = options;

  // Set DATABASE_URL environment variable for the app
  process.env.DATABASE_URL = databaseUrl;

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Override ProductRepository to use REAL Prisma implementation
  // (This is redundant since AppModule already uses PrismaProductRepository in production,
  // but we make it explicit for clarity)
  const moduleFixture: TestingModule = await moduleBuilder
    .overrideProvider("ProductRepository")
    .useClass(PrismaProductRepository)
    .compile();

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
