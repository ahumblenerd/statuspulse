import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { plugins, services } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("plugins API", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  it("POST registers a new plugin and creates service entry", async () => {
    const app = createApp();
    const res = await app.request("/api/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "internal-api",
        name: "Internal API",
        type: "custom-api",
        category: "custom",
        config: {
          url: "https://internal.example.com/health",
          statusPath: "status.overall",
          statusMapping: { healthy: "operational", down: "outage" },
          region: "us-east",
        },
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBe("internal-api");

    // Verify plugin was created
    const pluginRows = db.select().from(plugins).all();
    expect(pluginRows).toHaveLength(1);
    expect(pluginRows[0].name).toBe("Internal API");

    // Verify service entry was created
    const serviceRows = db.select().from(services).all();
    expect(serviceRows).toHaveLength(1);
    expect(serviceRows[0].region).toBe("us-east");
    expect(serviceRows[0].category).toBe("custom");
  });

  it("GET lists plugins with parsed config", async () => {
    db.insert(plugins)
      .values({
        id: "p1",
        name: "Plugin 1",
        type: "custom-api",
        config: JSON.stringify({ url: "https://example.com" }),
        enabled: true,
      })
      .run();

    const app = createApp();
    const res = await app.request("/api/plugins");
    const json = await res.json();

    expect(json.plugins).toHaveLength(1);
    expect(json.plugins[0].config.url).toBe("https://example.com");
  });

  it("DELETE removes plugin and service", async () => {
    db.insert(plugins)
      .values({
        id: "p1",
        name: "P1",
        type: "custom-api",
        config: "{}",
        enabled: true,
      })
      .run();
    db.insert(services)
      .values({
        id: "p1",
        vendorId: "p1",
        name: "P1",
        category: "custom",
      })
      .run();

    const app = createApp();
    const res = await app.request("/api/plugins/p1", { method: "DELETE" });
    expect(res.status).toBe(200);

    expect(db.select().from(plugins).all()).toHaveLength(0);
    expect(db.select().from(services).all()).toHaveLength(0);
  });
});
