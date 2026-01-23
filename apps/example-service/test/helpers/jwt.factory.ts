import * as jwt from 'jsonwebtoken'
import type { UserRole } from '~/auth/domain/user.entity'

/**
 * JWT payload structure for test tokens
 */
export interface TestTokenPayload {
  sub: string
  email: string
  name: string
  roles: UserRole[]
}

/**
 * Default JWT secret used in development/testing
 */
const DEFAULT_JWT_SECRET = 'dev-secret-change-in-production'

/**
 * Generate a valid JWT token for testing
 * @param payload - Partial token payload (missing fields will use defaults)
 * @param secret - JWT secret (defaults to dev secret)
 * @returns Signed JWT token string
 */
export function createTestToken(
  payload?: Partial<TestTokenPayload>,
  secret: string = DEFAULT_JWT_SECRET,
): string {
  const fullPayload: TestTokenPayload = {
    sub: payload?.sub || 'test-user-id',
    email: payload?.email || 'test@example.com',
    name: payload?.name || 'Test User',
    roles: payload?.roles || ['user'],
  }

  return jwt.sign(fullPayload, secret, { expiresIn: '1h' })
}

/**
 * Generate a token for an admin user
 */
export function createAdminToken(): string {
  return createTestToken({
    sub: 'admin-user-id',
    email: 'admin@example.com',
    name: 'Admin User',
    roles: ['admin', 'user'],
  })
}

/**
 * Generate a token for a regular user (no admin role)
 */
export function createUserToken(): string {
  return createTestToken({
    sub: 'regular-user-id',
    email: 'user@example.com',
    name: 'Regular User',
    roles: ['user'],
  })
}

/**
 * Generate an expired token for testing token expiration
 */
export function createExpiredToken(): string {
  const payload: TestTokenPayload = {
    sub: 'expired-user-id',
    email: 'expired@example.com',
    name: 'Expired User',
    roles: ['user'],
  }

  return jwt.sign(payload, DEFAULT_JWT_SECRET, { expiresIn: '-1h' })
}

/**
 * Generate an invalid token (wrong signature)
 */
export function createInvalidToken(): string {
  return createTestToken(undefined, 'wrong-secret')
}
