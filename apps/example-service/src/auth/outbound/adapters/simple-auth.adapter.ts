import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthProvider, TokenPayload } from "../ports/auth-provider.port";
import type { User, UserRole } from "../../domain/user.entity";

@Injectable()
export class SimpleAuthAdapter implements AuthProvider {
  constructor(private readonly jwtService: JwtService) {}

  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);

      // Validate roles are valid UserRole values
      const validRoles: UserRole[] = ["admin", "user"];
      const roles = Array.isArray(payload.roles)
        ? payload.roles.filter((role): role is UserRole =>
            validRoles.includes(role as UserRole),
          )
        : [];

      if (roles.length === 0) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        roles,
      };
    } catch (error) {
      return null;
    }
  }

  async signToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
