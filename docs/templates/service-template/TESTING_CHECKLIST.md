# Testing Checklist for New Services

This checklist helps ensure comprehensive test coverage when adding new features or services to the monorepo.

## Three-Tier Testing Approach

```
┌─────────────────────────────────────┐
│       Integration Tests              │  ← HTTP → Service → Real DB
├─────────────────────────────────────┤
│       Component Tests                │  ← HTTP → Service → Mocked DB
├─────────────────────────────────────┤
│          Unit Tests                  │  ← Individual functions/classes
└─────────────────────────────────────┘
```

## Setup Checklist

### Test Infrastructure

- [ ] Create `test/` directory in service root
- [ ] Create `test/fixtures/` for test data
- [ ] Create `test/helpers/` for test utilities
- [ ] Create `test/component/` for component tests
- [ ] Create `test/integration/` for integration tests (if needed)
- [ ] Configure Jest for unit tests (co-located `*.spec.ts`)
- [ ] Configure Jest for component tests (`jest-component.json`)
- [ ] Configure Jest for integration tests (`jest-integration.json`, if needed)

### Test Helpers

- [ ] Create mock logger factory (`mock-logger.factory.ts`)
- [ ] Create JWT token factory (`jwt.factory.ts`)
- [ ] Create test app factory with mocked dependencies (`test-app.factory.ts`)
- [ ] Create integration test app factory with real database (`integration-test-app.factory.ts`, if needed)
- [ ] Create database factory for testcontainers (`test-db.factory.ts`, if needed)

### Test Fixtures

- [ ] Create entity fixtures with factory functions
- [ ] Define boundary values for validation testing
- [ ] Create DTO fixtures for API testing

## Unit Tests Checklist

### Service Tests (Target: 100% Coverage)

- [ ] **Happy path tests**
  - [ ] Create operations with valid data
  - [ ] Read operations returning data
  - [ ] Update operations with valid changes
  - [ ] Delete operations

- [ ] **Business logic tests (ECP - Equivalence Class Partitioning)**
  - [ ] Valid input classes
  - [ ] Invalid input classes (duplicates, conflicts)
  - [ ] Edge cases and special scenarios

- [ ] **Boundary value tests (BVA)**
  - [ ] Minimum valid values
  - [ ] Maximum valid values
  - [ ] Values just below/above boundaries
  - [ ] Zero and negative values (where applicable)

- [ ] **Error handling tests**
  - [ ] Not found scenarios
  - [ ] Duplicate/conflict scenarios
  - [ ] Validation failures
  - [ ] Domain rule violations

### Repository Tests

- [ ] **CRUD operations**
  - [ ] Save and retrieve entities
  - [ ] Update existing entities
  - [ ] Delete entities
  - [ ] Find by various criteria

- [ ] **Query operations**
  - [ ] Pagination (limit, offset)
  - [ ] Filtering
  - [ ] Sorting
  - [ ] Empty result sets

- [ ] **Boundary conditions**
  - [ ] Empty repository
  - [ ] Single item
  - [ ] Pagination at boundaries

### Guard Tests

- [ ] **Authentication**
  - [ ] Valid Bearer token
  - [ ] Missing Authorization header
  - [ ] Invalid token format
  - [ ] Malformed token
  - [ ] Expired token

- [ ] **Authorization**
  - [ ] User with correct role
  - [ ] User with wrong role
  - [ ] Public routes (bypass auth)

## Component Tests Checklist

### API Endpoint Tests (Target: 90%+ Coverage)

- [ ] **CREATE endpoints (POST)**
  - [ ] Create with valid data (admin role)
  - [ ] Create with valid data (user role, if applicable)
  - [ ] 401 when no auth token
  - [ ] 403 when wrong role
  - [ ] 400 for validation failures (ECP)
  - [ ] 400 for boundary violations (BVA)
  - [ ] 409 for conflicts/duplicates
  - [ ] Minimum valid values (BVA)
  - [ ] Maximum valid values (BVA)

- [ ] **READ endpoints (GET)**
  - [ ] Get all (empty list)
  - [ ] Get all (with data)
  - [ ] Get all with pagination
  - [ ] Get by ID (found)
  - [ ] Get by ID (not found → 404)
  - [ ] 401 when no auth token (if protected)

