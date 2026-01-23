import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PinoLogger } from "nestjs-pino";
import { AuthService } from "../application/auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(JwtAuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      this.logger.warn(
        { url: request.url },
        "Missing or invalid authorization header",
      );
      throw new UnauthorizedException(
        "Missing or invalid authorization header",
      );
    }

    const token = authHeader.substring(7);
    const user = await this.authService.validateToken(token);

    if (!user) {
      this.logger.warn({ url: request.url }, "Invalid token");
      throw new UnauthorizedException("Invalid token");
    }

    request.user = user;
    return true;
  }
}
