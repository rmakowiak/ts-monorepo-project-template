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
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  /**
   * Application environment
   * @default Environment.Development
   */
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  /**
   * Logging verbosity level
   * @default LogLevel.Info
   */
  @IsEnum(LogLevel)
  LOG_LEVEL!: LogLevel;
}
