import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../api/server.js";
import type { AppDatabase } from "../../db/client.js";
import { alertTargets } from "../../db/schema.js";
import { createTestDb } from "../db.js";

describe("alert-targets API", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  it("POST creates a new alert target", async () => {
    const app = createApp();
    const res = await app.request("/api/alert-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "slack",
        name: "Eng Channel",
        url: "https://hooks.slack.com/services/xxx",
        filterRegion: "us-east",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeTruthy();
  });

  it("GET lists all targets", async () => {
    db.insert(alertTargets)
      .values([
        { id: "t1", type: "slack", name: "Slack", url: "https://hooks.slack.com/1", enabled: true },
        { id: "t2", type: "webhook", name: "PD", url: "https://pd.example.com", enabled: false },
      ])
      .run();

    const app = createApp();
    const res = await app.request("/api/alert-targets");
    const json = await res.json();

    expect(json.targets).toHaveLength(2);
  });

  it("DELETE removes a target", async () => {
    db.insert(alertTargets)
      .values({
        id: "t1",
        type: "slack",
        name: "Slack",
        url: "https://hooks.slack.com/1",
        enabled: true,
      })
      .run();

    const app = createApp();
    const res = await app.request("/api/alert-targets/t1", { method: "DELETE" });
    expect(res.status).toBe(200);

    const list = await (await app.request("/api/alert-targets")).json();
    expect(list.targets).toHaveLength(0);
  });
});
