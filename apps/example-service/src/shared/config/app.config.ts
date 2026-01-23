export type AppConfig = Readonly<{
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}>;

export function loadAppConfig(): AppConfig {
  const port = parseInt(process.env.PORT || "8000", 10);
  const nodeEnv = process.env.NODE_ENV || "development";
  const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  const logLevel = (process.env.LOG_LEVEL || "info") as AppConfig["logLevel"];

  // Validate required config
  if (!jwtSecret && nodeEnv === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  return {
    port,
    nodeEnv,
    jwtSecret,
    logLevel,
  };
}
