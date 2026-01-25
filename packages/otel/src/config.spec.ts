import "reflect-metadata";
import { initializeOtel } from "./config";
import { validateOtelConfig } from "./validate-config";
import { TraceExporterType } from "./config-schema";

// Mock dependencies
jest.mock("./validate-config");
jest.mock("@opentelemetry/sdk-node");
jest.mock("@opentelemetry/auto-instrumentations-node");

const mockValidateOtelConfig = validateOtelConfig as jest.MockedFunction<
  typeof validateOtelConfig
>;

describe("initializeOtel", () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Default mock: return valid config
    mockValidateOtelConfig.mockReturnValue({
      OTEL_SERVICE_NAME: "test-service",
      OTEL_SERVICE_VERSION: "1.0.0",
      OTEL_ENABLED: true,
      OTEL_TRACING_ENABLED: true,
      OTEL_TRACE_EXPORTER: TraceExporterType.OtlpHttp,
      OTEL_TRACE_SAMPLE_RATE: 1.0,
      OTEL_METRICS_ENABLED: true,
      OTEL_METRICS_PORT: 9464,
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("Configuration validation", () => {
    it("should read environment variables and pass to validateOtelConfig", () => {
      // Arrange
      process.env.OTEL_SERVICE_NAME = "my-service";
      process.env.OTEL_SERVICE_VERSION = "2.0.0";
      process.env.OTEL_ENABLED = "true";
      process.env.OTEL_TRACING_ENABLED = "false";
      process.env.OTEL_TRACE_EXPORTER = "console";
      process.env.OTEL_TRACE_SAMPLE_RATE = "0.5";
      process.env.OTEL_METRICS_ENABLED = "false";
      process.env.OTEL_METRICS_PORT = "8080";
      process.env.OTEL_RESOURCE_ATTRIBUTES = "team=platform";

      // Act
      initializeOtel();

      // Assert
      expect(mockValidateOtelConfig).toHaveBeenCalledWith({
        OTEL_SERVICE_NAME: "my-service",
        OTEL_SERVICE_VERSION: "2.0.0",
        OTEL_ENABLED: "true",
        OTEL_TRACING_ENABLED: "false",
        OTEL_TRACE_EXPORTER: "console",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: undefined,
        OTEL_TRACE_SAMPLE_RATE: "0.5",
        OTEL_METRICS_ENABLED: "false",
        OTEL_METRICS_PORT: "8080",
        OTEL_RESOURCE_ATTRIBUTES: "team=platform",
      });
    });

    it("should throw when validation fails (Fail Fast)", () => {
      // Arrange
      mockValidateOtelConfig.mockImplementation(() => {
        throw new Error("Validation failed: OTEL_SERVICE_NAME is required");
      });

      // Act & Assert
      expect(() => initializeOtel()).toThrow(
        "Validation failed: OTEL_SERVICE_NAME is required",
      );
    });

    it("should pass undefined values for unset environment variables", () => {
      // Arrange - minimal env
      process.env.OTEL_SERVICE_NAME = "test-service";
      delete process.env.OTEL_SERVICE_VERSION;
      delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
      delete process.env.OTEL_RESOURCE_ATTRIBUTES;

      // Act
      initializeOtel();

      // Assert
      expect(mockValidateOtelConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          OTEL_SERVICE_NAME: "test-service",
          OTEL_SERVICE_VERSION: undefined,
          OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: undefined,
          OTEL_RESOURCE_ATTRIBUTES: undefined,
        }),
      );
    });
  });

  describe("Disabled telemetry (OTEL_ENABLED=false)", () => {
    it("should skip SDK initialization when OTEL_ENABLED is false", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_SERVICE_NAME: "test-service",
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_ENABLED: false,
        OTEL_TRACING_ENABLED: true,
        OTEL_TRACE_EXPORTER: TraceExporterType.OtlpHttp,
        OTEL_TRACE_SAMPLE_RATE: 1.0,
        OTEL_METRICS_ENABLED: true,
        OTEL_METRICS_PORT: 9464,
      } as any);

      // Act
      initializeOtel();

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "[OTel] OpenTelemetry is disabled",
      );
    });

    it("should not throw error when OTEL_ENABLED is false", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_ENABLED: false,
      } as any);

      // Act & Assert
      expect(() => initializeOtel()).not.toThrow();
    });
  });

  describe("SDK initialization logging", () => {
    it("should log success message with configuration details", () => {
      // Arrange
      process.env.NODE_ENV = "production";

      // Act
      initializeOtel();

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "[OTel] OpenTelemetry SDK initialized successfully",
      );
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Service: test-service",
      );
      expect(console.log).toHaveBeenCalledWith("[OTel]   Version: 1.0.0");
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Environment: production",
      );
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Tracing: enabled (otlp-http)",
      );
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Metrics: enabled (port 9464)",
      );
    });

    it("should show disabled status for tracing when OTEL_TRACING_ENABLED is false", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_SERVICE_NAME: "test-service",
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_ENABLED: true,
        OTEL_TRACING_ENABLED: false,
        OTEL_TRACE_EXPORTER: TraceExporterType.Console,
        OTEL_TRACE_SAMPLE_RATE: 1.0,
        OTEL_METRICS_ENABLED: true,
        OTEL_METRICS_PORT: 9464,
      } as any);

      // Act
      initializeOtel();

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Tracing: disabled (console)",
      );
    });

    it("should show disabled status for metrics when OTEL_METRICS_ENABLED is false", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_SERVICE_NAME: "test-service",
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_ENABLED: true,
        OTEL_TRACING_ENABLED: true,
        OTEL_TRACE_EXPORTER: TraceExporterType.OtlpHttp,
        OTEL_TRACE_SAMPLE_RATE: 1.0,
        OTEL_METRICS_ENABLED: false,
        OTEL_METRICS_PORT: 9464,
      } as any);

      // Act
      initializeOtel();

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Metrics: disabled (port 9464)",
      );
    });

    it('should default to "development" environment when NODE_ENV is not set', () => {
      // Arrange
      delete process.env.NODE_ENV;

      // Act
      initializeOtel();

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Environment: development",
      );
    });
  });

  describe("Exporter configuration", () => {
    it("should handle console exporter type", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_SERVICE_NAME: "test-service",
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_ENABLED: true,
        OTEL_TRACING_ENABLED: true,
        OTEL_TRACE_EXPORTER: TraceExporterType.Console,
        OTEL_TRACE_SAMPLE_RATE: 1.0,
        OTEL_METRICS_ENABLED: true,
        OTEL_METRICS_PORT: 9464,
      } as any);

      // Act & Assert
      expect(() => initializeOtel()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Tracing: enabled (console)",
      );
    });

    it("should handle otlp-http exporter type", () => {
      // Arrange
      mockValidateOtelConfig.mockReturnValue({
        OTEL_SERVICE_NAME: "test-service",
        OTEL_SERVICE_VERSION: "1.0.0",
        OTEL_ENABLED: true,
        OTEL_TRACING_ENABLED: true,
        OTEL_TRACE_EXPORTER: TraceExporterType.OtlpHttp,
        OTEL_TRACE_SAMPLE_RATE: 1.0,
        OTEL_METRICS_ENABLED: true,
        OTEL_METRICS_PORT: 9464,
      } as any);

      // Act & Assert
      expect(() => initializeOtel()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        "[OTel]   Tracing: enabled (otlp-http)",
      );
    });
  });

  describe("Error handling (Fail Fast)", () => {
    it("should throw and crash app when SDK initialization fails", () => {
      // Arrange - Force NodeSDK to throw during construction/start
      const NodeSDK = require("@opentelemetry/sdk-node").NodeSDK;
      NodeSDK.mockImplementation(() => {
        return {
          start: jest.fn(() => {
            throw new Error("Failed to bind to metrics port");
          }),
        };
      });

      // Act & Assert
      expect(() => initializeOtel()).toThrow("Failed to bind to metrics port");
    });

    it("should not catch SDK initialization errors", () => {
      // Arrange
      const NodeSDK = require("@opentelemetry/sdk-node").NodeSDK;
      NodeSDK.mockImplementation(() => {
        throw new Error("SDK construction failed");
      });

      // Act & Assert
      expect(() => initializeOtel()).toThrow("SDK construction failed");
    });
  });
});
