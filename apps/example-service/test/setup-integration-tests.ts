/**
 * Setup file for integration tests
 * Runs before each test suite
 */

// Silence logs during tests
process.env.LOG_LEVEL = "fatal";

// Set test environment
process.env.NODE_ENV = "test";

// Disable database logging
process.env.DATABASE_LOGGING = "false";
