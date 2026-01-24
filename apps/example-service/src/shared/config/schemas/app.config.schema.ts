import { IsEnum, IsInt, Max, Min } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Application environment types
 */
export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

/**
 * Pino logging levels
 */
export enum LogLevel {
  Fatal = "fatal",
  Error = "error",
  Warn = "warn",
  Info = "info",
  Debug = "debug",
  Trace = "trace",
}

/**
 * Application-level configuration schema
 * Validates core application settings
 */
export class AppConfigSchema {
  /**
   * HTTP server port
   * @default 8000
   */
  @Transform(({ value }) => {
    const originalValue = value;

    if (value === undefined || value === null) {
      throw new Error(
        "PORT is required. Set PORT environment variable (e.g., PORT=8000)",
      );
    }

    const valueStr = String(value).trim();
    if (valueStr === "") {
      throw new Error(
        "PORT cannot be empty. Provide a valid port number (e.g., PORT=8000)",
      );
    }

    // Check for decimal points (integers shouldn't have decimals)
    if (valueStr.includes(".")) {
      throw new Error(
        `PORT must be an integer (no decimals). Got: "${valueStr}". Example: PORT=8000`,
      );
    }

    const parsed = parseInt(valueStr, 10);
    if (isNaN(parsed)) {
      throw new Error(
        `PORT must be a valid number. Got: "${originalValue}". Example: PORT=8000`,
      );
    }

    return parsed;
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  readonly PORT!: number;

  /**
   * Application environment
   * @default Environment.Development
   */
  @IsEnum(Environment)
  readonly NODE_ENV!: Environment;

  /**
   * Logging verbosity level
   * @default LogLevel.Info
   */
  @IsEnum(LogLevel)
  readonly LOG_LEVEL!: LogLevel;
}
