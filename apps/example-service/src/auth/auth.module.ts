import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { SharedModule } from "~/shared/shared.module";
import { AuthService } from "./application/auth.service";
import { SimpleAuthAdapter } from "./outbound/adapters/simple-auth.adapter";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { AppConfigService } from "~/shared/config/app-config.service";

@Module({
  imports: [
    SharedModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.auth.JWT_SECRET,
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
