import "reflect-metadata";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "~/app.module";
import { AppConfigService } from "~/shared/config/app-config.service";
import {
  Environment,
  LogLevel,
} from "~/shared/config/schemas/app.config.schema";

describe("Configuration Component Tests", () => {
  let app: INestApplication;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Suppress console output
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("application startup with valid configuration", () => {
    it("should successfully create app with valid configuration", async () => {
      process.env.PORT = "8000";
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
      process.env.LOG_LEVEL = "error";

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      expect(app).toBeDefined();

      const config = app.get(AppConfigService);
      expect(config.app.PORT).toBe(8000);
      expect(config.app.NODE_ENV).toBe(Environment.Test);
      expect(config.app.LOG_LEVEL).toBe(LogLevel.Error);
      expect(config.auth.JWT_SECRET).toBe(
        "test-secret-at-least-32-characters-long",
      );
    });

    it("should inject AppConfigService in services", async () => {
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const config = app.get(AppConfigService);

      expect(config).toBeInstanceOf(AppConfigService);
      expect(config.app).toBeDefined();
      expect(config.auth).toBeDefined();
    });

    it("should use default values when env vars not set", async () => {
      process.env.NODE_ENV = "test";
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
      // JWT_SECRET will use DEFAULT_JWT_SECRET

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const config = app.get(AppConfigService);

      expect(config.app.PORT).toBe(8000); // default
      expect(config.app.LOG_LEVEL).toBe(LogLevel.Info); // default
    });
  });

  describe("application startup with invalid configuration", () => {
    it("should fail to create app with invalid PORT", async () => {
      process.env.PORT = "99999";
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      await expect(
        Test.createTestingModule({
          imports: [AppModule],
        }).compile(),
      ).rejects.toThrow(/PORT must not be greater than 65535/);
    });

    it("should fail to create app with short JWT_SECRET", async () => {
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "too-short";

      await expect(
        Test.createTestingModule({
          imports: [AppModule],
        }).compile(),
      ).rejects.toThrow(/JWT_SECRET must be at least 32 characters/);
    });

    it("should fail to create app with invalid NODE_ENV", async () => {
      process.env.PORT = "8000";
      process.env.NODE_ENV = "invalid-environment";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      await expect(
        Test.createTestingModule({
          imports: [AppModule],
        }).compile(),
      ).rejects.toThrow(/NODE_ENV must be a valid enum value/);
    });

    it("should fail to create app with invalid LOG_LEVEL", async () => {
      process.env.NODE_ENV = "test";
      process.env.LOG_LEVEL = "verbose";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      await expect(
        Test.createTestingModule({
          imports: [AppModule],
        }).compile(),
      ).rejects.toThrow(/LOG_LEVEL must be a valid enum value/);
    });

    it("should provide detailed error messages on validation failure", async () => {
      process.env.PORT = "0";
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      await expect(
        Test.createTestingModule({
          imports: [AppModule],
        }).compile(),
      ).rejects.toThrow(/Configuration validation failed/);
    });
  });

  describe("config immutability in app context", () => {
    it("should provide frozen config objects", async () => {
      process.env.NODE_ENV = "test";
      process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const config = app.get(AppConfigService);

      // Config values should be read-only
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        config.app.PORT = 9999;
      }).toThrow();
    });
  });

  describe("environment-specific behavior", () => {
    it("should work with production environment", async () => {
      process.env.NODE_ENV = "production";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "warn";
      process.env.JWT_SECRET = "production-secret-at-least-32-characters";

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const config = app.get(AppConfigService);

      expect(config.app.NODE_ENV).toBe(Environment.Production);
      expect(config.app.LOG_LEVEL).toBe(LogLevel.Warn);
    });

    it("should work with development environment", async () => {
      process.env.NODE_ENV = "development";
      process.env.JWT_SECRET = "dev-secret-at-least-32-characters-long";

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const config = app.get(AppConfigService);

      expect(config.app.NODE_ENV).toBe(Environment.Development);
    });
  });
});
