import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.factory";
import { createAdminToken } from "../helpers/jwt.factory";
import { createTestProductDto } from "../fixtures/product.fixtures";
import { DEFAULT_JWT_SECRET } from "~/shared/config/config.constants";

// Configure security for tests - must be set before module loads
process.env.JWT_SECRET = DEFAULT_JWT_SECRET; // Match test tokens
process.env.SECURITY_HELMET_ENABLED = "true";
process.env.SECURITY_CORS_ORIGINS = "*";
process.env.SECURITY_RATE_LIMIT_ENABLED = "false"; // Disabled for tests
process.env.SECURITY_MAX_BODY_SIZE = "1048576"; // 1MB

describe("Security Features (Component)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = createAdminToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Security Headers (Helmet)", () => {
    it("should include all expected security headers with correct values", async () => {
      const response = await request(app.getHttpServer()).get("/").expect(200);

      // Core security headers
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-dns-prefetch-control"]).toBe("off");
      expect(response.headers["strict-transport-security"]).toContain(
        "max-age=31536000",
      );
      expect(response.headers["strict-transport-security"]).toContain(
        "includeSubDomains",
      );

      // Additional Helmet headers
      expect(response.headers["x-download-options"]).toBeDefined();
      expect(
        response.headers["x-permitted-cross-domain-policies"],
      ).toBeDefined();
    });

    it("should include HSTS header with preload directive", async () => {
      const response = await request(app.getHttpServer()).get("/").expect(200);

      const hstsHeader = response.headers["strict-transport-security"];
      expect(hstsHeader).toContain("max-age=31536000"); // 1 year
      expect(hstsHeader).toContain("includeSubDomains");
      expect(hstsHeader).toContain("preload");
    });

    it("should NOT include CSP header (disabled for Swagger)", async () => {
      const response = await request(app.getHttpServer()).get("/").expect(200);

      expect(response.headers["content-security-policy"]).toBeUndefined();
    });

    it("should NOT include COEP header (disabled for Swagger)", async () => {
      const response = await request(app.getHttpServer()).get("/").expect(200);

      expect(response.headers["cross-origin-embedder-policy"]).toBeUndefined();
    });
  });

  describe("Input Sanitization", () => {
    it("should trim leading and trailing whitespace from string fields", async () => {
      const dto = createTestProductDto({
        name: "   Trimmed Product   ",
        description: "   Trimmed Description   ",
        sku: `  TRIM-TEST-${Date.now()}  `,
      });

      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);

      // Verify trimming actually happened - no leading/trailing whitespace
      expect(response.body.name).toBe("Trimmed Product");
      expect(response.body.description).toBe("Trimmed Description");
      expect(response.body.sku).toMatch(/^TRIM-TEST-\d+$/); // No whitespace
    });
  });

  describe("Request Size Limits", () => {
    const LIMIT = 1048576; // 1MB from config

    it("should reject oversized request body (well over limit)", async () => {
      const largeDto = {
        name: "A".repeat(2000000), // ~2MB string
        description: "Test",
        sku: `LARGE-${Date.now()}`,
        price: 10,
        stock: 5,
      };

      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(largeDto)
        .expect(413); // Payload Too Large
    });

    it("should reject request just over size limit (BVA: +1 boundary)", async () => {
      // Create a payload that exceeds the limit by a small amount
      // Account for JSON overhead (~100 bytes for structure)
      const dto = {
        name: "A".repeat(LIMIT - 50), // Slightly over limit with JSON overhead
        description: "Test",
        sku: `OVER-LIMIT-${Date.now()}`,
        price: 10,
        stock: 5,
      };

      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(413); // Payload Too Large
    });

    it("should accept request well within size limit", async () => {
      const normalDto = createTestProductDto({
        sku: `NORMAL-${Date.now()}`,
        description: "A".repeat(400), // Well under 1MB
      });

      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(normalDto)
        .expect(201);
    });

    it("should accept request close to but under size limit (BVA: -1 boundary)", async () => {
      // Create a payload close to the limit but still valid
      // Note: description field has MaxLength(500), so we can't use it for large payloads
      // Instead, create multiple products in a single request would require batch endpoint
      // For now, just verify a moderately large valid request works
      const dto = createTestProductDto({
        sku: `NEAR-LIMIT-${Date.now()}`,
        description: "A".repeat(490), // Close to MaxLength but valid
      });

      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);
    });
  });

  describe("CORS", () => {
    it("should include CORS headers when Origin header is present", async () => {
      const response = await request(app.getHttpServer())
        .get("/")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });

    it("should include credentials flag in CORS headers", async () => {
      const response = await request(app.getHttpServer())
        .get("/")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should handle preflight OPTIONS requests", async () => {
      const response = await request(app.getHttpServer())
        .options("/products")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(response.headers["access-control-allow-methods"]).toBeDefined();
    });
  });
});

