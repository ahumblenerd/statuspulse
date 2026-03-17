import { describe, it, expect, beforeEach, vi } from "vitest";

const mockConfig = (overrides: Record<string, unknown> = {}) => ({
  AUTH_MODE: "none",
  API_KEY: "changeme",
  DATABASE_PATH: ":memory:",
  RESTATE_ADMIN_URL: "http://localhost:9070",
  RESTATE_INGRESS_URL: "http://localhost:8080",
  API_PORT: 3000,
  MCP_PORT: 3001,
  RESTATE_PORT: 9080,
  WEBHOOK_SECRET: "test-secret",
  DEFAULT_POLL_INTERVAL_SECONDS: 120,
  ...overrides,
});

async function setupWithConfig(overrides: Record<string, unknown> = {}) {
  vi.doMock("../../lib/config.js", () => ({
    config: mockConfig(overrides),
  }));
  const { createTestDb } = await import("../db.js");
  createTestDb();
  const { createApp } = await import("../../api/server.js");
  return createApp();
}

describe("auth middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("passes all requests when AUTH_MODE=none", async () => {
    const app = await setupWithConfig();

    const res = await app.request("/api/services");
    expect(res.status).toBe(200);
  });

  it("allows health check without auth regardless of mode", async () => {
    const app = await setupWithConfig();

    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  it("rejects requests without API key when AUTH_MODE=api-key", async () => {
    const app = await setupWithConfig({ AUTH_MODE: "api-key", API_KEY: "test-secret-key" });

    const res = await app.request("/api/services");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("accepts requests with valid API key header", async () => {
    const app = await setupWithConfig({ AUTH_MODE: "api-key", API_KEY: "test-secret-key" });

    const res = await app.request("/api/services", {
      headers: { "X-API-Key": "test-secret-key" },
    });
    expect(res.status).toBe(200);
  });

  it("rejects requests without bearer token when AUTH_MODE=bearer", async () => {
    const app = await setupWithConfig({ AUTH_MODE: "bearer", API_KEY: "test-bearer-token" });

    const res = await app.request("/api/services");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid bearer token");
  });

  it("accepts requests with valid bearer token", async () => {
    const app = await setupWithConfig({ AUTH_MODE: "bearer", API_KEY: "test-bearer-token" });

    const res = await app.request("/api/services", {
      headers: { Authorization: "Bearer test-bearer-token" },
    });
    expect(res.status).toBe(200);
  });
});
