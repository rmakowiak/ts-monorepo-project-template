#!/usr/bin/env ts-node

/**
 * Traffic Simulator for Example Service
 *
 * Simulates realistic user traffic patterns to generate observability data:
 * - Mix of read/write operations (80% reads, 20% writes)
 * - Varying response times
 * - Some error cases (404s, validation errors)
 * - Natural timing variation
 *
 * Usage:
 *   pnpm simulate:traffic
 *
 * Options:
 *   --duration <minutes>  How long to run (default: 5)
 *   --rate <rps>          Requests per second (default: 5)
 *   --base-url <url>      Service URL (default: reads PORT from .env)
 */

import { config as loadEnv } from "dotenv";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";

// Load .env file to get PORT
loadEnv();

/**
 * Product response type
 */
interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate admin JWT token for authenticated requests
 */
function generateAdminToken(): string {
  const secret =
    process.env.JWT_SECRET ||
    "dev-secret-change-in-production-at-least-32-chars";

  return jwt.sign(
    {
      sub: "simulator-admin",
      email: "simulator@example.com",
      name: "Traffic Simulator",
      roles: ["admin", "user"],
    },
    secret,
    { expiresIn: "1h" },
  );
}

// Configuration
const config = {
  baseUrl:
    process.env.BASE_URL || `http://localhost:${process.env.PORT || "8000"}`,
  duration: parseInt(process.env.DURATION || "5", 10), // minutes
  requestsPerSecond: parseInt(process.env.RATE || "5", 10),
  adminToken: generateAdminToken(),
};

// Product data for creating test products
const PRODUCT_TEMPLATES = [
  {
    name: "Wireless Mouse",
    category: "Electronics",
    price: 29.99,
    stock: 100,
    description: "Ergonomic wireless mouse with 2.4GHz connection",
  },
  {
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: 89.99,
    stock: 50,
    description: "RGB mechanical gaming keyboard with blue switches",
  },
  {
    name: "USB-C Cable",
    category: "Accessories",
    price: 12.99,
    stock: 200,
    description: "6ft braided USB-C to USB-C cable",
  },
  {
    name: "Laptop Stand",
    category: "Accessories",
    price: 39.99,
    stock: 75,
    description: "Aluminum adjustable laptop stand",
  },
  {
    name: "Webcam",
    category: "Electronics",
    price: 79.99,
    stock: 30,
    description: "1080p HD webcam with auto-focus",
  },
  {
    name: "Desk Lamp",
    category: "Office",
    price: 34.99,
    stock: 60,
    description: "LED desk lamp with adjustable brightness",
  },
  {
    name: "Phone Holder",
    category: "Accessories",
    price: 15.99,
    stock: 150,
    description: "Universal phone holder for desk",
  },
  {
    name: "Bluetooth Speaker",
    category: "Electronics",
    price: 49.99,
    stock: 80,
    description: "Portable waterproof Bluetooth speaker",
  },
];

// Track created products for read/update/delete operations
const createdProducts: string[] = [];

// Statistics
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  byEndpoint: {} as Record<string, { success: number; errors: number }>,
  byStatus: {} as Record<number, number>,
};

/**
 * Sleep for a random duration (adds natural variation)
 */
