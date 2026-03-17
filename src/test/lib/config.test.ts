import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses default values when env vars are not set", async () => {
    // Clear all StatusPulse-related env vars
    delete process.env.DATABASE_PATH;
    delete process.env.API_PORT;
    delete process.env.AUTH_MODE;

    const { config } = await import("../../lib/config.js");
    expect(config.DATABASE_PATH).toBe("./data/statuspulse.db");
    expect(config.API_PORT).toBe(3001);
    expect(config.MCP_PORT).toBe(3002);
    expect(config.RESTATE_PORT).toBe(9080);
    expect(config.AUTH_MODE).toBe("none");
    expect(config.DEFAULT_POLL_INTERVAL_SECONDS).toBe(120);
  });

  it("reads values from environment", async () => {
    process.env.API_PORT = "4000";
    process.env.AUTH_MODE = "api-key";
    process.env.API_KEY = "test-secret";
    process.env.DATABASE_PATH = "/tmp/test.db";

    const { config } = await import("../../lib/config.js");
    expect(config.API_PORT).toBe(4000);
    expect(config.AUTH_MODE).toBe("api-key");
    expect(config.API_KEY).toBe("test-secret");
    expect(config.DATABASE_PATH).toBe("/tmp/test.db");
  });

  it("coerces numeric strings", async () => {
    process.env.API_PORT = "8080";
    process.env.DEFAULT_POLL_INTERVAL_SECONDS = "60";

    const { config } = await import("../../lib/config.js");
    expect(config.API_PORT).toBe(8080);
    expect(config.DEFAULT_POLL_INTERVAL_SECONDS).toBe(60);
  });

  it("accepts valid auth modes", async () => {
    for (const mode of ["none", "api-key", "bearer"]) {
      vi.resetModules();
      process.env.AUTH_MODE = mode;
      const { config } = await import("../../lib/config.js");
      expect(config.AUTH_MODE).toBe(mode);
    }
  });

  it("rejects invalid auth mode", async () => {
    process.env.AUTH_MODE = "invalid-mode";

    await expect(import("../../lib/config.js")).rejects.toThrow();
  });
});
