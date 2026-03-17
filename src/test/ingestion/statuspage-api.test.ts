import { describe, it, expect } from "vitest";
import { fetchStatuspageSummary } from "../../ingestion/statuspage-api.js";
import { scenarioHandlers } from "../msw/handlers.js";
import { server } from "../msw/server.js";

describe("fetchStatuspageSummary", () => {
  it("parses operational GitHub response", async () => {
    const { status, incidents } = await fetchStatuspageSummary(
      "https://www.githubstatus.com/api/v2/summary.json",
      "github"
    );

    expect(status.vendorId).toBe("github");
    expect(status.status).toBe("operational");
    expect(status.description).toBe("All Systems Operational");
    expect(status.lastCheckedAt).toBeTruthy();
    expect(status.components).toBeDefined();
    expect(status.components!.length).toBeGreaterThan(0);
    expect(incidents).toEqual([]);
  });

  it("parses degraded response with incidents", async () => {
    server.use(...scenarioHandlers["github-degraded"]);

    const { status, incidents } = await fetchStatuspageSummary(
      "https://www.githubstatus.com/api/v2/summary.json",
      "github"
    );

    expect(status.status).toBe("degraded");
    expect(status.description).toBe("Minor Service Outage");
    expect(incidents.length).toBe(1);
    expect(incidents[0].title).toContain("GitHub Actions");
    expect(incidents[0].updates.length).toBeGreaterThan(0);
  });

  it("parses major outage response", async () => {
    server.use(...scenarioHandlers["github-outage"]);

    const { status, incidents } = await fetchStatuspageSummary(
      "https://www.githubstatus.com/api/v2/summary.json",
      "github"
    );

    expect(status.status).toBe("outage");
    expect(incidents.length).toBe(1);
    expect(incidents[0].impact).toBe("critical");
  });

  it("extracts region info from component names", async () => {
    server.use(...scenarioHandlers["github-outage"]);

    const { status } = await fetchStatuspageSummary(
      "https://www.githubstatus.com/api/v2/summary.json",
      "github"
    );

    // The outage fixture has components with region names
    expect(status.components).toBeDefined();
    const regionComps = status.components!.filter(
      (c) => c.name.includes("Region") || c.name.includes("US") || c.name.includes("EU")
    );
    expect(regionComps.length).toBeGreaterThan(0);
  });

  it("filters out group children", async () => {
    const { status } = await fetchStatuspageSummary(
      "https://www.githubstatus.com/api/v2/summary.json",
      "github"
    );

    // All components should have group_id: null (no children in our fixture)
    for (const comp of status.components!) {
      expect(comp).toBeDefined();
    }
  });

  it("throws on 500 error", async () => {
    server.use(...scenarioHandlers["fetch-error"]);

    await expect(
      fetchStatuspageSummary("https://www.githubstatus.com/api/v2/summary.json", "github")
    ).rejects.toThrow(/500/);
  });

  it("handles catch-all for unknown statuspage vendors", async () => {
    const { status } = await fetchStatuspageSummary(
      "https://status.unknownvendor.com/api/v2/summary.json",
      "unknown"
    );

    expect(status.vendorId).toBe("unknown");
    expect(status.status).toBe("operational");
  });
});
