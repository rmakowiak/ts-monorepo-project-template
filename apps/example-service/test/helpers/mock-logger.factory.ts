import type { PinoLogger } from 'nestjs-pino'

/**
 * Creates a mock PinoLogger for testing purposes
 * All methods are jest.fn() that do nothing, allowing you to verify calls
 */
export function createMockLogger(): jest.Mocked<PinoLogger> {
  return {
    setContext: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    log: jest.fn(),
    assign: jest.fn(),
  } as unknown as jest.Mocked<PinoLogger>
}