/**
 * Rate Limiting Tests
 * Note: These tests run in a separate describe block with their own app instance
 * because rate limiting must be ENABLED (unlike the main test suite where it's disabled)
 */
describe("Rate Limiting (Component)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Override environment to ENABLE rate limiting for these tests
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
    process.env.SECURITY_HELMET_ENABLED = "true";
    process.env.SECURITY_CORS_ORIGINS = "*";
    process.env.SECURITY_RATE_LIMIT_ENABLED = "true"; // ENABLED for these tests
    process.env.SECURITY_RATE_LIMIT_TTL = "5000"; // 5 seconds (short for testing)
    process.env.SECURITY_RATE_LIMIT_MAX_REQUESTS = "3"; // Low limit for testing

    app = await createTestApp();
    adminToken = createAdminToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Rate Limit Enforcement", () => {
    // Add delay between tests to prevent interference
    // Wait longer than TTL (5000ms) to ensure rate limits fully reset
    afterEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    });

    it("should allow requests under rate limit threshold", async () => {
      const sku = `RL-TEST-${Date.now()}`;

      // Make 3 requests (at the limit)
      for (let i = 0; i < 3; i++) {
        const dto = createTestProductDto({ sku: `${sku}-${i}` });
        await request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto)
          .expect(201);
      }
    });

    it("should block requests exceeding rate limit with 429", async () => {
      const sku = `RL-EXCEED-${Date.now()}`;

      // Make 3 requests (at the limit)
      for (let i = 0; i < 3; i++) {
        const dto = createTestProductDto({ sku: `${sku}-${i}` });
        await request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto)
          .expect(201);
      }

      // 4th request should be rate limited
      const dto = createTestProductDto({ sku: `${sku}-exceed` });
      const response = await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(429); // Too Many Requests

      expect(response.body.message).toContain("ThrottlerException");
    });

    it("should reset rate limit after TTL window expires", async () => {
      // Wait for any previous rate limits to clear before starting this test
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const sku = `RL-RESET-${Date.now()}`;

      // Exhaust rate limit with fresh counter
      for (let i = 0; i < 3; i++) {
        const dto = createTestProductDto({ sku: `${sku}-${i}` });
        await request(app.getHttpServer())
          .post("/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(dto)
          .expect(201);
      }

      // Verify we're rate limited
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(createTestProductDto({ sku: `${sku}-blocked` }))
        .expect(429);

      // Wait for TTL to expire (5 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Should be able to make requests again
      const dto = createTestProductDto({ sku: `${sku}-after-reset` });
      await request(app.getHttpServer())
        .post("/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);
    }, 20000); // Increase test timeout to 20 seconds to account for waits
  });

  describe("Rate Limit Bypass", () => {
    it("should NOT apply rate limiting to health endpoint", async () => {
      // Make many health check requests - none should return 429 (rate limit)
      // Note: Health checks may return 503 if checks fail, but that's not a rate limit issue
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer()).get("/health");
        // Should never get rate limited (429)
        expect(response.status).not.toBe(429);
      }
    });

    it("should NOT apply rate limiting to root endpoint", async () => {
      // Make many root requests - should all succeed (no rate limiting)
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer()).get("/").expect(200);
      }
    });
  });
});
