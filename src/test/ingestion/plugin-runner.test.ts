import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { runPlugin } from "../../ingestion/plugin-runner.js";
import { server } from "../msw/server.js";

describe("runPlugin", () => {
  it("extracts status via statusPath", async () => {
    const status = await runPlugin("test-plugin", "internal-api", {
      url: "https://internal.example.com/health",
      statusPath: "status.overall",
    });

    expect(status.vendorId).toBe("internal-api");
    expect(status.status).toBe("operational"); // "healthy" normalizes to operational
    expect(status.lastCheckedAt).toBeTruthy();
  });

  it("applies custom statusMapping", async () => {
    const status = await runPlugin("test-plugin", "internal-api", {
      url: "https://internal.example.com/health",
      statusPath: "status.database",
      statusMapping: {
        healthy: "operational",
        degraded: "degraded",
        down: "outage",
      },
    });

    expect(status.status).toBe("degraded");
  });

  it("tries default paths when statusPath not set", async () => {
    server.use(
      http.get("https://internal.example.com/health", () => {
        return HttpResponse.json({ status: "ok", uptime: 99.9 });
      })
    );

    const status = await runPlugin("test-plugin", "internal-api", {
      url: "https://internal.example.com/health",
    });

    // "ok" normalizes to operational via normalizeFromText
    expect(status.status).toBe("operational");
  });

  it("returns outage on fetch failure", async () => {
    server.use(
      http.get("https://internal.example.com/health", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const status = await runPlugin("test-plugin", "internal-api", {
      url: "https://internal.example.com/health",
    });

    expect(status.status).toBe("outage");
    expect(status.description).toContain("failed");
  });

  it("sends custom headers", async () => {
    let receivedAuth = "";
    server.use(
      http.get("https://internal.example.com/health", ({ request }) => {
        receivedAuth = request.headers.get("Authorization") ?? "";
        return HttpResponse.json({ status: "ok" });
      })
    );

    await runPlugin("test-plugin", "internal-api", {
      url: "https://internal.example.com/health",
      headers: { Authorization: "Bearer my-token" },
    });

    expect(receivedAuth).toBe("Bearer my-token");
  });
});
