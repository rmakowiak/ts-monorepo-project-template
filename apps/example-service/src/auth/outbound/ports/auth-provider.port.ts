import { User } from "../../domain/user.entity";

export type TokenPayload = {
  sub: string;
  email: string;
  name: string;
  roles: string[];
};

export type AuthProvider = {
  /**
   * Validates a JWT token and returns the user
   * @param token - The JWT token to validate
   * @returns User if valid, null if invalid
   */
  validateToken(token: string): Promise<User | null>;

  /**
   * Signs a payload and returns a JWT token
   * This is optional for the port - mainly used for testing/mock auth
   * @param payload - The payload to sign
   * @returns JWT token string
   */
  signToken(payload: TokenPayload): Promise<string>;
};
