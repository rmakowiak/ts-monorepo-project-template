import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { createMockLogger } from "../../../test/helpers/mock-logger.factory";
import type { User, UserRole } from "../domain/user.entity";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockLogger = createMockLogger();

    guard = new RolesGuard(mockReflector, mockLogger);

    // Create mock ExecutionContext with request
    const mockRequest = {
      user: undefined as User | undefined,
      url: "/test-endpoint",
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  describe("No roles required (ECP: No restrictions)", () => {
    it("should allow access when no roles are required", () => {
      // Arrange - No @Roles() decorator on endpoint
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should allow access when roles array is empty", () => {
      // Arrange - Empty roles array
      mockReflector.getAllAndOverride.mockReturnValue([]);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should check both handler and class level for @Roles() decorator", () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      guard.canActivate(mockContext);

      // Assert
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith("roles", [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });
  });

  describe("Valid role authorization (ECP: Valid)", () => {
    it("should allow access when user has required role", () => {
      // Arrange
      const mockUser: User = {
        id: "user-123",
        email: "admin@example.com",
        name: "Admin User",
        roles: ["admin"],
      };

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should allow access when user has one of multiple required roles", () => {
      // Arrange - User only needs ONE of the required roles
      const mockUser: User = {
        id: "user-123",
        email: "user@example.com",
        name: "Regular User",
        roles: ["user"],
      };

      mockReflector.getAllAndOverride.mockReturnValue([
        "admin",
        "user",
      ] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should allow access when user has multiple roles including required one", () => {
      // Arrange
      const mockUser: User = {
        id: "user-456",
        email: "superadmin@example.com",
        name: "Super Admin",
        roles: ["admin", "user"], // Has both roles
      };

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("Missing required role (ECP: Invalid)", () => {
    it("should throw ForbiddenException when user lacks required role", () => {
      // Arrange
      const mockUser: User = {
        id: "user-789",
        email: "user@example.com",
        name: "Regular User",
        roles: ["user"], // Only has 'user' role
      };

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]); // Requires 'admin'

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        "Insufficient permissions",
      );
    });

    it("should log warning when user lacks required role", () => {
      // Arrange
      const mockUser: User = {
        id: "user-999",
        email: "user@example.com",
        name: "Test User",
        roles: ["user"],
      };

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act
      try {
        guard.canActivate(mockContext);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          userId: "user-999",
          userRoles: ["user"],
          requiredRoles: ["admin"],
        },
        "User does not have required roles",
      );
    });

    it("should throw ForbiddenException when user has empty roles array", () => {
      // Arrange - User exists but has no roles
      const mockUser: User = {
        id: "user-empty",
        email: "empty@example.com",
        name: "Empty Roles User",
        roles: [], // No roles assigned
      };

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe("Missing user in request (ECP: Invalid)", () => {
    it("should throw ForbiddenException when user is not in request", () => {
      // Arrange - No user attached (JwtAuthGuard didn't run or failed)
      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = undefined; // No user

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        "User not authenticated",
      );
    });

    it("should log warning when user is missing from request", () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      // User not set (undefined)

      // Act
      try {
        guard.canActivate(mockContext);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { url: "/test-endpoint" },
        "No user found in request",
      );
    });
  });

  describe("Multiple required roles (ECP: OR logic)", () => {
    it("should allow access if user has ANY of the required roles", () => {
      // Arrange - User needs admin OR moderator
      const mockUser: User = {
        id: "mod-123",
        email: "mod@example.com",
        name: "Moderator",
        roles: ["user"], // Has 'user' which is in required roles
      };

      mockReflector.getAllAndOverride.mockReturnValue([
        "admin",
        "moderator",
        "user",
      ] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it("should deny access if user has NONE of the required roles", () => {
      // Arrange
      const mockUser: User = {
        id: "user-no-match",
        email: "nomatch@example.com",
        name: "No Match User",
        roles: ["user"], // Only has 'user'
      };

      // Requires either 'admin' or 'moderator' (but not 'user')
      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe("Edge cases", () => {
    it("should handle user with undefined roles property", () => {
      // Arrange - Malformed user object (shouldn't happen in practice)
      const mockUser = {
        id: "user-malformed",
        email: "malformed@example.com",
        name: "Malformed User",
        roles: undefined, // Roles is undefined
      } as any;

      mockReflector.getAllAndOverride.mockReturnValue(["admin"] as UserRole[]);

      const request = mockContext.switchToHttp().getRequest();
      request.user = mockUser;

      // Act & Assert - Will throw TypeError (not ForbiddenException)
      // This is acceptable - malformed user objects indicate a bug in auth
      expect(() => guard.canActivate(mockContext)).toThrow();
    });
  });
});