function sleep(ms: number): Promise<void> {
  const jitter = ms * 0.3; // +/- 30% variation
  const actual = ms + (Math.random() * jitter * 2 - jitter);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/**
 * Log with timestamp
 */
function log(message: string, data?: any) {
  const timestamp = new Date().toISOString().substring(11, 19);
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Make HTTP request and track stats
 */
async function makeRequest(
  endpoint: string,
  method: string,
  body?: any,
  useAuth = false,
): Promise<Response> {
  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (useAuth && config.adminToken) {
    headers["Authorization"] = `Bearer ${config.adminToken}`;
  }

  stats.total++;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    const key = `${method} ${endpoint}`;

    // Track stats
    if (!stats.byEndpoint[key]) {
      stats.byEndpoint[key] = { success: 0, errors: 0 };
    }

    stats.byStatus[response.status] =
      (stats.byStatus[response.status] || 0) + 1;

    if (response.ok) {
      stats.success++;
      stats.byEndpoint[key].success++;
      log(
        `✓ ${method} ${endpoint} - ${response.status} (${duration}ms)`,
        response.status >= 200 && response.status < 300
          ? undefined
          : { status: response.status },
      );
    } else {
      stats.errors++;
      stats.byEndpoint[key].errors++;
      log(`✗ ${method} ${endpoint} - ${response.status} (${duration}ms)`, {
        status: response.status,
      });
    }

    return response;
  } catch (error) {
    stats.errors++;
    log(`✗ ${method} ${endpoint} - ERROR`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Traffic patterns - simulate realistic user behavior
 */

async function healthCheck() {
  await makeRequest("/health", "GET");
}

async function getRootEndpoint() {
  await makeRequest("/", "GET");
}

async function listProducts() {
  const response = await makeRequest("/products", "GET");
  return response;
}

async function getProduct(id: string) {
  await makeRequest(`/products/${id}`, "GET");
}

async function getRandomProduct() {
  if (createdProducts.length === 0) return;
  const randomId =
    createdProducts[Math.floor(Math.random() * createdProducts.length)];
  await getProduct(randomId);
}

async function getNonExistentProduct() {
  const fakeId = randomUUID();
  await makeRequest(`/products/${fakeId}`, "GET");
}

async function createProduct() {
  const template =
    PRODUCT_TEMPLATES[Math.floor(Math.random() * PRODUCT_TEMPLATES.length)];
  const sku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const product = {
    ...template,
    sku,
  };

  const response = await makeRequest("/products", "POST", product, true);

  if (response.ok) {
    const data = (await response.json()) as ProductResponse;
    if (data.id) {
      createdProducts.push(data.id);
      log(`  → Created product: ${data.name} (${data.id})`);
    }
  }
}

async function updateProduct() {
  if (createdProducts.length === 0) return;

  const randomId =
    createdProducts[Math.floor(Math.random() * createdProducts.length)];
  const updates = {
    price: Math.floor(Math.random() * 100) + 10,
    stock: Math.floor(Math.random() * 200),
  };

  await makeRequest(`/products/${randomId}`, "PATCH", updates, true);
}

async function deleteProduct() {
  if (createdProducts.length === 0) return;

  const randomIndex = Math.floor(Math.random() * createdProducts.length);
  const productId = createdProducts[randomIndex];

  const response = await makeRequest(
    `/products/${productId}`,
    "DELETE",
    undefined,
    true,
  );

  if (response.ok) {
    createdProducts.splice(randomIndex, 1);
    log(`  → Deleted product: ${productId}`);
  }
}

async function createProductWithoutAuth() {
  const template =
    PRODUCT_TEMPLATES[Math.floor(Math.random() * PRODUCT_TEMPLATES.length)];
  const sku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await makeRequest("/products", "POST", { ...template, sku }, false);
}

async function createInvalidProduct() {
  const invalidProduct = {
    name: "Test",
    // Missing required fields
    price: -10, // Invalid price
  };

  await makeRequest("/products", "POST", invalidProduct, true);
}

/**
 * Traffic patterns with weights (realistic distribution)
 */
const trafficPatterns = [
  // Reads (70% of traffic)
  { fn: listProducts, weight: 25, name: "List Products" },
  { fn: getRandomProduct, weight: 20, name: "Get Product" },
  { fn: getRootEndpoint, weight: 15, name: "Root Endpoint" },
  { fn: healthCheck, weight: 10, name: "Health Check" },

  // Writes (25% of traffic)
  { fn: createProduct, weight: 10, name: "Create Product" },
  { fn: updateProduct, weight: 8, name: "Update Product" },
  { fn: deleteProduct, weight: 7, name: "Delete Product" },

  // Errors (5% of traffic)
  {
    fn: getNonExistentProduct,
    weight: 2,
    name: "Get Non-existent Product (404)",
  },
  {
    fn: createProductWithoutAuth,
    weight: 2,
    name: "Create without Auth (403)",
  },
  { fn: createInvalidProduct, weight: 1, name: "Create Invalid Product (400)" },
];

/**
 * Select random traffic pattern based on weights
 */
function selectRandomPattern() {
  const totalWeight = trafficPatterns.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const pattern of trafficPatterns) {
    random -= pattern.weight;
    if (random <= 0) {
      return pattern;
    }
  }

  return trafficPatterns[0];
}

/**
 * Main simulation loop
 */
async function runSimulation() {
  console.log("\n🚀 Traffic Simulator Starting...\n");
  console.log(`Configuration:`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Duration: ${config.duration} minutes`);
  console.log(`  Rate: ${config.requestsPerSecond} requests/second`);
  console.log(`  Auth: Admin token generated`);
  console.log("");

  const endTime = Date.now() + config.duration * 60 * 1000;
  const delayBetweenRequests = 1000 / config.requestsPerSecond;

  // Create some initial products
  log("Creating initial products...");
  for (let i = 0; i < 5; i++) {
    await createProduct();
    await sleep(200);
  }
  console.log("");

  log("Starting traffic simulation...\n");

  while (Date.now() < endTime) {
    const pattern = selectRandomPattern();

    try {
      await pattern.fn();
    } catch (error) {
      // Already logged in makeRequest
    }

    // Natural delay between requests
    await sleep(delayBetweenRequests);
  }

  // Print final statistics
  console.log("\n\n📊 Simulation Complete!\n");
  console.log("Statistics:");
  console.log(`  Total Requests: ${stats.total}`);
  console.log(
    `  Successful: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Errors: ${stats.errors} (${((stats.errors / stats.total) * 100).toFixed(1)}%)`,
  );
  console.log("");

  console.log("By Status Code:");
  Object.entries(stats.byStatus)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([status, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      console.log(`  ${status}: ${count} (${percentage}%)`);
    });
  console.log("");

  console.log("By Endpoint:");
  Object.entries(stats.byEndpoint)
    .sort(([, a], [, b]) => b.success + b.errors - (a.success + a.errors))
    .forEach(([endpoint, data]) => {
      const total = data.success + data.errors;
      const successRate = ((data.success / total) * 100).toFixed(1);
      console.log(`  ${endpoint}:`);
      console.log(
        `    Total: ${total}, Success: ${data.success} (${successRate}%)`,
      );
    });
  console.log("");

  console.log("🔗 View Results:");
  console.log(`  Grafana Dashboard: http://localhost:3000`);
  console.log(`  Jaeger Traces: http://localhost:16686`);
  console.log(`  Prometheus Metrics: http://localhost:9090`);
  console.log("");
}

// Run simulation
runSimulation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
