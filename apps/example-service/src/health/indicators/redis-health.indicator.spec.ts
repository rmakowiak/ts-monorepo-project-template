import { HealthCheckError } from "@nestjs/terminus";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import type { AppConfigService } from "~/shared/config/app-config.service";

// Mock ioredis
jest.mock("ioredis");

describe("RedisHealthIndicator", () => {
  let indicator: RedisHealthIndicator;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockConfig: jest.Mocked<AppConfigService>;
  let mockRedis: {
    connect: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockConfig = {
      database: {
        REDIS_URL: "redis://localhost:6379",
        DATABASE_URL: "postgresql://localhost:5432/test",
        DATABASE_LOGGING: false,
      },
    } as any;

    // Mock Redis instance
    mockRedis = {
      connect: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
    };

    // Mock Redis constructor
    const Redis = require("ioredis");
    Redis.mockImplementation(() => mockRedis);

    indicator = new RedisHealthIndicator(mockLogger, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set logger context to RedisHealthIndicator", () => {
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "RedisHealthIndicator",
      );
    });
  });

  describe("isHealthy", () => {
    it("should return healthy when Redis responds with PONG (ECP: Valid)", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      const result = await indicator.isHealthy("redis");

      // Assert
      expect(result).toEqual({
        redis: {
          status: "up",
          message: "Redis is responsive",
          latency: expect.stringMatching(/^\d+ms$/),
        },
      });
      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
      expect(mockRedis.ping).toHaveBeenCalledTimes(1);
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });

    it("should throw HealthCheckError when Redis connection fails (ECP: Invalid - Connection)", async () => {
      // Arrange
      mockRedis.connect.mockRejectedValue(new Error("ECONNREFUSED"));
      mockRedis.quit.mockResolvedValue("OK");

      // Act & Assert
      await expect(indicator.isHealthy("redis")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        "Redis health check failed",
      );
    });

    it("should throw when Redis PING returns unexpected response (ECP: Invalid - Protocol)", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("UNEXPECTED");
      mockRedis.quit.mockResolvedValue("OK");

      // Act & Assert
      try {
        await indicator.isHealthy("redis");
        fail("Should have thrown HealthCheckError");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthCheckError = error as HealthCheckError;
        expect(healthCheckError.causes).toEqual({
          redis: {
            status: "down",
            message: "Redis PING did not return PONG",
          },
        });
      }
    });

    it("should disconnect Redis even when health check fails", async () => {
      // Arrange
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      try {
        await indicator.isHealthy("redis");
      } catch {
        // Expected to fail
      }

      // Assert
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it("should handle Redis disconnect errors gracefully", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockRejectedValue(new Error("Already closed"));

      // Act - Should not throw despite quit() error
      const result = await indicator.isHealthy("redis");

      // Assert
      expect(result).toBeDefined();
      expect(result.redis.status).toBe("up");
    });

    it("should use config REDIS_URL for connection", async () => {
      // Arrange
      const Redis = require("ioredis");
      const customConfig = {
        database: {
          REDIS_URL: "redis://custom:6380",
          DATABASE_URL: "postgresql://localhost:5432/test",
          DATABASE_LOGGING: false,
        },
      } as any;
      const customIndicator = new RedisHealthIndicator(
        mockLogger,
        customConfig,
      );

      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      await customIndicator.isHealthy("redis");

      // Assert
      expect(Redis).toHaveBeenCalledWith(
        "redis://custom:6380",
        expect.objectContaining({
          maxRetriesPerRequest: 1,
          retryStrategy: expect.any(Function),
          lazyConnect: true,
        }),
      );
    });

    it("should use default Redis URL when config is undefined", async () => {
      // Arrange
      const Redis = require("ioredis");
      const undefinedConfig = {
        database: {
          REDIS_URL: undefined,
          DATABASE_URL: "postgresql://localhost:5432/test",
          DATABASE_LOGGING: false,
        },
      } as any;
      const undefinedIndicator = new RedisHealthIndicator(
        mockLogger,
        undefinedConfig,
      );

      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      await undefinedIndicator.isHealthy("redis");

      // Assert
      expect(Redis).toHaveBeenCalledWith(
        "redis://localhost:6379",
        expect.any(Object),
      );
    });

    it("should measure connection latency accurately (BVA: Latency)", async () => {
      // Arrange
      mockRedis.connect.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
      );
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      const result = await indicator.isHealthy("redis");

      // Assert
      const latency = parseInt(result.redis.latency);
      expect(latency).toBeGreaterThanOrEqual(50);
      expect(latency).toBeLessThan(150); // Allow some overhead
    });

    it("should use custom key name in result", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      const result = await indicator.isHealthy("custom-redis-key");

      // Assert
      expect(result).toHaveProperty("custom-redis-key");
      expect(result["custom-redis-key"].status).toBe("up");
    });

    it("should log debug message on success", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      await indicator.isHealthy("redis");

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          latency: expect.any(Number),
        }),
        "Redis health check passed",
      );
    });

    it("should log error message on failure", async () => {
      // Arrange
      const error = new Error("Redis connection timeout");
      mockRedis.connect.mockRejectedValue(error);
      mockRedis.quit.mockResolvedValue("OK");

      // Act
      try {
        await indicator.isHealthy("redis");
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        "Redis health check failed",
      );
    });

    it("should handle non-Error objects gracefully", async () => {
      // Arrange
      mockRedis.connect.mockRejectedValue("string error");
      mockRedis.quit.mockResolvedValue("OK");

      // Act & Assert
      try {
        await indicator.isHealthy("redis");
        fail("Should have thrown HealthCheckError");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthCheckError = error as HealthCheckError;
        expect(healthCheckError.causes).toEqual({
          redis: {
            status: "down",
            message: "Unknown error",
          },
        });
      }
    });

    it("should not throw if quit() fails after successful check", async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.quit.mockRejectedValue(new Error("Connection already closed"));

      // Act & Assert - Should complete without throwing
      await expect(indicator.isHealthy("redis")).resolves.toBeDefined();
    });
  });
});
