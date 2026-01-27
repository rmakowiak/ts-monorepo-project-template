import { HealthCheckError } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database-health.indicator";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import type { PrismaService } from "~/database/prisma.service";

describe("DatabaseHealthIndicator", () => {
  let indicator: DatabaseHealthIndicator;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockPrisma = {
      $queryRaw: jest.fn(),
    } as any;

    indicator = new DatabaseHealthIndicator(mockLogger, mockPrisma);
  });

  describe("constructor", () => {
    it("should set logger context to DatabaseHealthIndicator", () => {
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        "DatabaseHealthIndicator",
      );
    });
  });

  describe("isHealthy", () => {
    it("should return healthy status when database responds (ECP: Valid)", async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Act
      const result = await indicator.isHealthy("database");

      // Assert
      expect(result).toEqual({
        database: {
          status: "up",
          message: "PostgreSQL is responsive",
          latency: expect.stringMatching(/^\d+ms$/),
        },
      });
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ latency: expect.any(Number) }),
        "Database health check passed",
      );
    });

    it("should throw HealthCheckError when database query fails (ECP: Invalid - Connection)", async () => {
      // Arrange
      const dbError = new Error("Connection refused");
      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      // Act & Assert
      await expect(indicator.isHealthy("database")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError }),
        "Database health check failed",
      );
    });

    it("should include error message in health check error", async () => {
      // Arrange
      const errorMessage = "Connection timeout";
      mockPrisma.$queryRaw.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      try {
        await indicator.isHealthy("database");
        fail("Should have thrown HealthCheckError");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthCheckError = error as HealthCheckError;
        expect(healthCheckError.causes).toEqual({
          database: {
            status: "down",
            message: errorMessage,
          },
        });
      }
    });

    it("should handle non-Error objects gracefully", async () => {
      // Arrange
      mockPrisma.$queryRaw.mockRejectedValue("string error");

      // Act & Assert
      try {
        await indicator.isHealthy("database");
        fail("Should have thrown HealthCheckError");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthCheckError = error as HealthCheckError;
        expect(healthCheckError.causes).toEqual({
          database: {
            status: "down",
            message: "Unknown error",
          },
        });
      }
    });

    it("should measure query latency accurately (BVA: Latency)", async () => {
      // Arrange
      mockPrisma.$queryRaw.mockImplementation(
        (() =>
          new Promise((resolve) =>
            setTimeout(() => resolve([{ result: 1 }]), 50),
          )) as any,
      );

      // Act
      const result = await indicator.isHealthy("database");

      // Assert
      const latency = parseInt(result.database.latency);
      expect(latency).toBeGreaterThanOrEqual(50);
      expect(latency).toBeLessThan(150); // Allow some overhead
    });

    it("should use custom key name in result", async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Act
      const result = await indicator.isHealthy("custom-db-key");

      // Assert
      expect(result).toHaveProperty("custom-db-key");
      expect(result["custom-db-key"].status).toBe("up");
    });

    it("should log debug message on success", async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Act
      await indicator.isHealthy("database");

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          latency: expect.any(Number),
        }),
        "Database health check passed",
      );
    });

    it("should log error message on failure", async () => {
      // Arrange
      const error = new Error("Database connection failed");
      mockPrisma.$queryRaw.mockRejectedValue(error);

      // Act
      try {
        await indicator.isHealthy("database");
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        "Database health check failed",
      );
    });
  });
});