- [ ] **UPDATE endpoints (PUT/PATCH)**
  - [ ] Update with valid data (admin role)
  - [ ] 401 when no auth token
  - [ ] 403 when wrong role
  - [ ] 404 when entity not found
  - [ ] 400 for validation failures
  - [ ] 409 for conflicts (e.g., name already exists)

- [ ] **DELETE endpoints (DELETE)**
  - [ ] Delete existing entity (admin role)
  - [ ] 401 when no auth token
  - [ ] 403 when wrong role
  - [ ] 404 when entity not found
  - [ ] Verify entity is deleted (GET returns 404)

### Boundary Value Analysis (BVA) Tests

For each validated field, test:

- [ ] **String fields**
  - [ ] Empty string (if invalid)
  - [ ] Minimum length (if applicable)
  - [ ] Maximum length - 1
  - [ ] Maximum length (valid)
  - [ ] Maximum length + 1 (invalid)

- [ ] **Numeric fields**
  - [ ] Negative values (if invalid)
  - [ ] Zero (valid or invalid?)
  - [ ] Minimum valid value
  - [ ] Maximum valid value
  - [ ] Values with decimal precision

- [ ] **Array/List fields**
  - [ ] Empty array (valid or invalid?)
  - [ ] Single item
  - [ ] Maximum items (if limited)

### Exception Filter Tests

- [ ] **Domain error mappings**
  - [ ] NotFoundError → 404
  - [ ] AlreadyExistsError → 409
  - [ ] ValidationError → 400
  - [ ] Custom domain errors → appropriate status

## Integration Tests Checklist

**Note**: Only add integration tests when you need to verify integration with real external systems (database, message queues, etc.). Use decision table methodology to keep these tests minimal.

### Decision Table Methodology

Before writing an integration test, create a decision table to justify it:

**Template**:

