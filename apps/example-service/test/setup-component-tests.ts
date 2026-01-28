/**
 * Setup file for component tests
 * This runs before each test suite
 */

// Silence Pino logs during component tests for cleaner output
// Only fatal errors will be logged
process.env.LOG_LEVEL = "fatal";
