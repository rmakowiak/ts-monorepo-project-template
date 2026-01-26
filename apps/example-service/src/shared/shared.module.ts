import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { createPinoOtelMixin } from "@monorepo/otel";
import { loadConfig } from "./config/config.loader";
import { AppConfigService } from "./config/app-config.service";
import { SecurityModule } from "./security/security.module";
import type { ValidatedConfig } from "./config/config.loader";
import { Environment } from "./config/schemas/app.config.schema";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env.local", ".env.production", ".env"],
      load: [loadConfig],
    }),
    SecurityModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ValidatedConfig, true>) => {
        const logLevel = configService.get("app", { infer: true }).LOG_LEVEL;
        const nodeEnv = configService.get("app", { infer: true }).NODE_ENV;

        return {
          pinoHttp: {
            level: logLevel,
            mixin: createPinoOtelMixin(),
            transport:
              nodeEnv !== Environment.Production
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
        };
      },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService, LoggerModule],
})
export class SharedModule {}
