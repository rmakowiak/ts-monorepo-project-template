import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { AppConfig } from "./shared/config/app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Get configuration
  const config = app.get<AppConfig>("AppConfig");

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

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

  await app.listen(config.port, "0.0.0.0");

  const logger = app.get(Logger);
  logger.log(`🚀 Application running on: http://localhost:${config.port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${config.port}/api`);
  logger.log(`💚 Health check: http://localhost:${config.port}/health`);
  logger.log(`🌍 Environment: ${config.nodeEnv}`);
}

bootstrap();
