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

describe("POST /api/upload/detect", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("detects vendors from base64 image", async () => {
    const app = await setupWithConfig({ ANTHROPIC_API_KEY: "test-key" });

    // A minimal 1x1 PNG as base64
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await app.request("/api/upload/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: tinyPng, mediaType: "image/png" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.vendors).toBeDefined();
    expect(json.vendors.length).toBeGreaterThan(0);
    expect(json.vendors[0]).toHaveProperty("name");
    expect(json.vendors[0]).toHaveProperty("matchedVendorId");
  });

  it("returns error when ANTHROPIC_API_KEY is not set", async () => {
    const app = await setupWithConfig({ ANTHROPIC_API_KEY: undefined });

    const res = await app.request("/api/upload/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "base64data", mediaType: "image/png" }),
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("ANTHROPIC_API_KEY");
  });
});
