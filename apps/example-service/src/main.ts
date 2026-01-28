import { NestFactory } from "@nestjs/core";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { initializeOtel } from "@monorepo/otel";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/config/app-config.service";
import { createSecurityMiddleware } from "./shared/security/security.middleware";

async function bootstrap() {
  let app: INestApplication;

  try {
    // Initialize OpenTelemetry BEFORE creating the NestJS app
    // This ensures all modules and HTTP requests are auto-instrumented
    // Config validation happens internally within the OTel package
    initializeOtel();

    app = await NestFactory.create(AppModule, { bufferLogs: true });

    // Use Pino logger
    app.useLogger(app.get(Logger));
    const logger = app.get(Logger);

    // Get configuration
    const config = app.get(AppConfigService);

    try {
      // Apply Helmet security headers with API-friendly configuration
      //
      // CSP (Content-Security-Policy) and COEP (Cross-Origin-Embedder-Policy) are
      // disabled to support Swagger UI, which loads resources from multiple origins.
      // These headers are typically needed for browser-based apps but can break
      // interactive API documentation.
      //
      // All other Helmet defaults remain enabled:
      // - X-Content-Type-Options: nosniff
      // - X-Frame-Options: DENY (prevents clickjacking)
      // - X-DNS-Prefetch-Control: off
      // - Strict-Transport-Security: max-age=31536000 (HSTS)
      const securityMiddleware = createSecurityMiddleware({
        helmet: {
          enabled: config.security.SECURITY_HELMET_ENABLED,
          contentSecurityPolicy: false, // Disabled for Swagger UI resource loading
          crossOriginEmbedderPolicy: false, // Disabled for Swagger UI iframe support
        },
      });
      securityMiddleware.forEach((middleware) => app.use(middleware));
    } catch (error) {
      logger.error(
        {
          error,
          config: { helmetEnabled: config.security.SECURITY_HELMET_ENABLED },
        },
        "Failed to apply Helmet security middleware",
      );
      throw error;
    }

    try {
      // Configure CORS with environment-based origins
      const corsOrigins = config.security.SECURITY_CORS_ORIGINS;
      app.enableCors({
        origin:
          corsOrigins === "*"
            ? true
            : corsOrigins.split(",").map((o) => o.trim()),
        credentials: true,
      });
    } catch (error) {
      logger.error(
        { error, corsOrigins: config.security.SECURITY_CORS_ORIGINS },
        "Failed to configure CORS",
      );
      throw error;
    }

    try {
      // Request body size limits (prevents DoS via large payloads)
      app.use(json({ limit: config.security.SECURITY_MAX_BODY_SIZE }));
      app.use(
        urlencoded({
          extended: true,
          limit: config.security.SECURITY_MAX_BODY_SIZE,
        }),
      );
    } catch (error) {
      logger.error(
        { error, maxBodySize: config.security.SECURITY_MAX_BODY_SIZE },
        "Failed to apply body size limits",
      );
      throw error;
    }

    // Global validation pipe
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

    // Swagger documentation
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Example Service API")
      .setDescription(
        "Production-ready NestJS service with clean architecture, ports/adapters pattern, and comprehensive logging",
      )
      .setVersion("1.0.0")
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description: "Enter JWT token",
        in: "header",
      })
      .addTag("root", "Root endpoints")
      .addTag("health", "Health check endpoints")
      .addTag("products", "Product management")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });

    // Enable graceful shutdown
    app.enableShutdownHooks();

    await app.listen(config.app.PORT, "0.0.0.0");

    logger.log(
      `🚀 Application running on: http://localhost:${config.app.PORT}`,
    );
    logger.log(
      `📚 Swagger documentation: http://localhost:${config.app.PORT}/api`,
    );
    logger.log(`💚 Health check: http://localhost:${config.app.PORT}/health`);
    logger.log(`🌍 Environment: ${config.app.NODE_ENV}`);
  } catch (error) {
    // CRITICAL: Application failed to start
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(
      JSON.stringify({
        level: "fatal",
        message: "Application failed to start",
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
      }),
    );

    process.exit(1);
  }
}

bootstrap();
