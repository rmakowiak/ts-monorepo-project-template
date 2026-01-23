import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthService } from "../application/auth.service";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import type { User } from "../domain/user.entity";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockReflector: jest.Mocked<Reflector>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockAuthService = {
      validateToken: jest.fn(),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockLogger = createMockLogger();

    guard = new JwtAuthGuard(mockAuthService, mockReflector, mockLogger);

    // Create mock ExecutionContext
    const mockRequest = {
      headers: {},
      url: "/test-endpoint",
      user: undefined,
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  describe("Public route bypass (ECP: Public routes)", () => {
    it("should allow access to public routes without token", async () => {
      // Arrange - Route marked as @Public()
      mockReflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });

    it("should check both handler and class level for @Public() decorator", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(true);

      // Act
      await guard.canActivate(mockContext);

      // Assert - Reflector should check both handler and class
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith("isPublic", [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });
  });

  describe("Authentication with valid token (ECP: Valid)", () => {
    it("should allow access with valid Bearer token", async () => {
      // Arrange
      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      };

      mockReflector.getAllAndOverride.mockReturnValue(false); // Not public
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer valid-token-string";

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(
        "valid-token-string",
      );
      expect(request.user).toEqual(mockUser);
    });

    it("should extract token correctly from Authorization header", async () => {
      // Arrange
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.validateToken.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        name: "Test",
        roles: ["user"],
      });

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = `Bearer ${token}`;

      // Act
      await guard.canActivate(mockContext);

      // Assert - Should extract token after "Bearer " prefix
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(token);
    });
  });

  describe("Missing Authorization header (ECP: Invalid - Missing auth)", () => {
    it("should throw UnauthorizedException when Authorization header is missing", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);
      // No authorization header set

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "Missing or invalid authorization header",
      );
    });

    it("should log warning when header is missing", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);

      // Act
      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { url: "/test-endpoint" },
        "Missing or invalid authorization header",
      );
    });
  });

  describe("Malformed Authorization header (BVA: Invalid format)", () => {
    it("should throw UnauthorizedException when header does not start with Bearer", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Basic dXNlcjpwYXNz"; // Wrong auth scheme

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for empty Authorization header", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = ""; // Empty string

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when header is just "Bearer"', async () => {
      // Arrange (BVA: Boundary case)
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer"; // No token after Bearer

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("Invalid token (ECP: Invalid - Bad token)", () => {
    it("should throw UnauthorizedException when token validation fails", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.validateToken.mockResolvedValue(null); // Token invalid

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer invalid-token";

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "Invalid token",
      );
    });

    it("should log warning when token is invalid", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.validateToken.mockResolvedValue(null);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer invalid-token";

      // Act
      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { url: "/test-endpoint" },
        "Invalid token",
      );
    });

    it("should not attach user to request when token is invalid", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.validateToken.mockResolvedValue(null);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer invalid-token";

      // Act
      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw
      }

      // Assert - User should not be set
      expect(request.user).toBeUndefined();
    });
  });

  describe("Request user attachment", () => {
    it("should attach user object to request on successful validation", async () => {
      // Arrange
      const mockUser: User = {
        id: "user-456",
        email: "admin@example.com",
        name: "Admin User",
        roles: ["admin", "user"],
      };

      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      const request = mockContext.switchToHttp().getRequest();
      request.headers.authorization = "Bearer valid-admin-token";

      // Act
      await guard.canActivate(mockContext);

      // Assert - User should be attached with all properties
      expect(request.user).toEqual(mockUser);
      expect(request.user.id).toBe("user-456");
      expect(request.user.roles).toEqual(["admin", "user"]);
    });
  });
});
