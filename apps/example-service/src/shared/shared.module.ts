import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { loadAppConfig, type AppConfig } from "./config/app.config";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "HH:MM:ss",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        customProps: () => ({
          context: "HTTP",
        }),
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            params: req.params,
            query: req.query,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  providers: [
    {
      provide: "AppConfig",
      useFactory: (): AppConfig => loadAppConfig(),
    },
  ],
  exports: ["AppConfig", LoggerModule],
})
export class SharedModule {}