| Scenario        | Validates                  | Why Integration Test Needed?         | Alternative?                 |
| --------------- | -------------------------- | ------------------------------------ | ---------------------------- |
| [Scenario name] | [What behavior/constraint] | [Why unit/component test won't work] | [Could we test differently?] |

**Example**:

| Scenario                | Validates                               | Why Integration Test Needed?                  | Alternative?                   |
| ----------------------- | --------------------------------------- | --------------------------------------------- | ------------------------------ |
| Duplicate SKU           | PostgreSQL UNIQUE constraint            | In-memory mock doesn't enforce DB constraints | No - need real database        |
| Race condition on stock | Database transaction isolation          | Need real DB locking behavior                 | No - need real database        |
| Decimal rounding        | ORM type conversion (Decimal ↔ number) | Need real Prisma + PostgreSQL stack           | No - need real stack           |
| Soft delete filtering   | DB indexes + WHERE clause performance   | Need to verify query plan works correctly     | Maybe - could use in-memory DB |

**Decision Criteria**:

- ✅ Need integration test: Database constraints, transactions, ORM behavior, type conversions
- ⚠️ Maybe need it: Query performance, complex joins (could use lightweight DB)
- ❌ Don't need it: Validation, business logic, API responses (use unit/component tests)

### When to Add Integration Tests

- [ ] Testing database constraints (unique, foreign keys)
- [ ] Testing complex queries with real data
- [ ] Testing concurrency and race conditions
- [ ] Testing soft delete behavior
- [ ] Testing decimal precision with real database
- [ ] Testing pagination performance with real data

### Setup Requirements

- [ ] Docker installed and running
- [ ] Testcontainers configured
- [ ] Database migrations runnable
- [ ] Cleanup strategy between tests

### Integration Test Scenarios

- [ ] **Database constraints**
  - [ ] Unique constraints enforced
  - [ ] Foreign key constraints enforced
  - [ ] Check constraints enforced

- [ ] **Concurrency**
  - [ ] Race conditions handled
  - [ ] Transactions work correctly
  - [ ] Locks prevent conflicts

- [ ] **Data integrity**
  - [ ] Soft deletes exclude from queries
  - [ ] Decimal precision preserved
  - [ ] Timestamps set correctly
  - [ ] Default values applied

## Test Quality Checklist

### Test Structure

- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Test names are descriptive: `should [action] when [condition] (ECP/BVA: [category])`
- [ ] Each test has a single clear purpose
- [ ] Tests are independent (no shared state)
- [ ] Tests clean up after themselves

### Coverage Quality

- [ ] Coverage reports generated and reviewed
- [ ] Critical paths have 100% coverage
- [ ] Edge cases are tested
- [ ] Error paths are tested
- [ ] Not just chasing coverage numbers (meaningful tests)

### Test Data

- [ ] Use fixtures for reusable test data
- [ ] Boundary values defined in fixtures
- [ ] Factory functions for creating test entities
- [ ] Test data is realistic and representative

### Maintainability

- [ ] Helper functions for common test setup
- [ ] Mocks are reusable via factories
- [ ] Test utilities are well-documented
- [ ] Tests are easy to understand and modify

## Package.json Scripts

Add these scripts to your service's `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:unit": "jest --config jest.config.json",
    "test:cov:unit": "jest --config jest.config.json --coverage",
    "test:component": "jest --config test/jest-component.json",
    "test:component:cov": "jest --config test/jest-component.json --coverage",
    "test:integration": "jest --config test/jest-integration.json --runInBand --detectOpenHandles",
    "test:integration:cov": "jest --config test/jest-integration.json --runInBand --coverage --detectOpenHandles",
    "test:all": "pnpm test:unit && pnpm test:component",
    "test:ci": "pnpm test:unit && pnpm test:component && pnpm test:integration"
  }
}
```

## Jest Configuration

### Unit Tests (`jest.config.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.dto.ts",
    "!**/*.entity.ts",
    "!**/*.port.ts",
    "!**/*.error.ts",
    "!**/main.ts",
    "!**/*.module.ts",
    "!**/*.controller.ts",
    "!**/*.filter.ts",
    "!**/*.decorator.ts",
    "!**/config/**"
  ],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^~/(.*)$": "<rootDir>/$1"
  },
  "coverageThreshold": {
    "global": {
      "lines": 80,
      "branches": 75,
      "functions": 80,
      "statements": 80
    }
  }
}
```

### Component Tests (`test/jest-component.json`)

```json
{
  "rootDir": "..",
  "testRegex": "test/component/.*\\.component\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/main.ts"
  ],
  "coverageDirectory": "coverage-component",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^~/(.*)$": "<rootDir>/src/$1"
  },
  "testTimeout": 30000
}
```

### Integration Tests (`test/jest-integration.json`)

```json
{
  "rootDir": "..",
  "testRegex": "test/integration/.*\\.integration\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "coverageDirectory": "coverage-integration",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^~/(.*)$": "<rootDir>/src/$1"
  },
  "testTimeout": 60000
}
```

## ECP & BVA Quick Reference

### Equivalence Class Partitioning (ECP)

Group inputs into classes that should behave similarly:

- **Valid classes**: Admin user, Regular user, Valid data format
- **Invalid classes**: No auth, Wrong role, Malformed data, Duplicates

### Boundary Value Analysis (BVA)

Test at the edges where behavior changes:

- **Lower boundary**: Minimum valid value, just below minimum (invalid)
- **Upper boundary**: Maximum valid value, just above maximum (invalid)
- **Special values**: Zero, negative, null, empty string

## Example Test Coverage Goals

| Test Type   | Target Coverage | What It Tests                          |
| ----------- | --------------- | -------------------------------------- |
| Unit        | 100%            | Business logic, repositories, guards   |
| Component   | 90%+            | HTTP flow, controllers, filters, pipes |
| Integration | Decision table  | Database integration, constraints      |

## Common Pitfalls to Avoid

- [ ] Not testing error scenarios
- [ ] Skipping boundary value tests
- [ ] Testing implementation details
- [ ] Writing tests just for coverage numbers
- [ ] Hardcoding test data (use fixtures)
- [ ] Not cleaning up test state
- [ ] Tests that depend on execution order
- [ ] Overly complex test setup

## Final Verification

Before marking testing complete:

- [ ] All scripts run successfully
- [ ] Coverage reports meet thresholds
- [ ] No skipped or pending tests
- [ ] Tests are deterministic (pass consistently)
- [ ] CI/CD pipeline passes
- [ ] Documentation updated with testing info

## Resources

- Root CLAUDE.md: Testing Implementation Patterns section
- Service CLAUDE.md: Service-specific testing examples
- Existing test files: Use as reference for patterns
- Jest documentation: https://jestjs.io/
- Testcontainers documentation: https://testcontainers.com/

---

**Remember**: Tests are documentation. Write tests that clearly show how the system should behave and serve as examples for other developers.
