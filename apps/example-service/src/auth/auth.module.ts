import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { SharedModule } from "~/shared/shared.module";
import { AuthService } from "./application/auth.service";
import { SimpleAuthAdapter } from "./outbound/adapters/simple-auth.adapter";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import type { AppConfig } from "~/shared/config/app.config";

@Module({
  imports: [
    SharedModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: ["AppConfig"],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: "24h" },
      }),
    }),
  ],
  providers: [
    AuthService,
    {
      provide: "AuthProvider",
      useClass: SimpleAuthAdapter,
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, "AuthProvider"],
})
export class AuthModule {}
