import { Injectable, Inject } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { AuthProvider } from "../outbound/ports/auth-provider.port";
import type { User } from "../domain/user.entity";

@Injectable()
export class AuthService {
  constructor(
    @Inject("AuthProvider")
    private readonly authProvider: AuthProvider,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async validateToken(token: string): Promise<User | null> {
    this.logger.debug(
      { token: token.substring(0, 20) + "..." },
      "Validating token",
    );

    const user = await this.authProvider.validateToken(token);

    if (user) {
      this.logger.info(
        { userId: user.id, email: user.email },
        "Token validated successfully",
      );
    } else {
      this.logger.warn("Token validation failed");
    }

    return user;
  }
}
