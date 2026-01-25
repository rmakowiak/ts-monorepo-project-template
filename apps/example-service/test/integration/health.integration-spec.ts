import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.factory";
import { DEFAULT_JWT_SECRET } from "~/shared/config/config.constants";

describe("Health API (Integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set JWT_SECRET to match test tokens
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;

    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return health status without authentication (public endpoint)", async () => {
      // Act - Accept both 200 (healthy) and 503 (some checks failing)
      const response = await request(app.getHttpServer()).get("/health");

      // Assert - Health endpoint should be accessible
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty("status");
      expect(response.body.status).toBeDefined();
    });

    it("should include health check details", async () => {
      // Act
      const response = await request(app.getHttpServer()).get("/health");

      // Assert - Should have info or details properties (structure may vary based on status)
      const hasHealthData =
        response.body.hasOwnProperty("info") ||
        response.body.hasOwnProperty("details") ||
        response.body.hasOwnProperty("error");
      expect(hasHealthData).toBe(true);
    });

    it("should check multiple health indicators", async () => {
      // Act
      const response = await request(app.getHttpServer()).get("/health");

      // Assert - Should have health check structure
      expect(response.body).toHaveProperty("status");
      // Either info (healthy) or error (unhealthy) should be present
      const hasIndicators =
        (response.body.info && Object.keys(response.body.info).length > 0) ||
        (response.body.details &&
          Object.keys(response.body.details).length > 0) ||
        (response.body.error && Object.keys(response.body.error).length > 0);
      expect(hasIndicators).toBe(true);
    });
  });
});
