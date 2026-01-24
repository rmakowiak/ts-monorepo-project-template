import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { AppConfigService } from "./app-config.service";
import { Environment, LogLevel } from "./schemas/app.config.schema";
import type { ValidatedConfig } from "./config.loader";
import type { AppConfigSchema } from "./schemas/app.config.schema";
import type { AuthConfigSchema } from "./schemas/auth.config.schema";

describe("AppConfigService", () => {
  let service: AppConfigService;
  let mockConfigService: jest.Mocked<ConfigService<ValidatedConfig, true>>;

  const mockAppConfig: AppConfigSchema = {
    PORT: 8000,
    NODE_ENV: Environment.Development,
    LOG_LEVEL: LogLevel.Info,
  };

  const mockAuthConfig: AuthConfigSchema = {
    JWT_SECRET: "test-secret-at-least-32-characters-long",
  };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    service = new AppConfigService(mockConfigService);
  });

  describe("namespace access", () => {
    it("should return app config from app namespace", () => {
      mockConfigService.get.mockReturnValue(mockAppConfig);

      const result = service.app;

      expect(mockConfigService.get).toHaveBeenCalledWith("app", {
        infer: true,
      });
      expect(result).toEqual(mockAppConfig);
      expect(result.PORT).toBe(8000);
      expect(result.NODE_ENV).toBe(Environment.Development);
      expect(result.LOG_LEVEL).toBe(LogLevel.Info);
    });

    it("should return auth config from auth namespace", () => {
      mockConfigService.get.mockReturnValue(mockAuthConfig);

      const result = service.auth;

      expect(mockConfigService.get).toHaveBeenCalledWith("auth", {
        infer: true,
      });
      expect(result.JWT_SECRET).toBe("test-secret-at-least-32-characters-long");
    });

    it("should return all config namespaces", () => {
      mockConfigService.get
        .mockReturnValueOnce(mockAppConfig)
        .mockReturnValueOnce(mockAuthConfig);

      const result = service.all;

      expect(result.app).toEqual(mockAppConfig);
      expect(result.auth).toEqual(mockAuthConfig);
    });
  });

  describe("type safety", () => {
    it("should provide strongly typed app config", () => {
      mockConfigService.get.mockReturnValue(mockAppConfig);

      const app = service.app;

      // TypeScript should infer these types correctly
      const port: number = app.PORT;
      const env: Environment = app.NODE_ENV;
      const logLevel: LogLevel = app.LOG_LEVEL;

      expect(typeof port).toBe("number");
      expect(env).toBe(Environment.Development);
      expect(logLevel).toBe(LogLevel.Info);
    });

    it("should provide strongly typed auth config", () => {
      mockConfigService.get.mockReturnValue(mockAuthConfig);

      const auth = service.auth;

      // TypeScript should infer string type
      const secret: string = auth.JWT_SECRET;

      expect(typeof secret).toBe("string");
    });
  });

  describe("all getter", () => {
    it("should call config service for each namespace", () => {
      mockConfigService.get
        .mockReturnValueOnce(mockAppConfig)
        .mockReturnValueOnce(mockAuthConfig);

      service.all;

      expect(mockConfigService.get).toHaveBeenCalledTimes(2);
      expect(mockConfigService.get).toHaveBeenCalledWith("app", {
        infer: true,
      });
      expect(mockConfigService.get).toHaveBeenCalledWith("auth", {
        infer: true,
      });
    });

    it("should return complete config structure", () => {
      mockConfigService.get
        .mockReturnValueOnce(mockAppConfig)
        .mockReturnValueOnce(mockAuthConfig);

      const all = service.all;

      expect(all).toEqual({
        app: mockAppConfig,
        auth: mockAuthConfig,
      });
    });
  });

  describe("multiple access calls", () => {
    it("should call ConfigService each time app is accessed", () => {
      mockConfigService.get.mockReturnValue(mockAppConfig);

      service.app;
      service.app;
      service.app;

      expect(mockConfigService.get).toHaveBeenCalledTimes(3);
    });

    it("should call ConfigService each time auth is accessed", () => {
      mockConfigService.get.mockReturnValue(mockAuthConfig);

      service.auth;
      service.auth;

      expect(mockConfigService.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("enum value access", () => {
    it("should return correct enum values from app config", () => {
      const productionConfig: AppConfigSchema = {
        PORT: 3000,
        NODE_ENV: Environment.Production,
        LOG_LEVEL: LogLevel.Warn,
      };

      mockConfigService.get.mockReturnValue(productionConfig);

      const app = service.app;

      expect(app.NODE_ENV).toBe(Environment.Production);
      expect(app.NODE_ENV).toBe("production");
      expect(app.LOG_LEVEL).toBe(LogLevel.Warn);
      expect(app.LOG_LEVEL).toBe("warn");
    });

    it("should handle all Environment enum values", () => {
      const testCases = [
        Environment.Development,
        Environment.Production,
        Environment.Test,
      ];

      testCases.forEach((env) => {
        const config: AppConfigSchema = {
          PORT: 8000,
          NODE_ENV: env,
          LOG_LEVEL: LogLevel.Info,
        };

        mockConfigService.get.mockReturnValue(config);

        expect(service.app.NODE_ENV).toBe(env);
      });
    });

    it("should handle all LogLevel enum values", () => {
      const testCases = [
        LogLevel.Fatal,
        LogLevel.Error,
        LogLevel.Warn,
        LogLevel.Info,
        LogLevel.Debug,
        LogLevel.Trace,
      ];

      testCases.forEach((level) => {
        const config: AppConfigSchema = {
          PORT: 8000,
          NODE_ENV: Environment.Development,
          LOG_LEVEL: level,
        };

        mockConfigService.get.mockReturnValue(config);

        expect(service.app.LOG_LEVEL).toBe(level);
      });
    });
  });
});
