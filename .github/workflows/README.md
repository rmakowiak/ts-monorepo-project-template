# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the monorepo.

## ci.yml

Runs comprehensive tests on every push and pull request.

### Triggers

- **Push**: Runs on push to any branch
- **Pull Request**: Runs on PRs targeting `main`

### Jobs

#### 1. `test` Job - Unit & Component Tests with Coverage

Runs **unit** and **component** tests with coverage reports.

**Node.js Version:** 20.x

**Services:** None (tests use in-memory implementations)

**Steps:**

1. Checkout code
2. Setup pnpm (9.15.9)
3. Setup Node.js with cache
4. Install dependencies (`pnpm install --frozen-lockfile`)
5. Run linter (`pnpm lint`)
6. Run style check (`pnpm style:lint`)
7. Build packages (`pnpm build`)
8. Run unit tests with coverage (`pnpm test:cov:unit`) - Pure logic tests
9. Run component tests with coverage (`pnpm test:component:cov`) - In-process HTTP tests
10. Upload coverage reports as artifacts (30-day retention)

#### 2. `test-e2e` Job - End-to-End Tests

Runs **E2E** tests with real infrastructure to verify system integration.

**Node.js Version:** 20.x

**Services:**

- PostgreSQL 16 (port 5432) - Real database for health checks
- Redis 7 (port 6379) - Real cache for health checks

**Steps:**

1. Checkout code
2. Setup pnpm and Node.js
3. Install dependencies
4. Build packages
5. Run E2E tests (`pnpm test:e2e`) - Tests against real database and services
6. Upload E2E test results as artifacts (7-day retention)

### Environment Variables

**Unit & Component Tests:**

```yaml
NODE_ENV: test
LOG_LEVEL: fatal # Suppress logs during CI
JWT_SECRET: test-secret-at-least-32-characters-long-for-ci
# No DATABASE_URL or REDIS_URL - uses in-memory implementations
```

**E2E Tests:**

```yaml
NODE_ENV: test
LOG_LEVEL: fatal
JWT_SECRET: test-secret-at-least-32-characters-long-for-ci
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
REDIS_URL: redis://localhost:6379
```

### Artifacts

**Coverage Reports** (30 days):

- `coverage-reports` - Unit and component test coverage from Node.js 20.x

**E2E Test Results** (7 days):

- `e2e-test-results` - E2E test output with real services

### Viewing Results

1. Go to the **Actions** tab in GitHub
2. Select a workflow run
3. View job logs or download artifacts
4. Coverage reports can be found in the artifacts section

### Test Separation Strategy

This workflow follows a clean test pyramid:

```
         /\
        /E2E\        ← Few tests, real infrastructure (DB, Redis)
       /------\
      /Component\   ← Medium tests, in-process HTTP, in-memory
     /----------\
    /   Unit     \  ← Many tests, pure logic, fully mocked
   /--------------\
```

**Unit Tests** (`*.spec.ts` in `src/`):

- Pure business logic
- Fully mocked dependencies
- No external services
- Fast (milliseconds)

**Component Tests** (`*.component-spec.ts` in `test/component/`):

- Full HTTP request/response cycle
- In-memory repositories and services
- No external infrastructure
- Fast (seconds)

**E2E Tests** (`*.e2e-spec.ts` in `test/e2e/`):

- Real database connections
- Real service dependencies
- Verifies system integration
- Slower (can take minutes)

### Local Testing

To run the same tests locally:

```bash
cd apps/example-service

# Unit tests (no dependencies needed)
pnpm test:unit
pnpm test:cov:unit

# Component tests (no dependencies needed)
pnpm test:component
pnpm test:component:cov

# E2E tests (requires PostgreSQL and Redis running)
pnpm test:e2e
pnpm test:e2e:cov

# All tests
pnpm test:all

# Linting
cd ../..
pnpm lint
pnpm style:lint
```

### Adding More Workflows

When adding new workflows:

1. Create a new `.yml` file in this directory
2. Follow the existing naming convention
3. Use specific versions for actions (e.g., `@v4`)
4. Add appropriate triggers (`on:` section)
5. Set up required services in the `services:` section
6. Document the workflow in this README

### Troubleshooting

**Tests failing in CI but passing locally:**

- Check Node.js versions match
- Verify environment variables are set
- Ensure services (PostgreSQL, Redis) are healthy
- Review job logs for specific errors

**Coverage thresholds not met:**

- Review coverage reports in artifacts
- Check `coverageThreshold` in `jest.config.js`
- Add tests for uncovered code paths

**Dependency installation fails:**

- Verify `pnpm-lock.yaml` is committed
- Check for version conflicts in dependencies
- Try running `pnpm install --frozen-lockfile` locally
